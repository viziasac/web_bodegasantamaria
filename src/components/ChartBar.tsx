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

function safeNum(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

const ChartBar: React.FC<ChartBarProps> = ({ data, height = 200, showValues = true }) => {
  const maxVal = Math.max(...data.map((d) => safeNum(d.value)), 1);

  return (
    <div className="chart-bar-group" style={{ height }}>
      {data.map((d, i) => {
        const val = safeNum(d.value);
        return (
          <div className="chart-bar-col" key={i}>
            {showValues && <span className="chart-bar-value">{val > 0 ? val.toLocaleString() : ''}</span>}
            <div
              className={`chart-bar ${d.color || 'green'}`}
              style={{ height: `${Math.max((val / maxVal) * 100, 1)}%` }}
              title={`${d.label}: ${val.toLocaleString()}`}
            />
            <span className="chart-bar-label">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
};

export default ChartBar;
