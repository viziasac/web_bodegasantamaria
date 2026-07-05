/** Utilidades de periodo mensual (YYYY-MM) */

export interface RangoMes {
  mesKey: string;
  desde: string;
  hasta: string;
  label: string;
  esMesActual: boolean;
}

export function mesActualKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function rangoMes(mesKey: string): RangoMes {
  const [y, m] = mesKey.split('-').map(Number);
  const inicio = new Date(y, m - 1, 1);
  const fin = new Date(y, m, 0);
  const hoy = new Date();
  const esMesActual = y === hoy.getFullYear() && m === hoy.getMonth() + 1;
  const hastaDate = esMesActual ? hoy : fin;

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const label = inicio.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  return {
    mesKey,
    desde: fmt(inicio),
    hasta: fmt(hastaDate),
    label: label.charAt(0).toUpperCase() + label.slice(1),
    esMesActual,
  };
}

export function listMesesOptions(cantidad = 24): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < cantidad; i++) {
    const key = mesActualKey(d);
    const { label } = rangoMes(key);
    opts.push({ value: key, label });
    d.setMonth(d.getMonth() - 1);
  }
  return opts;
}

export function diasEnRango(desde: string, hasta: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${desde}T12:00:00`);
  const end = new Date(`${hasta}T12:00:00`);
  while (cur <= end) {
    out.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
    );
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
