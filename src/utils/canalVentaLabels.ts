/** Etiquetas de canal de venta (alineado a Flutter CanalVentaLabels). */

export function canalVentaLabel(canal: { codigo: string; nombre: string }): string {
  const codigo = canal.codigo?.trim().toUpperCase() ?? '';
  const nombre = canal.nombre?.trim() ?? '';
  if (!nombre) return codigo || '—';
  if (!codigo || nombre.toUpperCase() === codigo) return nombre;
  return `${nombre} · ${codigo}`;
}
