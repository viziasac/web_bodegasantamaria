/** Fechas de negocio en zona America/Lima (no UTC de toISOString). */

export const TZ_NEGOCIO = 'America/Lima';

/** YYYY-MM-DD en la zona de negocio. */
export function ymdInZone(date: Date = new Date(), timeZone = TZ_NEGOCIO): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function hoyYmd(): string {
  return ymdInZone(new Date());
}

/** Primer día del mes calendario en la zona de negocio (YYYY-MM-DD). */
export function inicioMesYmd(date: Date = new Date(), timeZone = TZ_NEGOCIO): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  return `${y}-${m}-01`;
}

/** YYYY-MM-DD hace N días (zona de negocio). */
export function haceDiasYmd(dias: number, date: Date = new Date()): string {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() - dias);
  return ymdInZone(d);
}

/** Clave de mes YYYY-MM en zona de negocio. */
export function mesKeyInZone(date: Date = new Date(), timeZone = TZ_NEGOCIO): string {
  return ymdInZone(date, timeZone).slice(0, 7);
}
