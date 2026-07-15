import React, { useEffect, useMemo, useState } from 'react';
import {
  getOrdenes, validarInsumosOrden, crearOrdenProduccion, completarOrden, anularOrden,
  resolveItemPtId, checkStockProduccion,
} from '../../services/apiProvider';
import { newTxnId } from '../../utils/txnId';
import {
  cantidadBaseDesdeEntrada, etiquetaModoCantidad, resumenCantidadBase,
  presentacionPermiteModoPack, modoCantidadToDb, type ModoCantidadEmpaque,
} from '../../utils/cantidadEmpaque';
import {
  presentacionesParaProduccion, categoriasDistintas, categoriaDePresentacion,
  etiquetaPresentacionCatalogo, etiquetaOrdenPlan,
} from '../../utils/presentacionLabels';
import {
  PageHeader, PageLoader, Alert, FormSelect, FormInput, SubmitButton,
  StatusBadge, StockBar, fmtNum, DataTable, EmptyState, toUserMessage,
  TabBar,
} from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';
import type { PrdOrden, InsumoValidacionOrden } from '../../types';

type FiltroEstado = 'BORRADOR' | 'COMPLETADA' | 'TODAS';

const ProductionPage: React.FC = () => {
  const { presentaciones, ubicaciones, ensureCatalogLoaded } = useCatalog();
  const [ordenes, setOrdenes] = useState<PrdOrden[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('BORRADOR');

  const [categoria, setCategoria] = useState('');
  const [presentacionId, setPresentacionId] = useState('');
  const [modoCantidad, setModoCantidad] = useState<ModoCantidadEmpaque>('botella');
  const [cantidad, setCantidad] = useState('');
  const [ubicacionId, setUbicacionId] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewStock, setPreviewStock] = useState<Awaited<ReturnType<typeof checkStockProduccion>> | null>(null);

  const [validacion, setValidacion] = useState<InsumoValidacionOrden[]>([]);
  const [selectedOrden, setSelectedOrden] = useState<PrdOrden | null>(null);
  const [cantReal, setCantReal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const catalogoProd = useMemo(
    () => presentacionesParaProduccion(presentaciones),
    [presentaciones],
  );
  const categorias = useMemo(() => categoriasDistintas(catalogoProd), [catalogoProd]);
  const presentacionesFiltradas = useMemo(() => {
    if (!categoria) return catalogoProd;
    return catalogoProd.filter((p) => categoriaDePresentacion(p) === categoria);
  }, [catalogoProd, categoria]);

  const presSel = useMemo(
    () => catalogoProd.find((p) => p.id === presentacionId) ?? presentacionesFiltradas.find((p) => p.id === presentacionId),
    [catalogoProd, presentacionesFiltradas, presentacionId],
  );

  const cantIngresada = parseFloat(cantidad);
  const botellasPlan = presSel && !Number.isNaN(cantIngresada) && cantIngresada > 0
    ? cantidadBaseDesdeEntrada({
      cantidadIngresada,
      modo: modoCantidad,
      cantUnidadesPresentacion: presSel.cant_unidades ?? 1,
    })
    : 0;

  const almacenesDestino = useMemo(
    () => ubicaciones.filter((u) => !u.es_punto_venta),
    [ubicaciones],
  );

  useEffect(() => {
    const almPt = almacenesDestino.find((u) => u.codigo === 'ALM_PT');
    if (!ubicacionId && almPt) setUbicacionId(almPt.id);
  }, [almacenesDestino, ubicacionId]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setOrdenes(await getOrdenes());
    } catch (err) {
      setError(toUserMessage(err, 'Error cargando órdenes'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const ordenesVisibles = useMemo(() => {
    if (filtroEstado === 'TODAS') return ordenes;
    return ordenes.filter((o) => o.estado === filtroEstado);
  }, [ordenes, filtroEstado]);

  const resetPreview = () => setPreviewStock(null);

  const cargarPreview = async () => {
    if (!presSel || !botellasPlan) {
      setError('Seleccione presentación y cantidad válida.');
      return;
    }
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await checkStockProduccion(presSel.id, botellasPlan);
      setPreviewStock(res);
    } catch (err) {
      setError(toUserMessage(err, 'Error al validar insumos'));
      setPreviewStock(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const crearOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presSel || botellasPlan <= 0) {
      setError('Indique presentación y cantidad válida.');
      return;
    }
    if (previewStock && !previewStock.tiene_stock) {
      const ok = confirm(
        'Hay insumos faltantes (GRANEL en ALM_GR / resto en ALM_MP). Puede crear la orden, pero al completarla el inventario puede quedar negativo si no repone insumos. ¿Continuar?',
      );
      if (!ok) return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await ensureCatalogLoaded();
      const itemPtId = await resolveItemPtId(presSel.id);
      await crearOrdenProduccion({
        itemProducidoId: itemPtId,
        presentacionId: presSel.id,
        modoCantidad: modoCantidadToDb(modoCantidad),
        cantidadProgramada: botellasPlan,
        ubicacionDestinoId: ubicacionId || undefined,
        observaciones: observaciones.trim() || undefined,
        txnId: newTxnId(),
      });
      setSuccess(`Orden creada: ${botellasPlan} bot. (${etiquetaPresentacionCatalogo(presSel)}).`);
      setCantidad('');
      setObservaciones('');
      setPreviewStock(null);
      await load();
    } catch (err) {
      setError(toUserMessage(err, 'Error al crear orden'));
    } finally {
      setSubmitting(false);
    }
  };

  const validar = async (orden: PrdOrden) => {
    setValidating(true);
    setError(null);
    try {
      const result = await validarInsumosOrden(orden.id);
      setValidacion(result);
      setSelectedOrden(orden);
      setCantReal(String(orden.cant_planificada));
    } catch (err) {
      setError(toUserMessage(err, 'Error al validar'));
      setValidacion([]);
    } finally {
      setValidating(false);
    }
  };

  const todosSuficientes = validacion.length > 0 && validacion.every((v) => v.suficiente);

  const completar = async () => {
    if (!selectedOrden) return;
    const real = parseInt(cantReal, 10);
    if (!real || real <= 0) {
      setError('Indique cantidad real en botellas.');
      return;
    }
    if (real > selectedOrden.cant_planificada) {
      const ok = confirm(
        `Produjo ${real} bot. pero se planificaron ${selectedOrden.cant_planificada} bot. ¿Continuar?`,
      );
      if (!ok) return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await completarOrden(selectedOrden.id, real);
      setSuccess('Orden completada correctamente.');
      setValidacion([]);
      setSelectedOrden(null);
      await load();
    } catch (err) {
      setError(toUserMessage(err, 'Error al completar orden'));
    } finally {
      setSubmitting(false);
    }
  };

  const anular = async (ordenId: string) => {
    if (!confirm('¿Anular esta orden?')) return;
    try {
      await anularOrden(ordenId);
      if (selectedOrden?.id === ordenId) {
        setValidacion([]);
        setSelectedOrden(null);
      }
      await load();
    } catch (err) {
      setError(toUserMessage(err, 'Error al anular orden'));
    }
  };

  const onPresentacionChange = (id: string) => {
    setPresentacionId(id);
    resetPreview();
    const p = catalogoProd.find((x) => x.id === id);
    if (p && (p.cant_unidades ?? 1) <= 1) setModoCantidad('botella');
  };

  return (
    <div className="animate-in">
      <PageHeader
        title="Producción Envasado"
        subtitle="Órdenes por presentación — botellas o packs (six pack, caja, etc.)"
        moduleId="produccion_envasado"
      />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="grid-2-1">
        <div className="card">
          <h3 className="card-section-title">Nueva orden</h3>
          {catalogoProd.length === 0 ? (
            <EmptyState icon="precision_manufacturing" title="Sin presentaciones PT" hint="Recargue catálogos en Configuración" />
          ) : (
            <form onSubmit={crearOrden}>
              {categorias.length > 1 && (
                <FormSelect
                  label="Categoría / línea"
                  value={categoria}
                  onChange={(v) => {
                    setCategoria(v);
                    setPresentacionId('');
                    resetPreview();
                  }}
                  options={[
                    { value: '', label: 'Todas las categorías' },
                    ...categorias.map((c) => ({ value: c, label: c })),
                  ]}
                />
              )}
              <FormSelect
                label="Presentación / empaque a producir"
                value={presentacionId}
                onChange={onPresentacionChange}
                required
                options={presentacionesFiltradas.map((p) => ({
                  value: p.id,
                  label: etiquetaPresentacionCatalogo(p),
                }))}
              />

              {presSel && presentacionPermiteModoPack(presSel.cant_unidades ?? 1) && (
                <div className="qty-mode-toggle" role="group" aria-label="Modo de cantidad">
                  <button
                    type="button"
                    className={`qty-mode-btn ${modoCantidad === 'botella' ? 'active' : ''}`}
                    onClick={() => { setModoCantidad('botella'); resetPreview(); }}
                  >
                    <span className="material-icons-round">wine_bar</span>
                    Botellas
                  </button>
                  <button
                    type="button"
                    className={`qty-mode-btn ${modoCantidad === 'pack' ? 'active' : ''}`}
                    onClick={() => { setModoCantidad('pack'); resetPreview(); }}
                  >
                    <span className="material-icons-round">inventory_2</span>
                    Packs
                  </button>
                </div>
              )}

              <FormInput
                label={presSel ? etiquetaModoCantidad(modoCantidad, presSel.cant_unidades ?? 1) : 'Cantidad planificada'}
                type="number"
                value={cantidad}
                onChange={(v) => { setCantidad(v); resetPreview(); }}
                required
                min={1}
                step={modoCantidad === 'pack' ? 1 : 1}
              />
              {presSel && botellasPlan > 0 && (
                <p className="qty-base-summary">
                  {resumenCantidadBase({
                    cantidadIngresada: cantIngresada,
                    modo: modoCantidad,
                    cantUnidadesPresentacion: presSel.cant_unidades ?? 1,
                  })}
                </p>
              )}

              <FormSelect
                label="Ubicación destino"
                value={ubicacionId}
                onChange={setUbicacionId}
                options={almacenesDestino.map((u) => ({
                  value: u.id,
                  label: `${u.codigo} — ${u.nombre}`,
                }))}
              />
              <FormInput label="Observaciones (opcional)" value={observaciones} onChange={setObservaciones} />

              <div className="form-actions form-actions--flat">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={previewLoading || !presSel || botellasPlan <= 0}
                  onClick={cargarPreview}
                >
                  <span className="material-icons-round">{previewLoading ? 'hourglass_empty' : 'fact_check'}</span>
                  {previewLoading ? 'Validando…' : 'Validar insumos'}
                </button>
              </div>

              {previewStock && (
                <div className={`preview-insumos ${previewStock.tiene_stock ? 'preview-ok' : 'preview-warn'}`}>
                  <p className="preview-insumos-title">
                    {previewStock.tiene_stock
                      ? 'Insumos suficientes (GRANEL→ALM_GR / resto→ALM_MP)'
                      : 'Aviso: faltan insumos en bodega'}
                  </p>
                  {!previewStock.tiene_stock && (
                    <p className="preview-insumos-hint">
                      Puede crear la orden; al completarla el inventario puede quedar negativo si no repone insumos.
                    </p>
                  )}
                  {previewStock.detalle.map((d) => (
                    <div key={`${d.codigo ?? ''}-${d.nombre}`} className="preview-insumo-row">
                      <span>
                        {d.nombre}
                        {d.ubicacion_codigo && (
                          <code className="code-tag" style={{ marginLeft: 6 }}>{d.ubicacion_codigo}</code>
                        )}
                      </span>
                      <span>
                        req {fmtNum(d.necesario, 2)} / disp {fmtNum(d.disponible, 2)}
                        {d.faltante > 0 && <strong className="text-danger"> · falta {fmtNum(d.faltante, 2)}</strong>}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="form-actions">
                <SubmitButton loading={submitting} label="Crear orden BORRADOR" icon="add" />
              </div>
            </form>
          )}
        </div>

        {validacion.length > 0 && selectedOrden && (
          <div className="card accent-border">
            <h3 className="card-section-title">Completar — {selectedOrden.nro_orden}</h3>
            <p className="kpi-sub" style={{ marginBottom: '1rem' }}>
              {selectedOrden.ma_item?.nombre}
              {selectedOrden.ma_presentacion?.nombre && selectedOrden.ma_presentacion.nombre !== selectedOrden.ma_item?.nombre
                ? ` · ${selectedOrden.ma_presentacion.nombre}`
                : ''}
            </p>
            <p className="qty-base-summary">{etiquetaOrdenPlan(selectedOrden)}</p>
            <div className="validation-list">
              {validacion.map((v) => (
                <div key={v.item_id} className={`validation-row ${v.suficiente ? '' : 'validation-fail'}`}>
                  <div className="validation-head">
                    <strong>{v.nombre}</strong>
                    {v.codigo && <code className="code-tag">{v.codigo}</code>}
                    {v.ubicacion_codigo && <code className="code-tag">{v.ubicacion_codigo}</code>}
                    <StatusBadge ok={v.suficiente} />
                  </div>
                  <div className="validation-stats">
                    <span>Req: <b>{fmtNum(v.requerido, 2)}</b> {v.unidad_medida}</span>
                    <span>Disp: <b>{fmtNum(v.disponible, 2)}</b></span>
                    {!v.suficiente && <span className="text-danger">Faltan: {fmtNum(v.faltante, 2)}</span>}
                  </div>
                  <StockBar value={v.disponible} max={Math.max(v.requerido, v.disponible, 1)} danger={!v.suficiente} />
                </div>
              ))}
            </div>
            <FormInput
              label="Cantidad real (botellas)"
              type="number"
              value={cantReal}
              onChange={setCantReal}
              required
              min={1}
            />
            <p className="preview-insumos-hint">El stock PT siempre se registra por botella física.</p>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting || !todosSuficientes}
                onClick={completar}
                title={!todosSuficientes ? 'Stock insuficiente en uno o más insumos' : undefined}
              >
                <span className="material-icons-round">{submitting ? 'hourglass_empty' : 'check_circle'}</span>
                {submitting ? 'Procesando…' : 'Completar orden'}
              </button>
            </div>
            {!todosSuficientes && (
              <p className="text-danger" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                No se puede completar: hay insumos con stock insuficiente
                (GRANEL en ALM_GR / resto en ALM_MP).
              </p>
            )}
          </div>
        )}
      </div>

      <TabBar
        active={filtroEstado}
        onChange={(id) => setFiltroEstado(id as FiltroEstado)}
        tabs={[
          { id: 'BORRADOR', label: 'En borrador', icon: 'edit_note' },
          { id: 'COMPLETADA', label: 'Completadas', icon: 'check_circle' },
          { id: 'TODAS', label: 'Todas', icon: 'list' },
        ]}
      />

      {loading ? <PageLoader /> : (
        <div className="card card-section">
          <h3 className="card-section-title">Órdenes de producción</h3>
          {ordenesVisibles.length === 0 ? (
            <EmptyState
              icon="precision_manufacturing"
              title={filtroEstado === 'BORRADOR' ? 'Sin órdenes en borrador' : 'Sin órdenes'}
              hint="Cree una nueva orden arriba"
            />
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <th>N° Orden</th>
                  <th>Producto</th>
                  <th>Presentación</th>
                  <th>Plan</th>
                  <th>Real</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenesVisibles.map((o) => (
                  <tr key={o.id} className={selectedOrden?.id === o.id ? 'row-selected' : ''}>
                    <td><code className="code-tag">{o.nro_orden}</code></td>
                    <td>{o.ma_item?.nombre ?? '—'}</td>
                    <td>{o.ma_presentacion?.nombre ?? '—'}</td>
                    <td className="cell-num" title={etiquetaOrdenPlan(o)}>
                      {fmtNum(o.cant_planificada)} bot.
                      {o.modo_cantidad === 'PACK' && o.ma_presentacion?.cant_unidades && o.ma_presentacion.cant_unidades > 1
                        && o.cant_planificada % o.ma_presentacion.cant_unidades === 0 && (
                        <small className="cell-sub">
                          {' '}({o.cant_planificada / o.ma_presentacion.cant_unidades} pack)
                        </small>
                      )}
                    </td>
                    <td className="cell-num">{o.cant_real != null ? `${fmtNum(o.cant_real)} bot.` : '—'}</td>
                    <td>
                      <span className={`status-tag ${o.estado === 'COMPLETADA' ? 'status-ok' : o.estado === 'BORRADOR' ? 'status-warn' : 'status-danger'}`}>
                        {o.estado}
                      </span>
                    </td>
                    <td className="cell-actions">
                      {o.estado === 'BORRADOR' && (
                        <>
                          <button type="button" className="btn btn-sm btn-primary" disabled={validating} onClick={() => validar(o)}>
                            <span className="material-icons-round">fact_check</span>
                            Validar
                          </button>
                          <button type="button" className="btn-icon" onClick={() => anular(o.id)} title="Anular">
                            <span className="material-icons-round">cancel</span>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductionPage;
