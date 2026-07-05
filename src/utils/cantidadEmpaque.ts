/** Cómo ingresa cantidad el operario para PT con empaque (pack × N). */
export type ModoCantidadEmpaque = 'botella' | 'pack';

/** Convierte entrada del usuario → unidades base de stock PT (botellas). */
export function cantidadBaseDesdeEntrada(opts: {
  cantidadIngresada: number;
  modo: ModoCantidadEmpaque;
  cantUnidadesPresentacion: number;
}): number {
  const { cantidadIngresada, modo, cantUnidadesPresentacion } = opts;
  if (cantidadIngresada <= 0) return 0;
  const factor = modo === 'pack'
    ? (cantUnidadesPresentacion > 0 ? cantUnidadesPresentacion : 1)
    : 1;
  return Math.round(cantidadIngresada * factor);
}

export function etiquetaModoCantidad(modo: ModoCantidadEmpaque, cantUnidades: number): string {
  if (modo === 'botella') return 'Cantidad (botellas)';
  if (cantUnidades <= 1) return 'Cantidad (packs = botellas)';
  return `Cantidad (packs × ${cantUnidades} bot.)`;
}

export function resumenCantidadBase(opts: {
  cantidadIngresada: number;
  modo: ModoCantidadEmpaque;
  cantUnidadesPresentacion: number;
  unidadBase?: string;
}): string {
  const base = cantidadBaseDesdeEntrada({
    cantidadIngresada: opts.cantidadIngresada,
    modo: opts.modo,
    cantUnidadesPresentacion: opts.cantUnidadesPresentacion,
  });
  if (base <= 0) return '';
  const packHint = opts.cantUnidadesPresentacion > 1 && opts.modo === 'pack'
    ? ` (${Math.round(opts.cantidadIngresada)} pack(s) × ${opts.cantUnidadesPresentacion})`
    : '';
  const unidad = opts.unidadBase ?? 'botella';
  return `Total: ${base} ${unidad}(s)${packHint}`;
}

export function presentacionPermiteModoPack(cantUnidades: number): boolean {
  return cantUnidades > 1;
}

export function modoCantidadToDb(modo: ModoCantidadEmpaque): 'BOTELLA' | 'PACK' {
  return modo === 'pack' ? 'PACK' : 'BOTELLA';
}
