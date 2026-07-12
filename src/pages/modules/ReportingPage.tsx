import React, { useState, useEffect } from 'react';
import { getResumenReportes } from '../../services/apiProvider';
import {
  PageHeader, Alert, FormInput, FormSelect, SubmitButton, PageLoader, FormRow,
  DataTable, EmptyState, fmtMoney, toUserMessage,
} from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';
import { hoyYmd, inicioMesYmd } from '../../utils/fechaLocal';

function ventaRowLabel(v: Record<string, unknown>): string {
  return String(
    v.canal ?? v.ubicacion_nombre ?? v.punto_venta ?? v.presentacion ?? v.item_nombre ?? 'Ventas',
  );
}

const ReportingPage: React.FC = () => {
  const { ubicaciones } = useCatalog();
  const [fechaDesde, setFechaDesde] = useState(inicioMesYmd());
  const [fechaHasta, setFechaHasta] = useState(hoyYmd());
  const [ubicacionId, setUbicacionId] = useState('');
  const [centroCosto, setCentroCosto] = useState('');
  const [resumen, setResumen] = useState<Awaited<ReturnType<typeof getResumenReportes>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pvUbicaciones = ubicaciones.filter((u) => u.es_punto_venta);

  const generar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (fechaDesde > fechaHasta) {
      setError('La fecha "Desde" no puede ser posterior a "Hasta".');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResumen(await getResumenReportes(fechaDesde, fechaHasta, {
        ubicacionId: ubicacionId || undefined,
        centroCosto: centroCosto || undefined,
      }));
    } catch (err) {
      setError(toUserMessage(err, 'Error al generar reporte'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { generar(); }, []);

  const gastosPorCategoria = resumen?.gastos.reduce<Record<string, number>>((acc, g) => {
    const cat = String(g.categoria ?? 'Sin categoría');
    acc[cat] = (acc[cat] ?? 0) + (Number(g.total_gastado) || 0);
    return acc;
  }, {}) ?? {};

  return (
    <div className="animate-in">
      <PageHeader title="Reportes" subtitle="Resumen operativo del periodo (solo administradores)" />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <div className="card card-section">
        <form onSubmit={generar}>
          <FormRow actions>
            <FormInput label="Desde" type="date" value={fechaDesde} onChange={setFechaDesde} required />
            <FormInput label="Hasta" type="date" value={fechaHasta} onChange={setFechaHasta} required />
          </FormRow>
          <FormRow actions>
            <FormSelect label="Punto de venta (opcional)" value={ubicacionId} onChange={setUbicacionId}
              options={[{ value: '', label: 'Todos' }, ...pvUbicaciones.map((u) => ({ value: u.id, label: u.nombre }))]} />
            <FormSelect label="Centro de costo (gastos)" value={centroCosto} onChange={setCentroCosto}
              options={[
                { value: '', label: 'Todos' },
                { value: 'BODEGA', label: 'Bodega' },
                { value: 'PRODUCCION', label: 'Producción' },
                { value: 'VENTAS', label: 'Ventas' },
              ]} />
            <SubmitButton loading={loading} label="Generar reporte" icon="analytics" />
          </FormRow>
        </form>
      </div>

      {loading && <PageLoader />}
      {resumen && !loading && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-label">Ingresos (ventas)</span>
              <div className="kpi-value">{fmtMoney(resumen.totalVentas)}</div>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Egresos (gastos)</span>
              <div className="kpi-value">{fmtMoney(resumen.totalGastos)}</div>
            </div>
            <div className="kpi-card accent-gold">
              <span className="kpi-label">Balance</span>
              <div className="kpi-value">{fmtMoney(resumen.balance)}</div>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Unidades vendidas</span>
              <div className="kpi-value">{resumen.ventas_unidades.toLocaleString()}</div>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Producción completada</span>
              <div className="kpi-value">{resumen.produccion.toLocaleString()} bot.</div>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Entradas insumo (COMPRA)</span>
              <div className="kpi-value">{resumen.entradas_insumo_cantidad.toLocaleString()}</div>
            </div>
          </div>
          {Object.keys(gastosPorCategoria).length > 0 && (
            <div className="card card-section">
              <h3 className="card-section-title">Gastos por categoría</h3>
              <DataTable>
                <thead><tr><th>Categoría</th><th>Total</th></tr></thead>
                <tbody>
                  {Object.entries(gastosPorCategoria).map(([cat, total]) => (
                    <tr key={cat}><td>{cat}</td><td className="cell-money">{fmtMoney(total)}</td></tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          )}
          <div className="grid-2-1">
            <div className="card card-section">
              <h3 className="card-section-title">Detalle ventas (agregado)</h3>
              {resumen.ventas.length === 0 ? (
                <EmptyState icon="receipt_long" title="Sin ventas en el periodo" />
              ) : (
                <DataTable>
                  <thead><tr><th>Grupo</th><th>Unidades</th><th>Total</th></tr></thead>
                  <tbody>
                    {resumen.ventas.slice(0, 20).map((v, i) => (
                      <tr key={i}>
                        <td>{ventaRowLabel(v)}</td>
                        <td className="cell-num">{Number(v.cant_vendida) || 0}</td>
                        <td className="cell-money">{fmtMoney(Number(v.total_vendido) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </div>
            <div className="card card-section">
              <h3 className="card-section-title">Detalle gastos (agregado)</h3>
              {resumen.gastos.length === 0 ? (
                <EmptyState icon="money_off" title="Sin gastos en el periodo" />
              ) : (
                <DataTable>
                  <thead><tr><th>Categoría</th><th>Proveedor</th><th>Total</th></tr></thead>
                  <tbody>
                    {resumen.gastos.slice(0, 20).map((g, i) => (
                      <tr key={i}>
                        <td>{String(g.categoria ?? 'Sin categoría')}</td>
                        <td>{String(g.proveedor ?? '—')}</td>
                        <td className="cell-money">{fmtMoney(Number(g.total_gastado) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportingPage;
