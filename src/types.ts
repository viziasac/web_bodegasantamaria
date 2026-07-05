// src/types.ts — Esquema Jul 2026 alineado a app INPUT

export type UserRole = 'admin' | 'administrador' | 'supervisor' | 'operario';

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface CatUbicacion {
  id: string;
  codigo: string;
  nombre: string;
  tipo?: string;
  es_punto_venta: boolean;
  activo?: boolean;
}

export interface MaItem {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  unidad_medida: string;
  stock_minimo: number;
  activo: boolean;
  categoria?: string | null;
}

export interface MaPresentacion {
  id: string;
  item_id: string;
  codigo?: string;
  nombre: string;
  cant_unidades?: number;
  activo?: boolean;
  ma_item?: MaItem;
}

export interface MaProveedor {
  id: string;
  nombre: string;
  ruc?: string;
  activo?: boolean;
}

export interface MaCliente {
  id: string;
  nombre: string;
  tipo?: string;
  activo?: boolean;
}

export interface InvLote {
  id: string;
  nro_lote?: string;
  codigo_lote?: string;
  item_id: string;
  fecha_produccion?: string;
  fecha_vencimiento?: string | null;
  estado?: string;
}

export interface InvMovimiento {
  id: string;
  fecha: string;
  ubicacion_id: string;
  item_id: string | null;
  presentacion_id?: string | null;
  cantidad: number;
  tipo_mov: string;
  lote_id?: string | null;
  motivo?: string | null;
  observacion?: string | null;
  usuario_id?: string | null;
  cat_ubicacion?: CatUbicacion;
  ma_item?: MaItem;
  ma_presentacion?: MaPresentacion;
}

export interface InvStockSaldo {
  id: string;
  ubicacion_id: string;
  item_id: string;
  lote_id: string;
  cantidad: number;
  cat_ubicacion?: CatUbicacion;
  ma_item?: MaItem;
  inv_lote?: InvLote;
}

export interface PrdOrden {
  id: string;
  nro_orden: string;
  item_producido_id: string;
  presentacion_id?: string | null;
  modo_cantidad?: string | null;
  cant_planificada: number;
  cant_real?: number | null;
  estado: string;
  ubicacion_destino_id?: string | null;
  fecha_inicio?: string;
  fecha_completada?: string | null;
  observaciones?: string | null;
  ma_item?: MaItem;
  ma_presentacion?: MaPresentacion;
}

export interface RecReceta {
  id: string;
  item_producido_id: string;
  item_componente_id: string;
  cantidad: number;
  unidad?: string;
  ma_item_producido?: MaItem;
  ma_item_componente?: MaItem;
}

export interface GasCategoria {
  id: string;
  nombre: string;
  centro_costo?: string;
  activo?: boolean;
}

export interface GasGasto {
  id: string;
  fecha: string;
  monto: number;
  descripcion?: string;
  categoria_id?: string;
  comprobante_url?: string | null;
  gas_categoria?: GasCategoria;
}

export interface TrnTransferencia {
  id: string;
  nro_transferencia?: string;
  origen_id: string;
  destino_id: string;
  estado: string;
  fecha_creacion?: string;
  fecha_recepcion?: string | null;
  observaciones?: string | null;
  origen?: CatUbicacion;
  destino?: CatUbicacion;
}

export interface InsumoValidacionOrden {
  item_id: string;
  codigo?: string;
  nombre: string;
  unidad_medida?: string;
  requerido: number;
  disponible: number;
  faltante: number;
  suficiente: boolean;
}

export interface StockResumenItem {
  item_id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  categoria?: string | null;
  unidad_medida: string;
  stock_minimo: number;
  stock_total: number;
  bajo_minimo?: boolean;
}

export interface InventarioFila {
  almacen_id: string;
  almacen_codigo: string;
  almacen_nombre: string;
  es_punto_venta: boolean;
  item_id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  categoria: string;
  unidad_medida: string;
  stock_total: number;
  lotes_count: number;
  stock_minimo: number;
  bajo_minimo: boolean;
}

export interface AlmacenResumenInv {
  almacen_id: string;
  almacen_codigo: string;
  almacen_nombre: string;
  es_punto_venta: boolean;
  sku_count: number;
  lotes_count: number;
  total_cantidad: number;
  alertas: number;
  por_tipo: Record<string, { skus: number; cantidad: number }>;
}

export interface VentaResumen {
  id: string;
  fecha: string;
  nro_venta?: string;
  total: number;
  canal?: string;
  tipo?: string;
  observaciones?: string | null;
  cat_ubicacion?: CatUbicacion;
  ma_cliente?: MaCliente;
}

export interface DashboardKPIs {
  totalStockPT: number;
  totalStockInsumos: number;
  alertasStockBajo: number;
  movimientosHoy: number;
  gastosDelMes: number;
  produccionMes: number;
  ventasMes?: number;
  ventasMesCount?: number;
}

export interface MovimientoTrendDia {
  fecha: string;
  entradas: number;
  salidas: number;
  ajustes: number;
  merma: number;
}

export interface AjusteTopItem {
  itemId: string;
  itemNombre: string;
  ubicacionNombre: string;
  deltaNeto: number;
  volumenAbs: number;
  count: number;
}

export interface AjustePorUbicacion {
  ubicacion: string;
  volumenAbs: number;
  count: number;
}

export interface DashboardEjecutivoData {
  totalVentas: number;
  totalGastos: number;
  balance: number;
  produccionReal: number;
  ajustesCount: number;
  ajustesVolumenAbs: number;
  ajustesDeltaNeto: number;
  mermaCount: number;
  mermaVolumen: number;
  impactoAjustesPct: number;
  prodPlan: number;
  prodReal: number;
  prodCumplimiento: number;
  topAjustes: AjusteTopItem[];
  ajustesPorUbicacion: AjustePorUbicacion[];
  alertasStock: StockResumenItem[];
  transferenciasPendientes: number;
  ordenesBorrador: number;
}

export interface MovimientoFilters {
  tipo_mov?: string;
  ubicacion_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  limit?: number;
}

export interface ModuleDef {
  id: string;
  title: string;
  icon: string;
  subtitle: string;
  path: string;
  adminOnly?: boolean;
}

export interface VentaLinea {
  item_id: string;
  lote_id: string;
  cantidad: number;
  precio_unitario: number;
  presentacion_id?: string;
}

export interface CompraLinea {
  item_id: string;
  cantidad: number;
  precio_unitario?: number;
  fecha_vencimiento?: string;
}

export interface TransferLinea {
  item_id?: string;
  presentacion_id?: string;
  lote_id?: string;
  cantidad: number;
}

/** Presentación comercial para venta / despacho */
export interface ProductoPv {
  presentacion_id: string;
  item_id: string;
  nombre: string;
  cant_unidades: number;
  stock_item: number;
  categoria?: string | null;
  item_nombre?: string;
}

/** Ítem seleccionable en ajuste por conteo físico */
export interface AjusteItemOption {
  key: string;
  id: string;
  nombre: string;
  isProducto: boolean;
  presentacionId?: string;
  stockTeorico: number;
  unidadMedida?: string;
}

export interface EgresoLineaDraft {
  id: string;
  descripcion: string;
  monto: number;
  categoriaId: string;
  categoriaNombre?: string;
  proveedorNombre?: string;
  tipoDocumento?: string;
  nroDocumento?: string;
}
