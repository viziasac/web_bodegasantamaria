import { ENTRADA_TIPOS } from '../../config/backendEnums';
import type { DashboardEjecutivoData } from '../../types';

export type SaludOperativa = 'ok' | 'warn' | 'crit';

export function moveTypeIcon(tipo: string) {
  if (ENTRADA_TIPOS.includes(tipo as typeof ENTRADA_TIPOS[number])) {
    return { icon: 'arrow_downward', cls: 'green' as const };
  }
  if (tipo === 'MERMA') return { icon: 'warning', cls: 'red' as const };
  if (tipo.includes('AJUSTE')) return { icon: 'tune', cls: 'blue' as const };
  return { icon: 'arrow_upward', cls: 'gold' as const };
}

export function calcularSalud(ej: DashboardEjecutivoData): { nivel: SaludOperativa; mensaje: string } {
  let score = 0;
  if (ej.alertasStock.length > 5) score += 2;
  else if (ej.alertasStock.length > 0) score += 1;
  if (ej.impactoAjustesPct > 5) score += 2;
  else if (ej.impactoAjustesPct > 2) score += 1;
  if (ej.balance < 0) score += 1;
  if (ej.prodPlan > 0 && ej.prodCumplimiento < 0.75) score += 1;
  if (ej.transferenciasPendientes > 3) score += 1;

  if (score >= 4) {
    return { nivel: 'crit', mensaje: 'Requiere atención inmediata en inventario y operaciones' };
  }
  if (score >= 2) {
    return { nivel: 'warn', mensaje: 'Hay puntos de control que revisar este mes' };
  }
  return { nivel: 'ok', mensaje: 'Operaciones dentro de parámetros esperados' };
}

export function desviacionSemaforo(pct: number): 'ok' | 'warn' | 'crit' {
  if (pct > 5) return 'crit';
  if (pct > 2) return 'warn';
  return 'ok';
}
