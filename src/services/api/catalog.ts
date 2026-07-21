/**
 * Catálogos maestros (ubicaciones, items, presentaciones, partners, etc.).
 */
import { supabase } from '../supabaseClient';
import { Tables } from '../../config/supabaseTables';
import { friendlyDbError } from '../../utils/erpErrors';
import { getUserId, parseNum } from './core';
import type {
  CatUbicacion, MaItem, MaPresentacion, MaEmpaqueTipo, MaProveedor, MaCliente, GasCategoria,
} from '../../types';

export async function getUbicaciones(opts?: { soloPuntoVenta?: boolean }): Promise<CatUbicacion[]> {
  let q = supabase
    .from(Tables.catUbicacion)
    .select('id, codigo, nombre, tipo, es_punto_venta, activo')
    .eq('activo', true)
    .order('nombre');
  if (opts?.soloPuntoVenta) q = q.eq('es_punto_venta', true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getCanalesVenta() {
  const { data, error } = await supabase.from(Tables.catCanalVenta).select('*').order('nombre');
  if (error) throw error;
  return data || [];
}

export async function getItems(opts?: { tipo?: string; includeInactive?: boolean }): Promise<MaItem[]> {
  let q = supabase.from(Tables.maItem).select('*').order('nombre');
  if (!opts?.includeInactive) q = q.eq('activo', true);
  if (opts?.tipo) q = q.eq('tipo', opts.tipo);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getInsumos(): Promise<MaItem[]> {
  const items = await getItems();
  return items.filter((i) => {
    const t = (i.tipo ?? '').trim().toUpperCase();
    return t.length > 0 && t !== 'PT';
  });
}

export async function getItemsGranel(): Promise<MaItem[]> {
  return getItems({ tipo: 'GRANEL' });
}

export async function getItemsPt(): Promise<MaItem[]> {
  return getItems({ tipo: 'PT' });
}

export async function getPresentaciones(itemId?: string, opts?: { includeInactive?: boolean }): Promise<MaPresentacion[]> {
  let q = supabase
    .from(Tables.maPresentacion)
    .select('*, ma_item(id, codigo, nombre, tipo, unidad_medida, categoria), ma_empaque_tipo:empaque_id(id, nombre, factor)')
    .order('nombre');
  if (!opts?.includeInactive) q = q.eq('activo', true);
  if (itemId) q = q.eq('item_id', itemId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((p: Record<string, unknown>) => ({
    ...p,
    ma_empaque_tipo: p.ma_empaque_tipo as MaEmpaqueTipo | undefined,
  })) as MaPresentacion[];
}

export async function getEmpaqueTipos(): Promise<MaEmpaqueTipo[]> {
  const { data, error } = await supabase
    .from(Tables.maEmpaqueTipo)
    .select('id, nombre, factor, activo')
    .eq('activo', true)
    .order('factor');
  if (error) throw error;
  return (data || []).map((e) => ({
    id: String(e.id),
    nombre: String(e.nombre),
    factor: parseNum(e.factor) || 1,
    activo: e.activo !== false,
  }));
}

export async function createItem(opts: {
  codigo: string;
  nombre: string;
  tipo: string;
  unidad_medida: string;
  categoria?: string;
  stock_minimo?: number;
  granel_base_id?: string;
  pct_merma?: number;
}): Promise<MaItem> {
  const codigo = opts.codigo.trim().toUpperCase();
  if (!codigo || codigo.length > 6) throw new Error('Código de ítem: máximo 6 caracteres.');
  if (!opts.nombre.trim()) throw new Error('Nombre obligatorio.');
  if (!opts.tipo) throw new Error('Tipo obligatorio.');
  if (!opts.unidad_medida.trim()) throw new Error('Unidad de medida obligatoria.');

  const payload: Record<string, unknown> = {
    codigo,
    nombre: opts.nombre.trim(),
    tipo: opts.tipo,
    unidad_medida: opts.unidad_medida.trim(),
    activo: true,
    stock_minimo: opts.stock_minimo ?? 0,
    pct_merma: opts.pct_merma ?? 0,
  };
  if (opts.categoria?.trim()) payload.categoria = opts.categoria.trim();
  if (opts.tipo === 'PT' && opts.granel_base_id) payload.granel_base_id = opts.granel_base_id;

  const { data, error } = await supabase
    .from(Tables.maItem)
    .insert(payload)
    .select('*')
    .single();
  if (error) throw new Error(friendlyDbError(error));
  return data as MaItem;
}

export async function updateItem(opts: {
  id: string;
  nombre?: string;
  categoria?: string | null;
  stock_minimo?: number;
  unidad_medida?: string;
  activo?: boolean;
  granel_base_id?: string | null;
  pct_merma?: number;
}): Promise<MaItem> {
  const patch: Record<string, unknown> = {};
  if (opts.nombre != null) patch.nombre = opts.nombre.trim();
  if (opts.categoria !== undefined) patch.categoria = opts.categoria?.trim() || null;
  if (opts.stock_minimo != null) patch.stock_minimo = opts.stock_minimo;
  if (opts.unidad_medida != null) patch.unidad_medida = opts.unidad_medida.trim();
  if (opts.activo != null) patch.activo = opts.activo;
  if (opts.granel_base_id !== undefined) patch.granel_base_id = opts.granel_base_id;
  if (opts.pct_merma != null) patch.pct_merma = opts.pct_merma;
  if (Object.keys(patch).length === 0) throw new Error('Sin cambios.');

  const { data, error } = await supabase
    .from(Tables.maItem)
    .update(patch)
    .eq('id', opts.id)
    .select('*')
    .single();
  if (error) throw new Error(friendlyDbError(error));
  return data as MaItem;
}

export async function createPresentacion(opts: {
  codigo: string;
  nombre: string;
  itemId: string;
  empaqueId: string;
  cantUnidades?: number;
}): Promise<MaPresentacion> {
  const codigo = opts.codigo.trim().toUpperCase();
  if (!codigo || codigo.length > 5) throw new Error('Código SKU: máximo 5 caracteres.');
  if (!opts.nombre.trim()) throw new Error('Nombre obligatorio.');
  if (!opts.itemId) throw new Error('Seleccione el ítem PT.');
  if (!opts.empaqueId) throw new Error('Seleccione tipo de empaque.');

  const empaques = await getEmpaqueTipos();
  const emp = empaques.find((e) => e.id === opts.empaqueId);
  if (!emp) throw new Error('Empaque no encontrado.');
  const cant = opts.cantUnidades ?? emp.factor;
  if (cant !== emp.factor) {
    throw new Error(`cant_unidades debe coincidir con el factor del empaque (${emp.factor}).`);
  }

  const { data, error } = await supabase
    .from(Tables.maPresentacion)
    .insert({
      codigo,
      nombre: opts.nombre.trim(),
      item_id: opts.itemId,
      empaque_id: opts.empaqueId,
      cant_unidades: cant,
      activo: true,
    })
    .select('*, ma_item(id, codigo, nombre, tipo), ma_empaque_tipo:empaque_id(id, nombre, factor)')
    .single();
  if (error) throw new Error(friendlyDbError(error));
  return data as MaPresentacion;
}

export async function updatePresentacion(opts: {
  id: string;
  nombre?: string;
  activo?: boolean;
}): Promise<MaPresentacion> {
  const patch: Record<string, unknown> = {};
  if (opts.nombre != null) patch.nombre = opts.nombre.trim();
  if (opts.activo != null) patch.activo = opts.activo;
  if (Object.keys(patch).length === 0) throw new Error('Sin cambios.');

  const { data, error } = await supabase
    .from(Tables.maPresentacion)
    .update(patch)
    .eq('id', opts.id)
    .select('*, ma_item(id, codigo, nombre, tipo), ma_empaque_tipo:empaque_id(id, nombre, factor)')
    .single();
  if (error) throw new Error(friendlyDbError(error));
  return data as MaPresentacion;
}

export async function getProveedores(): Promise<MaProveedor[]> {
  const { data, error } = await supabase.from(Tables.maProveedor).select('*').eq('activo', true).order('nombre');
  if (error) throw error;
  return data || [];
}

export async function getClientes(): Promise<MaCliente[]> {
  const { data, error } = await supabase.from(Tables.maCliente).select('*').eq('activo', true).order('nombre');
  if (error) throw error;
  return data || [];
}

export async function getCategoriasGasto(): Promise<GasCategoria[]> {
  const { data, error } = await supabase.from(Tables.gasCategoria).select('*').eq('activo', true).order('nombre');
  if (error) throw error;
  return data || [];
}

export async function upsertProveedor(opts: {
  id?: string;
  nombre: string;
  codigo?: string | null;
  tipo?: string | null;
  ruc?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  condicion_pago?: string | null;
  contacto_nombre?: string | null;
  direccion?: string | null;
  distrito?: string | null;
  telefono?: string | null;
  email?: string | null;
  observaciones?: string | null;
  es_default?: boolean;
  activo?: boolean;
}): Promise<MaProveedor> {
  const nombre = opts.nombre.trim();
  if (!nombre) throw new Error('Nombre de proveedor obligatorio.');
  const numDoc = opts.numero_documento?.trim() || opts.ruc?.trim() || null;
  const tipoDoc = opts.tipo_documento?.trim()
    || (numDoc ? 'RUC' : null);
  const payload: Record<string, unknown> = {
    nombre,
    codigo: opts.codigo?.trim().toUpperCase() || null,
    tipo: opts.tipo?.trim().toUpperCase() || null,
    ruc: numDoc,
    tipo_documento: tipoDoc,
    numero_documento: numDoc,
    condicion_pago: opts.condicion_pago?.trim().toUpperCase() || 'CONTADO',
    contacto_nombre: opts.contacto_nombre?.trim() || null,
    direccion: opts.direccion?.trim() || null,
    distrito: opts.distrito?.trim() || null,
    telefono: opts.telefono?.trim() || null,
    email: opts.email?.trim() || null,
    observaciones: opts.observaciones?.trim() || null,
    es_default: opts.es_default ?? false,
    activo: opts.activo ?? true,
  };
  if (opts.es_default) {
    const { error: clearErr } = await supabase.from(Tables.maProveedor).update({ es_default: false }).neq('id', opts.id ?? '00000000-0000-0000-0000-000000000000');
    if (clearErr) throw new Error(friendlyDbError(clearErr));
  }
  if (opts.id) {
    const { data, error } = await supabase.from(Tables.maProveedor).update(payload).eq('id', opts.id).select('*').single();
    if (error) throw new Error(friendlyDbError(error));
    return data as MaProveedor;
  }
  const { data, error } = await supabase.from(Tables.maProveedor).insert(payload).select('*').single();
  if (error) throw new Error(friendlyDbError(error));
  return data as MaProveedor;
}

export async function upsertCliente(opts: {
  id?: string;
  nombre: string;
  codigo?: string | null;
  tipo?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  condicion_pago?: string | null;
  direccion?: string | null;
  distrito?: string | null;
  telefono?: string | null;
  email?: string | null;
  es_default?: boolean;
  activo?: boolean;
}): Promise<MaCliente> {
  const nombre = opts.nombre.trim();
  if (!nombre) throw new Error('Nombre de cliente obligatorio.');
  const numDoc = opts.numero_documento?.trim() || null;
  const payload: Record<string, unknown> = {
    nombre,
    codigo: opts.codigo?.trim().toUpperCase() || null,
    tipo: opts.tipo?.trim().toUpperCase() || null,
    tipo_documento: opts.tipo_documento?.trim().toUpperCase() || null,
    numero_documento: numDoc,
    ruc_dni: numDoc,
    condicion_pago: opts.condicion_pago?.trim().toUpperCase() || 'CONTADO',
    direccion: opts.direccion?.trim() || null,
    distrito: opts.distrito?.trim() || null,
    telefono: opts.telefono?.trim() || null,
    email: opts.email?.trim() || null,
    es_default: opts.es_default ?? false,
    activo: opts.activo ?? true,
  };
  if (opts.es_default) {
    const { error: clearErr } = await supabase.from(Tables.maCliente).update({ es_default: false }).neq('id', opts.id ?? '00000000-0000-0000-0000-000000000000');
    if (clearErr) throw new Error(friendlyDbError(clearErr));
  }
  if (opts.id) {
    const { data, error } = await supabase.from(Tables.maCliente).update(payload).eq('id', opts.id).select('*').single();
    if (error) throw new Error(friendlyDbError(error));
    return data as MaCliente;
  }
  const { data, error } = await supabase.from(Tables.maCliente).insert(payload).select('*').single();
  if (error) throw new Error(friendlyDbError(error));
  return data as MaCliente;
}

/** Cambia flag activo (baja lógica; el registro permanece en BD). */
export async function setProveedorActivo(id: string, activo: boolean): Promise<MaProveedor> {
  const { data: row, error: readErr } = await supabase
    .from(Tables.maProveedor).select('id, es_default, nombre').eq('id', id).maybeSingle();
  if (readErr) throw new Error(friendlyDbError(readErr));
  if (!row) throw new Error('Proveedor no encontrado.');
  if (row.es_default && !activo) {
    throw new Error('No puede desactivar el proveedor predeterminado del sistema.');
  }

  const { data, error } = await supabase
    .from(Tables.maProveedor)
    .update({ activo })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(friendlyDbError(error));
  return data as MaProveedor;
}

export async function setClienteActivo(id: string, activo: boolean): Promise<MaCliente> {
  const { data: row, error: readErr } = await supabase
    .from(Tables.maCliente).select('id, es_default, nombre').eq('id', id).maybeSingle();
  if (readErr) throw new Error(friendlyDbError(readErr));
  if (!row) throw new Error('Cliente no encontrado.');
  if (row.es_default && !activo) {
    throw new Error('No puede desactivar el cliente predeterminado del sistema.');
  }

  const { data, error } = await supabase
    .from(Tables.maCliente)
    .update({ activo })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(friendlyDbError(error));
  return data as MaCliente;
}

export async function upsertCanalVenta(opts: {
  codigo?: string;
  nombre: string;
  /** Update by existing codigo */
  codigoOriginal?: string;
}): Promise<{ codigo: string; nombre: string }> {
  const nombre = opts.nombre.trim();
  const codigo = (opts.codigo ?? opts.codigoOriginal ?? '').trim().toUpperCase();
  if (!nombre) throw new Error('Nombre de canal obligatorio.');
  if (!codigo) throw new Error('Código de canal obligatorio.');
  if (opts.codigoOriginal) {
    const { data, error } = await supabase
      .from(Tables.catCanalVenta)
      .update({ nombre })
      .eq('codigo', opts.codigoOriginal)
      .select('*')
      .single();
    if (error) throw new Error(friendlyDbError(error));
    return data as { codigo: string; nombre: string };
  }
  const { data, error } = await supabase
    .from(Tables.catCanalVenta)
    .insert({ codigo, nombre })
    .select('*')
    .single();
  if (error) throw new Error(friendlyDbError(error));
  return data as { codigo: string; nombre: string };
}

export async function upsertEmpaqueTipo(opts: {
  id?: string;
  nombre: string;
  factor: number;
  activo?: boolean;
}): Promise<MaEmpaqueTipo> {
  const nombre = opts.nombre.trim();
  if (!nombre) throw new Error('Nombre de empaque obligatorio.');
  if (!Number.isFinite(opts.factor) || opts.factor < 1) throw new Error('Factor debe ser ≥ 1.');
  const payload: Record<string, unknown> = {
    nombre,
    factor: Math.round(opts.factor),
    activo: opts.activo ?? true,
  };
  if (opts.id) {
    const { data, error } = await supabase.from(Tables.maEmpaqueTipo).update(payload).eq('id', opts.id).select('*').single();
    if (error) throw new Error(friendlyDbError(error));
    return data as MaEmpaqueTipo;
  }
  const { data, error } = await supabase.from(Tables.maEmpaqueTipo).insert(payload).select('*').single();
  if (error) throw new Error(friendlyDbError(error));
  return data as MaEmpaqueTipo;
}

export async function upsertCategoriaGasto(opts: {
  id?: string;
  nombre: string;
  centro_costo?: string;
  activo?: boolean;
}): Promise<GasCategoria> {
  const nombre = opts.nombre.trim();
  if (!nombre) throw new Error('Nombre de categoría obligatorio.');
  const payload: Record<string, unknown> = {
    nombre,
    centro_costo: opts.centro_costo?.trim() || null,
    activo: opts.activo ?? true,
  };
  if (opts.id) {
    const { data, error } = await supabase.from(Tables.gasCategoria).update(payload).eq('id', opts.id).select('*').single();
    if (error) throw new Error(friendlyDbError(error));
    return data as GasCategoria;
  }
  const { data, error } = await supabase.from(Tables.gasCategoria).insert(payload).select('*').single();
  if (error) throw new Error(friendlyDbError(error));
  return data as GasCategoria;
}

export async function listMaestrosAdmin() {
  const [proveedores, clientes, canales, empaques, categorias] = await Promise.all([
    supabase.from(Tables.maProveedor).select('*').order('nombre'),
    supabase.from(Tables.maCliente).select('*').order('nombre'),
    supabase.from(Tables.catCanalVenta).select('*').order('nombre'),
    supabase.from(Tables.maEmpaqueTipo).select('*').order('factor'),
    supabase.from(Tables.gasCategoria).select('*').order('nombre'),
  ]);
  for (const r of [proveedores, clientes, canales, empaques, categorias]) {
    if (r.error) throw new Error(friendlyDbError(r.error));
  }
  return {
    proveedores: (proveedores.data || []) as MaProveedor[],
    clientes: (clientes.data || []) as MaCliente[],
    canales: (canales.data || []) as { codigo: string; nombre: string }[],
    empaques: (empaques.data || []) as MaEmpaqueTipo[],
    categorias: (categorias.data || []) as GasCategoria[],
  };
}

export async function getPrecioReferencia(presentacionId: string, segmento = 'GENERAL'): Promise<number | null> {
  const { data } = await supabase
    .from(Tables.venPrecioRef)
    .select('precio_minimo')
    .eq('presentacion_id', presentacionId)
    .eq('segmento', segmento)
    .eq('activo', true)
    .order('vigente_desde', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.precio_minimo != null ? Number(data.precio_minimo) : null;
}
