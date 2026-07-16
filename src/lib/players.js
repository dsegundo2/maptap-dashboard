export function enabledPlayers(registry) {
  const players = Array.isArray(registry)
    ? registry
    : registry && typeof registry === 'object'
      ? Object.entries(registry).map(([maptapUsername, value]) => (typeof value === 'string' ? { maptapUsername, displayName: value } : { ...value, maptapUsername, displayName: value?.displayName }))
      : null;
  if (!players) throw new Error('Player registry must be a JSON object or array.');
  if (players.length > 10) throw new Error('Player registry supports a maximum of 10 entries.');
  const usernames = new Set();
  for (const [index, player] of players.entries()) {
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
  return players.filter((player) => player.enabled !== false);
}
