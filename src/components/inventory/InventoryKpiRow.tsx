import React from 'react';
import { fmtNum } from '../ui';

interface Props {
  almacenes: number;
  skus: number;
  lotes: number;
  alertas: number;
  lineas?: number;
}

export const InventoryKpiRow: React.FC<Props> = ({ almacenes, skus, lotes, alertas, lineas }) => (
  <div className="kpi-grid inv-kpi-row">
    <div className="kpi-card">
      <div className="kpi-icon green"><span className="material-icons-round">warehouse</span></div>
      <span className="kpi-label">Almacenes con stock</span>
      <div className="kpi-value">{almacenes}</div>
    </div>
    <div className="kpi-card">
      <div className="kpi-icon blue"><span className="material-icons-round">qr_code_2</span></div>
      <span className="kpi-label">SKUs distintos</span>
      <div className="kpi-value">{skus}</div>
      {lineas != null && <span className="kpi-sub">{lineas} líneas almacén×ítem</span>}
    </div>
    <div className="kpi-card">
      <div className="kpi-icon gold"><span className="material-icons-round">layers</span></div>
      <span className="kpi-label">Lotes activos</span>
      <div className="kpi-value">{lotes}</div>
    </div>
    <div className={`kpi-card ${alertas > 0 ? 'accent-danger' : ''}`}>
      <div className="kpi-icon red"><span className="material-icons-round">warning</span></div>
      <span className="kpi-label">Bajo mínimo</span>
      <div className="kpi-value">{alertas}</div>
    </div>
  </div>
);
