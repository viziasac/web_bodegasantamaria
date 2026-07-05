import React, { useMemo } from 'react';
import ChartDonut from '../ChartDonut';
import { DONUT_COLORS } from '../ChartDonut';
import DashKpiCard from './DashKpiCard';
import { DataTable, EmptyState, fmtDate, fmtMoney } from '../ui';
import type { DashboardKPIs, VentaResumen } from '../../types';

interface Props {
  kpis: DashboardKPIs | null;
  ventas: VentaResumen[];
  periodoLabel?: string;
}

const DashVentasTab: React.FC<Props> = ({ kpis, ventas, periodoLabel }) => {
  const porCanal = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of ventas) {
      const c = v.canal || 'Sin canal';
      map[c] = (map[c] || 0) + (v.total || 0);
    }
    return Object.entries(map)
      .map(([label, value]) => ({ label, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [ventas]);

  const ticketPromedio = ventas.length > 0 && kpis?.ventasMes
    ? kpis.ventasMes / ventas.length
    : 0;

  return (
    <>
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <DashKpiCard
          label={`Total ventas${periodoLabel ? ` — ${periodoLabel}` : ''}`}
          value={fmtMoney(kpis?.ventasMes ?? 0)}
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
                value: c.value,
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
