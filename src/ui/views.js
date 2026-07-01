import { icon } from './icons.js';
import { escapeHtml, formatDate, formatScore } from './format.js';
import { sparkline } from './charts.js';
import { monthlyLeaderboard } from '../lib/stats.js';

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

function calendarPicker(minimum, maximum, selected) {
  const dates = [];
  for (let value = minimum; value <= maximum;) {
    dates.push(value);
    const next = new Date(`${value}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    value = next.toISOString().slice(0, 10);
  }
  const months = [...new Set(dates.map((date) => date.slice(0, 7)))];
  return `<div class="calendar-backdrop" data-action="close-calendar">
    <section class="calendar-popover" role="dialog" aria-modal="true" aria-labelledby="calendar-title">
      <div class="calendar-header"><div><h2 id="calendar-title">Choose a day</h2><p>Available from ${formatDate(minimum)}</p></div><button class="icon-button small" type="button" data-action="close-calendar" aria-label="Close calendar">×</button></div>
      ${months.map((month) => {
        const monthDates = dates.filter((date) => date.startsWith(month));
        const monthStart = new Date(`${month}-01T12:00:00Z`);
        const offset = monthStart.getUTCDay() + Number(monthDates[0].slice(-2)) - 1;
        const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(monthStart);
        return `<div class="calendar-month"><h3>${monthLabel}</h3><div class="weekday-row" aria-hidden="true">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => `<span>${day}</span>`).join('')}</div><div class="calendar-grid">${Array.from({ length: offset }, () => '<span></span>').join('')}${monthDates.map((date) => `<button type="button" data-date="${date}" aria-label="${formatDate(date, { month: 'long' })}" aria-pressed="${date === selected}">${Number(date.slice(-2))}</button>`).join('')}</div></div>`;
      }).join('')}
    </section>
  </div>`;
}

function locationTrail(date, locations = []) {
  if (!locations.length) return '';
  const points = locations.map((location, index) => {
    const x = 16 + ((Number(location.lng) + 180) / 360) * 288;
    const y = 12 + ((90 - Number(location.lat)) / 180) * 126;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="10" class="location-pulse"/><circle r="7" class="location-marker"/><text y="3.2">${index + 1}</text></g>`;
  }).join('');
  return `<section class="location-trail" aria-labelledby="location-trail-title">
    <header><div><p>Round locations</p><h2 id="location-trail-title">Where the trail went</h2></div><span>${formatDate(date, { year: undefined })}</span></header>
    <div class="location-trail-layout">
      <figure class="location-map" aria-label="World map showing the five round locations">
        <svg viewBox="0 0 320 150" role="img" aria-hidden="true"><rect width="320" height="150" rx="16"/><path d="M18 45 38 27l32 3 13 15-8 18 12 17-14 20-21-9-9-22-25-7Zm77 73 13-29 22-8 15 16-10 34-19 13Zm43-77 23-17 42 2 21 13 30-5 39 17-9 17-35 2-14 19-29-5-18 13-19-17-20-8Zm72 75 16-18 27 3 18 19-14 14-31-2Z"/><path class="map-grid" d="M0 50h320M0 100h320M80 0v150M160 0v150M240 0v150"/>${points}</svg>
        <figcaption>Five stops across the day’s map</figcaption>
      </figure>
      <ol class="location-list">${locations.map((location, index) => `<li><span>${index + 1}</span><strong>${escapeHtml(location.name)}</strong></li>`).join('')}</ol>
    </div>
  </section>`;
}

export function todayView(data, options = {}) {
  const { spotlightId, minimumDate, maximumDate, calendarOpen, standingsLoading } = options;
  const isToday = data.date === maximumDate;
  const leader = data.players.find((player) => player.playedToday);
  const notPlayed = data.players.filter((player) => !player.playedToday).length;
  const spotlight = data.players.find((player) => player.id === spotlightId) || leader || data.players[0];
  return `<div class="view today-view" data-view="today">
    <section class="winner-hero ${leader ? '' : 'is-empty'}" aria-label="Daily winner">
      <div class="mountain-scene" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="winner-panel">
        <div><p class="hero-label">${icon('trophy', 18)} ${isToday ? 'Today’s leader' : 'Daily leader'}</p><h1>${leader ? escapeHtml(leader.displayName) : 'No scores yet'}</h1><p class="winner-score">${leader ? `${formatScore(leader.score)} points` : 'No one in the group played.'}</p></div>
        <div class="streak-block"><strong>${isToday ? leader?.summary.currentWinStreak ?? 0 : Number(data.date.slice(-2))}</strong><span>${isToday ? 'win streak' : new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(`${data.date}T12:00:00Z`))}</span></div>
      </div>
    </section>

    <section class="surface leaderboard" aria-labelledby="leaderboard-title">
      <div class="section-heading"><div><h2 id="leaderboard-title">${isToday ? 'Today’s leaderboard' : 'Daily leaderboard'}</h2><p>${data.players.length} players${standingsLoading ? ' · checking global standings…' : ''}</p></div><button class="text-action" type="button" data-action="share">${icon('share', 18)} Share</button></div>
      <div class="date-toolbar" aria-label="Leaderboard date controls">
        <button type="button" data-action="previous-day" aria-label="Previous day" ${data.date <= minimumDate ? 'disabled' : ''}>${icon('chevron-left', 18)}</button>
        <button class="date-picker-trigger" type="button" data-action="open-calendar" aria-label="Choose leaderboard date">${icon('calendar', 16)}<span>${formatDate(data.date, { year: undefined })}</span></button>
        <button type="button" data-action="next-day" aria-label="Next day" ${data.date >= maximumDate ? 'disabled' : ''}>${icon('chevron', 18)}</button>
        <button class="today-shortcut" type="button" data-action="jump-today" aria-label="Jump to today" ${isToday ? 'disabled' : ''}>Today</button>
      </div>
      <div class="leader-labels" aria-hidden="true"><span>Rank</span><span>Player</span><span>Score</span><span>Percentile</span><span>Status</span></div>
      <div class="leader-list">${data.players.map(playerRow).join('')}</div>
      <p class="list-note"><span class="status-dot"></span>${data.players.length - notPlayed} played ${isToday ? 'today' : 'on this day'} <span>·</span> ${notPlayed} ${isToday ? 'still exploring' : 'did not play'}</p>
    </section>

    ${isToday ? '' : locationTrail(data.date, data.locationsByDate?.[data.date]?.locations)}

    <section class="summary-section" aria-labelledby="summary-title">
      <div class="summary-heading"><h2 id="summary-title">${spotlight ? `${escapeHtml(spotlight.displayName)}’s last 30 days` : 'Last 30 days'}</h2><label class="player-select"><span>Player</span><select data-summary-select aria-label="Select player for 30-day summary">${data.players.map((player) => `<option value="${escapeHtml(player.id)}" ${player.id === spotlight?.id ? 'selected' : ''}>${escapeHtml(player.displayName)}</option>`).join('')}</select></label></div>
      <div class="summary-grid">
        <div><span>Daily wins</span><strong>${spotlight?.summary.wins ?? 0}</strong><small>in the group</small></div>
        <div><span>Best streak</span><strong>${spotlight?.summary.longestWinStreak ?? 0}</strong><small>days</small></div>
        <div><span>Average</span><strong>${formatScore(spotlight?.summary.average)}</strong><small>points</small></div>
        <div><span>Best score</span><strong>${formatScore(spotlight?.summary.best)}</strong><small>points</small></div>
        <div><span>Games</span><strong>${spotlight?.summary.gamesPlayed ?? 0}</strong><small>played</small></div>
        <div><span>Days missed</span><strong>${spotlight?.summary.daysMissed ?? 30}</strong><small>of 30</small></div>
      </div>
    </section>
    ${calendarOpen ? calendarPicker(minimumDate, maximumDate, data.date) : ''}
  </div>`;
}

function playerCard(player) {
  return `<button class="player-card" type="button" data-player="${escapeHtml(player.id)}">
    <span class="avatar">${escapeHtml(player.displayName.slice(0, 1).toUpperCase())}</span>
    <span><strong>${escapeHtml(player.displayName)}</strong><small>${player.playedToday ? `${formatScore(player.score)} today` : 'Hasn’t played today'}</small></span>
    <span class="mini-win"><strong>${formatScore(player.summary.average)}</strong><small>average</small></span>${icon('chevron', 19)}
  </button>`;
}

export function playersView(data, selectedId) {
  const player = data.players.find((item) => item.id === selectedId);
  if (player) return playerDetail(player, data.date);
  const monthly = monthlyLeaderboard(data);
  const slots = Array.from({ length: 3 }, (_, index) => monthly.players[index] || null);
  const playerList = data.players.toSorted((a, b) => (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER));
  return `<div class="view content-view" data-view="players">
    <section class="monthly-leaderboard" aria-labelledby="monthly-leaderboard-title">
      <header><div><h1 id="monthly-leaderboard-title">${monthly.label} leaderboard</h1><p>Ranked by total wins</p></div><span>Top 3</span></header>
      <div class="monthly-ranks">${slots.map((entry, index) => entry ? `<button class="monthly-rank-row rank-${index + 1}" type="button" data-player="${escapeHtml(entry.id)}" aria-label="View ${escapeHtml(entry.displayName)} details, ranked ${index + 1}">
        <span class="monthly-rank-number">${index + 1}</span>
        <span class="monthly-player"><strong>${escapeHtml(entry.displayName)}</strong><small>${entry.gamesPlayed} ${entry.gamesPlayed === 1 ? 'game' : 'games'} · ${formatScore(entry.average)} avg</small></span>
        <span class="monthly-average"><strong>${entry.wins}</strong><small>${entry.wins === 1 ? 'win' : 'wins'}</small></span>
        ${entry.movement > 0 ? `<span class="monthly-movement up" aria-label="Moved up ${entry.movement} ${entry.movement === 1 ? 'place' : 'places'}">${icon('arrow-up', 15)}<small>${entry.movement}</small></span>` : entry.movement < 0 ? `<span class="monthly-movement down" aria-label="Moved down ${Math.abs(entry.movement)} ${entry.movement === -1 ? 'place' : 'places'}">${icon('arrow-down', 15)}<small>${Math.abs(entry.movement)}</small></span>` : '<span class="monthly-movement neutral" aria-label="No rank movement"></span>'}
      </button>` : `<div class="monthly-rank-row is-empty" aria-label="Rank ${index + 1} empty"><span class="monthly-rank-number">${index + 1}</span><span class="monthly-player">—</span><span class="monthly-average">—</span><span class="monthly-movement neutral">—</span></div>`).join('')}</div>
    </section>
    <header class="players-heading"><div><h1>Players</h1><p>${data.players.length} total</p></div></header>
    <section class="player-list" aria-label="Players">${playerList.map(playerCard).join('')}</section>
  </div>`;
}

function playerDetail(player, date) {
  const summary = player.summary;
  return `<div class="view content-view" data-view="players">
    <button class="back-action" type="button" data-action="back-players">← All players</button>
    <header class="profile-head"><div><p>Player detail</p><h1>${escapeHtml(player.displayName)}</h1><span>${player.playedToday ? `${formatScore(player.score)} on ${formatDate(date, { year: undefined })}` : 'Not played today'}</span></div></header>
    <section class="metric-grid" aria-label="30 day statistics">
      <div><span>Average</span><strong>${formatScore(summary.average)}</strong></div><div><span>Best</span><strong>${formatScore(summary.best)}</strong></div>
      <div><span>Wins</span><strong>${summary.wins}</strong></div><div><span>Longest streak</span><strong>${summary.longestWinStreak}</strong></div>
      <div><span>Games</span><strong>${summary.gamesPlayed}</strong></div><div><span>Days missed</span><strong>${summary.daysMissed}</strong></div>
    </section>
    <section class="chart-card player-score-trail"><div class="section-heading"><div><h2>Score trail</h2><p>Hover or focus any day to see its score</p></div></div>${sparkline(player.history, { label: `${player.displayName} score history`, height: 142 })}</section>
  </div>`;
}
