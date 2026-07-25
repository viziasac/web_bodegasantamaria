import React from 'react';
import type { ModoCantidadEmpaque } from '../utils/cantidadEmpaque';

interface Props {
  modo: ModoCantidadEmpaque;
  onChange: (m: ModoCantidadEmpaque) => void;
  /** Factor del pack activo (p.ej. 6 o 12). */
  cantUnidades: number;
  /** Todos los factores de pack disponibles (×6, ×12…). Si hay >1, se muestran chips. */
  packFactores?: number[];
  onFactorChange?: (factor: number) => void;
  disabled?: boolean;
}

export const CantidadEmpaqueToggle: React.FC<Props> = ({
  modo, onChange, cantUnidades, packFactores, onFactorChange, disabled,
}) => {
  const factores = (packFactores?.length ? packFactores : (cantUnidades > 1 ? [cantUnidades] : []))
    .filter((f) => f > 1)
    .sort((a, b) => a - b);

  if (factores.length === 0) return null;

  const factorActivo = factores.includes(cantUnidades) ? cantUnidades : factores[0];

  return (
    <div className="qty-mode-block">
      <div className="qty-mode-toggle" role="group" aria-label="Modo de cantidad">
        <button
          type="button"
          className={`qty-mode-btn ${modo === 'botella' ? 'active' : ''}`}
          disabled={disabled}
          onClick={() => onChange('botella')}
        >
          <span className="material-icons-round">wine_bar</span>
          Botellas
        </button>
        <button
          type="button"
          className={`qty-mode-btn ${modo === 'pack' ? 'active' : ''}`}
          disabled={disabled}
          onClick={() => {
            onChange('pack');
            if (onFactorChange && !factores.includes(cantUnidades)) {
              onFactorChange(factores[0]);
            }
          }}
        >
          <span className="material-icons-round">inventory_2</span>
          Packs
        </button>
      </div>
      {modo === 'pack' && factores.length > 1 && onFactorChange && (
        <div className="qty-pack-factors" role="group" aria-label="Tamaño de pack">
          {factores.map((f) => (
            <button
              key={f}
              type="button"
              className={`qty-pack-factor-btn ${factorActivo === f ? 'active' : ''}`}
              disabled={disabled}
              onClick={() => onFactorChange(f)}
            >
              ×{f}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
