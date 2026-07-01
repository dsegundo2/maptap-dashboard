import { describe, expect, it } from 'vitest';
import { maptapDayKey, parseDailyLocations, pastLocationDates } from '../scripts/location-archive.mjs';

describe('location archive', () => {
  it('crosses December and January with ISO dates while using MapTap day keys', () => {
    expect(pastLocationDates('2027-01-03', 5)).toEqual(['2027-01-02', '2027-01-01', '2026-12-31', '2026-12-30']);
    expect(maptapDayKey('2027-01-01')).toBe('January1');
    expect(maptapDayKey('2026-12-31')).toBe('December31');
  });

  it('reads the active five locations and ignores an older commented array', () => {
    const source = `cities = [
      { name: 'One', lat: 1, lng: 2 }, { name: 'Two', lat: 3, lng: 4 },
      { name: 'Three', lat: 5, lng: 6 }, { name: 'Four', lat: 7, lng: 8 },
      { name: 'Five', lat: 9, lng: 10 }
    ]; /* cities = [{ name: 'Old', lat: 0, lng: 0 }]; */`;
    expect(parseDailyLocations(source).map((location) => location.name)).toEqual(['One', 'Two', 'Three', 'Four', 'Five']);
  });
});
