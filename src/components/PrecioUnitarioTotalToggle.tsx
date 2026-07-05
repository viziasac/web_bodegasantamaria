import React from 'react';

export type ModoPrecio = 'unitario' | 'total';

interface Props {
  modo: ModoPrecio;
  onChange: (m: ModoPrecio) => void;
}

export const PrecioUnitarioTotalToggle: React.FC<Props> = ({ modo, onChange }) => (
  <div className="qty-mode-toggle" role="group" aria-label="Modo de precio">
    <button
      type="button"
      className={`qty-mode-btn ${modo === 'unitario' ? 'active' : ''}`}
      onClick={() => onChange('unitario')}
    >
      Precio unitario
    </button>
    <button
      type="button"
      className={`qty-mode-btn ${modo === 'total' ? 'active' : ''}`}
      onClick={() => onChange('total')}
    >
      Precio total
    </button>
  </div>
);
