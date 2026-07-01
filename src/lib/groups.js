import { enabledPlayers } from './players.js';

export function enabledGroups(registry) {
  if (!registry || typeof registry !== 'object' || !registry.groups || typeof registry.groups !== 'object') {
    throw new Error('Group registry needs a groups object.');
  }
  const groups = Object.entries(registry.groups).map(([id, group]) => {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`Invalid group id: ${id}`);
    if (!group || typeof group.name !== 'string' || !group.name.trim()) throw new Error(`Group ${id} needs a name.`);
    return { id, name: group.name.trim(), players: enabledPlayers(group.players) };
  });
  if (!groups.length) throw new Error('At least one group is required.');
  return groups;
}

export function resolveGroup(registry, requestedId) {
  const groups = enabledGroups(registry);
  const id = requestedId || registry.defaultGroup || groups[0].id;
  return groups.find((group) => group.id.toLowerCase() === String(id).toLowerCase()) || groups.find((group) => group.id === registry.defaultGroup) || groups[0];
}
