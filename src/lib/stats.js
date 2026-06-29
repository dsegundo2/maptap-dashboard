const DAY_MS = 86_400_000;

export function dateKey(date = new Date(), timezone = 'America/Chicago') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function scoreForDate(player, date) {
  return player.history?.find((game) => game.date === date)?.score ?? null;
}

export function addDays(date, amount) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function leaderboardDateRange(today, hardMinimum = '2026-06-01', days = 30) {
  const rollingMinimum = addDays(today, -(days - 1));
  const minimum = rollingMinimum > hardMinimum ? rollingMinimum : hardMinimum;
  const dates = [];
  for (let date = minimum; date <= today; date = addDays(date, 1)) dates.push(date);
  return { minimum, maximum: today, dates };
}

export function dashboardForDate(data, date, standings = {}) {
  const players = data.players.map((player) => {
    const score = scoreForDate(player, date);
    const standing = date === data.date
      ? { rank: player.globalRank, percentile: player.globalPercentile }
      : standings[player.id] || { rank: null, percentile: null };
    return {
      ...player,
      score,
      playedToday: Number.isFinite(score),
      globalRank: standing.rank,
      globalPercentile: standing.percentile
    };
  });
  players.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.displayName.localeCompare(b.displayName));
  return { ...data, date, players };
}

export function globalStanding(score, leaderboard = {}) {
  if (!Number.isFinite(score)) return { rank: null, percentile: null };
  const buckets = leaderboard.allScoreBuckets || {};
  const sampleTotal = Object.values(buckets).reduce((sum, count) => sum + Number(count), 0);
  const globalTotal = Number(leaderboard.totalPlayers) || sampleTotal;
  if (!sampleTotal) return { rank: null, percentile: null };
  let below = 0;
  for (const [bucket, countValue] of Object.entries(buckets)) {
    const count = Number(countValue);
    const floor = Number(bucket);
    const width = floor >= 1000 ? 1 : 10;
    if (floor + width <= score) below += count;
    else if (floor < score) below += count * ((score - floor) / width);
  }
  const betterThan = below / sampleTotal;
  const sampleRank = Math.max(1, Math.round(sampleTotal - below));
  return {
    rank: Math.max(31, Math.round((sampleRank / sampleTotal) * globalTotal)),
    percentile: Math.floor(Math.min(1, Math.max(0, betterThan)) * 100)
  };
}

function rangeDates(endDate, days) {
  const end = new Date(`${endDate}T12:00:00Z`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end.getTime() - (days - 1 - index) * DAY_MS);
    return date.toISOString().slice(0, 10);
  });
}

export function enrichDashboard(data, days = 30) {
  const dates = rangeDates(data.date, days);
  const wins = new Map(data.players.map((player) => [player.id, []]));

  for (const date of dates) {
    const scores = data.players
      .map((player) => ({ id: player.id, score: scoreForDate(player, date) }))
      .filter((entry) => Number.isFinite(entry.score));
    if (!scores.length) continue;
    const top = Math.max(...scores.map((entry) => entry.score));
    for (const entry of scores) if (entry.score === top) wins.get(entry.id)?.push(date);
  }

  const players = data.players.map((player) => {
    const recent = (player.history || []).filter((game) => dates.includes(game.date));
    const scores = recent.map((game) => game.score).filter(Number.isFinite);
    const winDates = new Set(wins.get(player.id));
    let longestWinStreak = 0;
    let running = 0;
    for (const date of dates) {
      running = winDates.has(date) ? running + 1 : 0;
      longestWinStreak = Math.max(longestWinStreak, running);
    }
    let currentWinStreak = 0;
    for (let index = dates.length - 1; index >= 0 && winDates.has(dates[index]); index -= 1) currentWinStreak += 1;
    return {
      ...player,
      summary: {
        wins: winDates.size,
        longestWinStreak,
        currentWinStreak,
        average: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
        best: scores.length ? Math.max(...scores) : null,
        lowest: scores.length ? Math.min(...scores) : null,
        gamesPlayed: scores.length,
        daysMissed: days - scores.length
      }
    };
  });

  players.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.displayName.localeCompare(b.displayName));
  return { ...data, players };
}

export function compactHistory(gameHistory = {}) {
  return Object.entries(gameHistory)
    .map(([date, game]) => ({ date, score: Number(game?.finalScore ?? game?.totalScore) }))
    .filter((game) => /^\d{4}-\d{2}-\d{2}$/.test(game.date) && Number.isFinite(game.score))
    .sort((a, b) => a.date.localeCompare(b.date));
}
