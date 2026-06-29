import { compactHistory, dateKey, enrichDashboard, globalStanding } from './stats.js';

const PROFILE_ENDPOINT = 'https://us-central1-jjexperiment-12af6.cloudfunctions.net/getPublicProfile';
const LEADERBOARD_ROOT = 'https://firebasestorage.googleapis.com/v0/b/jjexperiment-12af6.appspot.com/o/data%2Fleaderboards%2F';
const CACHE_KEY = 'maptap-dashboard-cache-v1';
const CACHE_TTL = 5 * 60 * 1000;

function asset(path) {
  return `${import.meta.env.BASE_URL}${path}`;
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

async function profileFor(user) {
  const payload = await jsonFetch(PROFILE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { nickname: user.username } })
  });
  const result = payload.result;
  if (!result?.success || !result.user || result.user.leaderboardVisible === false) throw new Error(`No public profile for ${user.username}`);
  return { config: user, profile: result.user };
}

export async function fetchLiveDashboard() {
  const [users, config] = await Promise.all([jsonFetch(asset('data/users.json')), jsonFetch(asset('data/config.json'))]);
  const today = dateKey(new Date(), config.timezone);
  const leaderboardUrl = `${LEADERBOARD_ROOT}daily-${today}.json?alt=media&v=${Date.now()}`;
  const leaderboardPromise = jsonFetch(leaderboardUrl).then((value) => value.leaderboard);
  const profiles = [];
  for (const user of users) {
    try {
      profiles.push(await profileFor(user));
    } catch (error) {
      console.warn(`Public MapTap profile unavailable for ${user.username}; keeping the configured friend visible.`, error);
      profiles.push({ config: user, profile: null });
    }
    if (users.length > 1) await new Promise((resolve) => setTimeout(resolve, 650));
  }
  const leaderboard = await leaderboardPromise;
  const players = profiles.map(({ config: user, profile }) => {
    if (!profile) {
      return {
        id: `configured:${user.username}`,
        username: user.username,
        displayName: user.displayName || user.username,
        score: null,
        playedToday: false,
        globalRank: null,
        globalPercentile: null,
        history: []
      };
    }
    const history = compactHistory(profile.gameHistory);
    const score = history.find((game) => game.date === today)?.score ?? null;
    const exact = leaderboard.players?.find((entry) => entry.odyseedId === profile.userId);
    const standing = exact ? { rank: exact.rank, percentile: ((leaderboard.totalPlayers - exact.rank) / leaderboard.totalPlayers) * 100 } : globalStanding(score, leaderboard);
    return {
      id: profile.userId,
      username: user.username,
      displayName: user.displayName || profile.nickname,
      score,
      playedToday: Number.isFinite(score),
      globalRank: standing.rank,
      globalPercentile: standing.percentile,
      history
    };
  });
  return enrichDashboard({ generatedAt: new Date().toISOString(), date: today, globalPlayers: leaderboard.totalPlayers, players }, config.competitionWindowDays);
}

export async function fetchStaticDashboard() {
  const [data, config] = await Promise.all([jsonFetch(asset('data/scores.json')), jsonFetch(asset('data/config.json'))]);
  return enrichDashboard(data, config.competitionWindowDays);
}

export function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    return cached?.savedAt && Date.now() - cached.savedAt < CACHE_TTL ? cached.data : null;
  } catch {
    return null;
  }
}

export function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data })); } catch { /* storage is optional */ }
}
