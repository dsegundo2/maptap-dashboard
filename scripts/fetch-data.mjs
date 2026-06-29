import { readFile, writeFile } from 'node:fs/promises';
import { compactHistory, dateKey, globalStanding } from '../src/lib/stats.js';

const PROFILE_ENDPOINT = 'https://us-central1-jjexperiment-12af6.cloudfunctions.net/getPublicProfile';
const LEADERBOARD_ROOT = 'https://firebasestorage.googleapis.com/v0/b/jjexperiment-12af6.appspot.com/o/data%2Fleaderboards%2F';
const users = JSON.parse(await readFile(new URL('../public/data/users.json', import.meta.url), 'utf8'));
const config = JSON.parse(await readFile(new URL('../public/data/config.json', import.meta.url), 'utf8'));
const today = dateKey(new Date(), config.timezone);

async function getJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  return response.json();
}

const leaderboardPayload = await getJson(`${LEADERBOARD_ROOT}daily-${today}.json?alt=media&v=${Date.now()}`);
const leaderboard = leaderboardPayload.leaderboard;
const players = [];

for (const [index, user] of users.entries()) {
  const payload = await getJson(PROFILE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { nickname: user.username } })
  });
  const profile = payload.result?.user;
  if (!payload.result?.success || !profile || profile.leaderboardVisible === false) {
    console.warn(`Public profile unavailable; keeping configured friend visible: ${user.username}`);
    players.push({
      id: `configured:${user.username}`,
      username: user.username,
      displayName: user.displayName || user.username,
      score: null,
      playedToday: false,
      globalRank: null,
      globalPercentile: null,
      history: []
    });
    if (index < users.length - 1) await new Promise((resolve) => setTimeout(resolve, 650));
    continue;
  }
  const history = compactHistory(profile.gameHistory);
  const score = history.find((game) => game.date === today)?.score ?? null;
  const exact = leaderboard.players?.find((entry) => entry.odyseedId === profile.userId);
  const standing = exact
    ? { rank: exact.rank, percentile: ((leaderboard.totalPlayers - exact.rank) / leaderboard.totalPlayers) * 100 }
    : globalStanding(score, leaderboard);
  players.push({
    id: profile.userId,
    username: user.username,
    displayName: user.displayName || profile.nickname,
    score,
    playedToday: Number.isFinite(score),
    globalRank: standing.rank,
    globalPercentile: standing.percentile,
    history
  });
  if (index < users.length - 1) await new Promise((resolve) => setTimeout(resolve, 650));
}

players.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
const output = { generatedAt: new Date().toISOString(), date: today, globalPlayers: leaderboard.totalPlayers, players };
await writeFile(new URL('../public/data/scores.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Refreshed ${players.length}/${users.length} public profiles for ${today}.`);
