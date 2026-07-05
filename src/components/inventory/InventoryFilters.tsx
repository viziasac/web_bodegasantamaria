import React from 'react';
import { FilterBar, FormSelect, SearchInput } from '../ui';
import { TIPO_LABELS } from './constants';
import type { CatUbicacion } from '../../types';

interface Props {
  ubicaciones: CatUbicacion[];
  ubicacionId: string;
  onUbicacionChange: (id: string) => void;
  tipoFilter: string;
  onTipoChange: (tipo: string) => void;
  categoriaFilter: string;
  onCategoriaChange: (cat: string) => void;
  categorias: string[];
  search: string;
  onSearchChange: (v: string) => void;
  soloAlertas: boolean;
  onSoloAlertasChange: (v: boolean) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  compact?: boolean;
}

export const InventoryFilters: React.FC<Props> = ({
  ubicaciones,
  ubicacionId,
  onUbicacionChange,
  tipoFilter,
  onTipoChange,
  categoriaFilter,
  onCategoriaChange,
  categorias,
  search,
  onSearchChange,
  soloAlertas,
  onSoloAlertasChange,
  hasActiveFilters,
  onClearFilters,
  compact = false,
}) => (
  <FilterBar>
    <div className="filter-grid">
      {!compact && (
        <FormSelect
          label="Almacén"
          value={ubicacionId}
          onChange={onUbicacionChange}
          options={[
            { value: '', label: 'Todos los almacenes' },
            ...ubicaciones.map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` })),
          ]}
        />
      )}
      <FormSelect
        label="Tipo de material"
        value={tipoFilter}
        onChange={onTipoChange}
        options={[
          { value: '', label: 'Todos los tipos' },
          ...Object.entries(TIPO_LABELS).map(([v, l]) => ({ value: v, label: l })),
        ]}
      />
      {!compact && (
        <FormSelect
          label="Categoría"
          value={categoriaFilter}
          onChange={onCategoriaChange}
          options={[
            { value: '', label: 'Todas' },
            ...categorias.map((c) => ({ value: c, label: c })),
          ]}
        />
      )}
      <label className="form-group">
        <span className="form-label">Buscar SKU / nombre</span>
        <SearchInput value={search} onChange={onSearchChange} placeholder="Código, nombre, almacén…" />
      </label>
    </div>
    <div className="inv-filter-extras">
      <label className="inv-check">
        <input type="checkbox" checked={soloAlertas} onChange={(e) => onSoloAlertasChange(e.target.checked)} />
        Solo bajo mínimo
      </label>
      {hasActiveFilters && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClearFilters}>
          Limpiar filtros
        </button>
      )}
    </div>
  </FilterBar>
);
