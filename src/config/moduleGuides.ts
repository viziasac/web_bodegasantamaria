/** Guías de uso por módulo — modal del botón info del PageHeader. */

export interface ModuleGuide {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  tips?: string[];
  related?: { label: string; path: string }[];
}

export const MODULE_GUIDES: Record<string, ModuleGuide> = {
  dashboard: {
    id: 'dashboard',
    title: 'Panel de Control',
    summary: 'Vista gerencial del mes: financiero, operaciones, comercial, producción e inventario.',
    steps: [
      'Seleccione el mes con el selector de la esquina superior.',
      'Use las pestañas (Ejecutivo, Financiero, Comercial, etc.) según lo que quiera revisar.',
      'Financiero muestra tops, mejor/peor día, ventas, gastos y movimientos del periodo.',
    ],
    tips: [
      'Los KPIs respetan la zona America/Lima (fecha de negocio).',
      'Las ventas anuladas no suman en totales.',
    ],
    related: [
      { label: 'Reportes', path: '/reporting' },
      { label: 'Descargas', path: '/downloads' },
    ],
  },
  ver_stock: {
    id: 'ver_stock',
    title: 'Inventario',
    summary: 'Consulta el stock por almacén y corrige saldos con ajustes de conteo físico.',
    steps: [
      'Pestaña Resumen: filtre por ubicación, tipo, categoría o alertas de mínimo.',
      'Pestaña Ajuste / conteo: indique lo contado; el sistema calcula el delta.',
      'Use /inventory?tab=ajuste para ir directo al ajuste.',
    ],
    tips: [
      'Un ajuste genera movimientos AJUSTE_ING / AJUSTE_SAL en el ledger.',
      'MERMA se reporta con motivo claro.',
    ],
    related: [
      { label: 'Transferencias', path: '/transfers' },
      { label: 'Auditoría', path: '/audit' },
    ],
  },
  ingreso_materiales: {
    id: 'ingreso_materiales',
    title: 'Ingreso de Insumos',
    summary: 'Registra compras y entradas de materiales al almacén, con opción de egreso automático.',
    steps: [
      'Elija ubicación destino, ítem, cantidad y precio.',
      'Active egreso si la compra debe generar gasto en el mismo flujo.',
      'Confirme; el stock queda disponible de inmediato.',
    ],
    tips: ['Los egresos ligados a compra no se eliminan desde Modificaciones.'],
    related: [
      { label: 'Inventario', path: '/inventory' },
      { label: 'Egresos', path: '/expenses' },
    ],
  },
  transferencias: {
    id: 'transferencias',
    title: 'Transferencias',
    summary: 'Mueve stock entre ubicaciones (almacén ↔ PV) con envío y recepción.',
    steps: [
      'Cree la transferencia: origen, destino y líneas (PT por SKU o materiales por ítem).',
      'Envíe y luego registre la recepción en destino.',
      'No mezcle presentacion_id e item_id en la misma línea (XOR).',
    ],
    related: [
      { label: 'Inventario', path: '/inventory' },
      { label: 'Despacho', path: '/sales/dispatch' },
    ],
  },
  recetas: {
    id: 'recetas',
    title: 'Recetas',
    summary: 'Define los componentes por 1 botella de cada producto terminado.',
    steps: [
      'Pulse «Nueva / agregar receta», elija el producto y agregue materiales con cantidad.',
      'Ordene mentalmente: granel primero, luego insumos y empaque.',
      'Edite cantidad o márquela variable; puede quitar una línea o toda la receta.',
    ],
    tips: [
      'La cantidad es siempre por botella (no por pack).',
      'Solo administradores pueden crear o editar (política de seguridad en base de datos).',
      'Al completar producción, el granel se valida en ALM_GR y el resto en ALM_MP.',
    ],
    related: [
      { label: 'Materiales / SKUs', path: '/materials' },
      { label: 'Producción', path: '/production' },
    ],
  },
  produccion_granel: {
    id: 'produccion_granel',
    title: 'Producción Granel',
    summary: 'Da de alta líquido a granel en ALM_GR (vino/pisco a granel).',
    steps: [
      'Seleccione el ítem GRANEL, cantidad y observacion (p.ej. tanque).',
      'Confirme: el stock entra en ALM_GR.',
    ],
    related: [
      { label: 'Producción', path: '/production' },
      { label: 'Inventario', path: '/inventory' },
    ],
  },
  produccion_envasado: {
    id: 'produccion_envasado',
    title: 'Producción (envasado)',
    summary: 'Planifica y completa órdenes de envasado. Consume receta y genera stock PT.',
    steps: [
      'Cree una orden: PT, presentación (botella/pack) y cantidad planificada.',
      'Revise el preview de insumos (GRANEL→ALM_GR / resto→ALM_MP).',
      'Complete con cantidad real en botellas; el stock PT se registra por botella.',
    ],
    tips: ['No se puede completar si faltan insumos. Anule solo órdenes en borrador sin movimientos.'],
    related: [
      { label: 'Recetas', path: '/recipes' },
      { label: 'Granel', path: '/production/bulk' },
    ],
  },
  reempaque: {
    id: 'reempaque',
    title: 'Reempaque',
    summary: 'Cambia formato/etiqueta de un ítem a otro sin pasar por orden de producción completa.',
    steps: [
      'Indique ubicación, ítem origen, ítem destino y cantidades.',
      'Confirme el movimiento de stock.',
    ],
    related: [{ label: 'Inventario', path: '/inventory' }],
  },
  ingresos: {
    id: 'ingresos',
    title: 'Ingresos POS',
    summary: 'Ventas en punto de venta: carrito multi-línea o venta rápida.',
    steps: [
      'Elija PV, canal y cliente.',
      'Modo agrupada: arme carrito y registre. Modo rápida: una línea al confirmar.',
      'El selector de fecha solo consulta historial; la venta nueva se registra con fecha de hoy.',
    ],
    tips: [
      'Si se equivocó en precios o cliente, use Modificaciones (no re-registre a ciegas).',
      'Requiere permiso acceso_ventas.',
    ],
    related: [
      { label: 'Despacho', path: '/sales/dispatch' },
      { label: 'Modificaciones', path: '/sales/modificaciones' },
    ],
  },
  despacho: {
    id: 'despacho',
    title: 'Despacho',
    summary: 'Venta rápida de una sola línea (ideal para mostrador o delivery puntual).',
    steps: [
      'Seleccione PV, producto con stock, cantidad y precio por botella.',
      'Opcional: lote (si no, FIFO automático), canal y cliente.',
      'Registre la venta.',
    ],
    tips: ['Para varias líneas en un comprobante use Ingresos POS.'],
    related: [
      { label: 'Ingresos', path: '/sales/income' },
      { label: 'Modificaciones', path: '/sales/modificaciones' },
    ],
  },
  gastos: {
    id: 'gastos',
    title: 'Egresos',
    summary: 'Registra gastos operativos del día con carrito de líneas.',
    steps: [
      'Complete cabecera (fecha, centro de costo).',
      'Agregue líneas: categoría, descripción, monto, proveedor/comprobante.',
      'Seleccione y registre; si una línea falla, se detiene e indica cuál.',
    ],
    tips: ['Para corregir un gasto ya guardado use Modificaciones.'],
    related: [
      { label: 'Modificaciones', path: '/sales/modificaciones?tab=egresos' },
      { label: 'Ingreso Insumos', path: '/purchases' },
    ],
  },
  modificaciones: {
    id: 'modificaciones',
    title: 'Modificaciones',
    summary: 'Corrige capturas erróneas de ventas y egresos sin romper el inventario.',
    steps: [
      'Pestaña Ingresos: filtre periodo, expanda líneas, edite precios/cliente/canal o anule.',
      'Anular venta restituye stock (AJUSTE_ING); el movimiento VENTA queda en auditoría.',
      'Pestaña Egresos: edite o elimine gastos manuales (no los de compra).',
    ],
    tips: [
      'No se pueden cambiar cantidades ni ubicación de una venta ya hecha.',
      'Egresos origen COMPRA se gestionan vía flujo de compras.',
    ],
    related: [
      { label: 'Ingresos', path: '/sales/income' },
      { label: 'Egresos', path: '/expenses' },
    ],
  },
  auditoria: {
    id: 'auditoria',
    title: 'Auditoría',
    summary: 'Consulta el historial de movimientos y la trazabilidad por lote.',
    steps: [
      'Use pestañas Historial / Trazabilidad.',
      'Filtre por fechas, tipo de movimiento o lote.',
    ],
    related: [
      { label: 'Inventario', path: '/inventory' },
      { label: 'Descargas', path: '/downloads' },
    ],
  },
  descargas: {
    id: 'descargas',
    title: 'Descargas',
    summary: 'Exporta a Excel un módulo (ventas, gastos, movimientos, etc.) por mes.',
    steps: [
      'Elija el mes y el módulo a exportar.',
      'Descargue el archivo; se consulta solo esa porción de datos.',
    ],
    related: [{ label: 'Reportes', path: '/reporting' }],
  },
  materiales_skus: {
    id: 'materiales_skus',
    title: 'Materiales y SKUs',
    summary: 'Catálogo maestro de ítems y presentaciones comerciales (solo admin).',
    steps: [
      'Cree o edite materiales (nombre, UM, categoría, stock mínimo, activo).',
      'Cree SKUs (presentaciones) ligados a un PT y un empaque.',
      'No hay eliminación física: desactive si ya no se usa.',
    ],
    tips: ['Crear ítem/SKU no genera stock; eso entra por compra, granel o producción.'],
    related: [
      { label: 'Maestros', path: '/maestros' },
      { label: 'Recetas', path: '/recipes' },
      { label: 'Ingreso Insumos', path: '/purchases' },
    ],
  },
  maestros: {
    id: 'maestros',
    title: 'Maestros',
    summary: 'Administra canales de venta, empaques y categorías de gasto.',
    steps: [
      'Elija la pestaña del maestro a mantener.',
      'Cree o edite registros; no hay borrado físico (use Activo = No cuando aplique).',
      'Recargue catálogos en Configuración si otro usuario editó maestros en paralelo.',
    ],
    related: [
      { label: 'Proveedores y clientes', path: '/proveedores-clientes' },
      { label: 'Materiales / SKUs', path: '/materials' },
      { label: 'Egresos', path: '/expenses' },
      { label: 'Usuarios', path: '/usuarios' },
    ],
  },
  proveedores_clientes: {
    id: 'proveedores_clientes',
    title: 'Clientes y proveedores',
    summary: 'Catálogo para compras, egresos y ventas. Campos alineados a ma_cliente y ma_proveedor.',
    steps: [
      'Elija la pestaña Proveedores o Clientes.',
      'Cree o edite con Nuevo / Editar; el código se genera automáticamente.',
      'Eliminar = baja lógica (activo=false): deja de verse en operaciones, el historial se conserva.',
      'Reactive con Reactivar (active «Ver inactivos» para encontrarlos).',
      'Los predeterminados no se pueden eliminar.',
    ],
    tips: [
      'En compras y ventas el proveedor/cliente del catálogo es opcional.',
      'Tras cambios, el catálogo de formularios se actualiza al guardar o con Actualizar.',
    ],
    related: [
      { label: 'Ingreso Insumos', path: '/purchases' },
      { label: 'Ingresos', path: '/sales/income' },
      { label: 'Despacho', path: '/sales/dispatch' },
    ],
  },
  usuarios: {
    id: 'usuarios',
    title: 'Usuarios',
    summary: 'Consulta de usuarios del ERP (correo, nombre, rol y accesos). Solo lectura.',
    steps: [
      'Revise la lista: correo, nombre, rol, activo y flags de acceso (web / app / ventas).',
      'Use la búsqueda para filtrar por correo, nombre o rol.',
      'Actualice la lista tras invitar usuarios desde Auth.',
    ],
    tips: [
      'Esta pantalla no modifica permisos: los cambios de rol/acceso se gestionan fuera de la web.',
      'acceso_web controla el login al ERP; acceso_ventas oculta módulos comerciales si está desactivado.',
    ],
    related: [
      { label: 'Configuración', path: '/settings' },
      { label: 'Clientes y proveedores', path: '/proveedores-clientes' },
    ],
  },
  reportes: {
    id: 'reportes',
    title: 'Reportes',
    summary: 'Resumen operativo del periodo (ventas, gastos, producción, compras). Solo admin.',
    steps: [
      'Defina rango de fechas y filtros opcionales (PV / centro de costo).',
      'Genere el resumen y revise los totales.',
    ],
    related: [
      { label: 'Dashboard', path: '/' },
      { label: 'Descargas', path: '/downloads' },
    ],
  },
  configuracion: {
    id: 'configuracion',
    title: 'Configuración',
    summary: 'Cuenta, permisos visibles y caché local del catálogo.',
    steps: [
      'Revise email, rol y flags acceso_web / acceso_ventas.',
      'Refresque el catálogo si acaba de cambiar maestros en otro dispositivo.',
      'Cierre sesión al terminar en equipos compartidos.',
    ],
  },
};

export function getModuleGuide(id: string): ModuleGuide | undefined {
  return MODULE_GUIDES[id];
}
