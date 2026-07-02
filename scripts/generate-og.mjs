import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const data = JSON.parse(await readFile(new URL('../public/data/scores.json', import.meta.url), 'utf8'));
const assetRoot = new URL('../public/assets/', import.meta.url);
await mkdir(assetRoot, { recursive: true });

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
const prettyDate = (date) => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

function leadersForDate(players, date) {
  return players.flatMap((player) => {
    const score = date === data.date && player.playedToday
      ? player.score
      : player.history?.find((entry) => entry.date === date)?.score;
    return Number.isFinite(score) ? [{ displayName: player.displayName, score }] : [];
  }).sort((a, b) => b.score - a.score).slice(0, 3);
}

function cardSvg(groupName, date, players) {
  const leaders = leadersForDate(players, date);
  const rows = leaders.length ? leaders : [{ displayName: 'The trail is open', score: '—' }];
  const rowWidth = 1000 / rows.length;
  const rowMarkup = rows.map((player, index) => {
    const x = 100 + index * rowWidth;
    const center = rowWidth / 2;
    const medal = ['#f4bc35', '#bcc3c0', '#c77932'][index] || '#8da28d';
    const score = Number.isFinite(player.score) ? player.score.toLocaleString() : player.score;
    return `<g transform="translate(${x} 398)"><circle cx="${center - 64}" cy="-26" r="24" fill="${medal}"/><text x="${center - 64}" y="-18" text-anchor="middle" fill="#092e21" font-size="25" font-weight="800">${index + 1}</text><text x="${center}" y="18" text-anchor="middle" fill="#e8eee6" font-size="25" font-weight="700">${escape(player.displayName)}</text><text x="${center}" y="67" text-anchor="middle" fill="#fff" font-size="43" font-weight="800">${escape(score)}</text></g>`;
  }).join('');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f7f4ec"/><stop offset="1" stop-color="#c9d7c2"/></linearGradient><linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0d4a32"/><stop offset="1" stop-color="#082e20"/></linearGradient></defs><rect width="1200" height="630" fill="url(#sky)"/><path d="M0 330 170 176l105 91 140-151 138 135 117-92 133 117 133-84 164 148v290H0Z" fill="#a6bca3"/><path d="M0 363 151 241l127 103 160-128 164 140 116-93 152 116 150-96 180 112v235H0Z" fill="#64856a" opacity=".85"/><rect x="62" y="76" width="1076" height="494" rx="42" fill="url(#panel)"/><g transform="translate(100 114)"><circle cx="31" cy="31" r="31" fill="#dce6d4"/><path d="M9 47 29 17l10 14 8-11 12 27Z" fill="#17442e"/></g><text x="180" y="145" fill="#fff" font-family="Arial, sans-serif" font-size="40" font-weight="800">MapTap Dashboard</text><text x="180" y="181" fill="#c5d5c8" font-family="Arial, sans-serif" font-size="22">${escape(groupName)} group · ${escape(prettyDate(date))}</text><line x1="100" y1="228" x2="1100" y2="228" stroke="#fff" stroke-opacity=".2"/>${rowMarkup}<text x="100" y="535" fill="#b8cbbd" font-family="Arial, sans-serif" font-size="18">Daily leaderboard · open the link for fresh scores and full standings</text></svg>`;
}

const manifest = { groups: {} };
for (const [groupId, group] of Object.entries(data.groups || {})) {
  const dates = [...new Set([data.date, ...group.players.flatMap((player) => player.history?.map((entry) => entry.date) || [])])]
    .sort().slice(-30);
  manifest.groups[groupId] = { name: group.name || groupId, dates };
  const directory = new URL(`og/${groupId}/`, assetRoot);
  await mkdir(directory, { recursive: true });
  for (const date of dates) {
    await sharp(Buffer.from(cardSvg(group.name || groupId, date, group.players))).png({ compressionLevel: 9 }).toFile(fileURLToPath(new URL(`${date}.png`, directory)));
  }
}

const defaultGroup = Object.keys(data.groups || {})[0];
if (defaultGroup) {
  const source = new URL(`og/${defaultGroup}/${data.date}.png`, assetRoot);
  await sharp(fileURLToPath(source)).toFile(fileURLToPath(new URL('og-preview.png', assetRoot)));
}
await writeFile(new URL('og-manifest.json', assetRoot), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated group-specific Open Graph cards for ${Object.keys(manifest.groups).join(', ')}.`);
