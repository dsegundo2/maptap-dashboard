import { describe, expect, it } from 'vitest';
import { compactHistory, dashboardForDate, dateKey, enrichDashboard, globalStanding, leaderboardDateRange } from '../src/lib/stats.js';

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

describe('compactHistory', () => {
  it('normalizes both MapTap score formats and sorts dates', () => {
    expect(compactHistory({
      '2026-06-02': { totalScore: '880' },
      nope: { finalScore: 900 },
      '2026-06-01': { finalScore: 920 }
    })).toEqual([{ date: '2026-06-01', score: 920 }, { date: '2026-06-02', score: 880 }]);
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
