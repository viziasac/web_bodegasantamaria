// src/components/ChartDonut.tsx
import React from 'react';

interface DonutData {
  label: string;
  value: number;
  color: string;
}

interface ChartDonutProps {
  data: DonutData[];
  totalLabel?: string;
  size?: number;
}

const DONUT_COLORS = ['#5E664F', '#C5A059', '#7A8368', '#3F4536', '#D4B574', '#8B956F', '#6B7280', '#9CA3AF'];

const ChartDonut: React.FC<ChartDonutProps> = ({ data, totalLabel = 'Total', size = 160 }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return <div className="empty-state"><p>Sin datos disponibles</p></div>;
  }

  let cumulative = 0;
  const segments = data.map((d, i) => {
    const pct = (d.value / total) * 100;
    const start = cumulative;
    cumulative += pct;
    return { ...d, pct, start, color: d.color || DONUT_COLORS[i % DONUT_COLORS.length] };
  });

  const gradient = segments
    .map(s => `${s.color} ${s.start}% ${s.start + s.pct}%`)
    .join(', ');

  return (
    <div className="chart-donut-container">
      <div
        className="chart-donut"
        style={{
          width: size, height: size,
          background: `conic-gradient(${gradient})`,
        }}
      >
        <div className="chart-donut-inner">
          <span className="donut-total">{total.toLocaleString()}</span>
          <span className="donut-label">{totalLabel}</span>
        </div>
      </div>
      <div className="chart-legend">
        {segments.map((s, i) => (
          <div className="legend-item" key={i}>
            <span className="legend-dot" style={{ background: s.color }} />
            <span>{s.label}</span>
            <span className="legend-value">{s.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export { DONUT_COLORS };
export default ChartDonut;
