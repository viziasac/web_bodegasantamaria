// src/components/ChartBar.tsx
import React from 'react';

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface ChartBarProps {
  data: BarData[];
  height?: number;
  showValues?: boolean;
}

const ChartBar: React.FC<ChartBarProps> = ({ data, height = 200, showValues = true }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="chart-bar-group" style={{ height }}>
      {data.map((d, i) => (
        <div className="chart-bar-col" key={i}>
          {showValues && <span className="chart-bar-value">{d.value > 0 ? d.value.toLocaleString() : ''}</span>}
          <div
            className={`chart-bar ${d.color || 'green'}`}
            style={{ height: `${Math.max((d.value / maxVal) * 100, 1)}%` }}
            title={`${d.label}: ${d.value.toLocaleString()}`}
          />
          <span className="chart-bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

export default ChartBar;
