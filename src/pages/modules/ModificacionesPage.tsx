import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getVentasPeriodo, getVentaDetalle, getGastosPeriodo,
  actualizarVenta, anularVenta, actualizarGasto, eliminarGasto,
} from '../../services/apiProvider';
import {
  PageHeader, PageLoader, Alert, DataTable, EmptyState, FormSelect, FormInput,
  SubmitButton, TabBar, FormSection, FormRow,
  toUserMessage, fmtMoney, fmtDate, fmtNum,
} from '../../components/ui';
import Modal from '../../components/Modal';
import { useCatalog } from '../../context/CatalogContext';
import { hoyYmd, inicioMesYmd } from '../../utils/fechaLocal';
import type { GasGasto, VentaDetalleLinea, VentaResumen } from '../../types';

type ModTab = 'ingresos' | 'egresos';

const TIPOS_DOC = [
  { value: '', label: '— Sin tipo —' },
  { value: 'BOLETA', label: 'Boleta' },
  { value: 'FACTURA', label: 'Factura' },
  { value: 'TICKET', label: 'Ticket' },
];

const ModificacionesPage: React.FC = () => {
  const { categoriasGasto, clientes, canalesVenta, ensureCatalogLoaded } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: ModTab = searchParams.get('tab') === 'egresos' ? 'egresos' : 'ingresos';
  const setTab = (id: ModTab) => {
    setSearchParams(id === 'egresos' ? { tab: 'egresos' } : {}, { replace: true });
  };
  const [desde, setDesde] = useState(inicioMesYmd());
  const [hasta, setHasta] = useState(hoyYmd());
  const [incluirAnuladas, setIncluirAnuladas] = useState(false);
  const [buscaNro, setBuscaNro] = useState('');

  const [ventas, setVentas] = useState<VentaResumen[]>([]);
  const [gastos, setGastos] = useState<GasGasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [ventaEdit, setVentaEdit] = useState<VentaResumen | null>(null);
  const [detalle, setDetalle] = useState<VentaDetalleLinea[]>([]);
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [obs, setObs] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [canal, setCanal] = useState('');
  const [anulMotivo, setAnulMotivo] = useState('');
  const [anulModal, setAnulModal] = useState(false);

  const [gastoEdit, setGastoEdit] = useState<GasGasto | null>(null);
  const [gFecha, setGFecha] = useState('');
  const [gMonto, setGMonto] = useState('');
  const [gDesc, setGDesc] = useState('');
  const [gCat, setGCat] = useState('');
  const [gProv, setGProv] = useState('');
  const [gTipoDoc, setGTipoDoc] = useState('');
  const [gNroDoc, setGNroDoc] = useState('');
  const [gCentro, setGCentro] = useState('BODEGA');

  const [saving, setSaving] = useState(false);
  const [expandedVenta, setExpandedVenta] = useState<string | null>(null);
  const [detalleCache, setDetalleCache] = useState<Record<string, VentaDetalleLinea[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureCatalogLoaded();
      if (tab === 'ingresos') {
        setVentas(await getVentasPeriodo(desde, hasta, { includeAnuladas: incluirAnuladas }));
      } else {
        setGastos(await getGastosPeriodo(desde, hasta));
      }
    } catch (err) {
      setError(toUserMessage(err, 'Error cargando registros'));
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, tab, incluirAnuladas, ensureCatalogLoaded]);

  useEffect(() => { load(); }, [load]);

  const openVentaEdit = async (v: VentaResumen) => {
    if (v.estado === 'ANULADA') {
      setError('No se puede editar una venta anulada.');
      return;
    }
    setError(null);
    setVentaEdit(v);
    setObs(v.observaciones ?? '');
    setClienteId(v.cliente_id ?? '');
    setCanal(v.canal ?? '');
    try {
      const lines = await getVentaDetalle(v.id);
      setDetalle(lines);
      const map: Record<string, string> = {};
      for (const l of lines) map[l.id] = String(l.precio_unitario);
      setPrecios(map);
    } catch (err) {
      setError(toUserMessage(err, 'No se pudieron cargar las líneas'));
      setVentaEdit(null);
    }
  };

  const toggleExpand = async (ventaId: string) => {
    if (expandedVenta === ventaId) {
      setExpandedVenta(null);
      return;
    }
    setExpandedVenta(ventaId);
    if (!detalleCache[ventaId]) {
      try {
        const lines = await getVentaDetalle(ventaId);
        setDetalleCache((prev) => ({ ...prev, [ventaId]: lines }));
      } catch (err) {
        setError(toUserMessage(err, 'No se pudieron cargar las líneas'));
      }
    }
  };

  const saveVenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ventaEdit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const lineas = detalle.map((d) => {
        const p = parseFloat(precios[d.id] ?? String(d.precio_unitario));
        if (!Number.isFinite(p) || p < 0) throw new Error('Precio inválido en una línea.');
        return { id: d.id, precio_unitario: p };
      });
      await actualizarVenta({
        ventaId: ventaEdit.id,
        observaciones: obs,
        clienteId: clienteId || null,
        canal: canal || undefined,
        lineas,
      });
      setSuccess(`Venta ${ventaEdit.nro_venta ?? ''} actualizada.`);
      setVentaEdit(null);
      setDetalleCache({});
      await load();
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo actualizar la venta'));
    } finally {
      setSaving(false);
    }
  };

  const confirmAnular = async () => {
    if (!ventaEdit) return;
    setSaving(true);
    setError(null);
    try {
      await anularVenta(ventaEdit.id, anulMotivo || undefined);
      setSuccess(`Venta ${ventaEdit.nro_venta ?? ''} anulada. Stock restituido.`);
      setAnulModal(false);
      setVentaEdit(null);
      setAnulMotivo('');
      setDetalleCache({});
      await load();
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo anular la venta'));
    } finally {
      setSaving(false);
    }
  };

  const openGastoEdit = (g: GasGasto) => {
    if (g.origen_tipo === 'COMPRA') {
      setError('Este egreso viene de una compra. No se edita aquí.');
      return;
    }
    setGastoEdit(g);
    setGFecha(g.fecha?.slice(0, 10) ?? hoyYmd());
    setGMonto(String(g.monto));
    setGDesc(g.descripcion ?? '');
    setGCat(g.categoria_id ?? '');
    setGProv(g.proveedor_nombre ?? '');
    setGTipoDoc(g.tipo_comprobante ?? '');
    setGNroDoc(g.nro_comprobante ?? '');
    setGCentro(g.centro_costo ?? 'BODEGA');
  };

  const saveGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gastoEdit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const monto = parseFloat(gMonto);
      if (!Number.isFinite(monto) || monto <= 0) throw new Error('Monto inválido.');
      await actualizarGasto(gastoEdit.id, {
        fecha: gFecha,
        monto,
        descripcion: gDesc,
        categoria_id: gCat || null,
        proveedor_nombre: gProv,
        tipo_comprobante: gTipoDoc,
        nro_comprobante: gNroDoc,
        centro_costo: gCentro,
        con_comprobante: !!(gTipoDoc || gNroDoc),
      });
      setSuccess('Egreso actualizado.');
      setGastoEdit(null);
      await load();
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo actualizar el egreso'));
    } finally {
      setSaving(false);
    }
  };

  const deleteGasto = async (g: GasGasto) => {
    if (g.origen_tipo === 'COMPRA') {
      setError('No se puede eliminar un egreso generado por compra.');
      return;
    }
    if (!confirm(`¿Eliminar egreso de ${fmtMoney(g.monto)} — ${g.descripcion || 'sin descripción'}?`)) return;
    setError(null);
    try {
      await eliminarGasto(g.id);
      setSuccess('Egreso eliminado.');
      await load();
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo eliminar el egreso'));
    }
  };

  const totalEditPreview = useMemo(() => {
    return detalle.reduce((s, d) => {
      const p = parseFloat(precios[d.id] ?? '0');
      return s + (Number.isFinite(p) ? p * d.cantidad : 0);
    }, 0);
  }, [detalle, precios]);

  const ventasFiltradas = useMemo(() => {
    const q = buscaNro.trim().toLowerCase();
    if (!q) return ventas;
    return ventas.filter((v) => (v.nro_venta || v.id).toLowerCase().includes(q));
  }, [ventas, buscaNro]);

  return (
    <div className="animate-in">
      <PageHeader
        title="Modificaciones"
        subtitle="Corregir ingresos (ventas) y egresos mal registrados"
        moduleId="modificaciones"
        action={
          <>
            <Link to="/sales/income" className="btn btn-ghost">
              <span className="material-icons-round">point_of_sale</span>
              Ir a Ingresos
            </Link>
            <Link to="/expenses" className="btn btn-ghost">
              <span className="material-icons-round">money_off</span>
              Ir a Egresos
            </Link>
          </>
        }
      />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="card card-section">
        <FormRow>
          <FormInput label="Desde" type="date" value={desde} onChange={setDesde} required />
          <FormInput label="Hasta" type="date" value={hasta} onChange={setHasta} required />
          {tab === 'ingresos' && (
            <>
              <FormSelect
                label="Anuladas"
                value={incluirAnuladas ? '1' : '0'}
                onChange={(v) => setIncluirAnuladas(v === '1')}
                options={[
                  { value: '0', label: 'Ocultar anuladas' },
                  { value: '1', label: 'Incluir anuladas' },
                ]}
              />
              <FormInput
                label="Buscar N° venta"
                value={buscaNro}
                onChange={setBuscaNro}
                placeholder="Ej: V-…"
              />
            </>
          )}
        </FormRow>
      </div>

      <TabBar
        active={tab}
        onChange={(id) => setTab(id as ModTab)}
        tabs={[
          { id: 'ingresos', label: 'Ingresos (ventas)', icon: 'payments' },
          { id: 'egresos', label: 'Egresos (gastos)', icon: 'receipt_long' },
        ]}
      />

      {loading ? <PageLoader /> : tab === 'ingresos' ? (
        ventasFiltradas.length === 0 ? (
          <EmptyState
            icon="receipt_long"
            title={buscaNro.trim() ? 'Sin coincidencias' : 'Sin ventas en el periodo'}
            hint="Registre ventas en Ingresos o Despacho, luego corríjalas aquí."
            action={(
              <Link to="/sales/income" className="btn btn-primary">Nuevo ingreso</Link>
            )}
          />
        ) : (
          <div className="card">
            <DataTable>
              <thead>
                <tr>
                  <th /><th>Fecha</th><th>N°</th><th>PV</th><th>Canal</th><th>Cliente</th><th>Total</th><th>Estado</th><th />
                </tr>
              </thead>
              <tbody>
                {ventasFiltradas.map((v) => {
                  const anulada = v.estado === 'ANULADA';
                  const lines = detalleCache[v.id];
                  return (
                    <React.Fragment key={v.id}>
                      <tr className={anulada ? 'row-danger' : undefined}>
                        <td>
                          <button type="button" className="btn-icon" title="Ver líneas" onClick={() => toggleExpand(v.id)}>
                            <span className="material-icons-round">
                              {expandedVenta === v.id ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                        </td>
                        <td>{fmtDate(v.fecha)}</td>
                        <td><code className="code-tag">{v.nro_venta || v.id.slice(0, 8)}</code></td>
                        <td>{v.cat_ubicacion?.nombre || '—'}</td>
                        <td>{v.canal || '—'}</td>
                        <td>{v.ma_cliente?.nombre || '—'}</td>
                        <td className="cell-money">{fmtMoney(v.total)}</td>
                        <td>
                          <span className={`status-tag ${anulada ? 'status-danger' : 'status-ok'}`}>
                            {anulada ? 'Anulada' : 'Activa'}
                          </span>
                        </td>
                        <td className="cell-actions">
                          {!anulada && (
                            <button type="button" className="btn-icon" title="Modificar" onClick={() => openVentaEdit(v)}>
                              <span className="material-icons-round">edit</span>
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedVenta === v.id && (
                        <tr>
                          <td colSpan={9}>
                            {!lines ? (
                              <p className="kpi-sub">Cargando líneas…</p>
                            ) : lines.length === 0 ? (
                              <p className="kpi-sub">Sin líneas</p>
                            ) : (
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Ítem / SKU</th><th>Cant.</th><th>P. unit.</th><th>Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lines.map((l) => (
                                    <tr key={l.id}>
                                      <td>
                                        {l.ma_presentacion?.nombre
                                          || (l.ma_item ? `${l.ma_item.codigo} — ${l.ma_item.nombre}` : '—')}
                                      </td>
                                      <td className="cell-num">{fmtNum(l.cantidad)}</td>
                                      <td className="cell-money">{fmtMoney(l.precio_unitario)}</td>
                                      <td className="cell-money">{fmtMoney(l.subtotal ?? l.cantidad * l.precio_unitario)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            {anulada && v.anulado_motivo && (
                              <p className="kpi-sub" style={{ marginTop: 8 }}>Motivo: {v.anulado_motivo}</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </DataTable>
          </div>
        )
      ) : gastos.length === 0 ? (
        <EmptyState
          icon="money_off"
          title="Sin egresos en el periodo"
          hint="Registre egresos en el módulo Egresos."
          action={<Link to="/expenses" className="btn btn-primary">Nuevo egreso</Link>}
        />
      ) : (
        <div className="card">
          <DataTable>
            <thead>
              <tr>
                <th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Proveedor</th><th>Origen</th><th>Monto</th><th />
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => {
                const fromCompra = g.origen_tipo === 'COMPRA';
                return (
                  <tr key={g.id}>
                    <td>{fmtDate(g.fecha)}</td>
                    <td>{g.gas_categoria?.nombre || '—'}</td>
                    <td>{g.descripcion || '—'}</td>
                    <td>{g.proveedor_nombre || '—'}</td>
                    <td>
                      <span className={`status-tag ${fromCompra ? 'status-warn' : 'status-neutral'}`}>
                        {fromCompra ? 'Compra' : 'Manual'}
                      </span>
                    </td>
                    <td className="cell-money">{fmtMoney(g.monto)}</td>
                    <td className="cell-actions">
                      {!fromCompra && (
                        <>
                          <button type="button" className="btn-icon" title="Editar" onClick={() => openGastoEdit(g)}>
                            <span className="material-icons-round">edit</span>
                          </button>
                          <button type="button" className="btn-icon" title="Eliminar" onClick={() => deleteGasto(g)}>
                            <span className="material-icons-round">delete_outline</span>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </div>
      )}

      <Modal
        title={ventaEdit ? `Modificar venta ${ventaEdit.nro_venta ?? ''}` : 'Venta'}
        isOpen={!!ventaEdit && !anulModal}
        onClose={() => setVentaEdit(null)}
      >
        {ventaEdit && (
          <form onSubmit={saveVenta}>
            <FormSection title="Cabecera">
              <p className="kpi-sub">
                {fmtDate(ventaEdit.fecha)} · {ventaEdit.cat_ubicacion?.nombre || 'PV'}
                {' · '}Ubicación y cantidades no se modifican (inventario).
              </p>
              <FormSelect
                label="Cliente"
                value={clienteId}
                onChange={setClienteId}
                options={[
                  { value: '', label: '— Sin cliente —' },
                  ...clientes.map((c) => ({ value: c.id, label: c.nombre })),
                ]}
              />
              <FormSelect
                label="Canal"
                value={canal}
                onChange={setCanal}
                options={
                  canalesVenta.length
                    ? canalesVenta.map((c) => ({ value: c.codigo, label: c.nombre }))
                    : [{ value: canal || 'DIRECTO', label: canal || 'DIRECTO' }]
                }
              />
              <FormInput label="Observaciones" value={obs} onChange={setObs} />
            </FormSection>
            <FormSection title="Precios por línea (cantidad fija)">
              {detalle.map((l) => (
                <FormRow key={l.id}>
                  <div className="form-group" style={{ flex: 2 }}>
                    <span className="form-label">
                      {l.ma_presentacion?.nombre
                        || (l.ma_item ? `${l.ma_item.codigo} — ${l.ma_item.nombre}` : l.id.slice(0, 8))}
                      {' · '}
                      {fmtNum(l.cantidad)} u.
                    </span>
                  </div>
                  <FormInput
                    label="P. unitario (S/)"
                    type="number"
                    value={precios[l.id] ?? ''}
                    onChange={(v) => setPrecios((p) => ({ ...p, [l.id]: v }))}
                    min={0}
                    step="0.01"
                    required
                  />
                </FormRow>
              ))}
              <p className="cart-total">Total estimado: {fmtMoney(totalEditPreview)}</p>
            </FormSection>
            <div className="form-actions" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setAnulModal(true)}
              >
                <span className="material-icons-round">cancel</span>
                Anular venta
              </button>
              <SubmitButton loading={saving} label="Guardar cambios" icon="save" />
            </div>
          </form>
        )}
      </Modal>

      <Modal
        title="Anular venta y restituir stock"
        isOpen={anulModal}
        onClose={() => setAnulModal(false)}
      >
        <p className="kpi-sub" style={{ marginBottom: '1rem' }}>
          Se marcará la venta como ANULADA y se generarán ingresos de inventario (AJUSTE_ING)
          por las mismas cantidades/lotes. El movimiento VENTA original permanece en auditoría.
        </p>
        <FormInput
          label="Motivo de anulación"
          value={anulMotivo}
          onChange={setAnulMotivo}
          placeholder="Error de captura, cliente canceló…"
        />
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setAnulModal(false)}>Cancelar</button>
          <button type="button" className="btn btn-danger" disabled={saving} onClick={confirmAnular}>
            <span className="material-icons-round">{saving ? 'hourglass_empty' : 'cancel'}</span>
            Confirmar anulación
          </button>
        </div>
      </Modal>

      <Modal
        title="Modificar egreso"
        isOpen={!!gastoEdit}
        onClose={() => setGastoEdit(null)}
      >
        {gastoEdit && (
          <form onSubmit={saveGasto}>
            <FormInput label="Fecha" type="date" value={gFecha} onChange={setGFecha} required />
            <FormInput label="Monto (S/)" type="number" value={gMonto} onChange={setGMonto} min={0.01} step="0.01" required />
            <FormInput label="Descripción" value={gDesc} onChange={setGDesc} required />
            <FormSelect
              label="Categoría"
              value={gCat}
              onChange={setGCat}
              required
              options={categoriasGasto.map((c) => ({ value: c.id, label: c.nombre }))}
            />
            <FormInput label="Proveedor" value={gProv} onChange={setGProv} />
            <FormRow>
              <FormSelect label="Tipo comprobante" value={gTipoDoc} onChange={setGTipoDoc} options={TIPOS_DOC} />
              <FormInput label="N° comprobante" value={gNroDoc} onChange={setGNroDoc} />
            </FormRow>
            <FormSelect
              label="Centro de costo"
              value={gCentro}
              onChange={setGCentro}
              options={[
                { value: 'BODEGA', label: 'Bodega' },
                { value: 'PRODUCCION', label: 'Producción' },
                { value: 'VENTAS', label: 'Ventas' },
              ]}
            />
            <div className="form-actions">
              <SubmitButton loading={saving} label="Guardar egreso" icon="save" />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default ModificacionesPage;
