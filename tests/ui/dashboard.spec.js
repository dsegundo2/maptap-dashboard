import { expect, test } from '@playwright/test';
import groupRegistry from '../../public/data/groups.json' with { type: 'json' };
import scoreSnapshot from '../../public/data/scores.json' with { type: 'json' };
import { enabledGroups, resolveGroup } from '../../src/lib/groups.js';

const configuredGroups = enabledGroups(groupRegistry);
const defaultGroup = resolveGroup(groupRegistry);
const playerRegistry = defaultGroup.players;
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

test('selects a Today player on the Players tab without a detail page', async ({ page }) => {
  const dailyList = page.locator('.leader-list');
  await expect(dailyList.getByRole('button', { name: `Select ${temporaryPlayer.displayName} on the Players tab`, exact: true })).toBeVisible();
  await expect(dailyList.getByRole('button', { name: `Select ${primaryPlayer.displayName} on the Players tab`, exact: true })).toBeVisible();
  await expect(page.locator('.leader-labels')).toContainText('Percentile');
  const todayLeader = scoreSnapshot.players.find((player) => player.playedToday);
  await page.getByRole('button', { name: `Select daily leader ${todayLeader.displayName} on the Players tab`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Show ${todayLeader.displayName}’s 30-day stats`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await dailyList.getByRole('button', { name: `Select ${temporaryPlayer.displayName} on the Players tab`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Players', exact: true })).toBeVisible();
  await expect(page.locator('#summary-title')).toContainText(temporaryPlayer.displayName);
  await expect(page.getByRole('button', { name: `Show ${temporaryPlayer.displayName}’s 30-day stats`, exact: true })).toHaveAttribute('aria-pressed', 'true');
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
  await expect(page.getByRole('button', { name: 'All players' })).toHaveCount(0);
});

test('players view shows player summaries instead of the monthly leaderboard', async ({ page }) => {
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await expect(page.locator('#summary-title')).toContainText('last 30 days');
  await expect(page.getByText('Ranked by total wins')).toHaveCount(0);
  await expect(page.locator('.player-card .mini-win small').first()).toHaveText('30-day avg');
  await expect(page.locator('.player-card .avatar').first()).toHaveText('DD');
  await expect(page.getByRole('button', { name: new RegExp(playerRegistry[0].displayName) })).toBeVisible();
  await expect(page.locator('.monthly-rank-row')).toHaveCount(0);
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
    const row = page.locator('.leader-list').getByRole('button', { name: `Select ${player.displayName} on the Players tab`, exact: true });
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
    await expect(page.locator('.leader-list').getByRole('button', { name: `Select ${player.displayName} on the Players tab`, exact: true })).toContainText(Number.isFinite(score) ? score.toLocaleString() : 'Not yet');
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
  await page.route('**/data/groups.json', (route) => route.fulfill({ json: { defaultGroup: 'HB', groups: { HB: { name: 'HB', players: players.map(({ maptapUsername, displayName }) => ({ maptapUsername, displayName, enabled: true })) } } } }));
  await page.goto('/?date=2026-06-01');
  await expect(page.getByRole('heading', { name: 'No scores yet' })).toBeVisible();
  await expect(page.getByText('No one in the group played.')).toBeVisible();
  await expect(page.locator('.leader-row .played-state')).toHaveText(playerRegistry.map(() => 'Not yet'));
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
  await page.route('**/data/groups.json', (route) => route.fulfill({ json: { defaultGroup: 'HB', groups: { HB: { name: 'HB', players: players.map(({ maptapUsername, displayName }) => ({ maptapUsername, displayName, enabled: true })) } } } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today’s leaderboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Player 9 on the Players tab' })).toBeVisible();
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Select player for 30-day summary' })).toHaveCount(0);
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
  await page.route('**/data/groups.json', (route) => route.fulfill({ json: { defaultGroup: 'HB', groups: { HB: { name: 'HB', players: players.map(({ maptapUsername, displayName }) => ({ maptapUsername, displayName, enabled: true })) } } } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'July leaderboard' })).toBeVisible();
  await expect(page.getByLabel('Moved up 1 place')).toBeVisible();
  await expect(page.getByLabel('Moved down 1 place')).toBeVisible();
  await expect(page.locator('.monthly-rank-row.is-empty')).toHaveCount(1);
});

test('every configured group URL loads its configured roster', async ({ page }) => {
  const routeBase = process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}`
    : '';

  for (const group of configuredGroups) {
    await page.goto(`${routeBase}/${group.id}`);
    await expect(page.locator('.brand')).toContainText(group.name);
    for (const player of group.players) {
      await expect(page.locator('.leader-list').getByRole('button', { name: `Select ${player.displayName} on the Players tab`, exact: true })).toBeVisible();
    }
  }
});

test('shares the selected day as a group-specific website link', async ({ page }) => {
  await page.addInitScript(() => {
    window.sharedPayload = null;
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (payload) => { window.sharedPayload = payload; }
    });
  });
  await page.goto('/SB');
  await expect(page.locator('.brand')).toContainText('SB');
  await page.getByRole('button', { name: 'Share' }).click();
  await expect.poll(() => page.evaluate(() => window.sharedPayload)).not.toBeNull();
  const payload = await page.evaluate(() => window.sharedPayload);
  expect(payload.url).toBe(`http://127.0.0.1:4179/SB/${scoreSnapshot.date}/`);
  expect(payload.title).toContain('SB MapTap leaderboard');
  expect(payload).not.toHaveProperty('files');
});
