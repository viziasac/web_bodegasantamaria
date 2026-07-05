import React from 'react';
import { TIPO_LABELS, TIPO_COLORS } from './constants';

interface Props {
  porTipo: Record<string, number>;
  tipoFilter: string;
  onToggleTipo: (tipo: string) => void;
}

export const InventoryTipoChips: React.FC<Props> = ({ porTipo, tipoFilter, onToggleTipo }) => {
  const entries = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  return (
    <div className="inv-tipo-bar card">
      {entries.map(([tipo, count]) => (
        <button
          key={tipo}
          type="button"
          className={`inv-tipo-chip ${TIPO_COLORS[tipo] ?? ''} ${tipoFilter === tipo ? 'active' : ''}`}
          onClick={() => onToggleTipo(tipoFilter === tipo ? '' : tipo)}
        >
          <span className="chip-label">{TIPO_LABELS[tipo] ?? tipo}</span>
          <span className="chip-count">{count} SKUs</span>
        </button>
      ))}
    </div>
  );
};
