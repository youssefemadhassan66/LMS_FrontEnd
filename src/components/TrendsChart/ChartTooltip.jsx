import React from 'react';

/**
 * Tooltip for the progress charts. Each row carries its series colour, so a
 * value can be matched to its line or bar without the legend.
 *
 * `format(value, entry)` turns a value into text; by default whole numbers
 * stay whole and the rest get one decimal.
 */
const ChartTooltip = ({ active, payload, label, format }) => {
  if (!active || !payload?.length) return null;
  const show = format || ((v) => (typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(1)) : v));
  const heading = label ?? payload[0]?.payload?.metric ?? payload[0]?.payload?.name;
  return (
    <div className="ins-tooltip">
      {heading != null && <p>{heading}</p>}
      {payload.map((p) => (
        <p key={p.dataKey ?? p.name} style={{ '--tone': p.payload?.color || p.color || p.stroke }}>
          <i aria-hidden="true" />
          {p.name}
          <strong>{show(p.value, p)}</strong>
        </p>
      ))}
    </div>
  );
};

export default ChartTooltip;
