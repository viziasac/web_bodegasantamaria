import React from 'react';
import { fmtMoney } from '../ui';

interface DashPlSummaryProps {
  ventas: number;
  gastos: number;
  balance: number;
}

const DashPlSummary: React.FC<DashPlSummaryProps> = ({ ventas, gastos, balance }) => {
  const maxBar = Math.max(ventas, gastos, Math.abs(balance), 1);
  const pct = (v: number) => `${Math.max((Math.abs(v) / maxBar) * 100, v !== 0 ? 8 : 0)}%`;

  return (
    <div className="dash-pl">
      <div className="dash-pl-row">
        <span className="dash-pl-label">Ingresos (ventas)</span>
        <div className="dash-pl-bar-track">
          <div className="dash-pl-bar dash-pl-bar-in" style={{ width: pct(ventas) }} />
        </div>
        <span className="dash-pl-val text-ok">{fmtMoney(ventas)}</span>
      </div>
      <div className="dash-pl-row">
        <span className="dash-pl-label">Egresos (gastos)</span>
        <div className="dash-pl-bar-track">
          <div className="dash-pl-bar dash-pl-bar-out" style={{ width: pct(gastos) }} />
        </div>
        <span className="dash-pl-val text-danger">{fmtMoney(gastos)}</span>
      </div>
      <div className="dash-pl-result">
        <span>Resultado operativo</span>
        <strong className={balance >= 0 ? 'text-ok' : 'text-danger'}>{fmtMoney(balance)}</strong>
      </div>
    </div>
  );
};

export default DashPlSummary;
