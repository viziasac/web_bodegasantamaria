/**
 * Protección client-side contra fuerza bruta en login.
 * Sin espera en intentos 1–4; a partir del 5.º fallo, 5 s antes del siguiente intento.
 */

const STORAGE_KEY = 'bsm_login_guard_v2';
const MAX_ATTEMPTS = 10;
const LOCKOUT_MS = 15 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
/** Tras este número de fallos, exigir pausa antes del siguiente intento */
const WAIT_AFTER_FAILURES = 4;
const WAIT_MS = 5000;

interface GuardState {
  failures: number;
  windowStart: number;
  lockedUntil: number;
  lastAttemptAt: number;
}

function readState(): GuardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { failures: 0, windowStart: Date.now(), lockedUntil: 0, lastAttemptAt: 0 };
    }
    const parsed = JSON.parse(raw) as Partial<GuardState>;
    return {
      failures: parsed.failures ?? 0,
      windowStart: parsed.windowStart ?? Date.now(),
      lockedUntil: parsed.lockedUntil ?? 0,
      lastAttemptAt: parsed.lastAttemptAt ?? 0,
    };
  } catch {
    return { failures: 0, windowStart: Date.now(), lockedUntil: 0, lastAttemptAt: 0 };
  }
}

function writeState(state: GuardState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

function resetWindowIfExpired(state: GuardState): GuardState {
  const now = Date.now();
  if (now - state.windowStart > ATTEMPT_WINDOW_MS && state.lockedUntil <= now) {
    return { failures: 0, windowStart: now, lockedUntil: 0, lastAttemptAt: state.lastAttemptAt };
  }
  return state;
}

export interface LoginGuardStatus {
  allowed: boolean;
  lockedUntil: number | null;
  waitMs: number;
  message: string | null;
}

export function getLoginGuardStatus(): LoginGuardStatus {
  const now = Date.now();
  let state = resetWindowIfExpired(readState());

  if (state.lockedUntil > now) {
    const waitMs = state.lockedUntil - now;
    const mins = Math.ceil(waitMs / 60000);
    return {
      allowed: false,
      lockedUntil: state.lockedUntil,
      waitMs,
      message: `Demasiados intentos fallidos. Espere ${mins} minuto(s) antes de volver a intentar.`,
    };
  }

  if (state.lockedUntil > 0 && state.lockedUntil <= now) {
    state = { failures: 0, windowStart: now, lockedUntil: 0, lastAttemptAt: state.lastAttemptAt };
    writeState(state);
  }

  if (state.failures >= WAIT_AFTER_FAILURES && state.lastAttemptAt > 0) {
    const sinceLast = now - state.lastAttemptAt;
    if (sinceLast < WAIT_MS) {
      return {
        allowed: false,
        lockedUntil: null,
        waitMs: WAIT_MS - sinceLast,
        message: `Espere ${Math.ceil((WAIT_MS - sinceLast) / 1000)} s antes del siguiente intento.`,
      };
    }
  }

  return { allowed: true, lockedUntil: null, waitMs: 0, message: null };
}

export function assertLoginAllowed(): void {
  const status = getLoginGuardStatus();
  if (!status.allowed) {
    throw new Error(status.message || 'Acceso temporalmente bloqueado.');
  }
}

export function recordLoginFailure(): void {
  const now = Date.now();
  let state = resetWindowIfExpired(readState());
  state.failures += 1;
  state.lastAttemptAt = now;

  if (state.failures >= MAX_ATTEMPTS) {
    state.lockedUntil = now + LOCKOUT_MS;
  }

  writeState(state);
}

export function recordLoginSuccess(): void {
  writeState({ failures: 0, windowStart: Date.now(), lockedUntil: 0, lastAttemptAt: 0 });
}

/** Limpia bloqueo local (útil si quedó un estado antiguo en el navegador). */
export function clearLoginGuard(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('bsm_login_guard_v1');
  } catch {
    /* ignore */
  }
}
