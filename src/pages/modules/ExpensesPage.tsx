import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getGastos } from '../../services/apiProvider';
import { bodegaService } from '../../services/bodegaService';
import {
  PageHeader, PageLoader, Alert, FormSelect, FormInput, FormSection, FormRow,
  DataTable, EmptyState, fmtMoney, fmtDate, toUserMessage,
} from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';
import { hoyYmd } from '../../utils/fechaLocal';
import {
  clearEgresosCartDraft, loadEgresosCartDraft, saveEgresosCartDraft,
} from '../../utils/egresosDraft';
import type { EgresoLineaDraft, GasGasto } from '../../types';

const TIPOS_DOC = [
  { value: '', label: '— Sin tipo —' },
  { value: 'BOLETA', label: 'Boleta' },
  { value: 'FACTURA', label: 'Factura' },
  { value: 'TICKET', label: 'Ticket' },
];

const ExpensesPage: React.FC = () => {
  const { categoriasGasto, proveedores, ensureCatalogLoaded } = useCatalog();
  const [gastos, setGastos] = useState<GasGasto[]>([]);
  const [loading, setLoading] = useState(true);

  const draft0 = loadEgresosCartDraft();
  const [fecha, setFecha] = useState(draft0?.fecha ?? hoyYmd());
  const [moneda, setMoneda] = useState(draft0?.moneda ?? 'PEN');
  const [centroCosto, setCentroCosto] = useState(draft0?.centroCosto ?? 'BODEGA');

  const [categoriaId, setCategoriaId] = useState('');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [proveedorCatalogId, setProveedorCatalogId] = useState('');
  const [proveedorNombre, setProveedorNombre] = useState('');
  const [tipoDoc, setTipoDoc] = useState('');
  const [nroDoc, setNroDoc] = useState('');

  const [cart, setCart] = useState<EgresoLineaDraft[]>(draft0?.cart ?? []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set((draft0?.cart ?? []).map((l) => l.id)),
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    saveEgresosCartDraft({ fecha, moneda, centroCosto, cart });
  }, [fecha, moneda, centroCosto, cart]);

  const onProveedorCatalog = (id: string) => {
    setProveedorCatalogId(id);
    const p = proveedores.find((x) => x.id === id);
    if (p) setProveedorNombre(p.nombre);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setGastos(await getGastos());
    } catch (err) {
      setError(toUserMessage(err, 'Error cargando egresos'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addLine = () => {
    const amt = parseFloat(monto);
    if (!categoriaId || !descripcion.trim()) {
      setError('Complete categoría y descripción.');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Monto inválido.');
      return;
    }
    const cat = categoriasGasto.find((c) => c.id === categoriaId);
    setError(null);
    const line: EgresoLineaDraft = {
      id: `L-${Date.now()}`,
      descripcion: descripcion.trim(),
      monto: amt,
      categoriaId,
      categoriaNombre: cat?.nombre,
      proveedorNombre: proveedorNombre.trim() || undefined,
      tipoDocumento: tipoDoc || undefined,
      nroDocumento: nroDoc.trim() || undefined,
    };
    setCart([...cart, line]);
    setSelectedIds((prev) => new Set([...prev, line.id]));
    setMonto('');
    setDescripcion('');
    setNroDoc('');
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => setSelectedIds(new Set(cart.map((l) => l.id)));
  const selectNone = () => setSelectedIds(new Set());

  const submitBatch = async () => {
    const toSubmit = cart.filter((l) => selectedIds.has(l.id));
    if (toSubmit.length === 0) {
      setError('Seleccione al menos una línea del carrito.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await ensureCatalogLoaded();
      await bodegaService.ingresarEgresosBatch(toSubmit, { fecha, moneda, centroCosto });
      setSuccess(`${toSubmit.length} egreso(s) registrados.`);
      const remaining = cart.filter((l) => !selectedIds.has(l.id));
      setCart(remaining);
      setSelectedIds(new Set(remaining.map((l) => l.id)));
      if (remaining.length === 0) clearEgresosCartDraft();
      await load();
    } catch (err) {
      const registered = (err as Error & { registeredIds?: string[] }).registeredIds ?? [];
      if (registered.length > 0) {
        const done = new Set(registered);
        setCart((prev) => prev.filter((l) => !done.has(l.id)));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          registered.forEach((id) => next.delete(id));
          return next;
        });
        await load();
      }
      setError(toUserMessage(err, 'Error al registrar egresos'));
    } finally {
      setSubmitting(false);
    }
  };

  const cartTotal = cart.filter((l) => selectedIds.has(l.id)).reduce((s, l) => s + l.monto, 0);

  return (
    <div className="animate-in">
      <PageHeader
        title="Egresos"
        subtitle="Gastos operativos — carrito del día (borrador local)"
        moduleId="gastos"
        action={
          <Link to="/sales/modificaciones?tab=egresos" className="btn btn-ghost">
            <span className="material-icons-round">edit_note</span>
            Corregir egresos
          </Link>
        }
      />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <FormSection title="Cabecera">
        <FormRow>
          <FormInput label="Fecha" type="date" value={fecha} onChange={setFecha} required />
          <FormSelect label="Moneda" value={moneda} onChange={setMoneda}
            options={[{ value: 'PEN', label: 'PEN' }]} />
          <FormSelect label="Centro de costo" value={centroCosto} onChange={setCentroCosto}
            options={[
              { value: 'BODEGA', label: 'Bodega' },
              { value: 'PRODUCCION', label: 'Producción' },
              { value: 'VENTAS', label: 'Ventas' },
            ]} />
        </FormRow>
      </FormSection>

      <FormSection title="Nueva línea de gasto">
        <FormSelect label="Categoría" value={categoriaId} onChange={setCategoriaId} required
          options={categoriasGasto.map((c) => ({ value: c.id, label: c.nombre }))} />
        <FormInput label="Descripción" value={descripcion} onChange={setDescripcion} required />
        <FormInput label="Monto (S/)" type="number" value={monto} onChange={setMonto} min={0.01} step="0.01" />
        <FormSelect label="Proveedor (catálogo)" value={proveedorCatalogId} onChange={onProveedorCatalog}
          options={[{ value: '', label: '— Manual —' }, ...proveedores.map((p) => ({ value: p.id, label: p.nombre }))]} />
        <FormInput label="Proveedor (nombre)" value={proveedorNombre} onChange={setProveedorNombre} />
        <FormRow>
          <FormSelect label="Tipo comprobante" value={tipoDoc} onChange={setTipoDoc} options={TIPOS_DOC} />
          <FormInput label="N° comprobante" value={nroDoc} onChange={setNroDoc} />
        </FormRow>
        <div className="form-actions form-actions--flat">
          <button type="button" className="btn btn-ghost" onClick={addLine}>
            <span className="material-icons-round">add</span>
            Agregar al carrito
          </button>
        </div>
      </FormSection>

      <FormSection title="Carrito del día">
        {cart.length === 0 ? (
          <EmptyState icon="shopping_cart" title="Carrito vacío" />
        ) : (
          <>
            <div className="form-actions form-actions--flat" style={{ marginBottom: '0.75rem' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={selectAll}>Seleccionar todo</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={selectNone}>Ninguno</button>
            </div>
            <DataTable>
              <thead>
                <tr><th /><th>Descripción</th><th>Categoría</th><th>Doc</th><th>Monto</th></tr>
              </thead>
              <tbody>
                {cart.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <input type="checkbox" checked={selectedIds.has(l.id)}
                        onChange={() => toggleSelect(l.id)} aria-label="Seleccionar" />
                    </td>
                    <td>{l.descripcion}</td>
                    <td>{l.categoriaNombre ?? '—'}</td>
                    <td>{l.tipoDocumento ? `${l.tipoDocumento} ${l.nroDocumento ?? ''}` : '—'}</td>
                    <td className="cell-money">{fmtMoney(l.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            <p className="cart-total">Seleccionado: {fmtMoney(cartTotal)}</p>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" disabled={submitting} onClick={submitBatch}>
                <span className="material-icons-round">{submitting ? 'hourglass_empty' : 'save'}</span>
                {submitting ? 'Procesando…' : 'Registrar seleccionados'}
              </button>
            </div>
          </>
        )}
      </FormSection>

      {loading ? <PageLoader /> : (
        <FormSection title="Últimos egresos">
          {gastos.length === 0 ? (
            <EmptyState icon="money_off" title="Sin egresos registrados" />
          ) : (
            <DataTable>
              <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Origen</th><th>Monto</th></tr></thead>
              <tbody>
                {gastos.map((g) => (
                  <tr key={g.id}>
                    <td>{g.fecha ? fmtDate(g.fecha.split('T')[0]) : '—'}</td>
                    <td>{g.gas_categoria?.nombre}</td>
                    <td>{g.descripcion}</td>
                    <td>{g.origen_tipo === 'COMPRA' ? 'Compra (solo lectura)' : 'Manual'}</td>
                    <td className="cell-money">{fmtMoney(g.monto || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </FormSection>
      )}
    </div>
  );
};

export default ExpensesPage;
