import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import useFetchData from '../../hooks/useFetchData';
import ChartTooltip from './ChartTooltip';
import '../../pages/Dashboard/Insights.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatPeriodLabel = (period = {}) => {
  if (period.week != null) return `Week ${period.week}`;
  if (period.month != null) return `${MONTHS[period.month - 1] || period.month} ${period.year}`;
  return '—';
};

const formatValue = (value) => (Number.isInteger(value) ? value : value.toFixed(1));

/** Rows from a trends endpoint, as numbers on the chart's scale. */
const toChartRows = (rawRows, metrics) => rawRows.map((row) => {
  const out = { label: formatPeriodLabel(row.period) };
  metrics.forEach((m) => {
    const v = row[m.key];
    const n = typeof v === 'number' ? v : (v == null ? null : Number(v));
    out[m.key] = n == null || Number.isNaN(n) ? null : n * (m.scale || 1);
  });
  return out;
});

/**
 * Line chart of one progress measure over time.
 *
 * Props:
 *   endpoint     — trends URL to fetch, when `rows` is not given
 *   rows         — already-fetched trend rows (skips the request)
 *   title, icon  — panel heading
 *   metrics      — [{ key, label, color, scale? }]
 *   yDomain      — [min, max] for the Y axis (defaults to auto)
 *   emptyMessage — text shown when there is nothing to plot
 *   height       — chart height in px (default 240)
 */
const TrendsChart = ({
  endpoint,
  rows: givenRows,
  title,
  icon,
  metrics,
  yDomain,
  emptyMessage = 'Not enough data yet to chart trends.',
  height = 240,
}) => {
  const { data, loading, error } = useFetchData(givenRows ? null : endpoint || null);

  const rawRows = givenRows || (Array.isArray(data) ? data : (data?.data || data?.docs || []));
  const rows = toChartRows(rawRows, metrics);
  const plotted = metrics.filter((m) => rows.some((r) => r[m.key] != null));
  const busy = !givenRows && loading;

  return (
    <div className="ins-panel">
      <div className="ins-panel__head">
        <h3>{icon && <i className={icon} />}{title}</h3>
        {busy && <span className="ins-panel__meta">Loading…</span>}
      </div>

      {error && !givenRows && (
        <p className="ins-panel__meta" style={{ color: 'var(--error)', margin: 0 }}>
          Could not load trends: {error}
        </p>
      )}

      {!error && !busy && plotted.length === 0 && (
        <p className="ins-panel__meta" style={{ margin: 0 }}>{emptyMessage}</p>
      )}

      {/* One period is one number: a lone dot on an empty chart read as a
          broken graph. */}
      {plotted.length > 0 && rows.length === 1 && (
        <div className="ins-single">
          {plotted.map((m) => (
            <div key={m.key} className="ins-single__item" style={{ '--tone': m.color }}>
              <span>{m.label}</span>
              <strong>{formatValue(rows[0][m.key])}</strong>
            </div>
          ))}
          <p className="ins-single__hint">{rows[0].label} so far. The line starts once there is a second period to compare.</p>
        </div>
      )}

      {plotted.length > 0 && rows.length > 1 && (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={rows} margin={{ top: 6, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={yDomain || ['auto', 'auto']}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-color)', strokeDasharray: '3 3' }} />
            {plotted.length > 1 && (
              <Legend wrapperStyle={{ fontSize: '0.78rem', fontWeight: 600 }} iconType="circle" />
            )}
            {plotted.map((m) => (
              <Line
                key={m.key}
                type="monotone"
                dataKey={m.key}
                name={m.label}
                stroke={m.color}
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: m.color, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: 'var(--card-bg)' }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default TrendsChart;
