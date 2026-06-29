import { defineConfig } from 'vite';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const owner = process.env.GITHUB_REPOSITORY?.split('/')[0];
const base = process.env.GITHUB_ACTIONS && repository ? `/${repository}/` : '/';
const ogImage = owner && repository
  ? `https://${owner.toLowerCase()}.github.io/${repository}/assets/og-preview.png`
  : `${base}assets/og-preview.png`;

export default defineConfig({
  base,
  plugins: [{
    name: 'absolute-og-image',
    transformIndexHtml: (html) => html.replace('__OG_IMAGE__', ogImage)
  }],
  build: { target: 'es2022', sourcemap: true },
  test: { include: ['tests/**/*.test.js'] }
});
