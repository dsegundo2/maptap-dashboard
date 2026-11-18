import { compactHistory, dateKey, enrichDashboard, globalStanding } from './stats.js';
import { resolveGroup } from './groups.js';

const PROFILE_ENDPOINT = 'https://us-central1-jjexperiment-12af6.cloudfunctions.net/getPublicProfile';
const LEADERBOARD_ROOT = 'https://firebasestorage.googleapis.com/v0/b/jjexperiment-12af6.appspot.com/o/data%2Fleaderboards%2F';
const CACHE_KEY = 'maptap-dashboard-cache-v6';
const CACHE_TTL = 5 * 60 * 1000;
const PROFILE_CONCURRENCY = 3;
const PROFILE_STAGGER_MS = 250;

function asset(path) {
  return `${import.meta.env.BASE_URL}${path}`;
}

async function jsonFetch(url, options = {}) {
  // These files are regenerated on every Pages refresh. Never let a browser
  // keep an old roster, score snapshot, or location archive after a deploy.
  const response = await fetch(url, { cache: 'no-store', ...options, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

async function profileFor(user) {
  const payload = await jsonFetch(PROFILE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { nickname: user.maptapUsername } })
  });
  const result = payload.result;
  if (!result?.success || !result.user || result.user.leaderboardVisible === false) throw new Error(`No public profile for ${user.maptapUsername}`);
  return { config: user, profile: result.user };
}

async function profilesFor(users) {
  const profiles = new Array(users.length);
  let nextIndex = 0;
  const worker = async (workerIndex) => {
    if (workerIndex) await new Promise((resolve) => setTimeout(resolve, workerIndex * PROFILE_STAGGER_MS));
    while (nextIndex < users.length) {
      const index = nextIndex;
      nextIndex += 1;
      const user = users[index];
      try {
        profiles[index] = await profileFor(user);
      } catch (error) {
        console.warn(`Public MapTap profile unavailable for ${user.maptapUsername}; keeping the configured player visible.`, error);
        profiles[index] = { config: user, profile: null };
      }
      if (nextIndex < users.length) await new Promise((resolve) => setTimeout(resolve, PROFILE_STAGGER_MS));
    }
  };
  await Promise.all(Array.from({ length: Math.min(PROFILE_CONCURRENCY, users.length) }, (_, index) => worker(index)));
  return profiles;
}

export async function fetchLiveDashboard(groupId) {
  const [groupRegistry, config, locationArchive] = await Promise.all([
    jsonFetch(asset('data/groups.json')),
    jsonFetch(asset('data/config.json')),
    jsonFetch(asset('data/locations.json')).catch(() => ({ dates: {} }))
  ]);
  const group = resolveGroup(groupRegistry, groupId);
  const users = group.players;
  const today = dateKey(new Date(), config.timezone);
  const leaderboardUrl = `${LEADERBOARD_ROOT}daily-${today}.json?alt=media&v=${Date.now()}`;
  const leaderboardPromise = jsonFetch(leaderboardUrl).then((value) => value.leaderboard);
  const profiles = await profilesFor(users);
  const leaderboard = await leaderboardPromise;
  const players = profiles.map(({ config: user, profile }, index) => {
    if (!profile) {
      return {
        id: `configured:${user.maptapUsername}`,
        maptapUsername: user.maptapUsername,
        displayName: user.displayName || user.maptapUsername,
        score: null,
        playedToday: false,
        globalRank: null,
        globalPercentile: null,
        displayOrder: index,
        excludedFromChatWins: user.excludedFromChatWins === true,
        history: []
      };
    }
    const history = compactHistory(profile.gameHistory);
    const score = history.find((game) => game.date === today)?.score ?? null;
    const exact = leaderboard.players?.find((entry) => entry.odyseedId === profile.userId);
    const standing = exact ? { rank: exact.rank, percentile: ((leaderboard.totalPlayers - exact.rank) / leaderboard.totalPlayers) * 100 } : globalStanding(score, leaderboard);
    return {
      id: profile.userId,
      maptapUsername: user.maptapUsername,
      displayName: user.displayName || profile.nickname,
      score,
      playedToday: Number.isFinite(score) && score > 0,
      globalRank: standing.rank,
      globalPercentile: standing.percentile,
      displayOrder: index,
      excludedFromChatWins: user.excludedFromChatWins === true,
      history
    };
  });
  return enrichDashboard({ generatedAt: new Date().toISOString(), date: today, globalPlayers: leaderboard.totalPlayers, players, locationsByDate: locationArchive.dates || {}, groupId: group.id, groupName: group.name }, config.competitionWindowDays);
}

export async function fetchStaticDashboard(groupId) {
  const [data, config, groupRegistry, locationArchive] = await Promise.all([
    jsonFetch(asset('data/scores.json')),
    jsonFetch(asset('data/config.json')),
    jsonFetch(asset('data/groups.json')),
    jsonFetch(asset('data/locations.json')).catch(() => ({ dates: {} }))
  ]);
  const group = resolveGroup(groupRegistry, groupId);
  const configuredPlayers = group.players;
  const sourcePlayers = data.groups?.[group.id]?.players || (group.id === groupRegistry.defaultGroup ? data.players : []);
  const playersByUsername = new Map(sourcePlayers.map((player) => [player.maptapUsername, player]));
  const players = configuredPlayers.map((configuredPlayer, displayOrder) => {
    const player = playersByUsername.get(configuredPlayer.maptapUsername);
    return player
      ? { ...player, displayName: configuredPlayer.displayName, displayOrder, excludedFromChatWins: configuredPlayer.excludedFromChatWins === true }
      : {
          id: `configured:${configuredPlayer.maptapUsername}`,
          maptapUsername: configuredPlayer.maptapUsername,
          displayName: configuredPlayer.displayName,
          score: null,
          playedToday: false,
          globalRank: null,
          globalPercentile: null,
          displayOrder,
          excludedFromChatWins: configuredPlayer.excludedFromChatWins === true,
          history: []
        };
  });
  return { ...enrichDashboard({ ...data, players, locationsByDate: locationArchive.dates || {}, groupId: group.id, groupName: group.name }, config.competitionWindowDays), configuredPlayers };
}

export async function fetchStandingsForDate(date, players) {
  try {
    const payload = await jsonFetch(`${LEADERBOARD_ROOT}daily-${date}.json?alt=media&v=${Date.now()}`);
    const leaderboard = payload.leaderboard;
    return Object.fromEntries(players.map((player) => {
      if (!Number.isFinite(player.score) || player.score <= 0) return [player.id, { rank: null, percentile: null }];
      const exact = leaderboard.players?.find((entry) => entry.odyseedId === player.id);
      const standing = exact
        ? { rank: exact.rank, percentile: ((leaderboard.totalPlayers - exact.rank) / leaderboard.totalPlayers) * 100 }
        : globalStanding(player.score, leaderboard);
      return [player.id, standing];
    }));
  } catch {
    return {};
  }
}

function rosterKey(players = []) {
  return players.map((player) => player.maptapUsername).filter(Boolean).toSorted().join('\n');
}

export function readCache(expectedPlayers, groupId = 'default', expectedDate) {
  try {
    const cached = JSON.parse(localStorage.getItem(`${CACHE_KEY}:${groupId}`));
    if (!cached?.savedAt || Date.now() - cached.savedAt >= CACHE_TTL) return null;
    if (expectedPlayers && rosterKey(cached.data?.players) !== rosterKey(expectedPlayers)) return null;
    if (expectedDate && cached.data?.date !== expectedDate) return null;
    return cached.data;
  } catch {
    return null;
  }
}

export function writeCache(data, groupId = data?.groupId || 'default') {
  try { localStorage.setItem(`${CACHE_KEY}:${groupId}`, JSON.stringify({ savedAt: Date.now(), data })); } catch { /* storage is optional */ }
}
