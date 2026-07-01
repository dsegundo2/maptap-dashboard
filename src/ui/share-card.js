import { escapeHtml, formatDate, formatScore } from './format.js';

export function shareCardSvg(data) {
  const leaders = data.players.filter((player) => player.playedToday).slice(0, 3);
  const date = formatDate(data.date, { month: 'long' });
  const width = 1080;
  const row = (player, index) => {
    const y = 390 + index * 145;
    const colors = ['#f3bd3f', '#c7ceca', '#bc7337'];
    return `<g transform="translate(72 ${y})"><circle cx="45" cy="45" r="35" fill="${colors[index]}"/><text x="45" y="56" text-anchor="middle" fill="#092e21" font-family="Arial,sans-serif" font-size="31" font-weight="800">${index + 1}</text><text x="108" y="37" fill="#fff" font-family="Arial,sans-serif" font-size="38" font-weight="750">${escapeHtml(player.displayName)}</text><text x="108" y="77" fill="#adc5b5" font-family="Arial,sans-serif" font-size="22">${formatScore(player.score)} points</text></g>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="1080" viewBox="0 0 ${width} 1080"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0e4c35"/><stop offset="1" stop-color="#072a1e"/></linearGradient><linearGradient id="glow" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#edf2e7"/><stop offset="1" stop-color="#9db49c"/></linearGradient></defs><rect width="1080" height="1080" rx="0" fill="url(#bg)"/><circle cx="934" cy="112" r="280" fill="#ffffff" opacity=".035"/><path d="M0 900 208 678l145 142 205-224 171 176 142-126 209 203v231H0Z" fill="#315f43" opacity=".75"/><path d="M0 959 170 806l160 120 189-147 184 153 158-121 219 171v98H0Z" fill="#173f2c"/><g transform="translate(72 70)"><circle cx="38" cy="38" r="38" fill="url(#glow)"/><path d="M12 56 36 20l13 18 10-14 17 32Z" fill="#164c34"/></g><text x="166" y="101" fill="#fff" font-family="Arial,sans-serif" font-size="36" font-weight="800">MapTap Dashboard</text><text x="72" y="219" fill="#bcd0c1" font-family="Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="3">DAILY LEADERBOARD</text><text x="72" y="290" fill="#fff" font-family="Georgia,serif" font-size="66" font-weight="700">${escapeHtml(date)}</text><line x1="72" y1="334" x2="1008" y2="334" stroke="#fff" opacity=".16"/>${leaders.length ? leaders.map(row).join('') : '<text x="72" y="460" fill="#fff" font-family="Georgia,serif" font-size="50">No scores recorded yet</text>'}<text x="72" y="1014" fill="#a8c0af" font-family="Arial,sans-serif" font-size="22">Today’s leaders, together on the trail.</text></svg>`;
}

export async function shareCardFile(data) {
  const blob = new Blob([shareCardSvg(data)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const png = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not create share image.')), 'image/png'));
    return new File([png], `maptap-leaderboard-${data.date}.png`, { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
