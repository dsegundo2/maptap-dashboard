import { escapeHtml, formatDate, formatScore } from './format.js';

function chartBounds(scores) {
  const minimum = Math.min(...scores);
  const maximum = Math.max(...scores);
  let lower = Math.max(0, Math.floor((minimum - 25) / 50) * 50);
  let upper = Math.min(1000, Math.ceil((maximum + 25) / 50) * 50);
  if (upper - lower < 100) {
    lower = Math.max(0, lower - 50);
    upper = Math.min(1000, upper + 50);
  }
  if (upper === lower) upper = lower + 100;
  return { lower, upper };
}

export function sparkline(history = [], { width = 320, height = 112, label = 'Score history' } = {}) {
  const values = history.slice(-30).filter((game) => Number.isFinite(game.score) && game.score > 0);
  if (values.length < 2) return '<div class="chart-empty">Play two days to unlock a trend.</div>';
  const { lower, upper } = chartBounds(values.map((game) => game.score));
  const plot = { left: 37, right: width - 8, top: 8, bottom: height - 10 };
  const points = values.map((game, index) => {
    const x = plot.left + (index / (values.length - 1)) * (plot.right - plot.left);
    const y = plot.top + ((upper - game.score) / (upper - lower)) * (plot.bottom - plot.top);
    return { x, y, ...game };
  });
  const polyline = points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${plot.left},${plot.bottom} ${polyline} ${plot.right},${plot.bottom}`;
  const last = points.at(-1);
  const ticks = [upper, Math.round((upper + lower) / 2), lower];
  return `<figure class="sparkline" data-chart aria-label="${escapeHtml(label)}">
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}. Scores range from ${formatScore(lower)} to ${formatScore(upper)} points.">
      ${ticks.map((tick) => {
        const y = plot.top + ((upper - tick) / (upper - lower)) * (plot.bottom - plot.top);
        return `<g class="chart-axis"><text x="30" y="${(y + 3).toFixed(1)}" text-anchor="end">${formatScore(tick)}</text><line x1="${plot.left}" y1="${y.toFixed(1)}" x2="${plot.right}" y2="${y.toFixed(1)}"/></g>`;
      }).join('')}
      <path class="chart-area" d="M${area.replaceAll(' ', ' L')} Z"/>
      <polyline points="${polyline}" fill="none" stroke="#315c42" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${points.map((point, index) => {
        const pointLabel = `${formatDate(point.date, { month: 'long' })}: ${formatScore(point.score)} points`;
        const hitLeft = index === 0 ? plot.left : (points[index - 1].x + point.x) / 2;
        const hitRight = index === points.length - 1 ? plot.right : (point.x + points[index + 1].x) / 2;
        return `<g class="chart-point ${index === points.length - 1 ? 'is-latest' : ''}" data-chart-point data-date="${escapeHtml(point.date)}" data-score="${point.score}" tabindex="0" role="img" aria-label="${escapeHtml(pointLabel)}"><title>${escapeHtml(pointLabel)}</title><rect class="chart-point-hit" x="${hitLeft.toFixed(1)}" y="${plot.top}" width="${(hitRight - hitLeft).toFixed(1)}" height="${plot.bottom - plot.top}"/><circle class="chart-point-dot" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.5"/></g>`;
      }).join('')}
    </svg>
    <figcaption><span>${values[0].date.slice(5).replace('-', '/')}</span><strong>${formatScore(last.score)} latest</strong><span>${last.date.slice(5).replace('-', '/')}</span></figcaption>
    <div class="chart-tooltip" data-chart-tooltip role="status" hidden><span data-tooltip-date></span><strong data-tooltip-score></strong></div>
  </figure>`;
}
