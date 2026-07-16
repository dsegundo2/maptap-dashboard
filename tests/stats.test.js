import { describe, expect, it } from 'vitest';
import { compactHistory, dashboardForDate, dateKey, enrichDashboard, globalStanding, leaderboardDateRange, monthlyLeaderboard, scoreForDate, standingsCoverPlayers } from '../src/lib/stats.js';

describe('dateKey', () => {
  it('always returns an ISO date in the configured timezone', () => {
    expect(dateKey(new Date('2026-06-30T01:00:00Z'), 'America/Chicago')).toBe('2026-06-29');
  });
});

describe('globalStanding', () => {
  it('estimates rank and percentile from public buckets', () => {
    const result = globalStanding(900, { totalPlayers: 10, allScoreBuckets: { 800: 2, 900: 3, 950: 5 } });
    expect(result.rank).toBe(31);
    expect(result.percentile).toBe(20);
  });

  it('returns nulls without a score', () => {
    expect(globalStanding(null, {})).toEqual({ rank: null, percentile: null });
  });
});

describe('historical standing coverage', () => {
  it('refetches when a newly configured scored player is absent from a cached day', () => {
    const players = [{ id: 'dad', score: 884 }, { id: 'tomas', score: 841 }];
    expect(standingsCoverPlayers({ tomas: { percentile: 45 } }, players)).toBe(false);
    expect(standingsCoverPlayers({ dad: { percentile: 69 }, tomas: { percentile: 45 } }, players)).toBe(true);
  });
});

describe('compactHistory', () => {
  it('normalizes both MapTap score formats and sorts dates', () => {
    expect(compactHistory({
      '2026-06-02': { totalScore: '880' },
      nope: { finalScore: 900 },
      '2026-06-01': { finalScore: 920 }
    })).toEqual([{ date: '2026-06-01', score: 920, rounds: [] }, { date: '2026-06-02', score: 880, rounds: [] }]);
  });
});

describe('enrichDashboard', () => {
  it('ranks today and calculates group wins and small-group summaries', () => {
    const result = enrichDashboard({ date: '2026-06-03', players: [
      { id: 'a', displayName: 'A', score: 950, history: [{ date: '2026-06-01', score: 900 }, { date: '2026-06-02', score: 920 }, { date: '2026-06-03', score: 950 }] },
      { id: 'b', displayName: 'B', score: 940, history: [{ date: '2026-06-01', score: 910 }, { date: '2026-06-03', score: 940 }] }
    ] }, 3);
    expect(result.players[0].id).toBe('a');
    expect(result.players[0].summary).toMatchObject({ wins: 2, longestWinStreak: 2, currentWinStreak: 2, average: 923, gamesPlayed: 3, daysMissed: 0 });
    expect(result.players[1].summary.daysMissed).toBe(1);
  });
});

describe('historical leaderboard dates', () => {
  it('limits navigation to June 1 and the latest 30 days', () => {
    expect(leaderboardDateRange('2026-06-29')).toMatchObject({ minimum: '2026-06-01', maximum: '2026-06-29' });
    expect(leaderboardDateRange('2026-07-15')).toMatchObject({ minimum: '2026-06-16', maximum: '2026-07-15' });
  });

  it('handles empty and partially completed days', () => {
    const data = { date: '2026-06-29', players: [
      { id: 'a', displayName: 'A', history: [{ date: '2026-06-10', score: 900 }] },
      { id: 'b', displayName: 'B', history: [] }
    ] };
    const partial = dashboardForDate(data, '2026-06-10');
    expect(partial.players.map((player) => [player.id, player.score, player.playedToday])).toEqual([['a', 900, true], ['b', null, false]]);
    expect(dashboardForDate(data, '2026-06-09').players.every((player) => !player.playedToday)).toBe(true);
  });
});

describe('monthlyLeaderboard', () => {
  it('uses calendar-month wins, average tiebreaks, and daily movement', () => {
    const data = { date: '2026-07-02', players: [
      { id: 'amy', displayName: 'Amy', history: [{ date: '2026-06-30', score: 1000 }, { date: '2026-07-01', score: 900 }, { date: '2026-07-02', score: 700 }] },
      { id: 'bob', displayName: 'Bob', history: [{ date: '2026-07-01', score: 800 }, { date: '2026-07-02', score: 950 }] },
      { id: 'zoe', displayName: 'Zoe', history: [{ date: '2026-07-01', score: 800 }, { date: '2026-07-02', score: 800 }] }
    ] };

    const result = monthlyLeaderboard(data);

    expect(result.label).toBe('July');
    expect(result.players.map((player) => [player.id, player.wins, player.rank, player.average, player.movement])).toEqual([
      ['bob', 1, 1, 875, 1],
      ['amy', 1, 1, 800, 0],
      ['zoe', 0, 2, 800, 0]
    ]);
  });

  it('keeps players without games at the bottom of the full leaderboard', () => {
    expect(monthlyLeaderboard({ date: '2026-07-01', players: [{ id: 'a', displayName: 'A', history: [{ date: '2026-06-30', score: 900 }] }] }).players)
      .toEqual([{ id: 'a', displayName: 'A', average: null, gamesPlayed: 0, wins: 0, rank: 1, movement: 0 }]);
  });

  it('returns the entire monthly leaderboard instead of only the top three', () => {
    const players = Array.from({ length: 6 }, (_, index) => ({
      id: `p${index + 1}`,
      displayName: `Player ${index + 1}`,
      history: [{ date: '2026-06-30', score: 900 - index * 10 }]
    }));
    expect(monthlyLeaderboard({ date: '2026-06-30', players }).players.map((player) => player.id))
      .toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
  });

  it('uses dense win ranks so alphabetical tie order cannot inflate movement', () => {
    const players = Array.from({ length: 6 }, (_, index) => ({
      id: `p${index + 1}`,
      displayName: `Player ${index + 1}`,
      history: index === 5 ? [{ date: '2026-07-02', score: 900 }] : []
    }));
    const result = monthlyLeaderboard({ date: '2026-07-02', players });
    expect(result.players[0]).toMatchObject({ id: 'p6', rank: 1, movement: 0 });
    for (const player of result.players.slice(1)) expect(player).toMatchObject({ rank: 2, movement: -1 });
  });

  it('treats zero scores as missing in histories and summary averages', () => {
    const history = compactHistory({
      '2026-07-01': { finalScore: 0 },
      '2026-07-02': { finalScore: 900 }
    });
    expect(history).toEqual([{ date: '2026-07-02', score: 900, rounds: [] }]);
    const result = enrichDashboard({ date: '2026-07-02', players: [{ id: 'a', displayName: 'A', history: [{ date: '2026-07-01', score: 0 }, { date: '2026-07-02', score: 900 }] }] }, 2);
    expect(result.players[0].summary).toMatchObject({ average: 900, best: 900, lowest: 900, gamesPlayed: 1, daysMissed: 1 });
    expect(scoreForDate(result.players[0], '2026-07-01')).toBeNull();
  });

  it('divides 30-day and monthly averages only by days actually played', () => {
    const history = [
      { date: '2026-06-03', score: 0 },
      { date: '2026-06-10', score: 800 },
      { date: '2026-06-20', score: 0 },
      { date: '2026-07-02', score: 900 }
    ];
    const dashboard = enrichDashboard({ date: '2026-07-02', players: [{ id: 'a', displayName: 'A', history }] }, 30);
    expect(dashboard.players[0].summary).toMatchObject({ average: 850, gamesPlayed: 2, daysMissed: 28 });
    expect(monthlyLeaderboard({ date: '2026-07-02', players: [{ id: 'a', displayName: 'A', history }] }).players[0])
      .toMatchObject({ average: 900, gamesPlayed: 1 });
  });
});

describe('teamStats and chat wins', () => {
  it('averages only played scores and ranks location days', async () => {
    const { teamStats, chatWinStats, enrichDashboard } = await import('../src/lib/stats.js');
    const dashboard = enrichDashboard({
      date: '2026-07-03',
      players: [
        { id: 'a', displayName: 'A', history: [{ date: '2026-07-01', score: 900, rounds: [{ round: 1, score: 90 }] }, { date: '2026-07-02', score: 0 }, { date: '2026-07-03', score: 700 }] },
        { id: 'b', displayName: 'B', history: [{ date: '2026-07-01', score: 800, rounds: [{ round: 1, score: 70 }] }, { date: '2026-07-02', score: 600 }] },
        { id: 'c', displayName: 'C', excludedFromChatWins: true, history: [{ date: '2026-07-01', score: 990, rounds: [{ round: 1, score: 100 }] }, { date: '2026-07-02', score: 950 }, { date: '2026-07-03', score: 950 }] }
      ],
      locationsByDate: {
        '2026-07-01': { locations: [{ name: 'Paris, France', lat: 48.8, lng: 2.3 }] },
        '2026-07-02': { locations: [{ name: 'Austin, Texas, USA', lat: 30.2, lng: -97.7 }] },
        '2026-07-03': { locations: [{ name: 'Tokyo, Japan', lat: 35.6, lng: 139.7 }] }
      }
    }, 3);
    const stats = teamStats(dashboard, 3);
    expect(stats.daily.map((day) => [day.date, day.average, day.played])).toEqual([
      ['2026-07-01', 850, 2],
      ['2026-07-02', null, 1],
      ['2026-07-03', null, 1]
    ]);
    expect(stats.teamAverage).toBe(850);
    expect(stats.highDay.date).toBe('2026-07-01');
    expect(stats.lowDay.date).toBe('2026-07-01');
    expect(stats.bestInternational.name).toBe('Paris, France');
    expect(stats.bestInternational.average).toBe(80);
    expect(stats.bestInternational.bestAppearance.topPlayer).toMatchObject({ displayName: 'A', score: 90 });
    expect(chatWinStats(dashboard).totalWins).toBe(3);
  });

  it('uses round scores out of 100 for location accuracy instead of daily totals', async () => {
    const { teamStats, enrichDashboard } = await import('../src/lib/stats.js');
    const dashboard = enrichDashboard({
      date: '2026-07-02',
      players: [
        { id: 'a', displayName: 'A', history: [{ date: '2026-07-01', score: 900, rounds: [{ round: 1, score: 90 }, { round: 2, score: 40 }] }] },
        { id: 'b', displayName: 'B', history: [{ date: '2026-07-01', score: 800, rounds: [{ round: 1, score: 70 }, { round: 2, score: 80 }] }] },
        { id: 'c', displayName: 'C', excludedFromChatWins: true, history: [{ date: '2026-07-01', score: 1000, rounds: [{ round: 1, score: 100 }, { round: 2, score: 100 }] }] }
      ],
      locationsByDate: {
        '2026-07-01': { locations: [
          { name: 'Montevideo, Uruguay', lat: -34.9, lng: -56.1 },
          { name: 'Austin, Texas, USA', lat: 30.2, lng: -97.7 }
        ] }
      }
    }, 2);
    const stats = teamStats(dashboard, 2);
    expect(stats.bestLocations.map((location) => [location.name, location.average])).toEqual([
      ['Montevideo, Uruguay', 80],
      ['Austin, Texas, USA', 60]
    ]);
    expect(stats.toughestLocations.map((location) => [location.name, location.average])).toEqual([
      ['Austin, Texas, USA', 60],
      ['Montevideo, Uruguay', 80]
    ]);
    expect(stats.bestInternational).toMatchObject({ name: 'Montevideo, Uruguay', average: 80 });
    expect(stats.bestInternational.bestAppearance.topPlayer).toMatchObject({ displayName: 'A', score: 90 });
  });
});

it('builds continent splits for team and players from archived locations', async () => {
  const { enrichDashboard, playerContinentStats, teamStats } = await import('../src/lib/stats.js');
  const dashboard = enrichDashboard({
    date: '2026-07-03',
    players: [
      { id: 'a', displayName: 'A', history: [{ date: '2026-07-01', score: 900, rounds: [{ round: 1, score: 90 }] }, { date: '2026-07-02', score: 700, rounds: [{ round: 1, score: 70 }] }, { date: '2026-07-03', score: 1000, rounds: [{ round: 1, score: 100 }] }] },
      { id: 'b', displayName: 'B', history: [{ date: '2026-07-01', score: 800, rounds: [{ round: 1, score: 80 }] }, { date: '2026-07-02', score: 600, rounds: [{ round: 1, score: 60 }] }, { date: '2026-07-03', score: 1000, rounds: [{ round: 1, score: 100 }] }] }
    ],
    locationsByDate: {
      '2026-07-01': { locations: [{ name: 'Bath, England, United Kingdom', lat: 51.38, lng: -2.36 }] },
      '2026-07-02': { locations: [{ name: 'Sendai, Japan', lat: 38.26, lng: 140.86 }] },
      '2026-07-03': { locations: [{ name: 'Today Secret, Japan', lat: 38.26, lng: 140.86 }] }
    }
  }, 3);
  expect(teamStats(dashboard, 3).continentStats.map((entry) => [entry.continent, entry.average, entry.days])).toEqual([
    ['Europe', 85, 1],
    ['Asia', 65, 1]
  ]);
  expect(playerContinentStats(dashboard, dashboard.players.find((player) => player.id === 'a'), 3).map((entry) => [entry.continent, entry.average])).toEqual([
    ['Europe', 90],
    ['Asia', 70]
  ]);
});
