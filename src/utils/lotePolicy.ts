/** Política FEFO/FIFO para consumo de lotes */

type LoteRow = Record<string, unknown>;

function compareNullableDate(a?: string | null, b?: string | null): number {
  if (!a) return !b ? 0 : 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

function hasVencimiento(lotes: LoteRow[]): boolean {
  return lotes.some((l) => {
    const v = l.fecha_vencimiento?.toString();
    return v != null && v.length > 0;
  });
}

export function sortLotesParaConsumo(lotes: LoteRow[]): LoteRow[] {
  const copy = [...lotes];
  if (copy.length <= 1) return copy;

  if (hasVencimiento(copy)) {
    copy.sort((a, b) => {
      const cmp = compareNullableDate(
        a.fecha_vencimiento?.toString(),
        b.fecha_vencimiento?.toString(),
      );
      if (cmp !== 0) return cmp;
      return compareNullableDate(
        a.fecha_produccion?.toString(),
        b.fecha_produccion?.toString(),
      );
    });
    return copy;
  }

  copy.sort((a, b) =>
    compareNullableDate(
      a.fecha_produccion?.toString(),
      b.fecha_produccion?.toString(),
    ),
  );
  return copy;
}

export function labelLote(lote: LoteRow): string {
  const cod =
    lote.nro_lote?.toString() ??
    lote.codigo_lote?.toString() ??
    lote.lote_id?.toString() ??
    '—';
  const cant = lote.cantidad as number | undefined;
  const cantTxt =
    cant != null
      ? ` · disp. ${cant % 1 === 0 ? cant.toFixed(0) : cant.toFixed(2)}`
      : '';
  const venc = lote.fecha_vencimiento?.toString();
  const vencTxt = venc && venc.length > 0 ? ` · vence ${venc}` : '';
  return `${cod}${cantTxt}${vencTxt}`;
}
