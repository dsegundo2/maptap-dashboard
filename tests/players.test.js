import { describe, expect, it } from 'vitest';
import { enabledPlayers } from '../src/lib/players.js';

describe('player registry', () => {
  it('filters disabled players without changing the registry format', () => {
    const players = enabledPlayers([
      { maptapUsername: 'Alpha', displayName: 'A', enabled: true },
      { maptapUsername: 'Beta', displayName: 'B', enabled: false }
    ]);
    expect(players.map((player) => player.displayName)).toEqual(['A']);
  });

  it('rejects duplicate MapTap usernames', () => {
    expect(() => enabledPlayers([
      { maptapUsername: 'Alpha', displayName: 'A' },
      { maptapUsername: 'alpha', displayName: 'B' }
    ])).toThrow('Duplicate MapTap username');
  });
});
