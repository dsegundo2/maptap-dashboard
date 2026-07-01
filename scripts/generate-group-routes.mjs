import { mkdir, readFile, writeFile } from 'node:fs/promises';

const registry = JSON.parse(await readFile(new URL('../public/data/groups.json', import.meta.url), 'utf8'));
const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
for (const groupId of Object.keys(registry.groups || {})) {
  const directory = new URL(`../dist/${groupId}/`, import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('index.html', directory), html);
}
await writeFile(new URL('../dist/404.html', import.meta.url), html);
console.log(`Generated routes for ${Object.keys(registry.groups || {}).join(', ')}.`);
