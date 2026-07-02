import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { broadcastCardSvg, previewDates } from './og-card.mjs';

const data = JSON.parse(await readFile(new URL('../public/data/scores.json', import.meta.url), 'utf8'));
const assetRoot = new URL('../public/assets/', import.meta.url);
await mkdir(assetRoot, { recursive: true });

const manifest = { groups: {} };
for (const [groupId, group] of Object.entries(data.groups || {})) {
  const dates = previewDates(data.date);
  manifest.groups[groupId] = { name: group.name || groupId, dates };
  const directory = new URL(`og/${groupId}/`, assetRoot);
  await mkdir(directory, { recursive: true });
  for (const date of dates) {
    const svg = broadcastCardSvg({ date, today: data.date, players: group.players });
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(fileURLToPath(new URL(`${date}.png`, directory)));
  }
}

const defaultGroup = Object.keys(data.groups || {})[0];
if (defaultGroup) {
  const source = new URL(`og/${defaultGroup}/${data.date}.png`, assetRoot);
  await sharp(fileURLToPath(source)).toFile(fileURLToPath(new URL('og-preview.png', assetRoot)));
}
await writeFile(new URL('og-manifest.json', assetRoot), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated group-specific Open Graph cards for ${Object.keys(manifest.groups).join(', ')}.`);
