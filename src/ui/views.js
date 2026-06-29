import { icon } from './icons.js';
import { escapeHtml, formatDate, formatScore } from './format.js';
import { sparkline } from './charts.js';

function rankMedal(index) {
  const tones = ['gold', 'silver', 'bronze'];
  return `<span class="rank ${tones[index] || ''}">${index + 1}</span>`;
}

function playerRow(player, index) {
  const standing = Number.isFinite(player.globalPercentile) ? `${player.globalPercentile.toFixed(1)}%` : '—';
  return `<button class="leader-row" type="button" data-player="${escapeHtml(player.id)}" aria-label="View ${escapeHtml(player.displayName)} details">
    ${rankMedal(index)}
    <span class="leader-name">${escapeHtml(player.displayName)}</span>
    <strong class="leader-score">${formatScore(player.score)}</strong>
    <span class="leader-percentile">${standing}</span>
    <span class="played-state ${player.playedToday ? 'is-played' : ''}">${player.playedToday ? 'Played' : 'Not yet'}</span>
  </button>`;
}

export function todayView(data, spotlightId) {
  const leader = data.players.find((player) => player.playedToday);
  const notPlayed = data.players.filter((player) => !player.playedToday).length;
  const spotlight = data.players.find((player) => player.id === spotlightId) || leader || data.players[0];
  return `<div class="view today-view" data-view="today">
    <section class="winner-hero ${leader ? '' : 'is-empty'}" aria-label="Daily winner">
      <div class="mountain-scene" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="winner-panel">
        <div><p class="hero-label">${icon('trophy', 18)} Today’s leader</p><h1>${leader ? escapeHtml(leader.displayName) : 'No scores yet'}</h1><p class="winner-score">${leader ? `${formatScore(leader.score)} points` : 'The trail is wide open.'}</p></div>
        <div class="streak-block"><strong>${leader?.summary.currentWinStreak ?? 0}</strong><span>win streak</span></div>
      </div>
    </section>

    <section class="surface leaderboard" aria-labelledby="leaderboard-title">
      <div class="section-heading"><div><h2 id="leaderboard-title">Today’s leaderboard</h2><p>${formatDate(data.date, { year: undefined })} · ${data.players.length} friends</p></div><button class="text-action" type="button" data-action="share">${icon('share', 18)} Share</button></div>
      <div class="leader-labels" aria-hidden="true"><span>Rank</span><span>Player</span><span>Score</span><span>Global</span><span>Status</span></div>
      <div class="leader-list">${data.players.map(playerRow).join('')}</div>
      <p class="list-note"><span class="status-dot"></span>${data.players.length - notPlayed} played today <span>·</span> ${notPlayed} still exploring</p>
    </section>

    <section class="summary-section" aria-labelledby="summary-title">
      <div class="section-heading"><div><h2 id="summary-title">${spotlight ? `${escapeHtml(spotlight.displayName)}’s last 30 days` : 'Last 30 days'}</h2><p>Choose any friend—no account needed</p></div></div>
      <div class="person-switcher" role="group" aria-label="Choose player for 30-day summary">${data.players.map((player) => `<button type="button" class="${player.id === spotlight?.id ? 'active' : ''}" data-summary-player="${escapeHtml(player.id)}">${escapeHtml(player.displayName)}</button>`).join('')}</div>
      <div class="summary-grid">
        <div><span>Daily wins</span><strong>${spotlight?.summary.wins ?? 0}</strong><small>in the group</small></div>
        <div><span>Best streak</span><strong>${spotlight?.summary.longestWinStreak ?? 0}</strong><small>days</small></div>
        <div><span>Average</span><strong>${formatScore(spotlight?.summary.average)}</strong><small>points</small></div>
        <div><span>Best score</span><strong>${formatScore(spotlight?.summary.best)}</strong><small>points</small></div>
        <div><span>Games</span><strong>${spotlight?.summary.gamesPlayed ?? 0}</strong><small>played</small></div>
        <div><span>Days missed</span><strong>${spotlight?.summary.daysMissed ?? 30}</strong><small>of 30</small></div>
      </div>
    </section>
  </div>`;
}

function playerCard(player) {
  return `<button class="player-card" type="button" data-player="${escapeHtml(player.id)}">
    <span class="avatar">${escapeHtml(player.displayName.slice(0, 1).toUpperCase())}</span>
    <span><strong>${escapeHtml(player.displayName)}</strong><small>${player.playedToday ? `${formatScore(player.score)} today` : 'Hasn’t played today'}</small></span>
    <span class="mini-win"><strong>${player.summary.wins}</strong><small>wins</small></span>${icon('chevron', 19)}
  </button>`;
}

export function playersView(data, selectedId) {
  const player = data.players.find((item) => item.id === selectedId);
  if (player) return playerDetail(player, data.date);
  return `<div class="view content-view" data-view="players">
    <header class="page-intro"><p>Friends</p><h1>The whole trail crew</h1><span>Built for a close group—everyone stays in view.</span></header>
    <section class="player-list" aria-label="Players">${data.players.map(playerCard).join('')}</section>
  </div>`;
}

function playerDetail(player, date) {
  const summary = player.summary;
  return `<div class="view content-view" data-view="players">
    <button class="back-action" type="button" data-action="back-players">← All friends</button>
    <header class="profile-head"><span class="avatar large">${escapeHtml(player.displayName.slice(0, 1).toUpperCase())}</span><div><p>Player detail</p><h1>${escapeHtml(player.displayName)}</h1><span>${player.playedToday ? `${formatScore(player.score)} on ${formatDate(date, { year: undefined })}` : 'Not played today'}</span></div></header>
    <section class="metric-grid" aria-label="30 day statistics">
      <div><span>Average</span><strong>${formatScore(summary.average)}</strong></div><div><span>Best</span><strong>${formatScore(summary.best)}</strong></div>
      <div><span>Wins</span><strong>${summary.wins}</strong></div><div><span>Longest streak</span><strong>${summary.longestWinStreak}</strong></div>
      <div><span>Games</span><strong>${summary.gamesPlayed}</strong></div><div><span>Days missed</span><strong>${summary.daysMissed}</strong></div>
    </section>
    <section class="chart-card"><div class="section-heading"><div><h2>Score trail</h2><p>Last 30 recorded games</p></div></div>${sparkline(player.history, { label: `${player.displayName} score history` })}</section>
  </div>`;
}

export function trendsView(data) {
  return `<div class="view content-view" data-view="trends">
    <header class="page-intro"><p>Trends</p><h1>See who’s finding their range</h1><span>Thirty-day score trails for every friend.</span></header>
    <div class="trend-stack">${data.players.map((player) => `<section class="chart-card"><div class="trend-title"><div><strong>${escapeHtml(player.displayName)}</strong><small>${formatScore(player.summary.average)} average</small></div><span class="trend-score">${formatScore(player.score)}</span></div>${sparkline(player.history, { label: `${player.displayName} score history`, height: 86 })}</section>`).join('')}</div>
  </div>`;
}

export function aboutView(data) {
  return `<div class="view content-view" data-view="about">
    <header class="page-intro"><p>About</p><h1>A friendly view of MapTap</h1><span>A lightweight dashboard for a group of fewer than ten friends.</span></header>
    <section class="about-copy">
      <h2>How scores stay fresh</h2><p>The app reads each configured public MapTap profile in your browser and compares today’s scores with MapTap’s public daily totals. The last successful static snapshot remains available if MapTap is temporarily unreachable.</p>
      <h2>What “global” means</h2><p>Global rank is exact for players included in MapTap’s published leaderboard and estimated from its public score distribution otherwise. Percentiles compare a score with all completed games today.</p>
      <h2>Sharing on iMessage</h2><p>The Share button refreshes first, then includes today’s leader and score in the message. GitHub Actions rebuilds the large link-preview image hourly because GitHub Pages itself cannot render metadata on demand.</p>
      <div class="data-note">${icon('wifi', 19)} <span>Snapshot generated <strong>${new Date(data.generatedAt).toLocaleString()}</strong></span></div>
      <a class="maptap-link" href="https://maptap.gg" target="_blank" rel="noreferrer">Play on MapTap.gg ↗</a>
    </section>
  </div>`;
}
