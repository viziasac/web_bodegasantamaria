/**
 * Capa de negocio — port simplificado de bodega_service.dart
 */
import * as api from './apiProvider';
import { newTxnId } from '../utils/txnId';
import type {
  VentaLinea, CompraLinea, TransferLinea, ProductoPv, AjusteItemOption, EgresoLineaDraft,
} from '../types';

export const bodegaService = {
  ...api,

  async ensureCatalogLoaded() {
    await Promise.all([
      api.getUbicaciones(),
      api.getItems(),
      api.getPresentaciones(),
      api.getCategoriasGasto(),
      api.getCanalesVenta(),
      api.getProveedores(),
      api.getClientes(),
    ]);
  },

  async productosParaPuntoVenta(ubicacionId: string): Promise<ProductoPv[]> {
    const [presentaciones, stockRows] = await Promise.all([
      api.getPresentaciones(),
      api.getPresentacionesConStock(ubicacionId),
    ]);
    const stockByItem = Object.fromEntries(
      stockRows.map((r) => [r.item_id as string, r.stock_item as number]),
    );
    return presentaciones
      .filter((p) => p.ma_item?.tipo === 'PT')
      .map((p) => ({
        presentacion_id: p.id,
        item_id: p.item_id,
        nombre: p.nombre,
        cant_unidades: p.cant_unidades ?? 1,
        stock_item: stockByItem[p.item_id] ?? 0,
        categoria: p.ma_item?.categoria,
        item_nombre: p.ma_item?.nombre,
      }));
  },

  async itemsConStockParaAjuste(ubicacionId: string): Promise<AjusteItemOption[]> {
    const [stockItems, presRows, allItems, allPres] = await Promise.all([
      api.getStockAgregadoPorUbicacion(ubicacionId),
      api.getPresentacionesConStock(ubicacionId),
      api.getItems(),
      api.getPresentaciones(),
    ]);
    const options: AjusteItemOption[] = [];
    const seenPres = new Set<string>();
    const seenItems = new Set<string>();

    for (const p of presRows) {
      const stock = p.stock_item as number;
      seenPres.add(p.presentacion_id as string);
      seenItems.add(p.item_id as string);
      options.push({
        key: `P:${p.presentacion_id}`,
        id: p.item_id as string,
        presentacionId: p.presentacion_id as string,
        nombre: `${p.nombre} (${p.item_nombre ?? 'PT'})${stock <= 0 ? ' · sin stock' : ''}`,
        isProducto: true,
        stockTeorico: stock,
        unidadMedida: 'bot.',
      });
    }

    // PT presentations with zero stock (conteo inicial / sembrar)
    for (const p of allPres) {
      if (p.ma_item?.tipo !== 'PT' || !p.activo) continue;
      if (seenPres.has(p.id)) continue;
      seenPres.add(p.id);
      options.push({
        key: `P:${p.id}`,
        id: p.item_id,
        presentacionId: p.id,
        nombre: `${p.nombre} (${p.ma_item?.nombre ?? 'PT'}) · sin stock`,
        isProducto: true,
        stockTeorico: 0,
        unidadMedida: 'bot.',
      });
    }

    for (const row of stockItems) {
      if (row.tipo === 'PT') continue;
      seenItems.add(row.item_id);
      options.push({
        key: `I:${row.item_id}`,
        id: row.item_id,
        nombre: `${row.codigo} — ${row.nombre}`,
        isProducto: false,
        stockTeorico: row.stock_total,
        unidadMedida: row.unidad_medida,
      });
    }

    for (const it of allItems) {
      if (it.tipo === 'PT' || !it.activo) continue;
      if (seenItems.has(it.id)) continue;
      options.push({
        key: `I:${it.id}`,
        id: it.id,
        nombre: `${it.codigo} — ${it.nombre} · sin stock`,
        isProducto: false,
        stockTeorico: 0,
        unidadMedida: it.unidad_medida,
      });
    }

    return options.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  },

  async registrarEntradaInsumo(opts: {
    insumoId: string;
    cantidad: number;
    referencia: string;
    almacenId: string;
    observaciones?: string;
    precioUnitario?: number;
    fechaVencimiento?: string;
    clientTxnId?: string;
    registrarGasto?: boolean;
    gastoCategoriaId?: string;
    gastoCentroCosto?: string;
    gastoDescripcion?: string;
    gastoProveedorNombre?: string;
  }) {
    const txnId = opts.clientTxnId ?? newTxnId();
    if (opts.registrarGasto) {
      return api.registrarCompraConGasto({
        itemId: opts.insumoId,
        cantidad: opts.cantidad,
        ubicacionId: opts.almacenId,
        registrarGasto: true,
        gastoCategoriaId: opts.gastoCategoriaId,
        motivo: opts.referencia,
        observacion: opts.observaciones,
        precioUnitario: opts.precioUnitario,
        fechaVencimiento: opts.fechaVencimiento,
        txnId,
        gastoCentroCosto: opts.gastoCentroCosto ?? 'BODEGA',
        gastoDescripcion: opts.gastoDescripcion,
        gastoProveedorNombre: opts.gastoProveedorNombre,
      });
    }
    return api.registrarCompra({
      itemId: opts.insumoId,
      cantidad: opts.cantidad,
      ubicacionId: opts.almacenId,
      motivo: opts.referencia,
      observacion: opts.observaciones,
      precioUnitario: opts.precioUnitario,
      fechaVencimiento: opts.fechaVencimiento,
      txnId,
    });
  },

  async registrarVentaBotellas(opts: {
    ubicacionId: string;
    presentacionId: string;
    cantidadBotellas: number;
    precioUnitarioBotella: number;
    canal?: string;
    observaciones?: string;
    clienteId?: string;
    loteId?: string;
    clientTxnId?: string;
  }) {
    const pres = (await api.getPresentaciones()).find((p) => p.id === opts.presentacionId);
    if (!pres?.item_id) throw new Error('Presentación no encontrada');
    const cant = Math.round(opts.cantidadBotellas);
    let precio = opts.precioUnitarioBotella;
    if (!Number.isFinite(precio) || precio <= 0) {
      const ref = await api.getPrecioReferencia(opts.presentacionId);
      precio = ref ?? 0;
    }
    if (precio <= 0) throw new Error('Precio no válido. Ingrese precio o configure ven_precio_ref.');

    let lineas: VentaLinea[];
    if (opts.loteId) {
      const stock = await api.validarStockDisponible({
        itemId: pres.item_id,
        loteId: opts.loteId,
        ubicacionId: opts.ubicacionId,
        cantidad: cant,
      });
      if (!stock.tiene_stock) {
        throw new Error(`Stock insuficiente. Faltante: ${stock.faltante ?? cant}`);
      }
      lineas = [{
        item_id: pres.item_id,
        lote_id: opts.loteId,
        cantidad: cant,
        precio_unitario: precio,
        presentacion_id: opts.presentacionId,
      }];
    } else {
      const allocations = await api.resolveLoteAllocationsFifo({
        ubicacionId: opts.ubicacionId,
        cantidad: cant,
        presentacionId: opts.presentacionId,
      });
      lineas = allocations.map((a) => ({
        item_id: pres.item_id,
        lote_id: a.loteId,
        cantidad: Math.round(a.cantidad),
        precio_unitario: precio,
        presentacion_id: opts.presentacionId,
      }));
    }

    return api.registrarVentaAtomica({
      ubicacionId: opts.ubicacionId,
      canal: opts.canal ?? 'DIRECTO',
      lineas,
      observaciones: opts.observaciones,
      clienteId: opts.clienteId,
      txnId: opts.clientTxnId ?? newTxnId(),
    });
  },

  /** @deprecated use registrarVentaBotellas */
  async registrarVentaConFifo(opts: {
    ubicacionId: string;
    presentacionId: string;
    cantidad: number;
    monto: number;
    canal?: string;
    observaciones?: string;
    loteId?: string;
    clientTxnId?: string;
  }) {
    return this.registrarVentaBotellas({
      ubicacionId: opts.ubicacionId,
      presentacionId: opts.presentacionId,
      cantidadBotellas: opts.cantidad,
      precioUnitarioBotella: opts.monto / opts.cantidad,
      canal: opts.canal,
      observaciones: opts.observaciones,
      loteId: opts.loteId,
      clientTxnId: opts.clientTxnId,
    });
  },

  async registrarVentaMultiLinea(opts: {
    ubicacionId: string;
    canal: string;
    lineas: { presentacionId: string; cantidadBotellas: number; precioUnitarioBotella: number }[];
    observaciones?: string;
    clienteId?: string;
    clientTxnId?: string;
  }) {
    const allLineas: VentaLinea[] = [];
    for (const l of opts.lineas) {
      const pres = (await api.getPresentaciones()).find((p) => p.id === l.presentacionId);
      if (!pres?.item_id) throw new Error(`Presentación ${l.presentacionId} no encontrada`);
      const allocations = await api.resolveLoteAllocationsFifo({
        ubicacionId: opts.ubicacionId,
        cantidad: Math.round(l.cantidadBotellas),
        presentacionId: l.presentacionId,
        productoLabel: pres.nombre,
      });
      for (const a of allocations) {
        allLineas.push({
          item_id: pres.item_id,
          lote_id: a.loteId,
          cantidad: Math.round(a.cantidad),
          precio_unitario: l.precioUnitarioBotella,
          presentacion_id: l.presentacionId,
        });
      }
    }
    return api.registrarVentaAtomica({
      ubicacionId: opts.ubicacionId,
      canal: opts.canal,
      lineas: allLineas,
      observaciones: opts.observaciones,
      clienteId: opts.clienteId,
      txnId: opts.clientTxnId ?? newTxnId(),
    });
  },

  async registrarCompraDocumentada(opts: {
    ubicacionId: string;
    lineas: CompraLinea[];
    proveedorId?: string;
    referencia?: string;
    observaciones?: string;
    clientTxnId?: string;
  }) {
    return api.registrarCompraDoc({
      ...opts,
      txnId: opts.clientTxnId ?? newTxnId(),
    });
  },

  async crearTransferenciaConFifo(opts: {
    origenId: string;
    destinoId: string;
    lineas: TransferLinea[];
    observaciones?: string;
    clientTxnId?: string;
  }) {
    return api.crearTransferencia({
      ...opts,
      txnId: opts.clientTxnId ?? newTxnId(),
    });
  },

  async registrarAjusteInventario(opts: {
    ubicacionId: string;
    option: AjusteItemOption;
    conteoFisico: number;
    motivo: string;
    loteId?: string;
    txnId?: string;
  }) {
    const delta = opts.conteoFisico - opts.option.stockTeorico;
    if (delta === 0) throw new Error('El conteo coincide con el stock teórico (delta = 0).');
    return api.registrarAjustePorSku({
      delta,
      ubicacionId: opts.ubicacionId,
      motivo: opts.motivo,
      itemId: opts.option.isProducto ? undefined : opts.option.id,
      presentacionId: opts.option.presentacionId,
      loteId: opts.loteId,
      txnId: opts.txnId ?? newTxnId(),
    });
  },

  async ingresarEgresosBatch(
    lineas: EgresoLineaDraft[],
    header: { fecha: string; moneda?: string; centroCosto?: string },
  ): Promise<{ registeredIds: string[] }> {
    const batchTxn = newTxnId();
    const registeredIds: string[] = [];
    for (const line of lineas) {
      const tipoDoc = line.tipoDocumento?.trim() ?? '';
      const nroDoc = line.nroDocumento?.trim() ?? '';
      const payload: Record<string, unknown> = {
        fecha: header.fecha,
        monto: line.monto,
        descripcion: line.descripcion,
        categoria_id: line.categoriaId,
        centro_costo: header.centroCosto ?? 'BODEGA',
        moneda: header.moneda ?? 'PEN',
        proveedor_nombre: line.proveedorNombre ?? null,
        con_comprobante: tipoDoc.length > 0 || nroDoc.length > 0,
      };
      if (tipoDoc) payload.tipo_comprobante = tipoDoc;
      if (nroDoc) payload.nro_comprobante = nroDoc;
      try {
        await api.registrarGasto(payload, `${batchTxn}:${line.id}`);
        registeredIds.push(line.id);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        const label = line.descripcion?.trim() || line.id;
        const msg = new Error(
          `Falló la línea «${label}» (${registeredIds.length + 1}/${lineas.length}): ${detail}`
          + (registeredIds.length > 0
            ? ` — ${registeredIds.length} egreso(s) ya quedaron registrados.`
            : ''),
        ) as Error & { registeredIds: string[] };
        msg.registeredIds = registeredIds;
        throw msg;
      }
    }
    return { registeredIds };
  },

  async producirGranel(opts: {
    materialId: string;
    cantidad: number;
    tanque: string;
    clientTxnId?: string;
  }) {
    const ubicaciones = await api.getUbicaciones();
    const almGr = ubicaciones.find((u) => u.codigo === 'ALM_GR');
    return api.registrarGranel({
      itemId: opts.materialId,
      cantidad: opts.cantidad,
      ubicacionId: almGr?.id,
      observacion: opts.tanque ? `Tanque: ${opts.tanque}` : undefined,
      txnId: opts.clientTxnId ?? newTxnId(),
    });
  },
};

export type BodegaService = typeof bodegaService;
