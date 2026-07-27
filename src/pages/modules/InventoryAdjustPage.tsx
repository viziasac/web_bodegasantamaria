import React, { useEffect, useMemo, useState } from 'react';
import { bodegaService } from '../../services/bodegaService';
import { getLotesDisponibles } from '../../services/apiProvider';
import { labelLote } from '../../utils/lotePolicy';
import { newTxnId } from '../../utils/txnId';
import {
  PageHeader, Alert, FormSelect, FormInput, SubmitButton, FormRow, fmtNum, toUserMessage,
  PageFeedback,
} from '../../components/ui';
import { CantidadEmpaqueToggle } from '../../components/CantidadEmpaqueToggle';
import { useCatalog } from '../../context/CatalogContext';
import type { ModoCantidadEmpaque } from '../../utils/cantidadEmpaque';
import type { AjusteItemOption } from '../../types';
import {
  ubicacionesParaAjuste,
  etiquetaFamiliaUbicacion,
  resumenTiposPermitidos,
  opcionesTipoParaUbicacion,
  tiposPermitidosParaUbicacion,
  isPuntoVenta,
} from '../../utils/ubicacionItemPolicy';
import { MSG_REGISTRADO } from '../../utils/uiFeedback';

const LOTE_AUTO = '__auto__';

const MOTIVO_PRESETS = [
  'Conteo físico',
  'MERMA: rotura',
  'MERMA: evaporación / merma natural',
  'MERMA: caducidad',
  'MERMA: muestreo / calidad',
  'Corrección de registro',
  'Otro (editar texto)',
];

interface Props {
  embedded?: boolean;
}

const InventoryAdjustPage: React.FC<Props> = ({ embedded = false }) => {
  const { ubicaciones, ensureCatalogLoaded } = useCatalog();
  const [ubicacionId, setUbicacionId] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [itemsStock, setItemsStock] = useState<AjusteItemOption[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [loteId, setLoteId] = useState(LOTE_AUTO);
  const [modoEmpaque, setModoEmpaque] = useState<ModoCantidadEmpaque>('botella');
  const [factorPackSel, setFactorPackSel] = useState(1);
  const [conteo, setConteo] = useState('');
  const [motivoPreset, setMotivoPreset] = useState(MOTIVO_PRESETS[0]);
  const [motivo, setMotivo] = useState(MOTIVO_PRESETS[0]);
  const [lotes, setLotes] = useState<Record<string, unknown>[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const ubicacionesAjuste = useMemo(() => ubicacionesParaAjuste(ubicaciones), [ubicaciones]);
  const ubiSel = ubicacionesAjuste.find((u) => u.id === ubicacionId);
  const tiposPermitidos = useMemo(() => tiposPermitidosParaUbicacion(ubiSel), [ubiSel]);
  const opcionesTipo = useMemo(() => opcionesTipoParaUbicacion(ubiSel), [ubiSel]);

  const selected = itemsStock.find((o) => o.key === selectedKey);
  const packFactores = selected?.isProducto
    ? (selected.factorPacks?.length ? selected.factorPacks : ((selected.factorPack ?? 1) > 1 ? [selected.factorPack!] : []))
    : [];
  const factorPack = packFactores.includes(factorPackSel)
    ? factorPackSel
    : (packFactores[0] ?? 1);
  const usaPack = selected?.isProducto === true && modoEmpaque === 'pack' && factorPack > 1;
  const conteoNum = parseFloat(conteo);

  const itemsFiltrados = useMemo(() => {
    let list = itemsStock;
    if (tiposPermitidos.length) {
      list = list.filter((o) => tiposPermitidos.includes(o.tipo as typeof tiposPermitidos[number]));
    }
    if (tipoFilter) list = list.filter((o) => o.tipo === tipoFilter);
    return list;
  }, [itemsStock, tipoFilter, tiposPermitidos]);

  const onMotivoPreset = (v: string) => {
    setMotivoPreset(v);
    if (v !== 'Otro (editar texto)') setMotivo(v);
  };

  /** Stock de referencia siempre en unidad de inventario (botellas para PT). */
  const stockReferencia = useMemo(() => {
    if (loteId !== LOTE_AUTO) {
      const lote = lotes.find((l) => String(l.lote_id) === loteId);
      if (lote?.cantidad != null) return Number(lote.cantidad);
    }
    return selected?.stockTeorico ?? 0;
  }, [loteId, lotes, selected]);

  /** Conteo del usuario convertido a unidad de inventario (botellas si PT+pack). */
  const conteoEnInventario = useMemo(() => {
    if (!Number.isFinite(conteoNum)) return null;
    if (usaPack) return Math.round(conteoNum * factorPack);
    return conteoNum;
  }, [conteoNum, usaPack, factorPack]);

  const delta = selected && conteoEnInventario != null
    ? conteoEnInventario - stockReferencia
    : null;

  useEffect(() => {
    if (!ubicacionId && ubicacionesAjuste.length > 0) {
      const almMp = ubicacionesAjuste.find((u) => u.codigo === 'ALM_MP');
      const almPt = ubicacionesAjuste.find((u) => u.codigo === 'ALM_PT');
      const id = almMp?.id ?? almPt?.id ?? ubicacionesAjuste[0].id;
      setUbicacionId(id);
      void loadItems(id);
    }
  }, [ubicacionesAjuste, ubicacionId]);

  useEffect(() => {
    if (tipoFilter && tiposPermitidos.length && !tiposPermitidos.includes(tipoFilter as typeof tiposPermitidos[number])) {
      setTipoFilter('');
    }
  }, [tiposPermitidos, tipoFilter]);

  const loadItems = async (ubi: string) => {
    if (!ubi) { setItemsStock([]); return; }
    setLoadingItems(true);
    try {
      await ensureCatalogLoaded();
      setItemsStock(await bodegaService.itemsConStockParaAjuste(ubi));
    } catch (err) {
      setItemsStock([]);
      setError(toUserMessage(err, 'Error cargando ítems para ajuste'));
    } finally {
      setLoadingItems(false);
    }
  };

  const loadLotes = async (ubi: string, opt: AjusteItemOption | undefined) => {
    if (!ubi || !opt) { setLotes([]); return; }
    try {
      // Stock/lotes siempre por item_id (PT y materiales).
      setLotes(await getLotesDisponibles({
        ubicacionId: ubi,
        itemId: opt.id,
      }));
    } catch {
      setLotes([]);
    }
  };

  const onUbicacionChange = (v: string) => {
    setUbicacionId(v);
    setTipoFilter('');
    setSelectedKey('');
    setLoteId(LOTE_AUTO);
    setModoEmpaque('botella');
    setFactorPackSel(1);
    setConteo('');
    void loadItems(v);
  };

  const onTipoFilterChange = (v: string) => {
    setTipoFilter(v);
    setSelectedKey('');
    setLoteId(LOTE_AUTO);
    setModoEmpaque('botella');
    setFactorPackSel(1);
    setConteo('');
    setLotes([]);
  };

  const syncConteoDesdeStock = (
    opt: AjusteItemOption | undefined,
    modo: ModoCantidadEmpaque,
    lote: string,
    factor: number,
  ) => {
    if (!opt) return;
    let base = opt.stockTeorico;
    if (lote !== LOTE_AUTO) {
      const l = lotes.find((x) => String(x.lote_id) === lote);
      if (l?.cantidad != null) base = Number(l.cantidad);
    }
    const f = opt.isProducto && modo === 'pack' && factor > 1 ? factor : 1;
    setConteo(String(f > 1 ? base / f : base));
  };

  const onItemChange = (key: string) => {
    setSelectedKey(key);
    setLoteId(LOTE_AUTO);
    setModoEmpaque('botella');
    const opt = itemsFiltrados.find((o) => o.key === key) ?? itemsStock.find((o) => o.key === key);
    const nextFactor = opt?.factorPack ?? 1;
    setFactorPackSel(nextFactor);
    void loadLotes(ubicacionId, opt);
    syncConteoDesdeStock(opt, 'botella', LOTE_AUTO, nextFactor);
  };

  const onModoEmpaqueChange = (m: ModoCantidadEmpaque) => {
    setModoEmpaque(m);
    syncConteoDesdeStock(selected, m, loteId, factorPack);
  };

  const onFactorPackChange = (f: number) => {
    setFactorPackSel(f);
    syncConteoDesdeStock(selected, 'pack', loteId, f);
  };

  const onLoteChange = (id: string) => {
    setLoteId(id);
    syncConteoDesdeStock(selected, modoEmpaque, id, factorPack);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!selected) {
      setError('Seleccione un ítem o SKU.');
      return;
    }
    if (conteoEnInventario == null || !Number.isFinite(conteoEnInventario)) {
      setError('Ingrese conteo físico válido.');
      return;
    }
    if (conteoEnInventario < 0) {
      setError('El conteo no puede ser negativo.');
      return;
    }
    if (delta === 0) {
      setError('El conteo coincide con el stock teórico (delta = 0).');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await ensureCatalogLoaded();
      await bodegaService.registrarAjusteInventario({
        ubicacionId,
        option: selected,
        conteoFisico: conteoEnInventario,
        motivo,
        stockReferencia,
        loteId: loteId !== LOTE_AUTO ? loteId : undefined,
        txnId: newTxnId(),
      });
      setConteo('');
      setSelectedKey('');
      setLoteId(LOTE_AUTO);
      setModoEmpaque('botella');
      setFactorPackSel(1);
      setTipoFilter('');
      setMotivoPreset(MOTIVO_PRESETS[0]);
      setMotivo(MOTIVO_PRESETS[0]);
      setLotes([]);
      await loadItems(ubicacionId);
      setSuccess(MSG_REGISTRADO);
    } catch (err) {
      setError(toUserMessage(err, 'Error al registrar ajuste'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={embedded ? '' : 'animate-in'}>
      {!embedded && (
        <PageHeader
          title="Ajuste Manual"
          subtitle="Conteo físico por almacén — solo materiales de esa ubicación"
          moduleId="ver_stock"
        />
      )}
      <PageFeedback
        success={success}
        error={error}
        onClearSuccess={() => setSuccess(null)}
        onClearError={() => setError(null)}
      />
      <div className="card">
        <form onSubmit={handleSubmit}>
          <Alert type="info">
            Cada almacén admite solo su familia de materiales:
            <strong> ALM_MP</strong> (material/insumo/empaque),
            <strong> ALM_GR</strong> (granel),
            <strong> ALM_PT / PV</strong> (producto terminado en botellas).
          </Alert>

          <FormRow>
            <FormSelect
              label="Almacén / ubicación"
              value={ubicacionId}
              onChange={onUbicacionChange}
              required
              options={ubicacionesAjuste.map((u) => ({
                value: u.id,
                label: isPuntoVenta(u)
                  ? `PV · ${u.codigo} — ${u.nombre}`
                  : `${u.codigo} — ${u.nombre}`,
              }))}
            />
            <FormSelect
              label="Tipo de material"
              value={tipoFilter}
              onChange={onTipoFilterChange}
              options={opcionesTipo}
            />
          </FormRow>

          {ubiSel && (
            <p className="kpi-sub" style={{ marginBottom: '0.75rem' }}>
              {etiquetaFamiliaUbicacion(ubiSel)}
              {' · '}
              Tipos disponibles: {resumenTiposPermitidos(tiposPermitidos)}.
              {isPuntoVenta(ubiSel) ? ' El ajuste en PV afecta ventas/despacho.' : ''}
            </p>
          )}

          {loadingItems && <p className="kpi-sub">Cargando ítems / SKUs de este almacén…</p>}
          {!loadingItems && itemsFiltrados.length === 0 && (
            <p className="kpi-sub">
              {itemsStock.length === 0
                ? 'No hay ítems activos compatibles con este almacén.'
                : 'No hay ítems de ese tipo en este almacén. Cambie el filtro.'}
            </p>
          )}

          <FormSelect
            label={
              tiposPermitidos.length === 1 && tiposPermitidos[0] === 'PT'
                ? 'SKU (producto terminado)'
                : 'Ítem / SKU'
            }
            value={selectedKey}
            onChange={onItemChange}
            required
            options={[
              {
                value: '',
                label: itemsFiltrados.length
                  ? '— Seleccionar —'
                  : 'Sin coincidencias',
              },
              ...itemsFiltrados.map((o) => ({
                value: o.key,
                label: `[${o.tipo}] ${o.nombre} · stock ${fmtNum(o.stockTeorico, 2)} ${o.unidadMedida ?? ''}`,
              })),
            ]}
          />

          {selected?.isProducto && packFactores.length > 0 && (
            <CantidadEmpaqueToggle
              modo={modoEmpaque}
              onChange={onModoEmpaqueChange}
              cantUnidades={factorPack}
              packFactores={packFactores}
              onFactorChange={onFactorPackChange}
            />
          )}

          {selected && (
            <p className="qty-base-summary">
              Stock de referencia: {fmtNum(stockReferencia, 2)} {selected.unidadMedida ?? ''}
              {loteId !== LOTE_AUTO ? ' (lote seleccionado)' : ''}
              {selected.isProducto ? ' · inventario en botellas' : ''}
              {usaPack ? ` · ingresando packs (×${factorPack})` : ''}
              {selected.stockTeorico === 0 ? ' — puede sembrar stock con conteo > 0' : ''}
            </p>
          )}

          <FormSelect
            label="Lote"
            value={loteId}
            onChange={onLoteChange}
            options={[
              { value: LOTE_AUTO, label: 'Automático (FIFO/FEFO o lote nuevo si ingreso)' },
              ...lotes.map((l) => ({ value: l.lote_id as string, label: labelLote(l) })),
            ]}
          />

          <FormInput
            label={
              selected?.isProducto
                ? (usaPack ? `Conteo físico (packs ×${factorPack})` : 'Conteo físico (botellas)')
                : `Conteo físico (${selected?.unidadMedida ?? 'uds'})`
            }
            type="number"
            value={conteo}
            onChange={setConteo}
            required
            min={0}
            step="any"
          />

          {delta != null && conteoEnInventario != null && (
            <p className={`qty-base-summary ${delta === 0 ? '' : delta > 0 ? 'text-ok' : 'text-danger'}`}>
              Delta inventario: {delta > 0 ? '+' : ''}{fmtNum(delta, 2)}{' '}
              {selected?.unidadMedida ?? ''}
              {usaPack && Number.isFinite(conteoNum) && (
                <> · ({fmtNum(conteoNum, 2)} pack(s) = {fmtNum(conteoEnInventario, 2)} bot.)</>
              )}
            </p>
          )}

          <FormSelect
            label="Motivo (preset)"
            value={motivoPreset}
            onChange={onMotivoPreset}
            options={MOTIVO_PRESETS.map((m) => ({ value: m, label: m }))}
            required
          />
          <FormInput label="Motivo (texto en ledger)" value={motivo} onChange={setMotivo} required />
          <div className="form-actions">
            <SubmitButton loading={loading} label="Registrar ajuste" icon="tune" />
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAdjustPage;
