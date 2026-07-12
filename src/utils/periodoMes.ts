/** Utilidades de periodo mensual (YYYY-MM) — zona America/Lima */

import { hoyYmd, mesKeyInZone, ymdInZone } from './fechaLocal';

export interface RangoMes {
  mesKey: string;
  desde: string;
  hasta: string;
  label: string;
  esMesActual: boolean;
}

export function mesActualKey(d = new Date()): string {
  return mesKeyInZone(d);
}

export function rangoMes(mesKey: string): RangoMes {
  const [y, m] = mesKey.split('-').map(Number);
  const inicio = new Date(y, m - 1, 1);
  const fin = new Date(y, m, 0);
  const hoyKey = hoyYmd();
  const esMesActual = mesKey === hoyKey.slice(0, 7);
  const hasta = esMesActual ? hoyKey : ymdInZone(fin);

  const label = inicio.toLocaleDateString('es-PE', { month: 'long', year: 'numeric', timeZone: 'America/Lima' });

  return {
    mesKey,
    desde: `${mesKey}-01`,
    hasta,
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
