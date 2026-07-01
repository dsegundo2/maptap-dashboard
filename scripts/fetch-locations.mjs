import { readFile, writeFile } from 'node:fs/promises';
import { dateKey } from '../src/lib/stats.js';
import { maptapDayKey, parseDailyLocations, pastLocationDates } from './location-archive.mjs';

const config = JSON.parse(await readFile(new URL('../public/data/config.json', import.meta.url), 'utf8'));
const destination = new URL('../public/data/locations.json', import.meta.url);
const today = dateKey(new Date(), config.timezone);
let previous = { dates: {} };
try { previous = JSON.parse(await readFile(destination, 'utf8')); } catch { /* first archive */ }

const entries = await Promise.all(pastLocationDates(today).map(async (date) => {
  const dayKey = maptapDayKey(date);
  try {
    const response = await fetch(`https://maptap.gg/data/this_day_in_history/${dayKey}.js?v=1`, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return [date, { dayKey, locations: parseDailyLocations(await response.text()) }];
  } catch (error) {
    if (previous.dates?.[date]) return [date, previous.dates[date]];
    console.warn(`Location archive unavailable for ${date} (${dayKey}): ${error.message}`);
    return null;
  }
}));

const dates = Object.fromEntries(entries.filter(Boolean).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(destination, `${JSON.stringify({ generatedAt: new Date().toISOString(), throughDate: today, dates }, null, 2)}\n`);
console.log(`Archived locations for ${Object.keys(dates).length}/${pastLocationDates(today).length} past days through ${today}.`);
