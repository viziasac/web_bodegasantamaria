import React from 'react';
import { fmtNum } from '../ui';
import { TIPO_LABELS, TIPO_COLORS } from './constants';
import type { AlmacenResumenInv } from '../../types';
import { EmptyState } from '../ui';

interface Props {
  almacenes: AlmacenResumenInv[];
  selectedId?: string;
  onSelectAlmacen?: (id: string) => void;
}

export const InventoryAlmacenGrid: React.FC<Props> = ({ almacenes, selectedId, onSelectAlmacen }) => {
  if (almacenes.length === 0) {
    return <EmptyState icon="inventory_2" title="Sin stock con estos filtros" hint="Pruebe ampliar la búsqueda" />;
  }

  return (
    <div className="inv-almacen-grid">
      {almacenes.map((alm) => {
        const CardTag = onSelectAlmacen ? 'button' : 'div';
        return (
          <CardTag
            key={alm.almacen_id}
            type={onSelectAlmacen ? 'button' : undefined}
            className={`inv-almacen-card card ${selectedId === alm.almacen_id ? 'selected' : ''}`}
            onClick={onSelectAlmacen ? () => onSelectAlmacen(alm.almacen_id) : undefined}
          >
            <div className="inv-almacen-head">
              <div>
                <code className="code-tag">{alm.almacen_codigo}</code>
                {alm.es_punto_venta && <span className="status-tag status-ok inv-pv-tag">PV</span>}
              </div>
              {alm.alertas > 0 && (
                <span className="status-tag status-danger">{alm.alertas} alertas</span>
              )}
            </div>
            <h3 className="inv-almacen-name">{alm.almacen_nombre}</h3>
            <div className="inv-almacen-stats">
              <div className="inv-stat">
                <span className="inv-stat-val">{alm.sku_count}</span>
                <span className="inv-stat-lbl">SKUs</span>
              </div>
              <div className="inv-stat">
                <span className="inv-stat-val">{alm.lotes_count}</span>
                <span className="inv-stat-lbl">Lotes</span>
              </div>
              <div className="inv-stat">
                <span className="inv-stat-val">{fmtNum(alm.total_cantidad, 0)}</span>
                <span className="inv-stat-lbl">Unidades</span>
              </div>
            </div>
            <div className="inv-almacen-tipos">
              {Object.entries(alm.por_tipo)
                .sort((a, b) => b[1].skus - a[1].skus)
                .map(([tipo, t]) => (
                  <div key={tipo} className="inv-tipo-row">
                    <span className={`inv-tipo-dot ${TIPO_COLORS[tipo] ?? ''}`} />
                    <span>{TIPO_LABELS[tipo] ?? tipo}</span>
                    <span className="inv-tipo-qty">{t.skus} · {fmtNum(t.cantidad, 0)} u</span>
                  </div>
                ))}
            </div>
          </CardTag>
        );
      })}
    </div>
  );
};
