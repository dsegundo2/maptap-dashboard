import './styles.css';
import { fetchLiveDashboard, fetchStandingsForDate, fetchStaticDashboard, readCache, writeCache } from './lib/data.js';
import { addDays, dashboardForDate, leaderboardDateRange, standingsCoverPlayers } from './lib/stats.js';
import { icon, logo } from './ui/icons.js';
import { formatDate, formatUpdated } from './ui/format.js';
import { playersView, todayView } from './ui/views.js';
import { shareCardFile } from './ui/share-card.js';

const app = document.querySelector('#app');
const basePath = import.meta.env.BASE_URL.replace(/^\/|\/$/g, '');
const routeParts = window.location.pathname.split('/').filter(Boolean);
const requestedGroup = routeParts[basePath ? routeParts.indexOf(basePath) + 1 : 0] || null;
const state = {
  data: null,
  view: 'today',
  selectedPlayer: null,
  spotlightPlayer: null,
  selectedDate: null,
  calendarOpen: false,
  standingsByDate: {},
  standingsLoading: false,
  loading: true,
  refreshing: false,
  source: 'snapshot',
  message: ''
};

function shell(content = '') {
  const navItems = [
    ['today', 'Today', 'home'],
    ['players', 'Players', 'users']
  ];
  return `<div class="app-shell">
    <header class="app-header">
      <div class="brand">${logo}<div><strong>MapTap Dashboard</strong><span>${state.data ? `${state.data.groupName} · ${formatUpdated(state.data.generatedAt)}` : 'Finding today’s trail…'}</span></div></div>
      <button class="refresh-button ${state.refreshing ? 'is-spinning' : ''}" type="button" data-action="refresh" aria-label="Refresh scores" ${state.refreshing ? 'disabled' : ''}>${icon('refresh', 17)}<span>Refresh</span></button>
    </header>
    ${state.message ? `<div class="toast" role="status">${state.message}</div>` : ''}
    <main id="main-content">${content || '<div class="loading-state"><div class="loader"></div><strong>Checking today’s scores</strong><span>MapTap’s public profiles are on the way.</span></div>'}</main>
    <nav class="bottom-nav" aria-label="Dashboard views">${navItems.map(([view, label, glyph]) => `<button type="button" class="${state.view === view ? 'active' : ''}" data-nav="${view}" ${state.view === view ? 'aria-current="page"' : ''}>${icon(glyph, 21)}<span>${label}</span></button>`).join('')}<a href="https://maptap.gg" target="_blank" rel="noreferrer" aria-label="Play on MapTap.gg (opens in new window)">${icon('external', 21)}<span>MapTap</span></a></nav>
  </div>`;
}

function render() {
  document.body.classList.toggle('calendar-open', state.calendarOpen);
  if (!state.data) {
    app.innerHTML = shell();
    return;
  }
  const dateRange = leaderboardDateRange(state.data.date);
  if (!state.selectedDate || state.selectedDate < dateRange.minimum || state.selectedDate > dateRange.maximum) state.selectedDate = dateRange.maximum;
  const selectedData = dashboardForDate(state.data, state.selectedDate, state.standingsByDate[state.selectedDate]);
  const views = {
    today: () => todayView(selectedData, {
      spotlightId: state.spotlightPlayer,
      minimumDate: dateRange.minimum,
      maximumDate: dateRange.maximum,
      calendarOpen: state.calendarOpen,
      standingsLoading: state.standingsLoading
    }),
    players: () => playersView(state.data, state.selectedPlayer, { spotlightId: state.spotlightPlayer })
  };
  app.innerHTML = shell(views[state.view]());
}

function setMessage(message) {
  state.message = message;
  render();
  window.setTimeout(() => {
    if (state.message === message) {
      state.message = '';
      render();
    }
  }, 2800);
}

async function refresh({ quiet = false } = {}) {
  if (state.refreshing) return state.data;
  state.refreshing = true;
  if (!quiet) render();
  try {
    const data = await fetchLiveDashboard(state.data?.groupId || requestedGroup);
    const previousRoster = state.data?.players.map((player) => player.id).toSorted().join('\n');
    const nextRoster = data.players.map((player) => player.id).toSorted().join('\n');
    if (previousRoster && previousRoster !== nextRoster) state.standingsByDate = {};
    state.data = data;
    state.source = 'live';
    writeCache(data, data.groupId);
    if (!quiet) setMessage('Scores are fresh from MapTap.');
    return data;
  } catch (error) {
    console.warn('Live refresh unavailable; keeping the latest snapshot.', error);
    if (!state.data) state.data = await fetchStaticDashboard(requestedGroup);
    state.source = 'snapshot';
    if (!quiet) setMessage('MapTap is taking a breather—showing the latest snapshot.');
    return state.data;
  } finally {
    state.loading = false;
    state.refreshing = false;
    render();
  }
}

async function shareSelectedDate() {
  setMessage('Refreshing before sharing…');
  const data = await refresh({ quiet: true });
  const selectedData = dashboardForDate(data, state.selectedDate, state.standingsByDate[state.selectedDate]);
  try {
    const file = await shareCardFile(selectedData);
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ files: [file] });
      setMessage('Shared with fresh scores.');
    } else {
      const download = document.createElement('a');
      download.href = URL.createObjectURL(file);
      download.download = file.name;
      download.click();
      window.setTimeout(() => URL.revokeObjectURL(download.href), 1000);
      setMessage('Leaderboard image saved.');
    }
  } catch (error) {
    if (error.name !== 'AbortError') setMessage('Sharing was unavailable. Try again.');
  }
}

async function selectDate(date) {
  if (!state.data) return;
  const range = leaderboardDateRange(state.data.date);
  if (date < range.minimum || date > range.maximum) return;
  state.selectedDate = date;
  state.calendarOpen = false;
  const selected = dashboardForDate(state.data, date);
  const cachedStandings = state.standingsByDate[date];
  const standingsComplete = standingsCoverPlayers(cachedStandings, selected.players);
  state.standingsLoading = date !== state.data.date && !standingsComplete;
  render();
  if (!state.standingsLoading) return;
  const standings = await fetchStandingsForDate(date, selected.players);
  state.standingsByDate[date] = standings;
  if (state.selectedDate === date) {
    state.standingsLoading = false;
    render();
  }
}

function showChartTooltip(point, event) {
  const chart = point.closest('[data-chart]');
  const tooltip = chart?.querySelector('[data-chart-tooltip]');
  if (!chart || !tooltip) return;
  tooltip.querySelector('[data-tooltip-date]').textContent = formatDate(point.dataset.date, { month: 'long' });
  tooltip.querySelector('[data-tooltip-score]').textContent = `${Number(point.dataset.score).toLocaleString()} points`;
  const chartBox = chart.getBoundingClientRect();
  const pointBox = point.getBoundingClientRect();
  const pointerX = event?.clientX ?? pointBox.left + pointBox.width / 2;
  const pointerY = event?.clientY ?? pointBox.top;
  tooltip.style.left = `${Math.min(chartBox.width - 52, Math.max(52, pointerX - chartBox.left))}px`;
  tooltip.style.top = `${Math.max(8, pointerY - chartBox.top - 8)}px`;
  tooltip.hidden = false;
}

function hideChartTooltip(point) {
  const tooltip = point.closest('[data-chart]')?.querySelector('[data-chart-tooltip]');
  if (tooltip) tooltip.hidden = true;
}

app.addEventListener('click', (event) => {
  const chartPoint = event.target.closest('[data-chart-point]');
  if (chartPoint) {
    showChartTooltip(chartPoint);
    return;
  }
  const nav = event.target.closest('[data-nav]');
  if (nav) {
    state.view = nav.dataset.nav;
    state.selectedPlayer = null;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const player = event.target.closest('[data-player]');
  if (player) {
    state.view = 'players';
    state.selectedPlayer = player.dataset.player;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const dateButton = event.target.closest('[data-date]');
  if (dateButton) {
    selectDate(dateButton.dataset.date);
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'refresh') refresh();
  if (action === 'share') shareSelectedDate();
  if (action === 'previous-day') selectDate(addDays(state.selectedDate, -1));
  if (action === 'next-day') selectDate(addDays(state.selectedDate, 1));
  if (action === 'jump-today') selectDate(state.data.date);
  if (action === 'open-calendar') {
    state.calendarOpen = true;
    render();
  }
  if (action === 'close-calendar') {
    state.calendarOpen = false;
    render();
  }
  if (action === 'back-players') {
    state.selectedPlayer = null;
    render();
  }
});

app.addEventListener('pointerover', (event) => {
  const point = event.target.closest('[data-chart-point]');
  if (point) showChartTooltip(point, event);
});

app.addEventListener('pointermove', (event) => {
  const point = event.target.closest('[data-chart-point]');
  if (point) showChartTooltip(point, event);
});

app.addEventListener('pointerout', (event) => {
  const point = event.target.closest('[data-chart-point]');
  if (event.pointerType === 'mouse' && point && !point.contains(event.relatedTarget) && document.activeElement !== point) hideChartTooltip(point);
});

app.addEventListener('focusin', (event) => {
  const point = event.target.closest('[data-chart-point]');
  if (point) showChartTooltip(point);
});

app.addEventListener('focusout', (event) => {
  const point = event.target.closest('[data-chart-point]');
  if (point) hideChartTooltip(point);
});

window.addEventListener('resize', () => {
  app.querySelectorAll('[data-chart-tooltip]').forEach((tooltip) => { tooltip.hidden = true; });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.calendarOpen) {
    state.calendarOpen = false;
    render();
  }
});

app.addEventListener('change', (event) => {
  const select = event.target.closest('[data-summary-select]');
  if (!select) return;
  state.spotlightPlayer = select.value;
  render();
});

async function init() {
  try {
    const snapshot = await fetchStaticDashboard(requestedGroup);
    state.data = readCache(snapshot.configuredPlayers, snapshot.groupId) || snapshot;
    document.title = `MapTap Dashboard — ${state.data.groupName}`;
    state.loading = false;
  } catch (error) {
    console.warn('Static snapshot unavailable.', error);
    const cached = readCache(undefined, requestedGroup || 'default');
    if (cached) {
      state.data = cached;
      state.loading = false;
    }
  }
  render();
  const requestedDate = new URLSearchParams(window.location.search).get('date');
  const range = leaderboardDateRange(state.data?.date || '2026-06-01');
  if (requestedDate && requestedDate >= range.minimum && requestedDate <= range.maximum) state.selectedDate = requestedDate;
  else state.selectedDate = state.data?.date || null;
  render();
  await refresh({ quiet: true });
}

render();
init();
