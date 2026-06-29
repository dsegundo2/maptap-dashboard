const icons = {
  refresh: '<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v7h14v-7"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  trend: '<path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  trophy: '<path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01"/>'
};

export function icon(name, size = 20) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
}

export const logo = `
  <svg class="brand-mark" aria-hidden="true" viewBox="0 0 64 64">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e5eadc"/><stop offset="1" stop-color="#bac9ad"/></linearGradient></defs>
    <rect width="64" height="64" rx="20" fill="url(#sky)"/>
    <path d="M4 48 25 20l8 12 8-10 19 26Z" fill="#f5f3e9" stroke="#264d39" stroke-width="2"/>
    <path d="M3 49 19 34l10 10 8-9 24 14v11H3Z" fill="#55795a"/>
    <path d="m31 60 10-31 7 31m-26 0 6-20 6 20" fill="#183f2d" opacity=".9"/>
  </svg>`;
