const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);

const displayDate = (date) => new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
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

export function broadcastCardSvg({ date, today, players }) {
  const leaders = leadersForDate(players, date, today);
  const winner = leaders[0];
  const medals = ['#f4bc35', '#d8deda', '#c77a42'];
  const rowMarkup = leaders.map((player, index) => {
    const y = 135 + index * 128;
    return `<g transform="translate(515 ${y})"><text x="0" y="52" fill="#9aa79f" font-family="Georgia,serif" font-size="48" font-weight="700">0${index + 1}</text><rect x="73" y="9" width="8" height="54" rx="4" fill="${medals[index]}"/><text x="112" y="34" fill="#17392b" font-family="Arial,sans-serif" font-size="27" font-weight="800">${escape(player.displayName)}</text><text x="112" y="62" fill="#77877e" font-family="Arial,sans-serif" font-size="16">daily score</text><text x="615" y="47" text-anchor="end" fill="#17392b" font-family="Arial,sans-serif" font-size="39" font-weight="900">${player.score.toLocaleString()}</text><line x1="0" y1="91" x2="615" y2="91" stroke="#cbd0c8"/></g>`;
  }).join('');
  const emptyMarkup = `<g transform="translate(515 185)"><text x="0" y="0" fill="#17392b" font-family="Georgia,serif" font-size="42" font-weight="700">No scores recorded</text><text x="0" y="43" fill="#77877e" font-family="Arial,sans-serif" font-size="19">Open the dashboard when the trail begins.</text><line x1="0" y1="86" x2="615" y2="86" stroke="#cbd0c8"/></g>`;
  const headline = winner ? `${escape(winner.displayName)} leads<tspan x="72" dy="49">the trail.</tspan>` : `The trail is<tspan x="72" dy="49">open.</tspan>`;
  const headlineSize = !winner || winner.displayName.length <= 8 ? 43 : winner.displayName.length <= 12 ? 36 : 30;
  const score = winner ? winner.score.toLocaleString() : '—';
  const scoreLabel = winner ? (date === today ? 'POINTS TODAY' : 'POINTS THAT DAY') : 'NO SCORES YET';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="forest" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b5037"/><stop offset="1" stop-color="#062d20"/></linearGradient></defs><rect width="1200" height="630" fill="#f4f0e5"/><rect width="455" height="630" fill="url(#forest)"/><path d="M0 500 125 380 222 458 340 332 455 438V630H0Z" fill="#376a4c"/><path d="M0 554 110 465 210 530 335 438 455 520V630H0Z" fill="#194832"/><g transform="translate(72 78)"><circle r="25" fill="#e8eedf"/><path d="M-17 12-3-11 7 2 14-8 22 12Z" fill="#164b35"/></g><text x="114" y="70" fill="#fff" font-family="Arial,sans-serif" font-size="27" font-weight="800">MapTap</text><text x="72" y="162" fill="#bfd0c3" font-family="Arial,sans-serif" font-size="16" font-weight="800" letter-spacing="2">${escape(displayDate(date).toUpperCase())}</text><text x="72" y="228" fill="#fff" font-family="Georgia,serif" font-size="${headlineSize}" font-weight="700">${headline}</text><text x="72" y="365" fill="#f4c14a" font-family="Arial,sans-serif" font-size="83" font-weight="900">${score}</text><text x="76" y="397" fill="#bed0c3" font-family="Arial,sans-serif" font-size="18">${scoreLabel}</text><text x="515" y="86" fill="#17392b" font-family="Arial,sans-serif" font-size="16" font-weight="800" letter-spacing="2">DAILY TOP THREE</text>${leaders.length ? rowMarkup : emptyMarkup}<text x="1130" y="574" text-anchor="end" fill="#75857c" font-family="Arial,sans-serif" font-size="16">Open the dashboard for all players →</text></svg>`;
}
