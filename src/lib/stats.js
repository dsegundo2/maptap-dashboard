const DAY_MS = 86_400_000;

export function dateKey(date = new Date(), timezone = 'America/Chicago') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function scoreForDate(player, date) {
  const score = player.history?.find((game) => game.date === date)?.score;
  return Number.isFinite(score) && score > 0 ? score : null;
}

function monthStats(player, month, throughDate) {
  const scores = (player.history || [])
    .filter((game) => game.date.startsWith(month) && game.date <= throughDate && Number.isFinite(game.score) && game.score > 0)
    .map((game) => ({ date: game.date, score: game.score }));
  return {
    scores,
    average: scores.length ? scores.reduce((sum, game) => sum + game.score, 0) / scores.length : null,
    gamesPlayed: scores.length
  };
}

function rankMonthly(entries) {
  const sorted = entries.toSorted((a, b) => b.wins - a.wins
    || (Number.isFinite(b.average) ? b.average : -1) - (Number.isFinite(a.average) ? a.average : -1)
    || a.displayName.localeCompare(b.displayName));
  let rank = 0;
  let previousWins;
  return sorted.map((player) => {
    if (player.wins !== previousWins) rank += 1;
    previousWins = player.wins;
    return { ...player, rank };
  });
}

function monthlyEntries(data, month, throughDate, options = {}) {
  const playerFilter = options.playerFilter || (() => true);
  const candidates = data.players.filter(playerFilter);
  const stats = candidates.map((player) => {
    const summary = monthStats(player, month, throughDate);
    return { id: player.id, displayName: player.displayName, ...summary };
  });
  const wins = new Map(stats.map((player) => [player.id, 0]));
  const dates = [...new Set(stats.flatMap((player) => player.scores.map((game) => game.date)))];
  for (const date of dates) {
    const games = stats.flatMap((player) => {
      const game = player.scores.find((entry) => entry.date === date);
      return game ? [{ id: player.id, score: game.score }] : [];
    });
    if (!games.length) continue;
    const winningScore = Math.max(...games.map((game) => game.score));
    for (const game of games) if (game.score === winningScore) wins.set(game.id, wins.get(game.id) + 1);
  }
  return rankMonthly(stats.map((player) => ({ id: player.id, displayName: player.displayName, average: player.average, gamesPlayed: player.gamesPlayed, wins: wins.get(player.id) })));
}

export function monthlyLeaderboard(data, throughDate = data.date, options = {}) {
  const month = throughDate.slice(0, 7);
  const previousDate = addDays(throughDate, -1);
  const current = monthlyEntries(data, month, throughDate, options);
  const previous = previousDate.startsWith(month) ? monthlyEntries(data, month, previousDate, options) : [];
  const previousRanks = new Map(previous.map((player) => [player.id, player.rank]));
  return {
    month,
    label: new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(`${throughDate}T12:00:00Z`)),
    players: current.map((player) => {
      const rank = player.rank;
      const previousRank = previousRanks.get(player.id);
      return { ...player, rank, average: Number.isFinite(player.average) ? Math.round(player.average) : null, movement: previousRank ? previousRank - rank : 0 };
    })
  };
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
      playedToday: Number.isFinite(score) && score > 0,
      globalRank: standing.rank,
      globalPercentile: standing.percentile
    };
  });
  players.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.displayName.localeCompare(b.displayName));
  return { ...data, date, players };
}

export function globalStanding(score, leaderboard = {}) {
  if (!Number.isFinite(score) || score <= 0) return { rank: null, percentile: null };
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

export function standingsCoverPlayers(standings, players = []) {
  return players
    .filter((player) => Number.isFinite(player.score) && player.score > 0)
    .every((player) => standings && Object.hasOwn(standings, player.id));
}

function rangeDates(endDate, days) {
  const end = new Date(`${endDate}T12:00:00Z`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end.getTime() - (days - 1 - index) * DAY_MS);
    return date.toISOString().slice(0, 10);
  });
}

function playedScoresForDate(players, date) {
  return players.map((player) => scoreForDate(player, date)).filter((score) => Number.isFinite(score) && score > 0);
}

function average(scores) {
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
}

function teamPlayers(data) {
  return (data.players || []).filter((player) => player.excludedFromChatWins !== true);
}

function roundScoresForDate(players, date, roundIndex) {
  return players
    .map((player) => {
      const game = player.history?.find((entry) => entry.date === date);
      const round = game?.rounds?.find((entry) => Number(entry.round) === roundIndex + 1) || game?.rounds?.[roundIndex];
      return { player, score: Number(round?.score) };
    })
    .filter((entry) => Number.isFinite(entry.score) && entry.score >= 0);
}

function playerRoundScoreForDate(player, date, roundIndex) {
  const game = player.history?.find((entry) => entry.date === date);
  const round = game?.rounds?.find((entry) => Number(entry.round) === roundIndex + 1) || game?.rounds?.[roundIndex];
  const score = Number(round?.score);
  return Number.isFinite(score) && score >= 0 ? score : null;
}

function topRoundScoreForDate(players, date, roundIndex) {
  return roundScoresForDate(players, date, roundIndex)
    .toSorted((a, b) => b.score - a.score || a.player.displayName.localeCompare(b.player.displayName))[0] || null;
}

function isLikelyInternational(location) {
  const name = String(location?.name || '');
  if (/\b(usa|u\.s\.a\.|united states|alaska|hawaii)\b/i.test(name)) return false;
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  const contiguousUS = lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66;
  const alaska = lat >= 51 && lat <= 72 && lng >= -180 && lng <= -129;
  const hawaii = lat >= 18 && lat <= 23 && lng >= -161 && lng <= -154;
  return !(contiguousUS || alaska || hawaii);
}


export function continentForLocation(location = {}) {
  const name = String(location.name || '').toLowerCase();
  if (/antarctica/.test(name)) return 'Antarctica';
  if (/greenland|canada|mexico|panama|united states|\busa\b|alaska|hawaii|new hampshire|texas|maryland|new jersey|rhode island|illinois|newport|chicago|atlantic city|ocean city/.test(name)) return 'North America';
  if (/argentina|chile|brazil|peru|colombia|ecuador|uruguay|paraguay|bolivia|venezuela|cape horn|buenos aires/.test(name)) return 'South America';
  if (/england|ireland|norway|greece|italy|france|spain|portugal|germany|poland|netherlands|belgium|sweden|finland|denmark|iceland|sparta|rome|toulouse|bath|galway|bergen/.test(name)) return 'Europe';
  if (/comoros|moroni|egypt|morocco|kenya|nigeria|south africa|ghana|ethiopia|tanzania|algeria|tunisia/.test(name)) return 'Africa';
  if (/new zealand|australia|solomon islands|tonga|fiji|samoa|guadalcanal|auckland|honiara|nuku/.test(name)) return 'Oceania';
  if (/japan|china|india|iraq|sumer|babylon|lagash|sendai|yokohama|korea|thailand|vietnam|indonesia|philippines|turkey|iran|saudi/.test(name)) return 'Asia';
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'Unknown';
  if (lat <= -60) return 'Antarctica';
  if (lat >= -56 && lat <= 13 && lng >= -82 && lng <= -34) return 'South America';
  if ((lat >= 7 && lat <= 84 && lng >= -170 && lng <= -50) || (lat >= 58 && lat <= 84 && lng >= -73 && lng <= -11)) return 'North America';
  if (lat >= -35 && lat <= 38 && lng >= -20 && lng <= 55) return 'Africa';
  if ((lat >= -50 && lat <= 10 && lng >= 110 && lng <= 180) || (lat >= -50 && lat <= 5 && lng >= -180 && lng <= -130)) return 'Oceania';
  if (lat >= 35 && lat <= 72 && lng >= -25 && lng <= 45) return 'Europe';
  if (lat >= -10 && lat <= 80 && lng >= 45 && lng <= 180) return 'Asia';
  return 'Unknown';
}

function rankContinentStats(entries) {
  return entries
    .map((entry) => ({ ...entry, average: Number.isFinite(entry.average) ? Math.round(entry.average) : null }))
    .filter((entry) => Number.isFinite(entry.average))
    .toSorted((a, b) => b.average - a.average || b.samples - a.samples || a.continent.localeCompare(b.continent));
}

function addContinentSample(map, location, score) {
  const continent = continentForLocation(location);
  if (continent === 'Unknown' || !Number.isFinite(score)) return;
  const entry = map.get(continent) || { continent, total: 0, samples: 0 };
  entry.total += score;
  entry.samples += 1;
  map.set(continent, entry);
}

export function playerContinentStats(data, player, days = 30) {
  const dates = rangeDates(data.date, days).filter((date) => date < data.date);
  const byContinent = new Map();
  for (const date of dates) {
    const locations = data.locationsByDate?.[date]?.locations || [];
    locations.forEach((location, index) => {
      const score = playerRoundScoreForDate(player, date, index);
      if (Number.isFinite(score)) addContinentSample(byContinent, location, score);
    });
  }
  return rankContinentStats([...byContinent.values()].map((entry) => ({ ...entry, average: entry.total / entry.samples, days: entry.samples })));
}

export function teamStats(data, days = 30) {
  const dates = rangeDates(data.date, days);
  const players = teamPlayers(data);
  const daily = dates.map((date) => {
    const scores = playedScoresForDate(players, date);
    const locations = date < data.date ? data.locationsByDate?.[date]?.locations || [] : [];
    const hasEnoughPlayers = scores.length >= 2;
    const avg = hasEnoughPlayers ? average(scores) : null;
    return {
      date,
      scores,
      average: Number.isFinite(avg) ? Math.round(avg) : null,
      high: hasEnoughPlayers ? Math.max(...scores) : null,
      low: hasEnoughPlayers ? Math.min(...scores) : null,
      played: scores.length,
      locations,
      counted: hasEnoughPlayers
    };
  });
  const playedDays = daily.filter((day) => Number.isFinite(day.average));
  const locatedDays = playedDays.filter((day) => day.locations.length);
  const highDay = locatedDays.toSorted((a, b) => b.average - a.average || b.high - a.high)[0] || playedDays.toSorted((a, b) => b.average - a.average || b.high - a.high)[0] || null;
  const lowDay = locatedDays.toSorted((a, b) => a.average - b.average || a.low - b.low)[0] || playedDays.toSorted((a, b) => a.average - b.average || a.low - b.low)[0] || null;
  const allScores = playedDays.flatMap((day) => day.scores);
  const teamAverage = average(allScores);
  const locationMap = new Map();
  const continentMap = new Map();
  for (const day of playedDays) {
    day.locations.forEach((location, index) => {
      const roundScores = roundScoresForDate(players, day.date, index);
      if (roundScores.length < 2) return;
      const roundAverage = Math.round(average(roundScores.map((entry) => entry.score)));
      const key = `${location.name}|${location.lat}|${location.lng}`;
      const top = topRoundScoreForDate(players, day.date, index);
      const existing = locationMap.get(key) || { ...location, continent: continentForLocation(location), days: 0, totalAverage: 0, highAverage: null, lowAverage: null, dates: [], appearances: [], international: isLikelyInternational(location) };
      existing.days += 1;
      existing.totalAverage += roundAverage;
      existing.highAverage = Math.max(existing.highAverage ?? roundAverage, roundAverage);
      existing.lowAverage = Math.min(existing.lowAverage ?? roundAverage, roundAverage);
      existing.dates.push(day.date);
      existing.appearances.push({ date: day.date, average: roundAverage, topPlayer: top ? { id: top.player.id, displayName: top.player.displayName, score: top.score } : null });
      locationMap.set(key, existing);
      addContinentSample(continentMap, location, roundAverage);
    });
  }
  const locations = [...locationMap.values()].map((location) => {
    const averageScore = Math.round(location.totalAverage / location.days);
    const bestAppearance = location.appearances.toSorted((a, b) => b.average - a.average || b.date.localeCompare(a.date))[0] || null;
    return { ...location, average: averageScore, bestAppearance };
  });
  const bestLocations = locations.toSorted((a, b) => b.average - a.average || a.name.localeCompare(b.name)).slice(0, 5);
  const toughestLocations = locations.toSorted((a, b) => a.average - b.average || a.name.localeCompare(b.name)).slice(0, 5);
  const bestInternational = locations.filter((location) => location.international).toSorted((a, b) => b.average - a.average || a.name.localeCompare(b.name))[0] || null;
  const longestStreakPlayer = players.toSorted((a, b) => (b.summary?.chatLongestWinStreak ?? 0) - (a.summary?.chatLongestWinStreak ?? 0) || (b.summary?.chatWins ?? 0) - (a.summary?.chatWins ?? 0) || a.displayName.localeCompare(b.displayName))[0] || null;
  const continentStats = rankContinentStats([...continentMap.values()].map((entry) => ({ ...entry, average: entry.total / entry.samples, days: entry.samples })));
  return {
    dates,
    daily,
    playedDays: playedDays.length,
    gamesPlayed: allScores.length,
    teamAverage: Number.isFinite(teamAverage) ? Math.round(teamAverage) : null,
    highDay,
    lowDay,
    bestLocations,
    toughestLocations,
    bestInternational,
    longestStreakPlayer,
    continentStats,
    chartHistory: daily.map((day) => ({ date: day.date, score: day.average, locations: day.locations })).filter((day) => Number.isFinite(day.score))
  };
}

export function chatWinStats(data, throughDate = data.date) {
  const hasChatScope = data.players.some((player) => player.excludedFromChatWins === true);
  if (!hasChatScope) return null;
  const chatPlayers = data.players.filter((player) => player.excludedFromChatWins !== true);
  const monthly = monthlyLeaderboard({ ...data, players: chatPlayers }, throughDate);
  return {
    label: 'Chat wins',
    excludedPlayers: data.players.filter((player) => player.excludedFromChatWins === true).map((player) => player.displayName),
    players: monthly.players,
    totalWins: monthly.players.reduce((sum, player) => sum + player.wins, 0)
  };
}

export function enrichDashboard(data, days = 30) {
  const dates = rangeDates(data.date, days);
  const wins = new Map(data.players.map((player) => [player.id, []]));
  const chatWins = new Map(data.players.map((player) => [player.id, []]));

  for (const date of dates) {
    const scores = data.players
      .map((player) => ({ id: player.id, score: scoreForDate(player, date), excludedFromChatWins: player.excludedFromChatWins === true }))
      .filter((entry) => Number.isFinite(entry.score) && entry.score > 0);
    if (!scores.length) continue;
    const top = Math.max(...scores.map((entry) => entry.score));
    for (const entry of scores) if (entry.score === top) wins.get(entry.id)?.push(date);
    const chatScores = scores.filter((entry) => !entry.excludedFromChatWins);
    if (!chatScores.length) continue;
    const chatTop = Math.max(...chatScores.map((entry) => entry.score));
    for (const entry of chatScores) if (entry.score === chatTop) chatWins.get(entry.id)?.push(date);
  }

  const players = data.players.map((player) => {
    const recent = (player.history || []).filter((game) => dates.includes(game.date));
    const scores = recent.map((game) => game.score).filter((score) => Number.isFinite(score) && score > 0);
    const winDates = new Set(wins.get(player.id));
    const chatWinDates = new Set(chatWins.get(player.id));
    let longestWinStreak = 0;
    let chatLongestWinStreak = 0;
    let running = 0;
    let chatRunning = 0;
    for (const date of dates) {
      running = winDates.has(date) ? running + 1 : 0;
      chatRunning = chatWinDates.has(date) ? chatRunning + 1 : 0;
      longestWinStreak = Math.max(longestWinStreak, running);
      chatLongestWinStreak = Math.max(chatLongestWinStreak, chatRunning);
    }
    let currentWinStreak = 0;
    let chatCurrentWinStreak = 0;
    for (let index = dates.length - 1; index >= 0 && winDates.has(dates[index]); index -= 1) currentWinStreak += 1;
    for (let index = dates.length - 1; index >= 0 && chatWinDates.has(dates[index]); index -= 1) chatCurrentWinStreak += 1;
    return {
      ...player,
      summary: {
        wins: winDates.size,
        chatWins: player.excludedFromChatWins ? null : chatWinDates.size,
        longestWinStreak,
        chatLongestWinStreak: player.excludedFromChatWins ? null : chatLongestWinStreak,
        currentWinStreak,
        chatCurrentWinStreak: player.excludedFromChatWins ? null : chatCurrentWinStreak,
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
    .map(([date, game]) => ({
      date,
      score: Number(game?.finalScore ?? game?.totalScore),
      rounds: Array.isArray(game?.rounds)
        ? game.rounds.map((round, index) => ({
            round: Number(round?.round) || index + 1,
            score: Number(round?.score),
            distance: Number(round?.distance)
          })).filter((round) => Number.isFinite(round.score))
        : []
    }))
    .filter((game) => /^\d{4}-\d{2}-\d{2}$/.test(game.date) && Number.isFinite(game.score) && game.score > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}
