import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStockSaldo } from '../../services/apiProvider';
import { InventoryPanorama } from '../inventory/InventoryPanorama';
import { InventoryFilters } from '../inventory/InventoryFilters';
import { TIPO_LABELS, TIPO_COLORS } from '../inventory/constants';
import type { useInventarioData } from '../inventory/useInventarioData';
import {
  TabBar, PageLoader, Alert, EmptyState, StatusBadge, DataTable, fmtNum, fmtDate, toUserMessage,
} from '../ui';
import type { CatUbicacion, InvStockSaldo, InventarioFila } from '../../types';

type InvData = ReturnType<typeof useInventarioData>;
type InvTab = 'panorama' | 'detalle' | 'matriz' | 'lotes';

interface Props {
  inv: InvData;
  ubicaciones: CatUbicacion[];
}

const DashInventarioTab: React.FC<Props> = ({ inv, ubicaciones }) => {
  const [tab, setTab] = useState<InvTab>('panorama');
  const [lotes, setLotes] = useState<InvStockSaldo[]>([]);
  const [lotesLoading, setLotesLoading] = useState(false);
  const [groupBy, setGroupBy] = useState<'almacen' | 'tipo'>('almacen');

  const {
    loading, error, setError, reload,
    ubicacionId, setUbicacionId,
    tipoFilter, categoriaFilter, search,
    filasFiltered, resumenAlmacenes,
  } = inv;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLotesLoading(true);
      try {
        const data = await getStockSaldo(ubicacionId || undefined);
        if (!cancelled) setLotes(data);
      } catch (err) {
        if (!cancelled) setError(toUserMessage(err, 'Error cargando lotes'));
      } finally {
        if (!cancelled) setLotesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ubicacionId, setError]);

  const filterText = (text: string) =>
    !search || text.toLowerCase().includes(search.toLowerCase());

  const lotesFiltered = useMemo(
    () =>
      lotes.filter((s) => {
        if (tipoFilter && s.ma_item?.tipo !== tipoFilter) return false;
        if (categoriaFilter && (s.ma_item?.categoria || 'Sin categoría') !== categoriaFilter) return false;
        const name = `${s.ma_item?.nombre} ${s.ma_item?.codigo} ${s.inv_lote?.nro_lote} ${s.cat_ubicacion?.nombre}`;
        return filterText(name);
      }),
    [lotes, tipoFilter, categoriaFilter, search],
  );

  const matrizData = useMemo(() => {
    const itemMap = new Map<string, { codigo: string; nombre: string; tipo: string; total: number; cells: Record<string, number> }>();
    for (const r of filasFiltered) {
      let row = itemMap.get(r.item_id);
      if (!row) {
        row = { codigo: r.codigo, nombre: r.nombre, tipo: r.tipo, total: 0, cells: {} };
        itemMap.set(r.item_id, row);
      }
      row.cells[r.almacen_id] = (row.cells[r.almacen_id] || 0) + r.stock_total;
      row.total += r.stock_total;
    }
    return { almacenes: resumenAlmacenes, rows: Array.from(itemMap.values()).sort((a, b) => b.total - a.total) };
  }, [filasFiltered, resumenAlmacenes]);

  const groupedDetalle = useMemo(() => {
    const groups = new Map<string, InventarioFila[]>();
    for (const r of filasFiltered) {
      const key = groupBy === 'almacen' ? r.almacen_id : r.tipo;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return Array.from(groups.entries())
      .map(([key, rows]) => ({
        key,
        label: groupBy === 'almacen'
          ? rows[0]?.almacen_nombre ?? key
          : (TIPO_LABELS[rows[0]?.tipo ?? ''] ?? rows[0]?.tipo ?? key),
        rows,
        skuCount: rows.length,
        totalQty: rows.reduce((s, r) => s + r.stock_total, 0),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filasFiltered, groupBy]);

  const selectAlmacen = (id: string) => {
    setUbicacionId(id === ubicacionId ? '' : id);
    if (id) setTab('detalle');
  };

  const handleRefresh = async () => {
    await reload();
    try {
      setLotes(await getStockSaldo(ubicacionId || undefined));
    } catch { /* reload already surfaces errors */ }
  };

  return (
    <>
      <div className="dash-inv-toolbar">
        <p className="dash-inv-hint">
          Vista analítica de stock. Para conteos y ajustes use el módulo{' '}
          <Link to="/inventory">Inventario</Link>.
        </p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleRefresh}>
          <span className="material-icons-round">refresh</span> Actualizar
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {!loading && (
        <InventoryFilters
          ubicaciones={ubicaciones}
          ubicacionId={inv.ubicacionId}
          onUbicacionChange={inv.setUbicacionId}
          tipoFilter={inv.tipoFilter}
          onTipoChange={inv.setTipoFilter}
          categoriaFilter={inv.categoriaFilter}
          onCategoriaChange={inv.setCategoriaFilter}
          categorias={inv.categorias}
          search={inv.search}
          onSearchChange={inv.setSearch}
          soloAlertas={inv.soloAlertas}
          onSoloAlertasChange={inv.setSoloAlertas}
          hasActiveFilters={inv.hasActiveFilters}
          onClearFilters={inv.clearFilters}
        />
      )}

      <TabBar
        active={tab}
        onChange={(id) => setTab(id as InvTab)}
        tabs={[
          { id: 'panorama', label: 'Panorama', icon: 'dashboard' },
          { id: 'detalle', label: 'Detalle SKUs', icon: 'view_list' },
          { id: 'matriz', label: 'Matriz', icon: 'grid_on' },
          { id: 'lotes', label: 'Por lote', icon: 'layers' },
        ]}
      />

      {loading ? <PageLoader /> : (
        <>
          {tab === 'panorama' && (
            <InventoryPanorama
              data={inv}
              ubicaciones={ubicaciones}
              onSelectAlmacen={selectAlmacen}
              hideFilters
            />
          )}

          {tab === 'detalle' && (
            <div className="card">
              <div className="card-header">
                <h3>Detalle por SKU</h3>
                <div className="inv-group-toggle">
                  <span>Agrupar:</span>
                  <button type="button" className={`btn btn-sm ${groupBy === 'almacen' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setGroupBy('almacen')}>Almacén</button>
                  <button type="button" className={`btn btn-sm ${groupBy === 'tipo' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setGroupBy('tipo')}>Tipo</button>
                </div>
              </div>
              {filasFiltered.length === 0 ? (
                <EmptyState icon="search_off" title="Sin resultados" hint="Ajuste filtros arriba" />
              ) : (
                groupedDetalle.map((g) => (
                  <details key={g.key} className="inv-group" open={groupedDetalle.length <= 4}>
                    <summary className="inv-group-summary">
                      <span className="inv-group-title">{g.label}</span>
                      <span className="inv-group-meta">{g.skuCount} SKUs · {fmtNum(g.totalQty, 2)} u total</span>
                    </summary>
                    <DataTable className="data-table-compact">
                      <thead>
                        <tr>
                          {groupBy === 'tipo' && <th>Almacén</th>}
                          <th>Código</th>
                          <th>Ítem</th>
                          <th>Tipo</th>
                          <th>Categoría</th>
                          <th>Lotes</th>
                          <th>Stock</th>
                          <th>Mín.</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((r) => (
                          <tr key={`${r.almacen_id}-${r.item_id}`} className={r.bajo_minimo ? 'row-danger' : ''}>
                            {groupBy === 'tipo' && <td>{r.almacen_codigo}</td>}
                            <td><code className="code-tag">{r.codigo}</code></td>
                            <td>{r.nombre}</td>
                            <td><span className={`status-tag status-neutral ${TIPO_COLORS[r.tipo] ?? ''}`}>{r.tipo}</span></td>
                            <td className="cell-muted">{r.categoria}</td>
                            <td className="cell-num">{r.lotes_count}</td>
                            <td className="cell-num">{fmtNum(r.stock_total, 2)} {r.unidad_medida}</td>
                            <td className="cell-num">{r.stock_minimo > 0 ? fmtNum(r.stock_minimo) : '—'}</td>
                            <td><StatusBadge ok={!r.bajo_minimo} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  </details>
                ))
              )}
            </div>
          )}

          {tab === 'matriz' && (
            <div className="card">
              <div className="card-header">
                <h3>Matriz ítem × almacén</h3>
                <span className="kpi-sub">{matrizData.rows.length} ítems · {matrizData.almacenes.length} almacenes</span>
              </div>
              {matrizData.rows.length === 0 ? (
                <EmptyState icon="grid_off" title="Sin datos para la matriz" />
              ) : (
                <div className="table-scroll inv-matrix-wrap">
                  <table className="data-table data-table-compact inv-matrix">
                    <thead>
                      <tr>
                        <th className="inv-matrix-sticky">Código</th>
                        <th className="inv-matrix-sticky inv-matrix-name">Ítem</th>
                        <th>Tipo</th>
                        {matrizData.almacenes.map((a) => (
                          <th key={a.almacen_id} title={a.almacen_nombre}>
                            <code className="code-tag">{a.almacen_codigo}</code>
                          </th>
                        ))}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrizData.rows.map((row) => (
                        <tr key={row.codigo + row.nombre}>
                          <td className="inv-matrix-sticky"><code className="code-tag">{row.codigo}</code></td>
                          <td className="inv-matrix-sticky inv-matrix-name">{row.nombre}</td>
                          <td><span className="status-tag status-neutral">{row.tipo}</span></td>
                          {matrizData.almacenes.map((a) => {
                            const v = row.cells[a.almacen_id];
                            return (
                              <td key={a.almacen_id} className={`cell-num ${v ? 'has-stock' : 'no-stock'}`}>
                                {v ? fmtNum(v, v % 1 === 0 ? 0 : 2) : '—'}
                              </td>
                            );
                          })}
                          <td className="cell-num inv-matrix-total">{fmtNum(row.total, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'lotes' && (
            <div className="card">
              <div className="card-header">
                <h3>Detalle por lote</h3>
                <span className="kpi-sub">{lotesFiltered.length} registros</span>
              </div>
              {lotesLoading ? <PageLoader /> : lotesFiltered.length === 0 ? (
                <EmptyState icon="inventory_2" title="Sin lotes en esta vista" />
              ) : (
                <DataTable>
                  <thead>
                    <tr><th>Almacén</th><th>Código</th><th>Ítem</th><th>Tipo</th><th>Lote</th><th>Vence</th><th>Cantidad</th></tr>
                  </thead>
                  <tbody>
                    {lotesFiltered.map((s) => (
                      <tr key={s.id}>
                        <td>{s.cat_ubicacion?.nombre}</td>
                        <td><code className="code-tag">{s.ma_item?.codigo}</code></td>
                        <td>{s.ma_item?.nombre}</td>
                        <td><span className="status-tag status-neutral">{s.ma_item?.tipo}</span></td>
                        <td>{s.inv_lote?.nro_lote || '—'}</td>
                        <td>{s.inv_lote?.fecha_vencimiento ? fmtDate(String(s.inv_lote.fecha_vencimiento)) : '—'}</td>
                        <td className="cell-num">{fmtNum(s.cantidad, 2)} {s.ma_item?.unidad_medida}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
};

export default DashInventarioTab;
