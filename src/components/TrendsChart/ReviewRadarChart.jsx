import React from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import useFetchData from '../../hooks/useFetchData';
import ChartTooltip from './ChartTooltip';
import '../../pages/Dashboard/Insights.css';

const RADAR_COLOR = 'var(--data-review)';

/**
 * Fetches the Session-Review radar endpoint and plots one average per metric
 * (Behavior, Understanding, Participation, Coding) on a single 0-max spider.
 *
 * Backend: GET /api/v1/progress/<me|child/:profileId>/reviews/radar
 *   → { reviewCount, avgOverall, axes: [{ metric, value, max }] }
 *
 * Props:
 *   endpoint     — full radar URL
 *   title        — panel heading
 *   icon         — Font Awesome class (optional)
 *   emptyMessage — shown when the student has no reviews
 *   height       — chart height in px (default 260)
 */
const ReviewRadarChart = ({
  endpoint,
  title = 'Review Breakdown',
  icon = 'fa-solid fa-star',
  emptyMessage = 'No session reviews yet. Scores from teachers’ reviews will show here.',
  height = 260,
}) => {
  const { data, loading, error } = useFetchData(endpoint || null);

  const axes = Array.isArray(data?.axes) ? data.axes : [];
  const reviewCount = data?.reviewCount ?? 0;
  const avgOverall = data?.avgOverall ?? 0;
  // All axes share the same bound (schema max); fall back to 5.
  const max = axes[0]?.max ?? 5;
  const hasData = axes.length > 0 && reviewCount > 0;

  return (
    <div className="ins-panel" style={{ '--tone': RADAR_COLOR }}>
      <div className="ins-panel__head">
        <h3>{icon && <i className={icon} />}{title}</h3>
        {loading ? (
          <span className="ins-panel__meta">Loading…</span>
        ) : hasData && (
          <span className="ins-panel__meta">
            {avgOverall.toFixed(1)} / {max} average · {reviewCount} review{reviewCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {error && (
        <p className="ins-panel__meta" style={{ color: 'var(--error)', margin: 0 }}>
          Could not load review radar: {error}
        </p>
      )}

      {!error && !loading && !hasData && (
        <div className="ins-empty">
          <i className="fa-regular fa-star" />
          <p>{emptyMessage}</p>
        </div>
      )}

      {hasData && (
        <ResponsiveContainer width="100%" height={height}>
          <RadarChart data={axes} margin={{ top: 10, right: 24, bottom: 10, left: 24 }}>
            <PolarGrid stroke="var(--chart-grid)" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 600 }} />
            <PolarRadiusAxis angle={30} domain={[0, max]} tick={false} axisLine={false} />
            <Radar
              name="Average"
              dataKey="value"
              stroke={RADAR_COLOR}
              fill={RADAR_COLOR}
              fillOpacity={0.22}
              strokeWidth={2}
              dot={{ r: 4, fill: RADAR_COLOR, strokeWidth: 0 }}
            />
            <Tooltip content={<ChartTooltip format={(v) => `${Number(v ?? 0).toFixed(1)} / ${max}`} />} />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default ReviewRadarChart;
