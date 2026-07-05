import React from 'react';
import { Link } from 'react-router-dom';
import type { DashboardEjecutivoData } from '../../types';

interface DashActionPanelProps {
  ej: DashboardEjecutivoData;
}

const DashActionPanel: React.FC<DashActionPanelProps> = ({ ej }) => {
  const items: { icon: string; text: string; path: string; tone?: 'warn' | 'crit' }[] = [];

  if (ej.alertasStock.length > 0) {
    items.push({
      icon: 'notification_important',
      text: `${ej.alertasStock.length} ítem(s) bajo stock mínimo`,
      path: '/inventory',
      tone: ej.alertasStock.length > 3 ? 'crit' : 'warn',
    });
  }
  if (ej.ajustesCount > 0) {
    items.push({
      icon: 'tune',
      text: `${ej.ajustesCount} ajuste(s) de inventario este mes`,
      path: '/audit',
    });
  }
  if (ej.ordenesBorrador > 0) {
    items.push({
      icon: 'precision_manufacturing',
      text: `${ej.ordenesBorrador} orden(es) de producción en borrador`,
      path: '/production',
      tone: 'warn',
    });
  }
  if (ej.transferenciasPendientes > 0) {
    items.push({
      icon: 'local_shipping',
      text: `${ej.transferenciasPendientes} transferencia(s) en tránsito`,
      path: '/transfers',
    });
  }
  if (ej.mermaCount > 0) {
    items.push({
      icon: 'warning',
      text: `${ej.mermaCount} registro(s) de merma (${ej.mermaVolumen.toLocaleString()} uds)`,
      path: '/audit',
      tone: 'warn',
    });
  }

  if (items.length === 0) {
    return (
      <div className="dash-actions-empty">
        <span className="material-icons-round">check_circle</span>
        <span>Sin acciones pendientes destacadas</span>
      </div>
    );
  }

  return (
    <ul className="dash-actions-list">
      {items.map((it) => (
        <li key={it.path + it.text}>
          <Link to={it.path} className={`dash-action-link${it.tone ? ` dash-action-${it.tone}` : ''}`}>
            <span className="material-icons-round">{it.icon}</span>
            <span>{it.text}</span>
            <span className="material-icons-round dash-action-arrow">chevron_right</span>
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default DashActionPanel;
