import { expect, test } from '@playwright/test';
import playerRegistry from '../../public/data/players.json' with { type: 'json' };
import scoreSnapshot from '../../public/data/scores.json' with { type: 'json' };

const [temporaryPlayer, primaryPlayer] = playerRegistry;
const addDays = (date, amount) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
};
const shortDate = (date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const playerSnapshot = (config) => scoreSnapshot.players.find((player) => player.maptapUsername === config.maptapUsername);
const scoreOn = (config, date) => playerSnapshot(config)?.history.find((game) => game.date === date)?.score ?? null;

test.beforeEach(async ({ page }) => {
  await page.route('https://us-central1-jjexperiment-12af6.cloudfunctions.net/**', (route) => route.abort());
  await page.route('https://firebasestorage.googleapis.com/**', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today’s leaderboard' })).toBeVisible();
});

test('loads the fallback leaderboard and navigates through player details', async ({ page }) => {
  await expect(page.getByRole('button', { name: `View ${temporaryPlayer.displayName} details` })).toBeVisible();
  await expect(page.getByRole('button', { name: `View ${primaryPlayer.displayName} details` })).toBeVisible();
  await expect(page.locator('.leader-labels')).toContainText('Percentile');
  await page.getByRole('button', { name: `View ${temporaryPlayer.displayName} details` }).click();
  await expect(page.getByRole('heading', { name: temporaryPlayer.displayName, exact: true })).toBeVisible();
  await expect(page.getByText('Score trail')).toBeVisible();
  await expect(page.locator('.profile-head .avatar')).toHaveCount(0);
  const scoreTrail = page.locator('.player-score-trail');
  await expect(scoreTrail.locator('.chart-axis')).toHaveCount(3);
  const trailPoints = scoreTrail.locator('[data-chart-point]');
  expect(await trailPoints.count()).toBeGreaterThan(1);
  await trailPoints.first().hover();
  await expect(scoreTrail.locator('[data-chart-tooltip]')).toBeVisible();
  await expect(scoreTrail.locator('[data-chart-tooltip]')).toContainText('points');
  await page.getByRole('button', { name: 'All players' }).click();
  await expect(page.getByRole('heading', { name: 'Players', exact: true })).toBeVisible();
});

test('bottom navigation exposes trends and the external MapTap link', async ({ page }) => {
  await page.getByRole('button', { name: 'Trends' }).click();
  await expect(page.getByRole('heading', { name: 'See who’s finding their range' })).toBeVisible();
  const chart = page.locator('[data-chart]').first();
  await expect(chart.locator('.chart-axis')).toHaveCount(3);
  const point = chart.locator('[data-chart-point]').first();
  await point.hover();
  await expect(chart.locator('[data-chart-tooltip]')).toBeVisible();
  await expect(chart.locator('[data-chart-tooltip]')).toContainText('points');
  await point.focus();
  await expect(chart.locator('[data-chart-tooltip]')).toBeVisible();
  const mapTapLink = page.getByRole('link', { name: 'Play on MapTap.gg (opens in new window)' });
  await expect(mapTapLink).toHaveAttribute('href', 'https://maptap.gg');
  await expect(mapTapLink).toHaveAttribute('target', '_blank');
});

test('mobile leaderboard has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.app-header')).toHaveCSS('position', 'relative');
  await expect(page.locator('.bottom-nav')).toHaveCSS('position', 'fixed');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test('desktop uses a persistent side rail instead of mobile app navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(page.locator('.app-header')).toHaveCSS('position', 'relative');
  await expect(page.locator('.bottom-nav')).toHaveCSS('position', 'static');
  const layout = await page.evaluate(() => {
    const navigation = document.querySelector('.bottom-nav').getBoundingClientRect();
    const content = document.querySelector('#main-content').getBoundingClientRect();
    return { navigationRight: navigation.right, contentLeft: content.left };
  });
  expect(layout.navigationRight).toBeLessThan(layout.contentLeft);
});

test('navigates previous and next leaderboard days', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Jump to today' })).toBeDisabled();
  const previousDate = addDays(scoreSnapshot.date, -1);
  await page.getByRole('button', { name: 'Previous day' }).click();
  await expect(page.getByRole('heading', { name: 'Daily leaderboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose leaderboard date' })).toContainText(shortDate(previousDate));
  for (const player of playerRegistry) {
    const row = page.getByRole('button', { name: `View ${player.displayName} details` });
    await expect(row).toContainText(Number.isFinite(scoreOn(player, previousDate)) ? 'Played' : 'Not yet');
  }
  await expect(page.getByRole('button', { name: 'Jump to today' })).toBeEnabled();
  await page.getByRole('button', { name: 'Jump to today' }).click();
  await expect(page.getByRole('heading', { name: 'Today’s leaderboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jump to today' })).toBeDisabled();
});

test('calendar selects the June 1 lower bound with one completed score', async ({ page }) => {
  await page.getByRole('button', { name: 'Choose leaderboard date' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose a day' })).toBeVisible();
  await page.getByRole('button', { name: 'June 1, 2026' }).click();
  const juneFirst = '2026-06-01';
  const scoredPlayers = playerRegistry.filter((player) => Number.isFinite(scoreOn(player, juneFirst)));
  const leader = scoredPlayers.toSorted((a, b) => scoreOn(b, juneFirst) - scoreOn(a, juneFirst))[0];
  await expect(page.getByRole('heading', { name: leader.displayName, exact: true })).toBeVisible();
  for (const player of playerRegistry) {
    const score = scoreOn(player, juneFirst);
    await expect(page.getByRole('button', { name: `View ${player.displayName} details` })).toContainText(Number.isFinite(score) ? score.toLocaleString() : 'Not yet');
  }
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
