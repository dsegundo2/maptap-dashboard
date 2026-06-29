import './styles.css';
import { fetchLiveDashboard, fetchStaticDashboard, readCache, writeCache } from './lib/data.js';
import { icon, logo } from './ui/icons.js';
import { formatUpdated } from './ui/format.js';
import { aboutView, playersView, todayView, trendsView } from './ui/views.js';

const app = document.querySelector('#app');
const state = {
  data: null,
  view: 'today',
  selectedPlayer: null,
  spotlightPlayer: null,
  loading: true,
  refreshing: false,
  source: 'snapshot',
  message: ''
};

function shell(content = '') {
  const navItems = [
    ['today', 'Today', 'home'],
    ['players', 'Players', 'users'],
    ['trends', 'Trends', 'trend'],
    ['about', 'About', 'info']
  ];
  return `<div class="app-shell">
    <header class="app-header">
      <div class="brand">${logo}<div><strong>MapTap Dashboard</strong><span>${state.data ? formatUpdated(state.data.generatedAt) : 'Finding today’s trail…'}</span></div></div>
      <button class="icon-button ${state.refreshing ? 'is-spinning' : ''}" type="button" data-action="refresh" aria-label="Refresh scores" ${state.refreshing ? 'disabled' : ''}>${icon('refresh', 22)}</button>
    </header>
    ${state.message ? `<div class="toast" role="status">${state.message}</div>` : ''}
    <main id="main-content">${content || '<div class="loading-state"><div class="loader"></div><strong>Checking today’s scores</strong><span>MapTap’s public profiles are on the way.</span></div>'}</main>
    <nav class="bottom-nav" aria-label="Dashboard views">${navItems.map(([view, label, glyph]) => `<button type="button" class="${state.view === view ? 'active' : ''}" data-nav="${view}" ${state.view === view ? 'aria-current="page"' : ''}>${icon(glyph, 21)}<span>${label}</span></button>`).join('')}</nav>
  </div>`;
}

function render() {
  if (!state.data) {
    app.innerHTML = shell();
    return;
  }
  const views = {
    today: () => todayView(state.data, state.spotlightPlayer),
    players: () => playersView(state.data, state.selectedPlayer),
    trends: () => trendsView(state.data),
    about: () => aboutView(state.data)
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

async function shareToday() {
  setMessage('Refreshing before sharing…');
  const data = await refresh({ quiet: true });
  const leader = data.players.find((player) => player.playedToday);
  const text = leader
    ? `Today’s MapTap leader is ${leader.displayName} with ${leader.score.toLocaleString()} points. See the full friend leaderboard:`
    : 'No one in our MapTap group has played yet today. The trail is wide open:';
  const url = new URL(window.location.href);
  url.searchParams.set('shared', Date.now().toString());
  try {
    if (navigator.share) {
      await navigator.share({ title: 'MapTap Dashboard — Today’s Leaderboard', text, url: url.toString() });
      setMessage('Shared with today’s fresh scores.');
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setMessage('Fresh leaderboard link copied.');
    }
  } catch (error) {
    if (error.name !== 'AbortError') setMessage('Sharing was unavailable. Try again.');
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
  const summaryPlayer = event.target.closest('[data-summary-player]');
  if (summaryPlayer) {
    state.spotlightPlayer = summaryPlayer.dataset.summaryPlayer;
    render();
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'refresh') refresh();
  if (action === 'share') shareToday();
  if (action === 'back-players') {
    state.selectedPlayer = null;
    render();
  }
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
  await refresh({ quiet: true });
}

render();
init();
