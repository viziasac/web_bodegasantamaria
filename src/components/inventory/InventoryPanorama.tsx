import React from 'react';
import { Link } from 'react-router-dom';
import { InventoryKpiRow } from './InventoryKpiRow';
import { InventoryTipoChips } from './InventoryTipoChips';
import { InventoryAlmacenGrid } from './InventoryAlmacenGrid';
import { InventoryFilters } from './InventoryFilters';
import { Alert, DataTable, StatusBadge, fmtNum } from '../ui';
import type { CatUbicacion, InventarioFila } from '../../types';

import type { useInventarioData } from './useInventarioData';

type InvData = ReturnType<typeof useInventarioData>;

interface Props {
  data: InvData;
  ubicaciones: CatUbicacion[];
  showFullFilters?: boolean;
  showLinkToInventory?: boolean;
  hideFilters?: boolean;
  onSelectAlmacen?: (id: string) => void;
}

export const InventoryPanorama: React.FC<Props> = ({
  data,
  ubicaciones,
  showFullFilters = true,
  showLinkToInventory = false,
  hideFilters = false,
  onSelectAlmacen,
}) => {
  const {
    globalStats,
    filasFiltered,
    resumenAlmacenes,
    tipoFilter,
    setTipoFilter,
    alertasRows,
    ubicacionId,
    setUbicacionId,
    categoriaFilter,
    setCategoriaFilter,
    categorias,
    search,
    setSearch,
    soloAlertas,
    setSoloAlertas,
    hasActiveFilters,
    clearFilters,
  } = data;

  return (
    <>
      <InventoryKpiRow
        almacenes={globalStats.almacenes}
        skus={globalStats.skus}
        lotes={globalStats.lotes}
        alertas={globalStats.alertas}
        lineas={showFullFilters ? filasFiltered.length : undefined}
      />

      {globalStats.alertas > 0 && (
        <Alert type="error" message={`${globalStats.alertas} ítem(s) bajo stock mínimo en la vista actual`} />
      )}

      {!hideFilters && (
        <InventoryFilters
          ubicaciones={ubicaciones}
          ubicacionId={ubicacionId}
          onUbicacionChange={setUbicacionId}
          tipoFilter={tipoFilter}
          onTipoChange={setTipoFilter}
          categoriaFilter={categoriaFilter}
          onCategoriaChange={setCategoriaFilter}
          categorias={categorias}
          search={search}
          onSearchChange={setSearch}
          soloAlertas={soloAlertas}
          onSoloAlertasChange={setSoloAlertas}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          compact={!showFullFilters}
        />
      )}

      <InventoryTipoChips
        porTipo={globalStats.porTipo}
        tipoFilter={tipoFilter}
        onToggleTipo={setTipoFilter}
      />

      <InventoryAlmacenGrid
        almacenes={resumenAlmacenes}
        selectedId={ubicacionId}
        onSelectAlmacen={onSelectAlmacen}
      />

      {alertasRows.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-header">
            <h3>Alertas de stock bajo</h3>
            <span className="kpi-sub">Top {alertasRows.length}</span>
          </div>
          <DataTable>
            <thead>
              <tr>
                <th>Almacén</th>
                <th>Código</th>
                <th>Ítem</th>
                <th>Stock</th>
                <th>Mín.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alertasRows.map((r: InventarioFila) => (
                <tr key={`${r.almacen_id}-${r.item_id}`} className="row-danger">
                  <td>{r.almacen_codigo}</td>
                  <td><code className="code-tag">{r.codigo}</code></td>
                  <td>{r.nombre}</td>
                  <td className="cell-num">{fmtNum(r.stock_total, 2)} {r.unidad_medida}</td>
                  <td className="cell-num">{fmtNum(r.stock_minimo)}</td>
                  <td><StatusBadge ok={false} failLabel="Bajo mín." /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}

      {showLinkToInventory && (
        <div className="form-actions" style={{ marginTop: '1rem', borderTop: 'none', paddingTop: 0 }}>
          <Link to="/inventory" className="btn btn-primary">
            <span className="material-icons-round">inventory_2</span>
            Ir a inventario (ajustes)
          </Link>
        </div>
      )}
    </>
  );
};
