import { describe, expect, it } from 'vitest';
import { broadcastCardSvg, leadersForDate, previewDates } from '../scripts/og-card.mjs';

const players = [
  { displayName: 'Karen', score: 880, playedToday: true, history: [{ date: '2026-07-01', score: 810 }] },
  { displayName: 'Kirthi', score: 862, playedToday: true, history: [{ date: '2026-07-01', score: 850 }] },
  { displayName: 'Diego Dad', score: 857, playedToday: true, history: [{ date: '2026-07-01', score: 820 }] }
];

describe('Open Graph broadcast card', () => {
  it('renders the selected date without exposing a group label or player initials', () => {
    const svg = broadcastCardSvg({ date: '2026-07-02', today: '2026-07-02', players });
    expect(svg).toContain('JULY 2, 2026');
    expect(svg).toContain('Karen leads');
    expect(svg).toContain('POINTS TODAY');
    expect(svg).toContain('DAILY TOP THREE');
    expect(svg).not.toContain('HB GROUP');
    expect(svg).not.toContain('>K<');
    expect(svg).not.toContain('>DD<');
  });

  it('uses historical scores for earlier dated previews', () => {
    expect(leadersForDate(players, '2026-07-01', '2026-07-02')).toEqual([
      { displayName: 'Kirthi', score: 850 },
      { displayName: 'Diego Dad', score: 820 },
      { displayName: 'Karen', score: 810 }
    ]);
    const svg = broadcastCardSvg({ date: '2026-07-01', today: '2026-07-02', players });
    expect(svg).toContain('POINTS THAT DAY');
  });

  it('has a deliberate empty-day treatment', () => {
    const svg = broadcastCardSvg({ date: '2026-06-30', today: '2026-07-02', players });
    expect(svg).toContain('The trail is');
    expect(svg).toContain('NO SCORES YET');
    expect(svg).toContain('No scores recorded');
  });

  it('generates a route-ready preview date for every day in the rolling window', () => {
    const dates = previewDates('2026-07-02');
    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe('2026-06-03');
    expect(dates.at(-1)).toBe('2026-07-02');
  });
});
