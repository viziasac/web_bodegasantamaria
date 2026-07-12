import React, { useMemo } from 'react';
import ChartBar from '../ChartBar';
import DashKpiCard from './DashKpiCard';
import { DataTable, EmptyState, fmtDate, fmtMoney, fmtNum } from '../ui';
import {
  extremosDiasVenta,
  financeKpis,
  labelMovimientoItem,
  serieIngresosDiarios,
  topEgresosPorCategoria,
  topEgresosPorProveedor,
  topVentasPorCanal,
  topVentasPorCliente,
  topVentasPorPuntoVenta,
  type FinanceTopRow,
} from '../../utils/dashboardFinance';
import type { GasGasto, InvMovimiento, VentaResumen } from '../../types';

interface Props {
  ventas: VentaResumen[];
  gastos: GasGasto[];
  movimientos: InvMovimiento[];
  periodoLabel?: string;
}

function TopTable({ rows, valueLabel = 'Monto' }: { rows: FinanceTopRow[]; valueLabel?: string }) {
  if (rows.length === 0) {
    return <EmptyState icon="leaderboard" title="Sin datos" />;
  }
  return (
    <DataTable>
      <thead>
        <tr>
          <th>#</th>
          <th>Concepto</th>
          <th>Ops</th>
          <th>{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.label}>
            <td className="cell-num">{i + 1}</td>
            <td>{r.label}</td>
            <td className="cell-num">{r.count}</td>
            <td className="cell-money">{fmtMoney(r.value)}</td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

const DashFinancieroTab: React.FC<Props> = ({ ventas, gastos, movimientos, periodoLabel }) => {
  const kpis = useMemo(() => financeKpis(ventas, gastos), [ventas, gastos]);
  const { mejor, peor } = useMemo(() => extremosDiasVenta(ventas), [ventas]);
  const serie = useMemo(() => serieIngresosDiarios(ventas), [ventas]);
  const topCanal = useMemo(() => topVentasPorCanal(ventas), [ventas]);
  const topPv = useMemo(() => topVentasPorPuntoVenta(ventas), [ventas]);
  const topCliente = useMemo(() => topVentasPorCliente(ventas), [ventas]);
  const topCat = useMemo(() => topEgresosPorCategoria(gastos), [gastos]);
  const topProv = useMemo(() => topEgresosPorProveedor(gastos), [gastos]);

  const period = periodoLabel ? ` — ${periodoLabel}` : '';

  return (
    <>
      <div className="kpi-grid kpi-grid--dense">
        <DashKpiCard
          label={`Ingresos${period}`}
          value={fmtMoney(kpis.ingresos)}
          icon="trending_up"
          iconTone="green"
          accent="gold"
        />
        <DashKpiCard
          label={`Egresos${period}`}
          value={fmtMoney(kpis.egresos)}
          icon="trending_down"
          iconTone="red"
        />
        <DashKpiCard
          label="Balance"
          value={fmtMoney(kpis.balance)}
          icon="account_balance"
          iconTone={kpis.balance >= 0 ? 'green' : 'red'}
          accent={kpis.balance < 0 ? 'danger' : undefined}
        />
        <DashKpiCard
          label="Ticket promedio"
          value={fmtMoney(kpis.ticketPromedio)}
          icon="payments"
          iconTone="gold"
        />
        <DashKpiCard
          label="Ops ventas"
          value={kpis.opsVentas}
          icon="receipt_long"
          iconTone="blue"
        />
        <DashKpiCard
          label="Ops gastos"
          value={kpis.opsGastos}
          icon="receipt"
          iconTone="blue"
        />
      </div>

      <div className="grid-2">
        <div className="card card-section">
          <div className="card-header"><h3>Mejor / peor día de venta</h3></div>
          {!mejor ? (
            <EmptyState icon="event" title="Sin ventas en el periodo" />
          ) : (
            <div className="kpi-grid kpi-grid--2">
              <div>
                <p className="kpi-sub">Mayor venta</p>
                <p className="cell-money" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                  {fmtMoney(mejor.total)}
                </p>
                <p>{fmtDate(mejor.fecha)} · {mejor.count} ops</p>
              </div>
              <div>
                <p className="kpi-sub">Menor venta (días con venta)</p>
                <p className="cell-money" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                  {fmtMoney(peor!.total)}
                </p>
                <p>{fmtDate(peor!.fecha)} · {peor!.count} ops</p>
              </div>
            </div>
          )}
        </div>
        <div className="card card-section">
          <div className="card-header"><h3>Ingresos diarios</h3></div>
          {serie.length === 0 ? (
            <EmptyState icon="bar_chart" title="Sin serie de ingresos" />
          ) : (
            <div className="chart-container">
              <ChartBar
                data={serie.map((d) => ({ label: d.label, value: Math.round(d.total), color: 'green' }))}
                height={180}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="card card-section">
          <div className="card-header"><h3>Top ingresos por canal</h3></div>
          <TopTable rows={topCanal} />
        </div>
        <div className="card card-section">
          <div className="card-header"><h3>Top ingresos por punto de venta</h3></div>
          <TopTable rows={topPv} />
        </div>
      </div>

      <div className="grid-2">
        <div className="card card-section">
          <div className="card-header"><h3>Top ingresos por cliente</h3></div>
          <TopTable rows={topCliente} />
        </div>
        <div className="card card-section">
          <div className="card-header"><h3>Top egresos por categoría</h3></div>
          <TopTable rows={topCat} />
        </div>
      </div>

      <div className="grid-2">
        <div className="card card-section">
          <div className="card-header"><h3>Top egresos por proveedor</h3></div>
          <TopTable rows={topProv} />
        </div>
        <div className="card card-section">
          <div className="card-header"><h3>Resumen rápido</h3></div>
          <p className="kpi-sub">
            Ingresos {fmtMoney(kpis.ingresos)} − Egresos {fmtMoney(kpis.egresos)} = Balance{' '}
            <strong className="cell-money">{fmtMoney(kpis.balance)}</strong>
          </p>
        </div>
      </div>

      <div className="card card-section">
        <div className="card-header"><h3>Ventas del mes</h3></div>
        {ventas.length === 0 ? (
          <EmptyState icon="point_of_sale" title="Sin ventas este mes" />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>N°</th>
                <th>PV</th>
                <th>Canal</th>
                <th>Cliente</th>
                <th>Total</th>
              </tr>
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

      <div className="card card-section">
        <div className="card-header"><h3>Gastos del mes</h3></div>
        {gastos.length === 0 ? (
          <EmptyState icon="money_off" title="Sin gastos este mes" />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Categoría</th>
                <th>Proveedor</th>
                <th>Descripción</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => (
                <tr key={g.id}>
                  <td>{fmtDate(g.fecha)}</td>
                  <td>{g.gas_categoria?.nombre || '—'}</td>
                  <td>{g.proveedor_nombre || '—'}</td>
                  <td>{g.descripcion || '—'}</td>
                  <td className="cell-money">{fmtMoney(g.monto)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>

      <div className="card card-section">
        <div className="card-header"><h3>Movimientos del periodo (últ. 100)</h3></div>
        {movimientos.length === 0 ? (
          <EmptyState icon="swap_vert" title="Sin movimientos en el periodo" />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Ítem</th>
                <th>Ubicación</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id}>
                  <td>{fmtDate(m.fecha)}</td>
                  <td><span className="status-tag status-neutral">{m.tipo_mov}</span></td>
                  <td>{labelMovimientoItem(m)}</td>
                  <td>{m.cat_ubicacion?.nombre || '—'}</td>
                  <td className="cell-num">{fmtNum(m.cantidad)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>
    </>
  );
};

export default DashFinancieroTab;
