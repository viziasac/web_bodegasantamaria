import React, { useEffect, useMemo, useState } from 'react';
import {
  getOrdenes, validarInsumosOrden, crearOrdenProduccion, completarOrden, anularOrden,
  checkStockProduccion,
} from '../../services/apiProvider';
import { newTxnId } from '../../utils/txnId';
import {
  cantidadBaseDesdeEntrada, etiquetaModoCantidad, resumenCantidadBase,
  modoCantidadToDb, type ModoCantidadEmpaque,
} from '../../utils/cantidadEmpaque';
import {
  skusDesdeCatalogoPt, categoriasSkus, filtrarSkusPorCategoria,
  etiquetaSkuConStock, presentacionParaFactor, factorActivoSku, factoresPackSku,
} from '../../utils/skuVenta';
import { etiquetaOrdenPlan } from '../../utils/presentacionLabels';
import { ubicacionesParaProduccionPt } from '../../utils/ubicacionItemPolicy';
import { CantidadEmpaqueToggle } from '../../components/CantidadEmpaqueToggle';
import {
  PageHeader, PageLoader, Alert, FormSelect, FormInput, SubmitButton,
  StatusBadge, StockBar, fmtNum, DataTable, EmptyState, toUserMessage,
  TabBar,
} from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';
import { CatalogGate } from '../../components/CatalogGate';
import type { PrdOrden, InsumoValidacionOrden } from '../../types';

type FiltroEstado = 'BORRADOR' | 'COMPLETADA' | 'TODAS';

const ProductionPage: React.FC = () => {
  const { presentaciones, ubicaciones, ensureCatalogLoaded } = useCatalog();
  const [ordenes, setOrdenes] = useState<PrdOrden[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('BORRADOR');

  const [categoria, setCategoria] = useState('');
  const [itemId, setItemId] = useState('');
  const [modoCantidad, setModoCantidad] = useState<ModoCantidadEmpaque>('botella');
  const [factorPackSel, setFactorPackSel] = useState(1);
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

  const skus = useMemo(() => skusDesdeCatalogoPt(presentaciones), [presentaciones]);
  const categorias = useMemo(() => categoriasSkus(skus), [skus]);
  const skusFiltrados = useMemo(
    () => filtrarSkusPorCategoria(skus, categoria || undefined),
    [skus, categoria],
  );
  const skuSel = skus.find((s) => s.itemId === itemId)
    ?? skusFiltrados.find((s) => s.itemId === itemId);

  const packFactores = skuSel ? factoresPackSku(skuSel) : [];
  const puedePack = packFactores.length > 0;
  const factorPackSelSafe = puedePack && packFactores.includes(factorPackSel)
    ? factorPackSel
    : (packFactores[0] ?? 1);
  const factorActivo = skuSel ? factorActivoSku(skuSel, modoCantidad, factorPackSelSafe) : 1;
  const presComercial = skuSel
    ? presentacionParaFactor(skuSel, modoCantidad, factorPackSelSafe)
    : undefined;

  const cantIngresada = parseFloat(cantidad);
  const botellasPlan = skuSel && !Number.isNaN(cantIngresada) && cantIngresada > 0
    ? cantidadBaseDesdeEntrada({
      cantidadIngresada: cantIngresada,
      modo: modoCantidad,
      cantUnidadesPresentacion: factorActivo,
    })
    : 0;

  const almacenesDestino = useMemo(
    () => ubicacionesParaProduccionPt(ubicaciones),
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
    if (!presComercial || !botellasPlan) {
      setError('Seleccione SKU y cantidad válida.');
      return;
    }
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await checkStockProduccion(presComercial.presentacion_id, botellasPlan);
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
    if (!skuSel || !presComercial || botellasPlan <= 0) {
      setError('Indique SKU y cantidad válida.');
      return;
    }
    if (modoCantidad === 'pack' && !puedePack) {
      setError('Este SKU no tiene presentación pack configurada.');
      return;
    }
    if (almacenesDestino.length === 0) {
      setError('Falta configurar ALM_PT (almacén de productos terminados).');
      return;
    }
    if (!ubicacionId) {
      setError('Seleccione ubicación destino (ALM_PT).');
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
      await crearOrdenProduccion({
        itemProducidoId: skuSel.itemId,
        presentacionId: presComercial.presentacion_id,
        modoCantidad: modoCantidadToDb(modoCantidad),
        cantidadProgramada: botellasPlan,
        ubicacionDestinoId: ubicacionId || undefined,
        observaciones: observaciones.trim() || undefined,
        txnId: newTxnId(),
      });
      setSuccess(`Orden creada: ${botellasPlan} bot. (${skuSel.nombre}).`);
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

  const onSkuChange = (id: string) => {
    setItemId(id);
    resetPreview();
    setModoCantidad('botella');
    const sku = skus.find((x) => x.itemId === id);
    setFactorPackSel(sku?.factorPack ?? 1);
  };

  return (
    <div className="animate-in">
      <PageHeader
        title="Producción Envasado"
        subtitle="Órdenes por SKU — planifica en botellas o packs; el stock PT se registra siempre en botellas"
        moduleId="produccion_envasado"
      />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="grid-2-1">
        <div className="card">
          <h3 className="card-section-title">Nueva orden</h3>
          <CatalogGate
            ready={skus.length > 0}
            emptyIcon="precision_manufacturing"
            emptyTitle="Sin SKUs PT"
            emptyHint="Recargue catálogos en Configuración"
          >
            <form onSubmit={crearOrden}>
              {categorias.length > 1 && (
                <FormSelect
                  label="Categoría / línea"
                  value={categoria}
                  onChange={(v) => {
                    setCategoria(v);
                    setItemId('');
                    resetPreview();
                  }}
                  options={[
                    { value: '', label: 'Todas las categorías' },
                    ...categorias.map((c) => ({ value: c, label: c })),
                  ]}
                />
              )}
              <FormSelect
                label="SKU a producir"
                value={itemId}
                onChange={onSkuChange}
                required
                options={[
                  { value: '', label: '— Seleccionar SKU —' },
                  ...skusFiltrados.map((s) => ({
                    value: s.itemId,
                    label: etiquetaSkuConStock(s),
                  })),
                ]}
              />

              {skuSel && puedePack && (
                <CantidadEmpaqueToggle
                  modo={modoCantidad}
                  onChange={(m) => { setModoCantidad(m); resetPreview(); }}
                  cantUnidades={factorPackSelSafe}
                  packFactores={packFactores}
                  onFactorChange={(f) => { setFactorPackSel(f); resetPreview(); }}
                />
              )}

              <FormInput
                label={skuSel ? etiquetaModoCantidad(modoCantidad, factorActivo) : 'Cantidad planificada'}
                type="number"
                value={cantidad}
                onChange={(v) => { setCantidad(v); resetPreview(); }}
                required
                min={1}
                step={1}
              />
              {skuSel && botellasPlan > 0 && (
                <p className="qty-base-summary">
                  {resumenCantidadBase({
                    cantidadIngresada: cantIngresada,
                    modo: modoCantidad,
                    cantUnidadesPresentacion: factorActivo,
                  })}
                </p>
              )}

              <FormSelect
                label="Ubicación destino"
                value={ubicacionId}
                onChange={setUbicacionId}
                required
                options={[
                  { value: '', label: almacenesDestino.length ? '— ALM_PT —' : 'Sin ALM_PT configurado' },
                  ...almacenesDestino.map((u) => ({
                    value: u.id,
                    label: `${u.codigo} — ${u.nombre}`,
                  })),
                ]}
              />
              {almacenesDestino.length === 0 && (
                <p className="kpi-sub text-danger">Configure la ubicación ALM_PT en el catálogo.</p>
              )}
              <FormInput label="Observaciones (opcional)" value={observaciones} onChange={setObservaciones} />

              <div className="form-actions form-actions--flat">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={previewLoading || !skuSel || botellasPlan <= 0}
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
          </CatalogGate>
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
