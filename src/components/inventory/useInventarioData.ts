import { useState, useMemo, useCallback, useEffect } from 'react';
import { getInventarioDetallado, buildResumenPorAlmacen } from '../../services/apiProvider';
import { toUserMessage } from '../../utils/erpErrors';
import type { InventarioFila } from '../../types';

export interface InventarioFilters {
  ubicacionId: string;
  tipoFilter: string;
  categoriaFilter: string;
  search: string;
  soloAlertas: boolean;
}

export function useInventarioData(ensureCatalogLoaded: () => Promise<void>) {
  const [inventario, setInventario] = useState<InventarioFila[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ubicacionId, setUbicacionId] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [search, setSearch] = useState('');
  const [soloAlertas, setSoloAlertas] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureCatalogLoaded();
      setInventario(await getInventarioDetallado());
    } catch (err) {
      setError(toUserMessage(err, 'Error cargando inventario'));
    } finally {
      setLoading(false);
    }
  }, [ensureCatalogLoaded]);

  useEffect(() => { reload(); }, [reload]);

  const categorias = useMemo(
    () => [...new Set(inventario.map((r) => r.categoria))].sort(),
    [inventario],
  );

  const filterText = (text: string) =>
    !search || text.toLowerCase().includes(search.toLowerCase());

  const filasFiltered = useMemo(
    () =>
      inventario.filter((r) => {
        if (ubicacionId && r.almacen_id !== ubicacionId) return false;
        if (tipoFilter && r.tipo !== tipoFilter) return false;
        if (categoriaFilter && r.categoria !== categoriaFilter) return false;
        if (soloAlertas && !r.bajo_minimo) return false;
        return filterText(`${r.nombre} ${r.codigo} ${r.almacen_nombre}`);
      }),
    [inventario, ubicacionId, tipoFilter, categoriaFilter, soloAlertas, search],
  );

  const resumenAlmacenes = useMemo(
    () => buildResumenPorAlmacen(filasFiltered),
    [filasFiltered],
  );

  const globalStats = useMemo(() => {
    const skus = new Set(filasFiltered.map((r) => r.item_id)).size;
    const alertas = filasFiltered.filter((r) => r.bajo_minimo).length;
    const lotesCount = filasFiltered.reduce((s, r) => s + r.lotes_count, 0);
    const porTipo: Record<string, number> = {};
    for (const r of filasFiltered) {
      porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1;
    }
    return {
      skus,
      alertas,
      lotes: lotesCount,
      almacenes: resumenAlmacenes.length,
      porTipo,
    };
  }, [filasFiltered, resumenAlmacenes.length]);

  const alertasRows = useMemo(
    () => filasFiltered.filter((r) => r.bajo_minimo).slice(0, 10),
    [filasFiltered],
  );

  const clearFilters = () => {
    setUbicacionId('');
    setTipoFilter('');
    setCategoriaFilter('');
    setSearch('');
    setSoloAlertas(false);
  };

  const hasActiveFilters = !!(ubicacionId || tipoFilter || categoriaFilter || search || soloAlertas);

  return {
    inventario,
    loading,
    error,
    setError,
    reload,
    ubicacionId,
    setUbicacionId,
    tipoFilter,
    setTipoFilter,
    categoriaFilter,
    setCategoriaFilter,
    search,
    setSearch,
    soloAlertas,
    setSoloAlertas,
    categorias,
    filasFiltered,
    resumenAlmacenes,
    globalStats,
    alertasRows,
    clearFilters,
    hasActiveFilters,
  };
}
