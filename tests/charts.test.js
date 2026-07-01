import { describe, expect, it } from 'vitest';
import { sparkline } from '../src/ui/charts.js';

const history = [
  { date: '2026-06-28', score: 840 },
  { date: '2026-06-29', score: 910 },
  { date: '2026-06-30', score: 880 }
];

describe('sparkline', () => {
  it('renders a labeled y axis and an interactive point for every score', () => {
    const chart = sparkline(history, { label: 'Test score history' });

    expect(chart.match(/class="chart-axis"/g)).toHaveLength(3);
    expect(chart.match(/data-chart-point/g)).toHaveLength(history.length);
    expect(chart.match(/class="chart-point-hit"/g)).toHaveLength(history.length);
    expect(chart).toContain('June 29, 2026: 910 points');
    expect(chart).toContain('data-chart-tooltip');
  });

  it('keeps the empty state until two scores are available', () => {
    expect(sparkline(history.slice(0, 1))).toContain('Play two days to unlock a trend.');
  });
});
