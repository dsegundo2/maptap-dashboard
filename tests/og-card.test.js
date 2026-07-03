import { describe, expect, it } from 'vitest';
import { broadcastCardSvg, leadersForDate, previewDates } from '../scripts/og-card.mjs';

const players = [
  { displayName: 'Karen', score: 880, playedToday: true, history: [{ date: '2026-07-01', score: 810 }] },
  { displayName: 'Kirthi', score: 862, playedToday: true, history: [{ date: '2026-07-01', score: 850 }] },
  { displayName: 'Diego Dad', score: 857, playedToday: true, history: [{ date: '2026-07-01', score: 820 }] }
];
const locations = [
  { name: 'Newark, New Jersey', lat: 40.743, lng: -74.1724 },
  { name: 'Tokyo, Japan', lat: 35.6764, lng: 139.65 },
  { name: 'Gaborone, Botswana', lat: -24.6282, lng: 25.9231 }
];

describe('Open Graph broadcast card', () => {
  it('renders the selected date without exposing a group label or player initials', () => {
    const svg = broadcastCardSvg({ date: '2026-07-02', today: '2026-07-02', players, locations });
    expect(svg).toContain('JULY 2, 2026');
    expect(svg).toContain('Karen leads');
    expect(svg).toContain('POINTS TODAY');
    expect(svg).toContain('DAILY TOP THREE');
    expect(svg).not.toContain('HB GROUP');
    expect(svg).not.toContain('>K<');
    expect(svg).not.toContain('>DD<');
    expect(svg).not.toContain('WHERE THE TRAIL WENT');
    expect(svg).not.toContain('Tokyo');
  });

  it('uses historical scores for earlier dated previews', () => {
    expect(leadersForDate(players, '2026-07-01', '2026-07-02')).toEqual([
      { displayName: 'Kirthi', score: 850 },
      { displayName: 'Diego Dad', score: 820 },
      { displayName: 'Karen', score: 810 }
    ]);
    const svg = broadcastCardSvg({ date: '2026-07-01', today: '2026-07-02', players, locations });
    expect(svg).toContain('Kirthi led');
    expect(svg).toContain('the day.');
    expect(svg).toContain('WINNING SCORE');
    expect(svg).toContain('FINAL TOP THREE');
    expect(svg).toContain('WHERE THE TRAIL WENT');
    expect(svg).toContain('Tokyo');
    expect(svg).toContain('scale(1.25)');
  });

  it('has a deliberate empty-day treatment', () => {
    const svg = broadcastCardSvg({ date: '2026-06-30', today: '2026-07-02', players });
    expect(svg).toContain('The trail is');
    expect(svg).toContain('NO SCORES YET');
    expect(svg).toContain('No scores recorded');
  });

  it('keeps group scoreboards isolated while sharing the same past-day locations', () => {
    const otherPlayers = [{ displayName: 'Chulo', history: [{ date: '2026-07-01', score: 777 }] }];
    const hb = broadcastCardSvg({ date: '2026-07-01', today: '2026-07-02', players, locations });
    const sb = broadcastCardSvg({ date: '2026-07-01', today: '2026-07-02', players: otherPlayers, locations });
    expect(hb).toContain('Kirthi');
    expect(hb).not.toContain('Chulo');
    expect(sb).toContain('Chulo');
    expect(sb).not.toContain('Kirthi');
    expect(sb).toContain('Newark');
  });

  it('generates a route-ready preview date for every day in the rolling window', () => {
    const dates = previewDates('2026-07-02');
    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe('2026-06-03');
    expect(dates.at(-1)).toBe('2026-07-02');
  });
});
