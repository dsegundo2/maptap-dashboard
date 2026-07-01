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
  const geometryBeforeClick = await scoreTrail.locator('polyline').getAttribute('points');
  await trailPoints.first().hover();
  await expect(scoreTrail.locator('[data-chart-tooltip]')).toBeVisible();
  await expect(scoreTrail.locator('[data-chart-tooltip]')).toContainText('points');
  await trailPoints.first().click();
  await expect(scoreTrail.locator('polyline')).toHaveAttribute('points', geometryBeforeClick);
  await expect(scoreTrail.locator('svg')).toHaveCount(1);
  await expect(page.locator('.view')).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: 'All players' }).click();
  await expect(page.getByRole('heading', { name: 'Players', exact: true })).toBeVisible();
});

test('players view shows the monthly top three and external MapTap link', async ({ page }) => {
  await page.getByRole('button', { name: 'Players' }).click();
  await expect(page.getByRole('heading', { name: /leaderboard/ })).toBeVisible();
  await expect(page.getByText('Ranked by total wins')).toBeVisible();
  await expect(page.locator('.player-card .mini-win small').first()).toHaveText('average');
  await expect(page.getByRole('button', { name: /Diego Dad/ })).toBeVisible();
  await expect(page.getByText('Eo2', { exact: true })).toHaveCount(0);
  await expect(page.locator('.monthly-rank-row')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Trends' })).toHaveCount(0);
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
  await expect(page.locator('.location-trail')).toHaveCount(0);
  const previousDate = addDays(scoreSnapshot.date, -1);
  await page.getByRole('button', { name: 'Previous day' }).click();
  await expect(page.getByRole('heading', { name: 'Daily leaderboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Where the trail went' })).toBeVisible();
  await expect(page.locator('.location-list li')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Choose leaderboard date' })).toContainText(shortDate(previousDate));
  for (const player of playerRegistry) {
    const row = page.getByRole('button', { name: `View ${player.displayName} details` });
    await expect(row).toContainText(Number.isFinite(scoreOn(player, previousDate)) ? 'Played' : 'Not yet');
  }
  await expect(page.getByRole('button', { name: 'Jump to today' })).toBeEnabled();
  await page.getByRole('button', { name: 'Jump to today' }).click();
  await expect(page.getByRole('heading', { name: 'Today’s leaderboard' })).toBeVisible();
  await expect(page.locator('.location-trail')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Jump to today' })).toBeDisabled();
});

test('calendar selects the rolling lower bound with one completed score', async ({ page }) => {
  const rollingMinimum = addDays(scoreSnapshot.date, -29);
  const minimumDate = rollingMinimum > '2026-06-01' ? rollingMinimum : '2026-06-01';
  const minimumLabel = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${minimumDate}T12:00:00Z`));
  await page.getByRole('button', { name: 'Choose leaderboard date' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose a day' })).toBeVisible();
  await page.getByRole('button', { name: minimumLabel }).click();
  const scoredPlayers = playerRegistry.filter((player) => Number.isFinite(scoreOn(player, minimumDate)));
  const leader = scoredPlayers.toSorted((a, b) => scoreOn(b, minimumDate) - scoreOn(a, minimumDate))[0];
  await expect(page.getByRole('heading', { name: leader.displayName, exact: true })).toBeVisible();
  for (const player of playerRegistry) {
    const score = scoreOn(player, minimumDate);
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
  await page.route('**/data/players.json', (route) => route.fulfill({ json: players.map(({ maptapUsername, displayName }) => ({ maptapUsername, displayName, enabled: true })) }));
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
  expect(await page.getByRole('combobox', { name: 'Select player for 30-day summary' }).locator('option').count()).toBe(9);
  await page.getByRole('button', { name: 'Players' }).click();
  expect(await page.locator('.player-list [data-player]').count()).toBe(9);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test('monthly leaderboard handles movement and empty slots', async ({ page }) => {
  const players = [
    { id: 'amy', maptapUsername: 'Amy', displayName: 'Amy', history: [{ date: '2026-07-01', score: 900 }, { date: '2026-07-02', score: 700 }] },
    { id: 'bob', maptapUsername: 'Bob', displayName: 'Bob', history: [{ date: '2026-07-01', score: 800 }, { date: '2026-07-02', score: 950 }] },
    { id: 'empty', maptapUsername: 'Empty', displayName: 'Empty', history: [] }
  ];
  await page.route('**/data/scores.json', (route) => route.fulfill({ json: { generatedAt: new Date().toISOString(), date: '2026-07-02', globalPlayers: 1000, players } }));
  await page.route('**/data/players.json', (route) => route.fulfill({ json: players.map(({ maptapUsername, displayName }) => ({ maptapUsername, displayName, enabled: true })) }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Players' }).click();
  await expect(page.getByRole('heading', { name: 'July leaderboard' })).toBeVisible();
  await expect(page.getByLabel('Moved up 1 place')).toBeVisible();
  await expect(page.getByLabel('Moved down 1 place')).toBeVisible();
  await expect(page.locator('.monthly-rank-row.is-empty')).toHaveCount(1);
});
