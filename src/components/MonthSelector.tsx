import React from 'react';
import { listMesesOptions } from '../utils/periodoMes';

interface MonthSelectorProps {
  value: string;
  onChange: (mesKey: string) => void;
  className?: string;
  label?: string;
}

const OPCIONES = listMesesOptions(24);

const MonthSelector: React.FC<MonthSelectorProps> = ({
  value,
  onChange,
  className = '',
  label = 'Periodo',
}) => (
  <div className={`month-selector ${className}`.trim()}>
    <label className="month-selector-label">
      <span className="material-icons-round">date_range</span>
      {label}
    </label>
    <select
      className="month-selector-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    >
      {OPCIONES.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

export default MonthSelector;
