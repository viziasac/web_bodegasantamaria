import React from 'react';
import ChartBar from '../ChartBar';
import ChartDonut from '../ChartDonut';
import { DONUT_COLORS } from '../ChartDonut';
import DashKpiCard from './DashKpiCard';
import DashTrendChart from './DashTrendChart';
import { EmptyState, fmtDate, fmtNum, fmtMoney } from '../ui';
import { moveTypeIcon } from './dashboardUtils';
import type { DashboardKPIs, InvMovimiento, MovimientoTrendDia } from '../../types';

interface Props {
  kpis: DashboardKPIs | null;
  recentMoves: InvMovimiento[];
  trend: MovimientoTrendDia[];
  stockUbi: { ubicacion: string; cantidad: number }[];
}

const DashOperacionesTab: React.FC<Props> = ({ kpis, recentMoves, trend, stockUbi }) => (
  <>
    <div className="kpi-grid">
      <DashKpiCard label="Stock PT" value={fmtNum(kpis?.totalStockPT ?? 0)} icon="inventory_2" iconTone="green" />
      <DashKpiCard label="Stock insumos" value={fmtNum(kpis?.totalStockInsumos ?? 0)} icon="category" iconTone="gold" />
      <DashKpiCard
        label="Movimientos hoy"
        value={kpis?.movimientosHoy ?? 0}
        icon="swap_vert"
        iconTone="blue"
      />
      <DashKpiCard
        label="Producción mes"
        value={fmtNum(kpis?.produccionMes ?? 0)}
        icon="precision_manufacturing"
        iconTone="gold"
        accent="gold"
      />
      <DashKpiCard
        label="Alertas stock"
        value={kpis?.alertasStockBajo ?? 0}
        icon="notification_important"
        iconTone="red"
        accent={(kpis?.alertasStockBajo ?? 0) > 0 ? 'danger' : undefined}
      />
      <DashKpiCard label="Gastos mes" value={fmtMoney(kpis?.gastosDelMes ?? 0)} icon="account_balance_wallet" iconTone="green" />
    </div>

    <div className="grid-2-1">
      <div className="card">
        <div className="card-header"><h3>Flujo de movimientos — 14 días</h3></div>
        <div className="chart-container">
          {trend.some((d) => d.entradas + d.salidas + d.ajustes + d.merma > 0) ? (
            <DashTrendChart data={trend} />
          ) : (
            <EmptyState icon="show_chart" title="Sin movimientos recientes" />
          )}
        </div>
      </div>
      <div className="card">
        <div className="card-header"><h3>Volumen diario total</h3></div>
        <div className="chart-container">
          {trend.length > 0 ? (
            <ChartBar
              data={trend.map((d) => ({
                label: d.fecha.slice(5),
                value: Math.round(d.entradas + d.salidas + d.ajustes + d.merma),
                color: 'green',
              }))}
              height={200}
            />
          ) : (
            <EmptyState icon="bar_chart" title="Sin datos" />
          )}
        </div>
      </div>
    </div>

    <div className="grid-2">
      <div className="card">
        <div className="card-header"><h3>Stock por ubicación</h3></div>
        {stockUbi.length > 0 ? (
          <ChartDonut
            data={stockUbi.map((s, i) => ({
              label: s.ubicacion,
              value: Math.round(s.cantidad),
              color: DONUT_COLORS[i % DONUT_COLORS.length],
            }))}
            totalLabel="Total"
          />
        ) : (
          <EmptyState icon="pie_chart" title="Sin stock registrado" />
        )}
      </div>
      <div className="card">
        <div className="card-header"><h3>Actividad reciente</h3></div>
        <div className="activity-feed">
          {recentMoves.length > 0 ? recentMoves.map((m) => {
            const { icon, cls } = moveTypeIcon(m.tipo_mov);
            return (
              <div className="activity-item" key={m.id}>
                <div className={`activity-icon ${cls}`}>
                  <span className="material-icons-round">{icon}</span>
                </div>
                <div className="activity-text">
                  <div className="activity-title">
                    <span className="status-tag status-neutral" style={{ marginRight: '8px' }}>{m.tipo_mov}</span>
                    {m.ma_item?.nombre || 'Ítem'} ×{fmtNum(m.cantidad)}
                  </div>
                  <div className="activity-time">
                    {m.cat_ubicacion?.nombre || ''} — {fmtDate(m.fecha)}
                  </div>
                </div>
              </div>
            );
          }) : (
            <EmptyState icon="history" title="No hay movimientos" />
          )}
        </div>
      </div>
    </div>
  </>
);

export default DashOperacionesTab;
