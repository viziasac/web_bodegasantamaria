/**
 * Capa de negocio — port simplificado de bodega_service.dart
 */
import * as api from './apiProvider';
import { newTxnId } from '../utils/txnId';
import { normalizarTipoItem, tiposPermitidosParaUbicacion } from '../utils/ubicacionItemPolicy';
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
      api.getStockAgregadoPorUbicacion(ubicacionId),
    ]);
    const stockByItem = Object.fromEntries(
      stockRows.filter((r) => r.tipo === 'PT').map((r) => [r.item_id, r.stock_total]),
    );
    return presentaciones
      .filter((p) => p.ma_item?.tipo === 'PT' && p.activo !== false)
      .map((p) => ({
        presentacion_id: p.id,
        item_id: p.item_id,
        nombre: p.nombre,
        cant_unidades: p.cant_unidades ?? 1,
        // Stock unificado por ítem (botellas), sin importar pack ×6 / ×12.
        stock_item: stockByItem[p.item_id] ?? 0,
        categoria: p.ma_item?.categoria,
        item_nombre: p.ma_item?.nombre,
        item_codigo: p.ma_item?.codigo,
      }));
  },

  async itemsConStockParaAjuste(ubicacionId: string): Promise<AjusteItemOption[]> {
    const [stockItems, allItems, allPres, ubicaciones] = await Promise.all([
      api.getStockAgregadoPorUbicacion(ubicacionId),
      api.getItems(),
      api.getPresentaciones(),
      api.getUbicaciones(),
    ]);
    const ubi = ubicaciones.find((u) => u.id === ubicacionId);
    const allowed = new Set(tiposPermitidosParaUbicacion(ubi).map((t) => t));
    if (allowed.size === 0) return [];

    const stockByItem: Record<string, number> = {};
    for (const row of stockItems) {
      stockByItem[row.item_id] = Number(row.stock_total) || 0;
    }

    const options: AjusteItemOption[] = [];
    const seenItems = new Set<string>();

    // PT: un SKU por ítem (solo si la ubicación admite PT).
    if (allowed.has('PT')) {
      const ptItems = allItems.filter((i) => normalizarTipoItem(i.tipo) === 'PT' && i.activo !== false);
      for (const it of ptItems) {
        const presList = allPres.filter((p) => p.item_id === it.id && p.activo !== false);
        if (presList.length === 0) continue;
        const sorted = [...presList].sort((a, b) => (a.cant_unidades ?? 1) - (b.cant_unidades ?? 1));
        const botella = sorted.find((p) => (p.cant_unidades ?? 1) <= 1) ?? sorted[0];
        const packsRaw = sorted.filter((p) => (p.cant_unidades ?? 1) > 1);
        const packs: { id: string; factor: number }[] = [];
        const seen = new Set<number>();
        for (const p of packsRaw) {
          const factor = p.cant_unidades ?? 1;
          if (factor <= 1 || seen.has(factor)) continue;
          seen.add(factor);
          packs.push({ id: p.id, factor });
        }
        packs.sort((a, b) => a.factor - b.factor);
        const factorPacks = packs.map((p) => p.factor);
        const packDefault = packs[0];
        const stock = stockByItem[it.id] ?? 0;
        seenItems.add(it.id);
        options.push({
          key: `PT:${it.id}`,
          id: it.id,
          presentacionId: botella.id,
          presentacionPackId: packDefault?.id,
          factorPack: packDefault?.factor ?? 1,
          factorPacks,
          packs,
          nombre: stock > 0
            ? `${it.codigo} — ${it.nombre}`
            : `${it.codigo} — ${it.nombre} · sin stock`,
          tipo: 'PT',
          isProducto: true,
          stockTeorico: stock,
          unidadMedida: 'bot.',
        });
      }
    }

    // Materiales / granel / empaque / insumos según almacén.
    for (const it of allItems) {
      if (it.activo === false) continue;
      const tipo = normalizarTipoItem(it.tipo);
      if (tipo === 'PT' || !allowed.has(tipo as 'GRANEL' | 'INSUMO' | 'EMPAQUE' | 'MATERIAL')) continue;
      if (seenItems.has(it.id)) continue;
      seenItems.add(it.id);
      const stock = stockByItem[it.id] ?? 0;
      options.push({
        key: `I:${it.id}`,
        id: it.id,
        nombre: stock > 0
          ? `${it.codigo} — ${it.nombre}`
          : `${it.codigo} — ${it.nombre} · sin stock`,
        tipo,
        isProducto: false,
        stockTeorico: stock,
        unidadMedida: it.unidad_medida,
      });
    }

    return options.sort((a, b) => {
      const ta = a.tipo.localeCompare(b.tipo, 'es');
      if (ta !== 0) return ta;
      return a.nombre.localeCompare(b.nombre, 'es');
    });
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
    proveedorId?: string;
    registrarGasto?: boolean;
    gastoCategoriaId?: string;
    gastoCentroCosto?: string;
    gastoDescripcion?: string;
    gastoProveedorNombre?: string;
    gastoProveedorId?: string;
  }) {
    const txnId = opts.clientTxnId ?? newTxnId();
    const linea = {
      item_id: opts.insumoId,
      cantidad: opts.cantidad,
      precio_unitario: opts.precioUnitario,
      fecha_vencimiento: opts.fechaVencimiento,
    };

    if (opts.proveedorId && !opts.registrarGasto) {
      return api.registrarCompraDoc({
        ubicacionId: opts.almacenId,
        proveedorId: opts.proveedorId,
        referencia: opts.referencia,
        observaciones: opts.observaciones,
        lineas: [linea],
        txnId,
      });
    }

    if (opts.proveedorId && opts.registrarGasto) {
      await api.registrarCompraDoc({
        ubicacionId: opts.almacenId,
        proveedorId: opts.proveedorId,
        referencia: opts.referencia,
        observaciones: opts.observaciones,
        lineas: [linea],
        txnId,
      });
      const monto = (opts.precioUnitario ?? 0) * opts.cantidad;
      if (monto > 0 && opts.gastoCategoriaId) {
        await api.registrarGasto({
          fecha: new Date().toISOString().slice(0, 10),
          monto,
          descripcion: opts.gastoDescripcion ?? `Compra: ${opts.referencia}`,
          categoria_id: opts.gastoCategoriaId,
          centro_costo: opts.gastoCentroCosto ?? 'BODEGA',
          proveedor_id: opts.gastoProveedorId ?? opts.proveedorId,
          proveedor_nombre: opts.gastoProveedorNombre ?? null,
          origen_tipo: 'COMPRA',
          origen_txn_id: txnId,
        }, `${txnId}:gasto`);
      }
      return txnId;
    }

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
      // FIFO por ítem (stock en botellas), no por presentación pack/botella.
      const allocations = await api.resolveLoteAllocationsFifo({
        ubicacionId: opts.ubicacionId,
        cantidad: cant,
        itemId: pres.item_id,
        productoLabel: pres.ma_item?.nombre ?? pres.nombre,
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
      clienteId: opts.clienteId || undefined,
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
        itemId: pres.item_id,
        productoLabel: pres.ma_item?.nombre ?? pres.nombre,
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
      clienteId: opts.clienteId || undefined,
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
    /** Base del delta (lote o teórico). Debe coincidir con lo mostrado en UI. */
    stockReferencia?: number;
    loteId?: string;
    txnId?: string;
  }) {
    const base = opts.stockReferencia ?? opts.option.stockTeorico;
    const delta = opts.conteoFisico - base;
    if (delta === 0) throw new Error('El conteo coincide con el stock de referencia (delta = 0).');
    return api.registrarAjustePorSku({
      delta,
      ubicacionId: opts.ubicacionId,
      motivo: opts.motivo,
      // Stock PT es por item_id (botellas); presentacionId solo ayuda a resolver si falta item.
      itemId: opts.option.id,
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
        proveedor_id: line.proveedorId ?? null,
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
    const almGr = ubicaciones.find((u) => u.codigo === 'ALM_GR' && u.activo !== false);
    if (!almGr?.id) {
      throw new Error('Falta configurar la ubicación ALM_GR (almacén de granel).');
    }
    return api.registrarGranel({
      itemId: opts.materialId,
      cantidad: opts.cantidad,
      ubicacionId: almGr.id,
      observacion: opts.tanque ? `Tanque: ${opts.tanque}` : undefined,
      txnId: opts.clientTxnId ?? newTxnId(),
    });
  },
};

export type BodegaService = typeof bodegaService;
