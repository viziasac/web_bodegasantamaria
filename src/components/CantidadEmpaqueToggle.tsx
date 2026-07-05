import React from 'react';
import type { ModoCantidadEmpaque } from '../utils/cantidadEmpaque';

interface Props {
  modo: ModoCantidadEmpaque;
  onChange: (m: ModoCantidadEmpaque) => void;
  cantUnidades: number;
  disabled?: boolean;
}

export const CantidadEmpaqueToggle: React.FC<Props> = ({
  modo, onChange, cantUnidades, disabled,
}) => {
  if (cantUnidades <= 1) return null;
  return (
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
        onClick={() => onChange('pack')}
      >
        <span className="material-icons-round">inventory_2</span>
        Packs
      </button>
    </div>
  );
};
