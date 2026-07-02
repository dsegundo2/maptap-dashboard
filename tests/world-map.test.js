import { describe, expect, it } from 'vitest';
import { projectLocation } from '../src/ui/world-map.js';

describe('world map projection', () => {
  it.each([
    ['Newark', 40.7357, -74.1724, 98.2, 44.7],
    ['Tokyo', 35.6762, 139.6503, 276.4, 48.4],
    ['Charlottetown', 46.2382, -63.1311, 107.4, 40.6],
    ['Gaborone', -24.6282, 25.9231, 181.6, 93.3],
    ['Darwin', -12.4634, 130.8456, 269.0, 84.3],
    ['Quito', -0.1807, -78.4678, 94.6, 75.1]
  ])('places %s at its equirectangular map coordinate', (_name, lat, lng, x, y) => {
    const projected = projectLocation(lat, lng);
    expect(projected.x).toBeCloseTo(x, 1);
    expect(projected.y).toBeCloseTo(y, 1);
  });

  it('keeps extreme coordinates inside the map drawing area', () => {
    expect(projectLocation(90, -180)).toEqual({ x: 10, y: 8 });
    expect(projectLocation(-90, 180)).toEqual({ x: 310, y: 142 });
  });
});
