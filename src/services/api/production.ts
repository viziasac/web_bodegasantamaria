/**
 * Órdenes de producción y validación de insumos.
 */
import { supabase } from '../supabaseClient';
import { Tables } from '../../config/supabaseTables';
import { ErpRpc } from '../../config/erpContract';
import { newTxnId } from '../../utils/txnId';
import { callRpc, getUserId, hoyYmd, parseNum } from './core';
import { getItems, getPresentaciones } from './catalog';
import { getRecetas } from './recipes';
import type { PrdOrden, InsumoValidacionOrden } from '../../types';

export async function getOrdenes(estado?: string): Promise<PrdOrden[]> {
  let q = supabase
    .from(Tables.prdOrden)
    .select(`
      *,
      ma_item:item_producido_id(id, codigo, nombre, tipo),
      ma_presentacion:presentacion_id(id, codigo, nombre, cant_unidades, item_id)
    `)
    .order('fecha_inicio', { ascending: false });
  if (estado) q = q.eq('estado', estado);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function resolveItemPtId(presentacionOrPtId: string): Promise<string> {
  const { data: pres } = await supabase
    .from(Tables.maPresentacion)
    .select('item_id')
    .eq('id', presentacionOrPtId)
    .maybeSingle();
  if (pres?.item_id) return String(pres.item_id);
  const { data: item } = await supabase
    .from(Tables.maItem)
    .select('id, tipo')
    .eq('id', presentacionOrPtId)
    .maybeSingle();
  if (item?.tipo === 'PT') return String(item.id);
  return presentacionOrPtId;
}

async function stockPorItemEnUbicacion(ubicacionId: string | undefined): Promise<Record<string, number>> {
  if (!ubicacionId) return {};
  const { data: stockRows, error: stockErr } = await supabase
    .from(Tables.invStockSaldo)
    .select('item_id, cantidad')
    .eq('ubicacion_id', ubicacionId)
    .gt('cantidad', 0);
  if (stockErr) throw stockErr;
  const stockPorItem: Record<string, number> = {};
  for (const r of stockRows ?? []) {
    const id = String(r.item_id);
    stockPorItem[id] = (stockPorItem[id] ?? 0) + parseNum(r.cantidad);
  }
  return stockPorItem;
}

/** Preview alineado con fn_validar_insumos_orden: GRANEL en ALM_GR; resto en ALM_MP. */
export async function validarInsumosPreview(opts: {
  itemProducidoId: string;
  cantPlanificada: number;
}): Promise<InsumoValidacionOrden[]> {
  const ptId = await resolveItemPtId(opts.itemProducidoId);
  const { data: ubiRows } = await supabase
    .from(Tables.catUbicacion)
    .select('id, codigo')
    .in('codigo', ['ALM_MP', 'ALM_GR']);
  const almMpId = (ubiRows ?? []).find((u) => u.codigo === 'ALM_MP')?.id as string | undefined;
  const almGrId = (ubiRows ?? []).find((u) => u.codigo === 'ALM_GR')?.id as string | undefined;
  if (!almMpId) return [];

  const recetas = await getRecetas();
  const componentes = recetas.filter((r) => r.item_producido_id === ptId);
  if (componentes.length === 0) return [];

  const [stockMp, stockGr] = await Promise.all([
    stockPorItemEnUbicacion(almMpId),
    stockPorItemEnUbicacion(almGrId),
  ]);

  return componentes.map((r) => {
    const compId = r.componente_id ?? r.item_componente_id;
    const comp = r.componente ?? r.ma_item_componente;
    const tipo = (comp?.tipo ?? '').toUpperCase();
    const esGranel = tipo === 'GRANEL';
    const req = r.cantidad * opts.cantPlanificada;
    const disp = esGranel ? (stockGr[compId] ?? 0) : (stockMp[compId] ?? 0);
    const faltante = Math.max(0, req - disp);
    return {
      item_id: compId,
      codigo: comp?.codigo,
      nombre: comp?.nombre ?? '—',
      unidad_medida: comp?.unidad_medida,
      tipo: tipo || undefined,
      ubicacion_codigo: esGranel ? 'ALM_GR' : 'ALM_MP',
      requerido: req,
      disponible: disp,
      faltante,
      suficiente: disp >= req,
    };
  });
}

export async function checkStockProduccion(
  presentacionOrPtId: string,
  cantidadBotellas: number,
): Promise<{
  tiene_stock: boolean;
  detalle: {
    nombre: string;
    codigo?: string;
    tipo?: string;
    ubicacion_codigo?: 'ALM_GR' | 'ALM_MP';
    necesario: number;
    disponible: number;
    faltante: number;
  }[];
}> {
  const preview = await validarInsumosPreview({
    itemProducidoId: presentacionOrPtId,
    cantPlanificada: Math.round(cantidadBotellas),
  });
  const detalle = preview.map((v) => ({
    nombre: v.nombre,
    codigo: v.codigo,
    tipo: v.tipo,
    ubicacion_codigo: v.ubicacion_codigo,
    necesario: v.requerido,
    disponible: v.disponible,
    faltante: v.faltante,
  }));
  return {
    tiene_stock: preview.length > 0 && preview.every((v) => v.suficiente),
    detalle,
  };
}

export async function validarInsumosOrden(ordenId: string): Promise<InsumoValidacionOrden[]> {
  const { data, error } = await supabase.rpc(ErpRpc.validarInsumosOrden, { p_orden_id: ordenId });
  if (error) throw error;
  return ((data as Record<string, unknown>[]) || []).map((r) => {
    const requerido = parseNum(r.cantidad_req ?? r.requerido);
    const disponible = parseNum(r.cantidad_disp ?? r.disponible);
    const faltante = parseNum(r.faltante ?? Math.max(0, requerido - disponible));
    const tipo = r.tipo ? String(r.tipo).toUpperCase() : undefined;
    const esGranel = tipo === 'GRANEL';
    return {
      item_id: String(r.item_id ?? ''),
      codigo: r.codigo ? String(r.codigo) : undefined,
      nombre: String(r.nombre ?? r.item_nombre ?? '—'),
      unidad_medida: r.unidad_medida ? String(r.unidad_medida) : undefined,
      tipo,
      ubicacion_codigo: esGranel ? 'ALM_GR' : 'ALM_MP',
      requerido,
      disponible,
      faltante,
      suficiente: r.tiene_todo === true || r.suficiente === true || faltante <= 0,
    };
  });
}

export async function crearOrdenProduccion(opts: {
  itemProducidoId: string;
  cantidadProgramada: number;
  ubicacionDestinoId?: string;
  observaciones?: string;
  txnId?: string;
  presentacionId?: string;
  modoCantidad?: 'BOTELLA' | 'PACK';
}): Promise<string> {
  const uid = await getUserId();
  const nroData = await callRpc<string | number>(ErpRpc.generarNroOrden, { p_fecha: hoyYmd() }, 'No se pudo generar número de orden');
  const txnId = opts.txnId ?? newTxnId();
  const { data, error } = await supabase
    .from(Tables.prdOrden)
    .insert({
      nro_orden: String(nroData),
      item_producido_id: opts.itemProducidoId,
      cant_planificada: Math.round(opts.cantidadProgramada),
      estado: 'BORRADOR',
      ubicacion_destino_id: opts.ubicacionDestinoId ?? null,
      observaciones: opts.observaciones ?? null,
      presentacion_id: opts.presentacionId ?? null,
      modo_cantidad: opts.modoCantidad ?? 'BOTELLA',
      usuario_id: uid ?? null,
      txn_id: txnId,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}
