import React, { useMemo } from 'react';
import ChartDonut from '../ChartDonut';
import { DONUT_COLORS } from '../ChartDonut';
import DashKpiCard from './DashKpiCard';
import { DataTable, EmptyState, fmtDate, fmtMoney } from '../ui';
import {
  financeKpis,
  topVentasPorCanal,
  topVentasPorCliente,
  topVentasPorPuntoVenta,
} from '../../utils/dashboardFinance';
import type { DashboardKPIs, VentaResumen } from '../../types';

interface Props {
  kpis: DashboardKPIs | null;
  ventas: VentaResumen[];
  periodoLabel?: string;
}

const DashVentasTab: React.FC<Props> = ({ kpis, ventas, periodoLabel }) => {
  const porCanal = useMemo(() => topVentasPorCanal(ventas, 8), [ventas]);
  const topPv = useMemo(() => topVentasPorPuntoVenta(ventas, 5), [ventas]);
  const topCliente = useMemo(() => topVentasPorCliente(ventas, 5), [ventas]);
  const fin = useMemo(() => financeKpis(ventas, []), [ventas]);

  const ticketPromedio = fin.ticketPromedio || (
    ventas.length > 0 && kpis?.ventasMes ? kpis.ventasMes / ventas.length : 0
  );

  return (
    <>
      <div className="kpi-grid kpi-grid--dense">
        <DashKpiCard
          label={`Total ventas${periodoLabel ? ` — ${periodoLabel}` : ''}`}
          value={fmtMoney(kpis?.ventasMes ?? fin.ingresos)}
          icon="attach_money"
          iconTone="blue"
          accent="gold"
        />
        <DashKpiCard
          label="Operaciones"
          value={kpis?.ventasMesCount ?? ventas.length}
          icon="receipt_long"
          iconTone="green"
        />
        <DashKpiCard
          label="Ticket promedio"
          value={fmtMoney(ticketPromedio)}
          icon="payments"
          iconTone="gold"
        />
      </div>

      <div className="grid-2">
        <div className="card card-section">
          <div className="card-header"><h3>Top por punto de venta</h3></div>
          {topPv.length === 0 ? (
            <EmptyState icon="storefront" title="Sin datos" />
          ) : (
            <DataTable>
              <thead>
                <tr><th>#</th><th>PV</th><th>Ops</th><th>Total</th></tr>
              </thead>
              <tbody>
                {topPv.map((r, i) => (
                  <tr key={r.label}>
                    <td className="cell-num">{i + 1}</td>
                    <td>{r.label}</td>
                    <td className="cell-num">{r.count}</td>
                    <td className="cell-money">{fmtMoney(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>
        <div className="card card-section">
          <div className="card-header"><h3>Top por cliente</h3></div>
          {topCliente.length === 0 ? (
            <EmptyState icon="groups" title="Sin datos" />
          ) : (
            <DataTable>
              <thead>
                <tr><th>#</th><th>Cliente</th><th>Ops</th><th>Total</th></tr>
              </thead>
              <tbody>
                {topCliente.map((r, i) => (
                  <tr key={r.label}>
                    <td className="cell-num">{i + 1}</td>
                    <td>{r.label}</td>
                    <td className="cell-num">{r.count}</td>
                    <td className="cell-money">{fmtMoney(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="card card-section">
          <div className="card-header"><h3>Detalle de ventas</h3></div>
          {ventas.length === 0 ? (
            <EmptyState icon="receipt_long" title="Sin ventas este mes" />
          ) : (
            <DataTable>
              <thead>
                <tr><th>Fecha</th><th>N° Venta</th><th>Ubicación</th><th>Canal</th><th>Cliente</th><th>Total</th></tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id}>
                    <td>{fmtDate(v.fecha)}</td>
                    <td><code className="code-tag">{v.nro_venta || v.id.slice(0, 8)}</code></td>
                    <td>{v.cat_ubicacion?.nombre || '—'}</td>
                    <td><span className="status-tag status-neutral">{v.canal || '—'}</span></td>
                    <td>{v.ma_cliente?.nombre || '—'}</td>
                    <td className="cell-money">{fmtMoney(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>
        <div className="card">
          <div className="card-header"><h3>Ventas por canal</h3></div>
          {porCanal.length > 0 ? (
            <ChartDonut
              data={porCanal.map((c, i) => ({
                label: c.label,
                value: Math.round(c.value),
                color: DONUT_COLORS[i % DONUT_COLORS.length],
              }))}
              totalLabel="S/"
            />
          ) : (
            <EmptyState icon="pie_chart" title="Sin datos por canal" />
          )}
        </div>
      </div>
    </>
  );
};

export default DashVentasTab;
