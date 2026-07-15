import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

const VALID_TABS: DashTab[] = ['ejecutivo', 'financiero', 'operaciones', 'ventas', 'produccion', 'stock'];

function tabFromParam(raw: string | null): DashTab {
  return VALID_TABS.includes(raw as DashTab) ? (raw as DashTab) : 'ejecutivo';
}

const Dashboard: React.FC = () => {
  const { ubicaciones, ensureCatalogLoaded } = useCatalog();
  const inv = useInventarioData(ensureCatalogLoaded);
  const [searchParams, setSearchParams] = useSearchParams();
  const [mesKey, setMesKey] = useState(mesActualKey());
  const tab = tabFromParam(searchParams.get('tab'));
  const setTab = (id: DashTab) => {
    setSearchParams(id === 'ejecutivo' ? {} : { tab: id }, { replace: true });
  };

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [ejecutivo, setEjecutivo] = useState<DashboardEjecutivoData | null>(null);
  const [recentMoves, setRecentMoves] = useState<InvMovimiento[]>([]);
  const [stockUbi, setStockUbi] = useState<{ ubicacion: string; cantidad: number }[]>([]);
  const [trendData, setTrendData] = useState<MovimientoTrendDia[]>([]);
  const [ventas, setVentas] = useState<VentaResumen[]>([]);
  const [gastos, setGastos] = useState<GasGasto[]>([]);
  const [movimientosPeriodo, setMovimientosPeriodo] = useState<InvMovimiento[]>([]);
  const [ordenes, setOrdenes] = useState<PrdOrden[]>([]);
  const [loadingCore, setLoadingCore] = useState(true);
  const [loadingTab, setLoadingTab] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadedRef = useRef<Set<string>>(new Set());

  const rango = rangoMes(mesKey);

  useEffect(() => {
    let cancelled = false;
    loadedRef.current = new Set();
    const load = async () => {
      setLoadingCore(true);
      setEjecutivo(null);
      try {
        setLoadError(null);
        const { desde, hasta } = rangoMes(mesKey);
        const [k, moves, ubi, trend, ej] = await Promise.all([
          getDashboardKPIs(desde, hasta),
          getMovimientos({ limit: 12 }),
          getStockPorUbicacion(),
          getMovimientosTrendDetalle(14, { desde, hasta }),
          getDashboardEjecutivoData(desde, hasta),
        ]);
        if (cancelled) return;
        setKpis(k);
        setRecentMoves(moves);
        setStockUbi(ubi);
        setTrendData(trend);
        setEjecutivo(ej);
        loadedRef.current.add('ejecutivo');
        loadedRef.current.add('operaciones');
      } catch (err) {
        if (!cancelled) setLoadError(toUserMessage(err, 'Error cargando el panel'));
      } finally {
        if (!cancelled) setLoadingCore(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [mesKey]);

  useEffect(() => {
    if (loadingCore) return;
    if (tab === 'stock' || tab === 'ejecutivo' || tab === 'operaciones') return;
    if (loadedRef.current.has(tab)) return;

    let cancelled = false;
    const load = async () => {
      setLoadingTab(true);
      try {
        const { desde, hasta } = rangoMes(mesKey);
        if (tab === 'financiero') {
          const [v, g, movs] = await Promise.all([
            getVentasPeriodo(desde, hasta),
            getGastosPeriodo(desde, hasta),
            getMovimientosPeriodo(desde, hasta, { limit: 100 }),
          ]);
          if (cancelled) return;
          setVentas(v);
          setGastos(g);
          setMovimientosPeriodo(movs);
          loadedRef.current.add('financiero');
          loadedRef.current.add('ventas');
        } else if (tab === 'ventas') {
          const v = await getVentasPeriodo(desde, hasta);
          if (cancelled) return;
          setVentas(v);
          loadedRef.current.add('ventas');
        } else if (tab === 'produccion') {
          const ord = await getOrdenesPeriodo(desde, hasta);
          if (cancelled) return;
          setOrdenes(ord);
          loadedRef.current.add('produccion');
        }
      } catch (err) {
        if (!cancelled) setLoadError(toUserMessage(err, 'Error cargando pestaña'));
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tab, loadingCore, mesKey]);

  if (loadingCore && !ejecutivo) return <PageLoader />;

  const showFinanciero = tab === 'financiero' && !loadingTab && !loadingCore;
  const showVentas = tab === 'ventas' && !loadingTab && !loadingCore;
  const showProduccion = tab === 'produccion' && !loadingTab && !loadingCore && !!ejecutivo;

  return (
    <div className="animate-in dash-page">
      <PageHeader
        title="Panel de Control"
        subtitle={`Vista gerencial y detalle operativo — ${rango.label}`}
        moduleId="dashboard"
        action={
          <>
            <Link to="/downloads" className="btn btn-ghost">
              <span className="material-icons-round">download</span>
              Exportar periodo
            </Link>
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

      {(loadingCore || loadingTab) && <PageLoader />}

      {!loadingCore && !loadingTab && ejecutivo && tab === 'ejecutivo' && (
        <DashExecutiveTab
          kpis={kpis}
          ej={ejecutivo}
          trend={trendData}
          stockUbi={stockUbi}
          periodoLabel={rango.label}
        />
      )}

      {showFinanciero && (
        <DashFinancieroTab
          ventas={ventas}
          gastos={gastos}
          movimientos={movimientosPeriodo}
          periodoLabel={rango.label}
        />
      )}

      {!loadingCore && !loadingTab && tab === 'operaciones' && (
        <DashOperacionesTab
          kpis={kpis}
          recentMoves={recentMoves}
          trend={trendData}
          stockUbi={stockUbi}
          periodoLabel={rango.label}
        />
      )}

      {showVentas && (
        <DashVentasTab kpis={kpis} ventas={ventas} periodoLabel={rango.label} />
      )}

      {showProduccion && (
        <DashProduccionTab ordenes={ordenes} ej={ejecutivo!} periodoLabel={rango.label} />
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
