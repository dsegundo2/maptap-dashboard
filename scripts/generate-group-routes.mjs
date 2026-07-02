import { mkdir, readFile, writeFile } from 'node:fs/promises';

const registry = JSON.parse(await readFile(new URL('../public/data/groups.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('../public/assets/og-manifest.json', import.meta.url), 'utf8'));
const baseHtml = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const owner = process.env.GITHUB_REPOSITORY?.split('/')[0]?.toLowerCase();
const siteRoot = owner && repository ? `https://${owner}.github.io/${repository}` : '';

function withMetadata(html, { title, description, image, url }) {
  return html
    .replace(/(<meta property="og:title" content=")[^"]*(" \/>)/, `$1${title}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(" \/>)/, `$1${description}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(" \/>)/, `$1${image}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(" \/>)/, `$1${url}$2`)
    .replace(/(<title>)[^<]*(<\/title>)/, `$1${title}$2`);
}

for (const [groupId, group] of Object.entries(registry.groups || {})) {
  const dates = manifest.groups[groupId]?.dates || [];
  const latestDate = dates.at(-1);
  const groupRoot = `${siteRoot}/${encodeURIComponent(groupId)}`;
  const groupHtml = withMetadata(baseHtml, {
    title: `MapTap Dashboard — ${group.name}`,
    description: `See the ${group.name} group’s latest MapTap leaderboard.`,
    image: `${siteRoot}/assets/og/${encodeURIComponent(groupId)}/${latestDate}.png`,
    url: `${groupRoot}/`
  });
  const groupDirectory = new URL(`../dist/${groupId}/`, import.meta.url);
  await mkdir(groupDirectory, { recursive: true });
  await writeFile(new URL('index.html', groupDirectory), groupHtml);

  for (const date of dates) {
    const directory = new URL(`${date}/`, groupDirectory);
    await mkdir(directory, { recursive: true });
    await writeFile(new URL('index.html', directory), withMetadata(groupHtml, {
      title: `${group.name} MapTap leaderboard — ${date}`,
      description: `See the ${group.name} group’s MapTap scores for ${date}.`,
      image: `${siteRoot}/assets/og/${encodeURIComponent(groupId)}/${date}.png`,
      url: `${groupRoot}/${date}/`
    }));
  }
}
await writeFile(new URL('../dist/404.html', import.meta.url), baseHtml);
console.log(`Generated dated routes for ${Object.keys(registry.groups || {}).join(', ')}.`);
