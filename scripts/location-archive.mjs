import vm from 'node:vm';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function addUtcDays(date, amount) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function maptapDayKey(date) {
  const value = new Date(`${date}T12:00:00Z`);
  return `${MONTHS[value.getUTCMonth()]}${value.getUTCDate()}`;
}

export function pastLocationDates(today, days = 30) {
  return Array.from({ length: days - 1 }, (_, index) => addUtcDays(today, -(index + 1)));
}

function assignedArray(source, variable) {
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];
    if (lineComment) { if (current === '\n') lineComment = false; continue; }
    if (blockComment) { if (current === '*' && next === '/') { blockComment = false; index += 1; } continue; }
    if (quote) { if (current === '\\') index += 1; else if (current === quote) quote = null; continue; }
    if (current === '/' && next === '/') { lineComment = true; index += 1; continue; }
    if (current === '/' && next === '*') { blockComment = true; index += 1; continue; }
    if (current === '"' || current === "'" || current === '`') { quote = current; continue; }
    if (!source.startsWith(variable, index) || /[\w$]/.test(source[index - 1] || '') || /[\w$]/.test(source[index + variable.length] || '')) continue;
    const assignment = source.slice(index + variable.length).match(/^\s*=\s*/);
    if (!assignment) continue;
    const start = index + variable.length + assignment[0].length;
    if (source[start] !== '[') continue;
    let depth = 0;
    let innerQuote = null;
    let innerLineComment = false;
    let innerBlockComment = false;
    for (let cursor = start; cursor < source.length; cursor += 1) {
      const char = source[cursor];
      const after = source[cursor + 1];
      if (innerLineComment) { if (char === '\n') innerLineComment = false; continue; }
      if (innerBlockComment) { if (char === '*' && after === '/') { innerBlockComment = false; cursor += 1; } continue; }
      if (innerQuote) { if (char === '\\') cursor += 1; else if (char === innerQuote) innerQuote = null; continue; }
      if (char === '/' && after === '/') { innerLineComment = true; cursor += 1; continue; }
      if (char === '/' && after === '*') { innerBlockComment = true; cursor += 1; continue; }
      if (char === '"' || char === "'" || char === '`') { innerQuote = char; continue; }
      if (char === '[') depth += 1;
      if (char === ']') depth -= 1;
      if (depth === 0) return source.slice(start, cursor + 1);
    }
  }
  throw new Error(`No active ${variable} array found.`);
}

export function parseDailyLocations(source) {
  const sandbox = { result: null };
  vm.runInNewContext(`result = ${assignedArray(source, 'cities')}`, sandbox, {
    timeout: 100,
    contextCodeGeneration: { strings: false, wasm: false }
  });
  if (!Array.isArray(sandbox.result)) throw new Error('Daily locations are not an array.');
  return sandbox.result.slice(0, 5).map((location, index) => {
    const lat = Number(location?.lat);
    const lng = Number(location?.lng);
    if (!location?.name || !Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error(`Location ${index + 1} is incomplete.`);
    return { name: String(location.name), lat, lng };
  });
}
