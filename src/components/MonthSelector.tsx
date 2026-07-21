import React from 'react';
import { listMesesOptions } from '../utils/periodoMes';

interface MonthSelectorProps {
  value: string;
  onChange: (mesKey: string) => void;
  className?: string;
  label?: string;
  /** `toolbar` = control compacto alineado con botones del page-header */
  variant?: 'default' | 'toolbar';
}

const OPCIONES = listMesesOptions(24);

const MonthSelector: React.FC<MonthSelectorProps> = ({
  value,
  onChange,
  className = '',
  label = 'Periodo',
  variant = 'default',
}) => {
  const isToolbar = variant === 'toolbar';

  return (
    <div className={`month-selector month-selector--${variant} ${className}`.trim()}>
      {!isToolbar && (
        <label className="month-selector-label" htmlFor={`month-sel-${label}`}>
          <span className="material-icons-round" aria-hidden>date_range</span>
          {label}
        </label>
      )}
      {isToolbar && (
        <span className="material-icons-round month-selector-icon" aria-hidden>date_range</span>
      )}
      <select
        id={!isToolbar ? `month-sel-${label}` : undefined}
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
};

export default MonthSelector;
