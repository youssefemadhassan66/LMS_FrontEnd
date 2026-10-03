import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrendsChart from './TrendsChart';

const mocks = vi.hoisted(() => ({ useFetchData: vi.fn(() => ({ data: null, loading: false, error: null })) }));
vi.mock('../../hooks/useFetchData', () => ({ default: mocks.useFetchData }));

const metrics = [
  { key: 'onTimeRate', label: 'On time', color: 'red' },
  { key: 'avgScore', label: 'Avg score (×10)', color: 'blue', scale: 10 },
];

describe('TrendsChart', () => {
  it('uses rows it is given instead of fetching them', () => {
    render(<TrendsChart title="Homework" metrics={metrics} rows={[]} />);
    expect(mocks.useFetchData).toHaveBeenLastCalledWith(null);
    expect(screen.getByText(/not enough data yet/i)).toBeInTheDocument();
  });

  it('shows a single period as numbers, on the chart’s scale', () => {
    render(
      <TrendsChart
        title="Homework"
        metrics={metrics}
        rows={[{ onTimeRate: 80, avgScore: 7.5, period: { year: 2026, month: 9 } }]}
      />,
    );
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText(/Sep 2026 so far/)).toBeInTheDocument();
  });

  it('draws a chart once there are two periods', () => {
    // jsdom has no ResizeObserver; Recharts' container only needs it to exist.
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    const { container } = render(
      <TrendsChart
        title="Homework"
        metrics={metrics}
        rows={[
          { onTimeRate: 80, avgScore: 7, period: { year: 2026, month: 8 } },
          { onTimeRate: 90, avgScore: 8, period: { year: 2026, month: 9 } },
        ]}
      />,
    );
    expect(screen.queryByText(/so far/)).not.toBeInTheDocument();
    expect(container.querySelector('.recharts-responsive-container')).not.toBeNull();
    vi.unstubAllGlobals();
  });
});
