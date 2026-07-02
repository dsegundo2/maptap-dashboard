import { describe, expect, it } from 'vitest';
import { shareCardSvg, shareUrlForDate } from '../src/ui/share-card.js';

describe('share card', () => {
  it('renders a dedicated image with the daily leaders', () => {
    const svg = shareCardSvg({ date: '2026-07-01', players: [{ displayName: 'Eo2', score: 880, playedToday: true }] });
    expect(svg).toContain('July 1, 2026');
    expect(svg).toContain('Eo2');
    expect(svg).toContain('880 points');
    expect(svg).not.toContain('See the full player leaderboard');
  });

  it('builds a group-specific website URL for the selected day', () => {
    expect(shareUrlForDate({ origin: 'https://dsegundo2.github.io' }, 'maptap-dashboard', 'SB', '2026-07-01'))
      .toBe('https://dsegundo2.github.io/maptap-dashboard/SB/2026-07-01/');
  });
});
