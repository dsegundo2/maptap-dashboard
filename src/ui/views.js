import { icon } from './icons.js';
import { escapeHtml, formatDate, formatScore } from './format.js';
import { sparkline } from './charts.js';
import { monthlyLeaderboard, playerContinentStats, teamStats } from '../lib/stats.js';
import { projectLocation, WORLD_LAND_PATH } from './world-map.js';

function rankMedal(index) {
  const tones = ['gold', 'silver', 'bronze'];
  return `<span class="rank ${tones[index] || ''}">${index + 1}</span>`;
}

function playerInitials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2) || '?').toUpperCase();
}

function playerRow(player, index) {
  const standing = Number.isFinite(player.globalPercentile) ? `${player.globalPercentile.toFixed(1)}%` : '—';
  return `<button class="leader-row" type="button" data-player="${escapeHtml(player.id)}" aria-label="Select ${escapeHtml(player.displayName)} on the Players tab">
    ${rankMedal(index)}
    <span class="leader-name">${escapeHtml(player.displayName)}</span>
    <strong class="leader-score">${formatScore(player.score)}</strong>
    <span class="leader-percentile">${standing}</span>
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
  const projectedLocations = locations.map((location) => projectLocation(location.lat, location.lng));
  const route = projectedLocations.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  const points = projectedLocations.map(({ x, y }, index) => {
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="10" class="location-pulse"/><circle r="7" class="location-marker"/><text y="3.2">${index + 1}</text></g>`;
  }).join('');
  return `<section class="location-trail" aria-labelledby="location-trail-title">
    <header><div><p>Round locations</p><h2 id="location-trail-title">Where the trail went</h2></div><span>${formatDate(date, { year: undefined })}</span></header>
    <div class="location-trail-layout">
      <figure class="location-map" aria-label="World map showing the five round locations">
        <svg viewBox="0 0 320 150" role="img"><title>Five round locations plotted by latitude and longitude</title><rect width="320" height="150" rx="16"/><path class="map-grid" d="M10 52.7h300M10 97.3h300M85 8v134M160 8v134M235 8v134"/><path class="world-land" d="${WORLD_LAND_PATH}"/><path class="location-route" d="${route}"/>${points}</svg>
        <figcaption>Plotted from each location’s coordinates</figcaption>
      </figure>
      <ol class="location-list">${locations.map((location, index) => `<li><span>${index + 1}</span><strong>${escapeHtml(location.name)}</strong></li>`).join('')}</ol>
    </div>
  </section>`;
}


function continentSplit(title, entries, note = '') {
  if (!entries?.length) return '';
  return `<section class="continent-card" aria-labelledby="${escapeHtml(title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">
    <div class="section-heading"><div><h2 id="${escapeHtml(title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">${escapeHtml(title)}</h2>${note ? `<p>${note}</p>` : ''}</div></div>
    <div class="continent-list">${entries.map((entry) => `<article><div><strong>${escapeHtml(entry.continent)}</strong><small>${entry.days} ${entry.days === 1 ? 'round' : 'rounds'} matched</small></div><span>${formatScore(entry.average)}/100</span><i style="--bar:${Math.max(8, Math.min(100, Math.round((entry.average / 100) * 100)))}%"></i></article>`).join('')}</div>
  </section>`;
}

function playerSummary(data, spotlightId) {
  const leader = data.players.find((player) => player.playedToday);
  const spotlight = data.players.find((player) => player.id === spotlightId) || leader || data.players[0];
  if (!spotlight) return '';
  return `<section id="player-insights" class="summary-section player-summary" aria-labelledby="summary-title" aria-live="polite">
    <div class="summary-heading"><div><p>Selected player</p><h2 id="summary-title">${escapeHtml(spotlight.displayName)}’s last 30 days</h2></div></div>
    <div class="summary-grid">
      <div><span>Daily wins</span><strong>${spotlight?.summary.wins ?? 0}</strong><small>full group</small></div>
      ${Number.isFinite(spotlight?.summary.chatWins) ? `<div><span>Chat group wins</span><strong>${spotlight.summary.chatWins}</strong><small>subgroup</small></div>` : ''}
      <div><span>Best streak</span><strong>${spotlight?.summary.longestWinStreak ?? 0}</strong><small>days</small></div>
      <div><span>30-day average</span><strong>${formatScore(spotlight?.summary.average)}</strong><small>points</small></div>
      <div><span>Best score</span><strong>${formatScore(spotlight?.summary.best)}</strong><small>points</small></div>
      <div><span>Games</span><strong>${spotlight?.summary.gamesPlayed ?? 0}</strong><small>played</small></div>
      <div><span>Days missed</span><strong>${spotlight?.summary.daysMissed ?? 30}</strong><small>of 30</small></div>
    </div>
    ${continentSplit(`${spotlight.displayName} by continent`, playerContinentStats(data, spotlight), 'Average round score by archived location continent.')}
    <section class="chart-card player-score-trail"><div class="section-heading"><div><h2>${escapeHtml(spotlight.displayName)}’s score trail</h2><p>Last 30 days · hover or focus any played day to see its score</p></div></div>${sparkline(spotlight.history, { label: `${spotlight.displayName} score history`, height: 142, endDate: data.date })}</section>
  </section>`;
}

function monthlyBoard(data, className = '') {
  const monthly = monthlyLeaderboard(data);
  return `<section class="monthly-leaderboard ${className}" aria-labelledby="monthly-leaderboard-title">
    <header><div><h2 id="monthly-leaderboard-title">${monthly.label} leaderboard</h2><p>Ranked by total wins</p></div><span>Full standings</span></header>
    <div class="monthly-ranks">${monthly.players.map((entry) => `<button class="monthly-rank-row rank-${entry.rank}" type="button" data-player="${escapeHtml(entry.id)}" aria-label="Select ${escapeHtml(entry.displayName)} on the Players tab, ranked ${entry.rank}">
      ${rankMedal(entry.rank - 1)}
      <span class="monthly-player"><strong>${escapeHtml(entry.displayName)}</strong><small>${entry.gamesPlayed} ${entry.gamesPlayed === 1 ? 'game' : 'games'} · ${formatScore(entry.average)} avg</small></span>
      <span class="monthly-average"><strong>${entry.wins}</strong><small>${entry.wins === 1 ? 'win' : 'wins'}</small></span>
      ${entry.movement > 0 ? `<span class="monthly-movement up" aria-label="Moved up ${entry.movement} ${entry.movement === 1 ? 'place' : 'places'}">${icon('arrow-up', 15)}<small>${entry.movement}</small></span>` : entry.movement < 0 ? `<span class="monthly-movement down" aria-label="Moved down ${Math.abs(entry.movement)} ${entry.movement === -1 ? 'place' : 'places'}">${icon('arrow-down', 15)}<small>${Math.abs(entry.movement)}</small></span>` : '<span class="monthly-movement neutral" aria-label="No rank movement"></span>'}
    </button>`).join('')}</div>
  </section>`;
}


function locationsList(title, locations, modifier = '') {
  if (!locations?.length) return '';
  return `<section class="location-rank-card ${modifier}"><h3>${title}</h3><div>${locations.map((location, index) => `<article><span>${index + 1}</span><div><strong>${escapeHtml(location.name)}</strong><small>${formatScore(location.average)}/100 avg · ${location.bestAppearance ? formatDate(location.bestAppearance.date, { year: undefined }) : `${location.days} ${location.days === 1 ? 'day' : 'days'}`}</small></div></article>`).join('')}</div></section>`;
}

function dayLocations(day) {
  if (!day?.locations?.length) return '<p class="empty-note">No location archive for this day yet.</p>';
  return `<ol class="team-day-locations">${day.locations.map((location, index) => `<li><span>${index + 1}</span><strong>${escapeHtml(location.name)}</strong></li>`).join('')}</ol>`;
}

function teamDayCard(title, day, tone) {
  if (!day) return '';
  return `<article class="team-extreme-card ${tone}">
    <p>${title}</p>
    <h3>${formatScore(day.average)} avg</h3>
    <span>${formatDate(day.date, { month: 'long' })} · ${day.played} played · ${formatScore(day.high)} high / ${formatScore(day.low)} low</span>
    ${dayLocations(day)}
  </article>`;
}

function teamAverageTable(stats) {
  const rankedDays = stats.daily
    .filter((day) => Number.isFinite(day.average) && day.locations?.length)
    .toSorted((a, b) => b.average - a.average || b.high - a.high || b.date.localeCompare(a.date));
  return `<section class="team-average-table surface" aria-labelledby="team-average-title">
    <div class="section-heading"><div><h2 id="team-average-title">Best chat group days</h2><p>Ranked by average score for days with archived locations. Requires at least two scores.</p></div></div>
    <div class="team-table" role="table" aria-label="Best chat group average scores over the last 30 days">
      <div role="row" class="team-table-head"><span>Date</span><span>Players</span><span>Average</span><span>High / Low</span><span>Locations</span></div>
      ${rankedDays.map((day) => {
        const locations = day.locations?.length ? day.locations.map((location) => location.name).join(' • ') : '—';
        return `<div role="row"><span>${formatDate(day.date, { year: undefined })}</span><span>${day.played || '—'}</span><strong>${formatScore(day.average)}</strong><span>${Number.isFinite(day.high) ? `${formatScore(day.high)} / ${formatScore(day.low)}` : '—'}</span><span class="team-table-locations">${escapeHtml(locations)}</span></div>`;
      }).join('')}
    </div>
  </section>`;
}

export function teamView(data) {
  const stats = teamStats(data);
  const longest = stats.longestStreakPlayer;
  return `<div class="view content-view team-view" data-view="team">
    <header class="players-heading"><div><h1>Team</h1><p>${data.groupName} collective stats · last 30 days</p></div></header>
    <section class="team-hero surface" aria-labelledby="team-title">
      <div><p>Chat group average</p><h2 id="team-title">${formatScore(stats.teamAverage)}</h2><span>${stats.gamesPlayed} played scores across ${stats.playedDays} qualifying days</span></div>
      <div class="team-scope-cards">
        <article><span>Chat group streak</span><strong>${longest?.summary?.chatLongestWinStreak ?? 0}</strong><small>${longest ? escapeHtml(longest.displayName) : 'No streak yet'}</small></article>
        <article><span>Best continent</span><strong>${formatScore(stats.continentStats?.[0]?.average)}</strong><small>${escapeHtml(stats.continentStats?.[0]?.continent || 'Not enough data')}</small></article>
      </div>
    </section>
    <section class="team-extremes" aria-label="Team high and low days">
      ${teamDayCard('Highest team day', stats.highDay, 'high')}
      ${teamDayCard('Lowest team day', stats.lowDay, 'low')}
    </section>
    ${continentSplit('Team by continent', stats.continentStats, 'Average chat-group round score by archived location continent.')}
    <section class="chart-card team-score-trail"><div class="section-heading"><div><h2>Chat group score trail</h2><p>Daily average of subgroup players who played; requires at least two scores.</p></div></div>${sparkline(stats.chartHistory, { label: 'Team average score history', height: 142, endDate: data.date })}</section>
    <section class="location-insights" aria-label="Location accuracy insights">
      ${locationsList('Most accurate locations', stats.bestLocations, 'best')}
      ${locationsList('Toughest locations', stats.toughestLocations, 'tough')}
      ${stats.bestInternational ? `<section class="international-card"><p>Best international location</p><h3>${escapeHtml(stats.bestInternational.name)}</h3><span>${formatScore(stats.bestInternational.average)}/100 average${stats.bestInternational.bestAppearance ? ` · ${formatDate(stats.bestInternational.bestAppearance.date, { month: 'long' })}${stats.bestInternational.bestAppearance.topPlayer ? ` · ${escapeHtml(stats.bestInternational.bestAppearance.topPlayer.displayName)} led with ${formatScore(stats.bestInternational.bestAppearance.topPlayer.score)}/100` : ''}` : ''}</span></section>` : ''}
    </section>
    ${teamAverageTable(stats)}
  </div>`;
}

export function todayView(data, options = {}) {
  const { minimumDate, maximumDate, calendarOpen, standingsLoading } = options;
  const isToday = data.date === maximumDate;
  const leader = data.players.find((player) => player.playedToday);
  const notPlayed = data.players.filter((player) => !player.playedToday).length;
  return `<div class="view today-view" data-view="today">
    <section class="winner-hero ${leader ? '' : 'is-empty'}" aria-label="Daily winner">
      <div class="mountain-scene" aria-hidden="true"><span></span><span></span><span></span></div>
      <${leader ? 'button' : 'div'} class="winner-panel" ${leader ? `type="button" data-player="${escapeHtml(leader.id)}" aria-label="Select daily leader ${escapeHtml(leader.displayName)} on the Players tab"` : ''}>
        <div><p class="hero-label">${icon('trophy', 18)} ${isToday ? 'Today’s leader' : 'Daily leader'}</p><h1>${leader ? escapeHtml(leader.displayName) : 'No scores yet'}</h1><p class="winner-score">${leader ? `${formatScore(leader.score)} points` : 'No one in the group played.'}</p></div>
        <div class="streak-block"><strong>${isToday ? leader?.summary.currentWinStreak ?? 0 : Number(data.date.slice(-2))}</strong><span>${isToday ? 'win streak' : new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(`${data.date}T12:00:00Z`))}</span></div>
      </${leader ? 'button' : 'div'}>
    </section>

    <section class="surface leaderboard" aria-labelledby="leaderboard-title">
      <div class="section-heading"><div><h2 id="leaderboard-title">${isToday ? 'Today’s leaderboard' : 'Daily leaderboard'}</h2><p>${data.players.length} players${standingsLoading ? ' · checking global standings…' : ''}</p></div><button class="text-action" type="button" data-action="share">${icon('share', 18)} Share</button></div>
      <div class="date-toolbar" aria-label="Leaderboard date controls">
        <button type="button" data-action="previous-day" aria-label="Previous day" ${data.date <= minimumDate ? 'disabled' : ''}>${icon('chevron-left', 18)}</button>
        <button class="date-picker-trigger" type="button" data-action="open-calendar" aria-label="Choose leaderboard date">${icon('calendar', 16)}<span>${formatDate(data.date, { year: undefined })}</span></button>
        <button type="button" data-action="next-day" aria-label="Next day" ${data.date >= maximumDate ? 'disabled' : ''}>${icon('chevron', 18)}</button>
        <button class="today-shortcut" type="button" data-action="jump-today" aria-label="Jump to today" ${isToday ? 'disabled' : ''}>Today</button>
      </div>
      <div class="leader-labels" aria-hidden="true"><span>Rank</span><span>Player</span><span>Score</span><span>Percentile</span></div>
      <div class="leader-list">${data.players.map(playerRow).join('')}</div>
      <p class="list-note"><span class="status-dot"></span>${data.players.length - notPlayed} played ${isToday ? 'today' : 'on this day'} <span>·</span> ${notPlayed} ${isToday ? 'still exploring' : 'did not play'}</p>
    </section>

    ${isToday ? '' : locationTrail(data.date, data.locationsByDate?.[data.date]?.locations)}

    ${monthlyBoard(data, 'monthly-home')}
    ${calendarOpen ? calendarPicker(minimumDate, maximumDate, data.date) : ''}
  </div>`;
}

function playerCard(player, selected) {
  return `<button class="player-card ${selected ? 'is-selected' : ''}" type="button" data-player="${escapeHtml(player.id)}" aria-pressed="${selected}" aria-label="Show ${escapeHtml(player.displayName)}’s 30-day stats">
    <span class="avatar">${escapeHtml(playerInitials(player.displayName))}</span>
    <span><strong>${escapeHtml(player.displayName)}</strong><small>${player.playedToday ? `${formatScore(player.score)} today` : 'Hasn’t played today'}</small></span>
    <span class="mini-win"><strong>${formatScore(player.summary.average)}</strong><small>30-day avg</small></span>${icon('chevron', 19)}
  </button>`;
}

export function playersView(data, selectedId, options = {}) {
  const playerList = data.players.toSorted((a, b) => (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER));
  const leader = data.players.find((player) => player.playedToday);
  const selected = data.players.find((player) => player.id === selectedId) || data.players.find((player) => player.id === options.spotlightId) || leader || playerList[0];
  return `<div class="view content-view" data-view="players">
    <header class="players-heading"><div><h1>Players</h1><p>${data.players.length} total</p></div></header>
    <section class="player-list" aria-label="Players">${playerList.map((player) => playerCard(player, player.id === selected?.id)).join('')}</section>
    ${playerSummary(data, selected?.id)}
  </div>`;
}
