export function enabledPlayers(registry) {
  if (!Array.isArray(registry)) throw new Error('Player registry must be a JSON array.');
  if (registry.length > 10) throw new Error('Player registry supports a maximum of 10 entries.');
  const usernames = new Set();
  for (const [index, player] of registry.entries()) {
    if (!player || typeof player.maptapUsername !== 'string' || !player.maptapUsername.trim()) {
      throw new Error(`Player ${index + 1} needs a maptapUsername.`);
    }
    if (typeof player.displayName !== 'string' || !player.displayName.trim()) {
      throw new Error(`Player ${index + 1} needs a displayName.`);
    }
    const key = player.maptapUsername.trim().toLowerCase();
    if (usernames.has(key)) throw new Error(`Duplicate MapTap username: ${player.maptapUsername}`);
    usernames.add(key);
  }
  return registry.filter((player) => player.enabled !== false);
}
