import React, { useMemo } from 'react';
import ChartBar from '../ChartBar';
import DashKpiCard from './DashKpiCard';
import { DataTable, EmptyState, fmtNum } from '../ui';
import { etiquetaOrdenPlan } from '../../utils/presentacionLabels';
import type { DashboardEjecutivoData, PrdOrden } from '../../types';

interface Props {
  ordenes: PrdOrden[];
  ej: DashboardEjecutivoData | null;
  periodoLabel?: string;
}

const DashProduccionTab: React.FC<Props> = ({ ordenes, ej, periodoLabel }) => {
  const ordenesCompletadas = ordenes.filter((o) => o.estado === 'COMPLETADA');
  const ordenesBorrador = ordenes.filter((o) => o.estado === 'BORRADOR');
  const ordenesActivas = ordenes.filter((o) => o.estado !== 'COMPLETADA' && o.estado !== 'ANULADA');

  const chartProductos = useMemo(() => {
    const map: Record<string, { plan: number; real: number }> = {};
    for (const o of ordenesCompletadas) {
      const name = o.ma_item?.nombre || 'Producto';
      if (!map[name]) map[name] = { plan: 0, real: 0 };
      map[name].plan += o.cant_planificada || 0;
      map[name].real += o.cant_real || 0;
    }
    return Object.entries(map)
      .slice(0, 6)
      .map(([label, v]) => ({
        label: label.length > 12 ? `${label.slice(0, 11)}…` : label,
        value: Math.round(v.real),
        color: 'gold' as const,
      }));
  }, [ordenesCompletadas]);

  const cumplimiento = ej?.prodCumplimiento ?? (
    ordenesCompletadas.reduce((s, o) => s + (o.cant_planificada || 0), 0) > 0
      ? ordenesCompletadas.reduce((s, o) => s + (o.cant_real || 0), 0)
        / ordenesCompletadas.reduce((s, o) => s + (o.cant_planificada || 0), 0)
      : 1
  );

  return (
    <>
      <div className="kpi-grid kpi-grid--dense">
        <DashKpiCard label="Órdenes totales" value={ordenes.length} icon="list_alt" iconTone="blue" />
        <DashKpiCard label="Completadas" value={ordenesCompletadas.length} icon="check_circle" iconTone="green" accent="success" />
        <DashKpiCard label="En borrador" value={ordenesBorrador.length} icon="edit_note" iconTone="gold" accent={ordenesBorrador.length > 0 ? 'gold' : undefined} />
        <DashKpiCard label="Activas" value={ordenesActivas.length} icon="pending" iconTone="blue" />
        <DashKpiCard
          label={`Cumplimiento${periodoLabel ? ` — ${periodoLabel}` : ''}`}
          value={`${Math.round(cumplimiento * 100)}%`}
          icon="speed"
          iconTone="gold"
          accent="gold"
          sub={ej ? `${fmtNum(ej.prodReal)} / ${fmtNum(ej.prodPlan)} bot.` : undefined}
        />
      </div>

      {chartProductos.length > 0 && (
        <div className="card">
          <div className="card-header"><h3>Producción real por producto (completadas)</h3></div>
          <div className="chart-container">
            <ChartBar data={chartProductos} height={180} />
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h3>Órdenes de producción</h3></div>
        {ordenes.length === 0 ? (
          <EmptyState icon="factory" title="Sin órdenes de producción" />
        ) : (
          <DataTable>
            <thead>
              <tr><th>N° Orden</th><th>Producto</th><th>Presentación</th><th>Plan</th><th>Real</th><th>%</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {ordenes.map((o) => {
                const pct = o.cant_planificada > 0 && o.cant_real != null
                  ? Math.round((o.cant_real / o.cant_planificada) * 100)
                  : null;
                return (
                  <tr key={o.id}>
                    <td><code className="code-tag">{o.nro_orden}</code></td>
                    <td>{o.ma_item?.nombre || '—'}</td>
                    <td>{o.ma_presentacion?.nombre ?? '—'}</td>
                    <td title={etiquetaOrdenPlan(o)}>{fmtNum(o.cant_planificada)} bot.</td>
                    <td>{o.cant_real != null ? `${fmtNum(o.cant_real)} bot.` : '—'}</td>
                    <td className={pct != null && pct < 80 ? 'text-danger' : pct != null && pct >= 100 ? 'text-ok' : ''}>
                      {pct != null ? `${pct}%` : '—'}
                    </td>
                    <td>
                      <span className={`status-tag ${o.estado === 'COMPLETADA' ? 'status-ok' : o.estado === 'BORRADOR' ? 'status-warn' : 'status-danger'}`}>
                        {o.estado}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </div>
    </>
  );
};

export default DashProduccionTab;
