import { projectLocation, WORLD_LAND_PATH } from '../src/ui/world-map.js';

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
const MEDALS = ['#f4bc35', '#d8deda', '#c77a42'];

const displayDate = (date) => new Intl.DateTimeFormat('en-US', {
  month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
}).format(new Date(`${date}T12:00:00Z`));

export function leadersForDate(players, date, today) {
  return players.flatMap((player) => {
    const score = date === today && player.playedToday
      ? player.score
      : player.history?.find((entry) => entry.date === date)?.score;
    return Number.isFinite(score) && score > 0 ? [{ displayName: player.displayName, score }] : [];
  }).sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName)).slice(0, 3);
}

export function previewDates(today, days = 30, hardMinimum = '2026-06-01') {
  const end = new Date(`${today}T12:00:00Z`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (days - 1 - index));
    return date.toISOString().slice(0, 10);
  }).filter((date) => date >= hardMinimum);
}

function brandAndBackground(leftWidth) {
  return `<defs><linearGradient id="forest" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b5037"/><stop offset="1" stop-color="#062d20"/></linearGradient></defs><rect width="1200" height="630" fill="#f4f0e5"/><rect width="${leftWidth}" height="630" fill="url(#forest)"/><path d="M0 505 110 395 195 465 300 350 ${leftWidth} 445V630H0Z" fill="#376a4c"/><path d="M0 560 95 480 185 535 300 450 ${leftWidth} 525V630H0Z" fill="#194832"/><g transform="translate(64 70)"><circle r="23" fill="#e8eedf"/><path d="M-16 11-3-10 6 2 13-7 20 11Z" fill="#164b35"/></g><text x="104" y="63" fill="#fff" font-family="Arial,sans-serif" font-size="25" font-weight="800">MapTap</text>`;
}

function scoreboardCard({ date, today, leaders, exploring = 0 }) {
  const winner = leaders[0];
  const isPast = date < today;
  const rowMarkup = leaders.map((player, index) => {
    const y = 135 + index * 128;
    return `<g transform="translate(515 ${y})"><text x="0" y="52" fill="#9aa79f" font-family="Georgia,serif" font-size="48" font-weight="700">0${index + 1}</text><rect x="73" y="9" width="8" height="54" rx="4" fill="${MEDALS[index]}"/><text x="112" y="34" fill="#17392b" font-family="Arial,sans-serif" font-size="27" font-weight="800">${escape(player.displayName)}</text><text x="112" y="62" fill="#77877e" font-family="Arial,sans-serif" font-size="16">daily score</text><text x="615" y="47" text-anchor="end" fill="#17392b" font-family="Arial,sans-serif" font-size="39" font-weight="900">${player.score.toLocaleString()}</text><line x1="0" y1="91" x2="615" y2="91" stroke="#cbd0c8"/></g>`;
  }).join('');
  const emptyMarkup = `<g transform="translate(515 185)"><text x="0" y="0" fill="#17392b" font-family="Georgia,serif" font-size="42" font-weight="700">No scores recorded</text><text x="0" y="43" fill="#77877e" font-family="Arial,sans-serif" font-size="19">Open the dashboard when the trail begins.</text><line x1="0" y1="86" x2="615" y2="86" stroke="#cbd0c8"/></g>`;
  const headline = winner
    ? (isPast ? `${escape(winner.displayName)} led<tspan x="72" dy="49">the day.</tspan>` : `${escape(winner.displayName)} leads<tspan x="72" dy="49">the trail.</tspan>`)
    : `The trail is<tspan x="72" dy="49">open.</tspan>`;
  const headlineSize = !winner || winner.displayName.length <= 8 ? 43 : winner.displayName.length <= 12 ? 36 : 30;
  const score = winner ? winner.score.toLocaleString() : '—';
  const scoreLabel = winner ? (isPast ? 'WINNING SCORE' : 'POINTS TODAY') : 'NO SCORES YET';
  const heading = isPast ? 'FINAL TOP THREE' : 'DAILY TOP THREE';
  const exploringMarkup = !isPast && exploring > 0 ? `<g transform="translate(72 420)"><rect width="190" height="34" rx="17" fill="#fff" opacity=".12"/><circle cx="18" cy="17" r="5" fill="#f4c14a"/><text x="32" y="22" fill="#e5eee7" font-family="Arial,sans-serif" font-size="14" font-weight="700">${exploring} still exploring</text></g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">${brandAndBackground(455)}<text x="72" y="162" fill="#bfd0c3" font-family="Arial,sans-serif" font-size="16" font-weight="800" letter-spacing="2">${escape(displayDate(date).toUpperCase())}</text><text x="72" y="228" fill="#fff" font-family="Georgia,serif" font-size="${headlineSize}" font-weight="700">${headline}</text><text x="72" y="365" fill="#f4c14a" font-family="Arial,sans-serif" font-size="83" font-weight="900">${score}</text><text x="76" y="397" fill="#bed0c3" font-family="Arial,sans-serif" font-size="18">${scoreLabel}</text>${exploringMarkup}<text x="515" y="86" fill="#17392b" font-family="Arial,sans-serif" font-size="16" font-weight="800" letter-spacing="2">${heading}</text>${leaders.length ? rowMarkup : emptyMarkup}<text x="1130" y="574" text-anchor="end" fill="#75857c" font-family="Arial,sans-serif" font-size="16">Open the dashboard for all players →</text></svg>`;
}

function pastMapCard({ date, leaders, locations }) {
  const winner = leaders[0];
  const headlineSize = !winner || winner.displayName.length <= 8 ? 38 : winner.displayName.length <= 12 ? 34 : 29;
  const headline = winner ? `${escape(winner.displayName)} led<tspan x="64" dy="44">the day.</tspan>` : `No one scored<tspan x="64" dy="44">that day.</tspan>`;
  const score = winner ? winner.score.toLocaleString() : '—';
  const rows = leaders.map((player, index) => `<g transform="translate(460 ${105 + index * 67})"><text x="0" y="31" fill="#9aa79f" font-family="Georgia,serif" font-size="34" font-weight="700">0${index + 1}</text><rect x="55" y="2" width="6" height="38" rx="3" fill="${MEDALS[index]}"/><text x="83" y="23" fill="#17392b" font-family="Arial,sans-serif" font-size="21" font-weight="800">${escape(player.displayName)}</text><text x="675" y="27" text-anchor="end" fill="#17392b" font-family="Arial,sans-serif" font-size="29" font-weight="900">${player.score.toLocaleString()}</text><line x1="0" y1="52" x2="675" y2="52" stroke="#d4d8d0"/></g>`).join('');
  const points = locations.slice(0, 5).map(({ lat, lng }) => projectLocation(lat, lng));
  const route = points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join('');
  const pins = points.map((point, index) => `<g transform="translate(${point.x} ${point.y})"><circle r="8" fill="#f4c14a" stroke="#f6f1e6" stroke-width="2"/><text y="3.2" text-anchor="middle" fill="#17392b" font-family="Arial,sans-serif" font-size="8" font-weight="900">${index + 1}</text></g>`).join('');
  const locationRows = locations.slice(0, 5).map((location, index) => `<g transform="translate(888 ${378 + index * 38})"><circle r="11" fill="#f4c14a"/><text y="4" text-anchor="middle" fill="#17392b" font-family="Arial,sans-serif" font-size="10" font-weight="900">${index + 1}</text><text x="22" y="5" fill="#f6f1e6" font-family="Arial,sans-serif" font-size="14" font-weight="700">${escape(location.name.split(',')[0])}</text></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">${brandAndBackground(400)}<text x="64" y="146" fill="#bfd0c3" font-family="Arial,sans-serif" font-size="15" font-weight="800" letter-spacing="2">${escape(displayDate(date).toUpperCase())}</text><text x="64" y="210" fill="#fff" font-family="Georgia,serif" font-size="${headlineSize}" font-weight="700">${headline}</text><text x="64" y="342" fill="#f4c14a" font-family="Arial,sans-serif" font-size="76" font-weight="900">${score}</text><text x="68" y="373" fill="#bed0c3" font-family="Arial,sans-serif" font-size="17">${winner ? 'WINNING SCORE' : 'NO SCORES RECORDED'}</text><text x="460" y="67" fill="#17392b" font-family="Arial,sans-serif" font-size="15" font-weight="800" letter-spacing="2">FINAL TOP THREE</text>${rows}<rect x="438" y="310" width="705" height="292" rx="24" fill="#123c2e"/><text x="468" y="345" fill="#f6f1e6" font-family="Arial,sans-serif" font-size="15" font-weight="800" letter-spacing="2">WHERE THE TRAIL WENT</text><text x="1113" y="345" text-anchor="end" fill="#a9c0b0" font-family="Arial,sans-serif" font-size="14">${points.length} round locations</text><g transform="translate(462 368) scale(1.25)"><rect width="320" height="150" rx="12" fill="#0b3024"/><path d="${WORLD_LAND_PATH}" fill="#54775d"/><path d="${route}" fill="none" stroke="#e5b842" stroke-width="1.5" stroke-dasharray="4 3" opacity=".8"/>${pins}</g>${locationRows}</svg>`;
}

export function broadcastCardSvg({ date, today, players, locations = [] }) {
  const leaders = leadersForDate(players, date, today);
  // Location rounds are deliberately impossible on today's card, even if data is passed accidentally.
  if (date < today && locations.length) return pastMapCard({ date, leaders, locations });
  const exploring = date === today ? players.filter((player) => !player.playedToday).length : 0;
  return scoreboardCard({ date, today, leaders, exploring });
}
