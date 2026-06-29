import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://us-central1-jjexperiment-12af6.cloudfunctions.net/**', (route) => route.abort());
  await page.route('https://firebasestorage.googleapis.com/**', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today’s leaderboard' })).toBeVisible();
});

test('loads the fallback leaderboard and navigates through player details', async ({ page }) => {
  await expect(page.getByText('Eo2', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: /View Eo2 details/i }).click();
  await expect(page.getByRole('heading', { name: 'Eo2' })).toBeVisible();
  await expect(page.getByText('Score trail')).toBeVisible();
  await page.getByRole('button', { name: 'All friends' }).click();
  await expect(page.getByRole('heading', { name: 'The whole trail crew' })).toBeVisible();
});

test('bottom navigation exposes trends and about copy', async ({ page }) => {
  await page.getByRole('button', { name: 'Trends' }).click();
  await expect(page.getByRole('heading', { name: 'See who’s finding their range' })).toBeVisible();
  await page.getByRole('button', { name: 'About' }).click();
  await expect(page.getByRole('heading', { name: 'How scores stay fresh' })).toBeVisible();
});

test('mobile leaderboard has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test('keeps all nine friends directly visible without pagination', async ({ page }) => {
  const players = Array.from({ length: 9 }, (_, index) => ({
    id: `friend-${index + 1}`,
    username: `Friend${index + 1}`,
    displayName: `Friend ${index + 1}`,
    score: 990 - index * 10,
    playedToday: true,
    globalRank: index + 31,
    globalPercentile: 99 - index,
    history: [{ date: '2026-06-29', score: 990 - index * 10 }]
  }));
  await page.route('**/data/scores.json', (route) => route.fulfill({ json: { generatedAt: new Date().toISOString(), date: '2026-06-29', globalPlayers: 1000, players } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today’s leaderboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View Friend 9 details' })).toBeVisible();
  expect(await page.locator('[data-player]').count()).toBe(9);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
