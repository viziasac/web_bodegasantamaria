import React, { useEffect, useState } from 'react';
import {
  getDashboardKPIs, getMovimientos, getStockPorUbicacion, getMovimientosTrendDetalle,
  getVentasPeriodo, getOrdenesPeriodo, getDashboardEjecutivoData,
  getGastosPeriodo, getMovimientosPeriodo,
} from '../services/apiProvider';
import {
  PageHeader, PageLoader, TabBar, Alert, toUserMessage,
} from '../components/ui';
import MonthSelector from '../components/MonthSelector';
import { useInventarioData } from '../components/inventory/useInventarioData';
import DashInventarioTab from '../components/dashboard/DashInventarioTab';
import DashExecutiveTab from '../components/dashboard/DashExecutiveTab';
import DashOperacionesTab from '../components/dashboard/DashOperacionesTab';
import DashVentasTab from '../components/dashboard/DashVentasTab';
import DashProduccionTab from '../components/dashboard/DashProduccionTab';
import DashFinancieroTab from '../components/dashboard/DashFinancieroTab';
import { useCatalog } from '../context/CatalogContext';
import { mesActualKey, rangoMes } from '../utils/periodoMes';
import type {
  DashboardKPIs, DashboardEjecutivoData, InvMovimiento,
  MovimientoTrendDia, PrdOrden, VentaResumen, GasGasto,
} from '../types';

type DashTab = 'ejecutivo' | 'financiero' | 'operaciones' | 'ventas' | 'produccion' | 'stock';

const Dashboard: React.FC = () => {
  const { ubicaciones, ensureCatalogLoaded } = useCatalog();
  const inv = useInventarioData(ensureCatalogLoaded);
  const [mesKey, setMesKey] = useState(mesActualKey());
  const [tab, setTab] = useState<DashTab>('ejecutivo');
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [ejecutivo, setEjecutivo] = useState<DashboardEjecutivoData | null>(null);
  const [recentMoves, setRecentMoves] = useState<InvMovimiento[]>([]);
  const [stockUbi, setStockUbi] = useState<{ ubicacion: string; cantidad: number }[]>([]);
  const [trendData, setTrendData] = useState<MovimientoTrendDia[]>([]);
  const [ventas, setVentas] = useState<VentaResumen[]>([]);
  const [gastos, setGastos] = useState<GasGasto[]>([]);
  const [movimientosPeriodo, setMovimientosPeriodo] = useState<InvMovimiento[]>([]);
  const [ordenes, setOrdenes] = useState<PrdOrden[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const rango = rangoMes(mesKey);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setLoadError(null);
        const { desde, hasta } = rangoMes(mesKey);
        const [k, moves, ubi, trend, v, g, movs, ord, ej] = await Promise.all([
          getDashboardKPIs(desde, hasta),
          getMovimientos({ limit: 12 }),
          getStockPorUbicacion(),
          getMovimientosTrendDetalle(14, { desde, hasta }),
          getVentasPeriodo(desde, hasta),
          getGastosPeriodo(desde, hasta),
          getMovimientosPeriodo(desde, hasta, { limit: 100 }),
          getOrdenesPeriodo(desde, hasta),
          getDashboardEjecutivoData(desde, hasta),
        ]);
        setKpis(k);
        setRecentMoves(moves);
        setStockUbi(ubi);
        setTrendData(trend);
        setVentas(v);
        setGastos(g);
        setMovimientosPeriodo(movs);
        setOrdenes(ord);
        setEjecutivo(ej);
      } catch (err) {
        setLoadError(toUserMessage(err, 'Error cargando el panel'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [mesKey]);

  if (loading && !ejecutivo) return <PageLoader />;

  return (
    <div className="animate-in dash-page">
      <PageHeader
        title="Panel de Control"
        subtitle={`Vista gerencial y detalle operativo — ${rango.label}`}
        moduleId="dashboard"
        action={
          <>
            <MonthSelector value={mesKey} onChange={setMesKey} label="Mes" />
            <div className="date-badge">
              <span className="material-icons-round" style={{ fontSize: '16px' }}>calendar_today</span>
              {new Date().toLocaleDateString('es-PE', { dateStyle: 'long' })}
            </div>
          </>
        }
      />

      {loadError && <Alert type="error" message={loadError} onClose={() => setLoadError(null)} />}

      <TabBar
        active={tab}
        onChange={(id) => setTab(id as DashTab)}
        tabs={[
          { id: 'ejecutivo', label: 'Ejecutivo', icon: 'insights' },
          { id: 'financiero', label: 'Financiero', icon: 'account_balance_wallet' },
          { id: 'operaciones', label: 'Operaciones', icon: 'dashboard' },
          { id: 'ventas', label: 'Comercial', icon: 'point_of_sale' },
          { id: 'produccion', label: 'Producción', icon: 'precision_manufacturing' },
          { id: 'stock', label: 'Inventario', icon: 'inventory_2' },
        ]}
      />

      {loading && <PageLoader />}

      {!loading && ejecutivo && tab === 'ejecutivo' && (
        <DashExecutiveTab
          kpis={kpis}
          ej={ejecutivo}
          trend={trendData}
          stockUbi={stockUbi}
          periodoLabel={rango.label}
        />
      )}

      {!loading && tab === 'financiero' && (
        <DashFinancieroTab
          ventas={ventas}
          gastos={gastos}
          movimientos={movimientosPeriodo}
          periodoLabel={rango.label}
        />
      )}

      {!loading && tab === 'operaciones' && (
        <DashOperacionesTab
          kpis={kpis}
          recentMoves={recentMoves}
          trend={trendData}
          stockUbi={stockUbi}
          periodoLabel={rango.label}
        />
      )}

      {!loading && tab === 'ventas' && (
        <DashVentasTab kpis={kpis} ventas={ventas} periodoLabel={rango.label} />
      )}

      {!loading && ejecutivo && tab === 'produccion' && (
        <DashProduccionTab ordenes={ordenes} ej={ejecutivo} periodoLabel={rango.label} />
      )}

      {tab === 'stock' && (
        <>
          {inv.error && <Alert type="error" message={inv.error} onClose={() => inv.setError(null)} />}
          <DashInventarioTab inv={inv} ubicaciones={ubicaciones} />
        </>
      )}
    </div>
  );
};

export default Dashboard;
