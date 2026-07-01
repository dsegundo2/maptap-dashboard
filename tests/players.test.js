import { describe, expect, it } from 'vitest';
import { enabledPlayers } from '../src/lib/players.js';
import groupRegistry from '../public/data/groups.json' with { type: 'json' };
import { readCache } from '../src/lib/data.js';
import { enabledGroups, resolveGroup } from '../src/lib/groups.js';

describe('player registry', () => {
  it('supports one-line username-to-display-name entries', () => {
    expect(enabledPlayers({ DiegoT: 'Diggs', Eo2: 'Eo2' })).toEqual([
      { maptapUsername: 'DiegoT', displayName: 'Diggs' },
      { maptapUsername: 'Eo2', displayName: 'Eo2' }
    ]);
  });

  it('derives every group and roster from the registry', () => {
    const groups = enabledGroups(groupRegistry);
    expect(groups.map((group) => group.id)).toEqual(Object.keys(groupRegistry.groups));
    for (const group of groups) {
      expect(resolveGroup(groupRegistry, group.id).players).toEqual(enabledPlayers(groupRegistry.groups[group.id].players));
    }
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
