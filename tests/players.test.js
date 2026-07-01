import { describe, expect, it } from 'vitest';
import { enabledPlayers } from '../src/lib/players.js';
import playerRegistry from '../public/data/players.json' with { type: 'json' };
import { readCache } from '../src/lib/data.js';

describe('player registry', () => {
  it('includes Diego Dad and no longer includes Eo2', () => {
    const players = enabledPlayers(playerRegistry);
    expect(players).toContainEqual(expect.objectContaining({ maptapUsername: 'Diego Dad', displayName: 'Diego Dad' }));
    expect(players.some((player) => player.maptapUsername === 'Eo2')).toBe(false);
  });
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

  it('rejects a fresh cache when its roster no longer matches the registry', () => {
    const originalStorage = globalThis.localStorage;
    globalThis.localStorage = { getItem: () => JSON.stringify({ savedAt: Date.now(), data: { players: [{ maptapUsername: 'Eo2' }] } }) };
    expect(readCache([{ maptapUsername: 'Diego Dad' }, { maptapUsername: 'DiegoT' }])).toBeNull();
    globalThis.localStorage = originalStorage;
  });
});
