import { escapeHtml, formatScore } from './format.js';

export function sparkline(history = [], { width = 320, height = 112, label = 'Score history' } = {}) {
  const values = history.slice(-30).filter((game) => Number.isFinite(game.score));
  if (values.length < 2) return '<div class="chart-empty">Play two days to unlock a trend.</div>';
  const min = Math.min(...values.map((game) => game.score));
  const max = Math.max(...values.map((game) => game.score));
  const spread = Math.max(40, max - min);
  const padding = 10;
  const points = values.map((game, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = padding + ((max - game.score) / spread) * (height - padding * 2);
    return { x, y, ...game };
  });
  const polyline = points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${padding},${height - padding} ${polyline} ${width - padding},${height - padding}`;
  const last = points.at(-1);
  return `<figure class="sparkline" aria-label="${escapeHtml(label)}">
    <svg viewBox="0 0 ${width} ${height}" role="img">
      <defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#527c58" stop-opacity=".35"/><stop offset="1" stop-color="#527c58" stop-opacity="0"/></linearGradient></defs>
      <path d="M${area.replaceAll(' ', ' L')} Z" fill="url(#chart-fill)"/>
      <polyline points="${polyline}" fill="none" stroke="#315c42" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last.x}" cy="${last.y}" r="4" fill="#f2b72f" stroke="#fff" stroke-width="2"/>
    </svg>
    <figcaption><span>${values[0].date.slice(5).replace('-', '/')}</span><strong>${formatScore(last.score)} latest</strong><span>${last.date.slice(5).replace('-', '/')}</span></figcaption>
  </figure>`;
}
