import React, { useState } from 'react';
import { getHistorialMovimientos, getTrazabilidadLote } from '../../services/apiProvider';
import {
  PageHeader, Alert, FormInput, SubmitButton, PageLoader, TabBar, FormRow, FormSelect,
  EmptyState, DataTable, toUserMessage, fmtDate,
} from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';

type AuditTab = 'historial' | 'lote';

const COLUMN_LABELS: Record<string, string> = {
  fecha: 'Fecha',
  tipo_mov: 'Tipo',
  cantidad: 'Cantidad',
  ubicacion: 'Ubicación',
  ubicacion_nombre: 'Ubicación',
  item_nombre: 'Ítem',
  item_codigo: 'Código',
  nro_lote: 'Lote',
  motivo: 'Motivo',
  observacion: 'Observación',
  usuario: 'Usuario',
};

const DISPLAY_COLUMNS = ['fecha', 'tipo_mov', 'item_nombre', 'cantidad', 'ubicacion_nombre', 'nro_lote'];

function pickColumns(row: Record<string, unknown>): string[] {
  const keys = Object.keys(row);
  const preferred = DISPLAY_COLUMNS.filter((k) => k in row);
  if (preferred.length >= 3) return preferred;
  return keys.slice(0, 6);
}

function labelCol(key: string): string {
  return COLUMN_LABELS[key] ?? key.replace(/_/g, ' ');
}

function formatCell(key: string, val: unknown): string {
  if (val == null || val === '') return '—';
  if (key === 'fecha' && typeof val === 'string') return fmtDate(val.split('T')[0]);
  return String(val);
}

const AuditPage: React.FC = () => {
  const { ubicaciones, items } = useCatalog();
  const [tab, setTab] = useState<AuditTab>('historial');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [itemId, setItemId] = useState('');
  const [ubicacionId, setUbicacionId] = useState('');
  const [direccion, setDireccion] = useState('');
  const [nroLote, setNroLote] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchTab = (t: AuditTab) => {
    setTab(t);
    setRows([]);
    setColumns([]);
    setSearched(false);
    setError(null);
  };

  const buscarHistorial = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const data = await getHistorialMovimientos({
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        itemId: itemId || undefined,
        ubicacionId: ubicacionId || undefined,
        direccion: direccion || undefined,
      });
      setRows(data);
      setColumns(data.length > 0 ? pickColumns(data[0]) : []);
    } catch (err) {
      setError(toUserMessage(err, 'Error al buscar historial'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const buscarLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nroLote.trim()) {
      setError('Ingrese el número de lote.');
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const data = await getTrazabilidadLote(nroLote.trim());
      setRows(data);
      setColumns(data.length > 0 ? pickColumns(data[0]) : []);
    } catch (err) {
      setError(toUserMessage(err, 'Error al trazar lote'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in">
      <PageHeader title="Auditoría" subtitle="Historial de movimientos y trazabilidad de lotes" moduleId="auditoria" />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <TabBar
        active={tab}
        onChange={(id) => switchTab(id as AuditTab)}
        tabs={[
          { id: 'historial', label: 'Historial', icon: 'history' },
          { id: 'lote', label: 'Trazabilidad lote', icon: 'track_changes' },
        ]}
      />

      <div className="card card-section">
        {tab === 'historial' ? (
          <form onSubmit={buscarHistorial}>
            <FormRow actions>
              <FormInput label="Desde" type="date" value={fechaDesde} onChange={setFechaDesde} />
              <FormInput label="Hasta" type="date" value={fechaHasta} onChange={setFechaHasta} />
            </FormRow>
            <FormRow actions>
              <FormSelect label="Ubicación" value={ubicacionId} onChange={setUbicacionId}
                options={[{ value: '', label: 'Todas' }, ...ubicaciones.map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` }))]} />
              <FormSelect label="Ítem" value={itemId} onChange={setItemId}
                options={[{ value: '', label: 'Todos' }, ...items.slice(0, 200).map((i) => ({ value: i.id, label: `${i.codigo} — ${i.nombre}` }))]} />
              <FormSelect label="Dirección" value={direccion} onChange={setDireccion}
                options={[
                  { value: '', label: 'Todas' },
                  { value: 'ENTRADA', label: 'Entradas' },
                  { value: 'SALIDA', label: 'Salidas' },
                ]} />
              <SubmitButton loading={loading} label="Buscar" icon="search" />
            </FormRow>
          </form>
        ) : (
          <form onSubmit={buscarLote}>
            <FormRow actions>
              <FormInput label="N° de lote" value={nroLote} onChange={setNroLote} required placeholder="Ej: L-2026-001" />
              <SubmitButton loading={loading} label="Trazar" icon="track_changes" />
            </FormRow>
          </form>
        )}
      </div>

      {loading ? <PageLoader /> : searched && rows.length === 0 ? (
        <EmptyState icon="search_off" title="Sin resultados" hint="Pruebe ampliar el rango de fechas o verifique el n° de lote" />
      ) : rows.length > 0 ? (
        <div className="card">
          <DataTable>
            <thead>
              <tr>{columns.map((k) => <th key={k}>{labelCol(k)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {columns.map((k) => (
                    <td key={k}>{formatCell(k, r[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      ) : null}
    </div>
  );
};

export default AuditPage;
