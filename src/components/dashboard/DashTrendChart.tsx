import React from 'react';
import type { MovimientoTrendDia } from '../../types';

interface DashTrendChartProps {
  data: MovimientoTrendDia[];
  height?: number;
}

const SERIES = [
  { key: 'entradas' as const, label: 'Entradas', cls: 'dash-trend-in' },
  { key: 'salidas' as const, label: 'Salidas', cls: 'dash-trend-out' },
  { key: 'ajustes' as const, label: 'Ajustes', cls: 'dash-trend-adj' },
  { key: 'merma' as const, label: 'Merma', cls: 'dash-trend-mer' },
];

const DashTrendChart: React.FC<DashTrendChartProps> = ({ data, height = 220 }) => {
  const maxVal = Math.max(
    ...data.flatMap((d) => [d.entradas, d.salidas, d.ajustes, d.merma]),
    1,
  );

  return (
    <div className="dash-trend-wrap">
      <div className="dash-trend-legend">
        {SERIES.map((s) => (
          <span key={s.key} className="dash-trend-legend-item">
            <span className={`dash-trend-dot ${s.cls}`} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="dash-trend-chart" style={{ height }}>
        {data.map((d) => (
          <div className="dash-trend-col" key={d.fecha}>
            <div className="dash-trend-bars">
              {SERIES.map((s) => {
                const val = d[s.key];
                return (
                  <div
                    key={s.key}
                    className={`dash-trend-bar ${s.cls}`}
                    style={{ height: `${Math.max((val / maxVal) * 100, val > 0 ? 4 : 0)}%` }}
                    title={`${s.label}: ${val.toLocaleString()}`}
                  />
                );
              })}
            </div>
            <span className="dash-trend-label">{d.fecha.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashTrendChart;
