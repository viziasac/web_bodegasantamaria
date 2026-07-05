import React from 'react';
import { Link } from 'react-router-dom';
import ChartDonut from '../ChartDonut';
import { DONUT_COLORS } from '../ChartDonut';
import DashKpiCard from './DashKpiCard';
import DashPlSummary from './DashPlSummary';
import DashActionPanel from './DashActionPanel';
import DashTrendChart from './DashTrendChart';
import { DataTable, EmptyState, fmtMoney, fmtNum } from '../ui';
import { calcularSalud, desviacionSemaforo } from './dashboardUtils';
import type { DashboardEjecutivoData, DashboardKPIs, MovimientoTrendDia } from '../../types';

interface Props {
  kpis: DashboardKPIs | null;
  ej: DashboardEjecutivoData;
  trend: MovimientoTrendDia[];
  stockUbi: { ubicacion: string; cantidad: number }[];
  periodoLabel?: string;
}

const DashExecutiveTab: React.FC<Props> = ({ kpis, ej, trend, stockUbi, periodoLabel }) => {
  const salud = calcularSalud(ej);
  const devSem = desviacionSemaforo(ej.impactoAjustesPct);

  return (
    <>
      <div className={`dash-health dash-health-${salud.nivel}`}>
        <span className="material-icons-round">
          {salud.nivel === 'ok' ? 'verified' : salud.nivel === 'warn' ? 'info' : 'error'}
        </span>
        <div>
          <strong>Salud operativa — {salud.nivel === 'ok' ? 'Estable' : salud.nivel === 'warn' ? 'Atención' : 'Crítico'}</strong>
          <p>{salud.mensaje}</p>
        </div>
        <span className="dash-health-period">{periodoLabel ?? 'Mes en curso'}</span>
      </div>

      <div className="kpi-grid dash-kpi-exec">
        <DashKpiCard
          label="Ventas del mes"
          value={fmtMoney(ej.totalVentas)}
          icon="point_of_sale"
          iconTone="blue"
          sub={`${kpis?.ventasMesCount ?? 0} operaciones`}
        />
        <DashKpiCard
          label="Resultado operativo"
          value={fmtMoney(ej.balance)}
          icon="account_balance"
          iconTone={ej.balance >= 0 ? 'green' : 'red'}
          accent={ej.balance >= 0 ? 'success' : 'danger'}
          sub={`Gastos ${fmtMoney(ej.totalGastos)}`}
        />
        <DashKpiCard
          label="Producción vs plan"
          value={`${Math.round(ej.prodCumplimiento * 100)}%`}
          icon="precision_manufacturing"
          iconTone="gold"
          accent="gold"
          sub={`${fmtNum(ej.prodReal)} / ${fmtNum(ej.prodPlan)} bot.`}
        />
        <DashKpiCard
          label="Impacto ajustes"
          value={`${fmtNum(ej.impactoAjustesPct, 1)}%`}
          icon="tune"
          iconTone="blue"
          accent={devSem === 'ok' ? undefined : devSem === 'warn' ? 'gold' : 'danger'}
          sub={`${ej.ajustesCount} mov. · ${fmtNum(ej.ajustesVolumenAbs)} uds`}
        />
        <DashKpiCard
          label="Alertas stock"
          value={ej.alertasStock.length}
          icon="notification_important"
          iconTone="red"
          accent={ej.alertasStock.length > 0 ? 'danger' : undefined}
        />
        <DashKpiCard
          label="Stock PT total"
          value={fmtNum(kpis?.totalStockPT ?? 0)}
          icon="inventory_2"
          iconTone="green"
          sub={`Insumos ${fmtNum(kpis?.totalStockInsumos ?? 0)}`}
        />
      </div>

      <div className="grid-2-1">
        <div className="card">
          <div className="card-header">
            <h3>Flujo operativo — 14 días</h3>
            <span className="cell-muted">Entradas · Salidas · Ajustes · Merma</span>
          </div>
          <div className="chart-container">
            {trend.some((d) => d.entradas + d.salidas + d.ajustes + d.merma > 0) ? (
              <DashTrendChart data={trend} />
            ) : (
              <EmptyState icon="show_chart" title="Sin movimientos recientes" />
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Resultado del mes</h3></div>
          <DashPlSummary ventas={ej.totalVentas} gastos={ej.totalGastos} balance={ej.balance} />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Top desviaciones (ajustes)</h3>
            <Link to="/audit" className="dash-link-sm">Ver auditoría</Link>
          </div>
          {ej.topAjustes.length === 0 ? (
            <EmptyState icon="fact_check" title="Sin ajustes este mes" hint="Los conteos físicos aparecerán aquí" />
          ) : (
            <DataTable className="data-table-compact">
              <thead>
                <tr><th>Ítem</th><th>Ubicación</th><th>Vol. abs.</th><th>Δ neto</th></tr>
              </thead>
              <tbody>
                {ej.topAjustes.map((a) => (
                  <tr key={a.itemId}>
                    <td>{a.itemNombre}</td>
                    <td className="cell-muted">{a.ubicacionNombre}</td>
                    <td>{fmtNum(a.volumenAbs)}</td>
                    <td className={a.deltaNeto >= 0 ? 'text-ok' : 'text-danger'}>
                      {a.deltaNeto > 0 ? '+' : ''}{fmtNum(a.deltaNeto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>

        <div className="card">
          <div className="card-header"><h3>Acciones recomendadas</h3></div>
          <DashActionPanel ej={ej} />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3>Ajustes por almacén</h3></div>
          {ej.ajustesPorUbicacion.length === 0 ? (
            <EmptyState icon="warehouse" title="Sin ajustes por ubicación" />
          ) : (
            <DataTable className="data-table-compact">
              <thead>
                <tr><th>Ubicación</th><th>Movimientos</th><th>Volumen</th></tr>
              </thead>
              <tbody>
                {ej.ajustesPorUbicacion.map((u) => (
                  <tr key={u.ubicacion}>
                    <td>{u.ubicacion}</td>
                    <td>{u.count}</td>
                    <td>{fmtNum(u.volumenAbs)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>
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
      </div>

      {ej.alertasStock.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Ítems bajo mínimo</h3>
            <Link to="/inventory" className="dash-link-sm">Ir a inventario</Link>
          </div>
          <DataTable className="data-table-compact">
            <thead>
              <tr><th>Código</th><th>Ítem</th><th>Stock</th><th>Mínimo</th><th>Δ</th></tr>
            </thead>
            <tbody>
              {ej.alertasStock.map((a) => (
                <tr key={a.item_id}>
                  <td><code className="code-tag">{a.codigo}</code></td>
                  <td>{a.nombre}</td>
                  <td className="text-danger">{fmtNum(a.stock_total)}</td>
                  <td>{fmtNum(a.stock_minimo)}</td>
                  <td className="text-danger">{fmtNum(a.stock_total - a.stock_minimo)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}
    </>
  );
};

export default DashExecutiveTab;
