import { readFile, writeFile } from 'node:fs/promises';
import { compactHistory, dateKey, globalStanding } from '../src/lib/stats.js';
import { enabledGroups } from '../src/lib/groups.js';

const PROFILE_ENDPOINT = 'https://us-central1-jjexperiment-12af6.cloudfunctions.net/getPublicProfile';
const LEADERBOARD_ROOT = 'https://firebasestorage.googleapis.com/v0/b/jjexperiment-12af6.appspot.com/o/data%2Fleaderboards%2F';
const groupRegistry = JSON.parse(await readFile(new URL('../public/data/groups.json', import.meta.url), 'utf8'));
const groups = enabledGroups(groupRegistry);
const uniqueUsers = [...new Map(groups.flatMap((group) => group.players).map((player) => [player.maptapUsername.toLowerCase(), player])).values()];
const config = JSON.parse(await readFile(new URL('../public/data/config.json', import.meta.url), 'utf8'));
const today = dateKey(new Date(), config.timezone);

async function getJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  return response.json();
}

const leaderboardPayload = await getJson(`${LEADERBOARD_ROOT}daily-${today}.json?alt=media&v=${Date.now()}`);
const leaderboard = leaderboardPayload.leaderboard;
const profiles = new Map();

for (const [index, user] of uniqueUsers.entries()) {
  const payload = await getJson(PROFILE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { nickname: user.maptapUsername } })
  });
  const profile = payload.result?.user;
  if (!payload.result?.success || !profile || profile.leaderboardVisible === false) {
    console.warn(`Public profile unavailable; keeping configured player visible: ${user.maptapUsername}`);
    profiles.set(user.maptapUsername.toLowerCase(), null);
    if (index < uniqueUsers.length - 1) await new Promise((resolve) => setTimeout(resolve, 650));
    continue;
  }
  profiles.set(user.maptapUsername.toLowerCase(), profile);
  if (index < uniqueUsers.length - 1) await new Promise((resolve) => setTimeout(resolve, 650));
}

const groupData = Object.fromEntries(groups.map((group) => {
  const players = group.players.map((user, index) => {
    const profile = profiles.get(user.maptapUsername.toLowerCase());
    if (!profile) return {
      id: `configured:${user.maptapUsername}`,
      maptapUsername: user.maptapUsername,
      displayName: user.displayName || user.maptapUsername,
      score: null,
      playedToday: false,
      globalRank: null,
      globalPercentile: null,
      displayOrder: index,
      history: []
    };
    const history = compactHistory(profile.gameHistory);
    const score = history.find((game) => game.date === today)?.score ?? null;
    const exact = leaderboard.players?.find((entry) => entry.odyseedId === profile.userId);
    const standing = exact
      ? { rank: exact.rank, percentile: ((leaderboard.totalPlayers - exact.rank) / leaderboard.totalPlayers) * 100 }
      : globalStanding(score, leaderboard);
    return {
      id: profile.userId,
      maptapUsername: user.maptapUsername,
      displayName: user.displayName || profile.nickname,
      score,
      playedToday: Number.isFinite(score) && score > 0,
      globalRank: standing.rank,
      globalPercentile: standing.percentile,
      displayOrder: index,
      history
    };
  }).toSorted((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return [group.id, { name: group.name, players }];
}));
const defaultPlayers = groupData[groupRegistry.defaultGroup]?.players || Object.values(groupData)[0]?.players || [];
const output = { generatedAt: new Date().toISOString(), date: today, globalPlayers: leaderboard.totalPlayers, groups: groupData, players: defaultPlayers };
await writeFile(new URL('../public/data/scores.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Refreshed ${uniqueUsers.length} unique public profiles across ${groups.length} groups for ${today}.`);
