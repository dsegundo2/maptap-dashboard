import { defineConfig } from 'vite';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const owner = process.env.GITHUB_REPOSITORY?.split('/')[0];
const base = process.env.GITHUB_ACTIONS && repository ? `/${repository}/` : '/';
const siteRoot = owner && repository
  ? `https://${owner.toLowerCase()}.github.io/${repository}`
  : '';
const ogImage = siteRoot
  ? `${siteRoot}/assets/og-preview.png`
  : `${base}assets/og-preview.png`;

export default defineConfig({
  base,
  plugins: [{
    name: 'absolute-og-image',
    transformIndexHtml: (html) => html
      .replace('__OG_TITLE__', 'MapTap Dashboard — Today’s Leaderboard')
      .replace('__OG_DESCRIPTION__', 'See who is leading today’s MapTap player leaderboard.')
      .replace('__OG_IMAGE__', ogImage)
      .replace('__OG_URL__', siteRoot ? `${siteRoot}/` : '/')
  }],
  build: { target: 'es2022', sourcemap: true },
  test: { include: ['tests/**/*.test.js'] }
});
