import './styles.css';
import { fetchLiveDashboard, fetchStandingsForDate, fetchStaticDashboard, readCache, writeCache } from './lib/data.js';
import { addDays, dashboardForDate, leaderboardDateRange } from './lib/stats.js';
import { icon, logo } from './ui/icons.js';
import { formatDate, formatUpdated } from './ui/format.js';
import { playersView, todayView, trendsView } from './ui/views.js';

const app = document.querySelector('#app');
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
    ['players', 'Players', 'users'],
    ['trends', 'Trends', 'trend']
  ];
  return `<div class="app-shell">
    <header class="app-header">
      <div class="brand">${logo}<div><strong>MapTap Dashboard</strong><span>${state.data ? formatUpdated(state.data.generatedAt) : 'Finding today’s trail…'}</span></div></div>
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
    players: () => playersView(state.data, state.selectedPlayer),
    trends: () => trendsView(state.data)
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
    const data = await fetchLiveDashboard();
    state.data = data;
    state.source = 'live';
    writeCache(data);
    if (!quiet) setMessage('Scores are fresh from MapTap.');
    return data;
  } catch (error) {
    console.warn('Live refresh unavailable; keeping the latest snapshot.', error);
    if (!state.data) state.data = await fetchStaticDashboard();
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
  const leader = selectedData.players.find((player) => player.playedToday);
  const isToday = state.selectedDate === data.date;
  const dateLabel = formatDate(state.selectedDate);
  const text = leader
    ? `${isToday ? 'Today’s' : `${dateLabel}’s`} MapTap leader is ${leader.displayName} with ${leader.score.toLocaleString()} points. See the full player leaderboard:`
    : `No one in our MapTap group recorded a score for ${isToday ? 'today' : dateLabel}:`;
  const url = new URL(window.location.href);
  url.searchParams.set('date', state.selectedDate);
  url.searchParams.set('shared', Date.now().toString());
  try {
    if (navigator.share) {
      await navigator.share({ title: `MapTap Dashboard — ${dateLabel}`, text, url: url.toString() });
      setMessage('Shared with fresh scores.');
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setMessage('Fresh leaderboard link copied.');
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
  state.standingsLoading = date !== state.data.date && !state.standingsByDate[date];
  render();
  if (!state.standingsLoading) return;
  const selected = dashboardForDate(state.data, date);
  const standings = await fetchStandingsForDate(date, selected.players);
  state.standingsByDate[date] = standings;
  if (state.selectedDate === date) {
    state.standingsLoading = false;
    render();
  }
}

app.addEventListener('click', (event) => {
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
  const cached = readCache();
  if (cached) {
    state.data = cached;
    state.loading = false;
  } else {
    try {
      state.data = await fetchStaticDashboard();
      state.loading = false;
    } catch (error) {
      console.warn('Static snapshot unavailable.', error);
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
