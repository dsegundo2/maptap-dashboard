import { expect, test } from '@playwright/test';
import playerRegistry from '../../public/data/players.json' with { type: 'json' };

const [temporaryPlayer, primaryPlayer] = playerRegistry;

test.beforeEach(async ({ page }) => {
  await page.route('https://us-central1-jjexperiment-12af6.cloudfunctions.net/**', (route) => route.abort());
  await page.route('https://firebasestorage.googleapis.com/**', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today’s leaderboard' })).toBeVisible();
});

test('loads the fallback leaderboard and navigates through player details', async ({ page }) => {
  await expect(page.getByRole('button', { name: `View ${temporaryPlayer.displayName} details` })).toBeVisible();
  await expect(page.getByRole('button', { name: `View ${primaryPlayer.displayName} details` })).toContainText('Played');
  await page.getByRole('button', { name: `View ${temporaryPlayer.displayName} details` }).click();
  await expect(page.getByRole('heading', { name: temporaryPlayer.displayName, exact: true })).toBeVisible();
  await expect(page.getByText('Score trail')).toBeVisible();
  await page.getByRole('button', { name: 'All players' }).click();
  await expect(page.getByRole('heading', { name: 'Players', exact: true })).toBeVisible();
});

test('bottom navigation exposes trends and the external MapTap link', async ({ page }) => {
  await page.getByRole('button', { name: 'Trends' }).click();
  await expect(page.getByRole('heading', { name: 'See who’s finding their range' })).toBeVisible();
  const mapTapLink = page.getByRole('link', { name: 'Play on MapTap.gg (opens in new window)' });
  await expect(mapTapLink).toHaveAttribute('href', 'https://maptap.gg');
  await expect(mapTapLink).toHaveAttribute('target', '_blank');
});

test('mobile leaderboard has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test('navigates previous and next leaderboard days', async ({ page }) => {
  await page.getByRole('button', { name: 'Previous day' }).click();
  await expect(page.getByRole('heading', { name: 'Daily leaderboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose leaderboard date' })).toContainText('Jun 28');
  await expect(page.getByRole('button', { name: `View ${temporaryPlayer.displayName} details` })).toContainText('Played');
  await expect(page.getByRole('button', { name: `View ${temporaryPlayer.displayName} details` })).not.toContainText('932');
  await expect(page.getByRole('button', { name: `View ${primaryPlayer.displayName} details` })).toContainText('Played');
  await page.getByRole('button', { name: 'Next day' }).click();
  await expect(page.getByRole('heading', { name: 'Today’s leaderboard' })).toBeVisible();
});

test('calendar selects the June 1 lower bound with one completed score', async ({ page }) => {
  await page.getByRole('button', { name: 'Choose leaderboard date' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose a day' })).toBeVisible();
  await page.getByRole('button', { name: 'June 1, 2026' }).click();
  await expect(page.getByRole('heading', { name: primaryPlayer.displayName, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `View ${primaryPlayer.displayName} details` })).toContainText('759');
  await expect(page.getByRole('button', { name: `View ${temporaryPlayer.displayName} details` })).toContainText('Not yet');
  await expect(page.getByRole('button', { name: 'Previous day' })).toBeDisabled();
});

test('renders a clear empty state when no one has a score', async ({ page }) => {
  const players = playerRegistry.map(({ displayName, maptapUsername }, index) => ({
    id: `empty-${index}`,
    maptapUsername,
    displayName,
    score: 900 - index,
    playedToday: true,
    globalRank: 31 + index,
    globalPercentile: 90 - index,
    history: [{ date: '2026-06-29', score: 900 - index }]
  }));
  await page.route('**/data/scores.json', (route) => route.fulfill({ json: { generatedAt: new Date().toISOString(), date: '2026-06-29', globalPlayers: 1000, players } }));
  await page.goto('/?date=2026-06-01');
  await expect(page.getByRole('heading', { name: 'No scores yet' })).toBeVisible();
  await expect(page.getByText('No one in the group played.')).toBeVisible();
  await expect(page.locator('.leader-row .played-state')).toHaveText(['Not yet', 'Not yet']);
});

test('keeps all nine players directly visible without pagination', async ({ page }) => {
  const players = Array.from({ length: 9 }, (_, index) => ({
    id: `player-${index + 1}`,
    maptapUsername: `Player${index + 1}`,
    displayName: `Player ${index + 1}`,
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
  await expect(page.getByRole('button', { name: 'View Player 9 details' })).toBeVisible();
  expect(await page.locator('[data-player]').count()).toBe(9);
  expect(await page.getByRole('combobox', { name: 'Select player for 30-day summary' }).locator('option').count()).toBe(9);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
