// src/context/AuthContext.tsx — Supabase Auth + gate acceso_web
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import type { Session, User as SupaUser } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import {
  assertLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
} from '../utils/loginGuard';
import {
  validateLoginEmail,
  validateLoginPassword,
  mapSupabaseAuthError,
} from '../utils/authValidation';
import { clearIngresosCartDraft } from '../utils/ingresosDraft';
import { clearEgresosCartDraft } from '../utils/egresosDraft';
import { clearComprasDocDraft } from '../utils/comprasDraft';
import {
  resolveAuthenticatedWebUser,
  WEB_ACCESS_DENIED_MESSAGE,
} from '../services/userAccess';
import type { AppUser } from '../types';

/** Timeout solo para validación de perfil en login (fuera del callback de Auth). */
const PROFILE_TIMEOUT_MS = 20_000;

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label} (timeout ${ms}ms)`)), ms);
    promise.then(
      (v) => { window.clearTimeout(t); resolve(v); },
      (e) => { window.clearTimeout(t); reject(e); },
    );
  });
}

function isHardAccessDenial(msg: string): boolean {
  return (
    msg === WEB_ACCESS_DENIED_MESSAGE
    || msg.includes('Usuario inactivo')
    || msg.includes('sin acceso web')
    || msg.includes('acceso_web')
  );
}

function isTransientAuthError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('timeout')
    || m.includes('red')
    || m.includes('network')
    || m.includes('fetch')
    || m.includes('validar el perfil')
  );
}

/**
 * Diferir trabajo fuera de onAuthStateChange.
 * Await de supabase.* dentro del callback provoca deadlock del lock de Auth.
 */
function deferAuthWork(fn: () => void): void {
  window.setTimeout(fn, 0);
}

type SupaAuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<AppUser | null>(null);
  const bootDoneRef = useRef(false);
  const bootStartedRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const applySessionUser = useCallback(async (
    supaUser: SupaAuthUser | null,
    opts?: { soft?: boolean },
  ): Promise<AppUser | null> => {
    if (!supaUser) {
      setUser(null);
      return null;
    }
    const soft = opts?.soft === true;
    try {
      const mapped = soft
        ? await resolveAuthenticatedWebUser(supaUser)
        : await withTimeout(
          resolveAuthenticatedWebUser(supaUser),
          PROFILE_TIMEOUT_MS,
          'Validación de acceso',
        );
      setUser(mapped);
      return mapped;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';

      if (soft && isTransientAuthError(msg) && userRef.current) {
        console.warn('[Auth] refresh de perfil falló; se mantiene la sesión activa:', msg);
        return userRef.current;
      }

      if (isHardAccessDenial(msg)) {
        setUser(null);
        try {
          sessionStorage.setItem('bodega_auth_denied', 'web');
        } catch { /* ignore */ }
        // signOut fuera del callback de auth (ya diferido)
        try {
          await supabase.auth.signOut();
        } catch { /* ignore */ }
        return null;
      }

      if (soft && userRef.current) {
        console.warn('[Auth] error no crítico en refresh; se mantiene sesión:', msg);
        return userRef.current;
      }

      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let focusTimer: number | undefined;

    const markBootDone = () => {
      if (cancelled || bootDoneRef.current) return;
      bootDoneRef.current = true;
      setIsLoading(false);
    };

    const runSessionApply = (session: Session | null, soft: boolean, fromBoot: boolean) => {
      deferAuthWork(() => {
        void (async () => {
          if (cancelled) return;
          try {
            if (session?.user) {
              await applySessionUser(session.user as SupaAuthUser, { soft });
            } else {
              setUser(null);
            }
          } catch (err) {
            console.warn('[Auth] applySessionUser:', err);
            if (!soft) setUser(null);
          } finally {
            if (fromBoot) markBootDone();
          }
        })();
      });
    };

    // Callback SIN async/await a supabase — evita deadlock del lock interno.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;

      if (event === 'INITIAL_SESSION') {
        bootStartedRef.current = true;
        runSessionApply(session, true, true);
        return;
      }

      if (event === 'SIGNED_OUT' || !session?.user) {
        deferAuthWork(() => {
          if (!cancelled) setUser(null);
        });
        return;
      }

      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        runSessionApply(session, true, false);
        return;
      }

      if (event === 'SIGNED_IN') {
        // El login() también resuelve el perfil; aquí solo sincronizamos de forma suave.
        runSessionApply(session, true, false);
      }
    });

    // Fallback si INITIAL_SESSION no llega (clientes antiguos / edge cases).
    const bootFallback = window.setTimeout(() => {
      if (cancelled || bootDoneRef.current || bootStartedRef.current) return;
      bootStartedRef.current = true;
      deferAuthWork(() => {
        void supabase.auth.getSession().then(({ data }) => {
          if (cancelled || bootDoneRef.current) return;
          runSessionApply(data.session, true, true);
        }).catch((err) => {
          console.warn('[Auth] bootstrap fallback getSession:', err);
          if (!cancelled) {
            setUser(null);
            markBootDone();
          }
        });
      });
    }, 4_000);

    const onForeground = () => {
      if (!bootDoneRef.current) return;
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        void supabase.auth.refreshSession().then(({ data, error }) => {
          if (error) {
            console.warn('[Auth] refreshSession al volver a la pestaña:', error.message);
            return;
          }
          if (data.session?.user) {
            void applySessionUser(data.session.user as SupaAuthUser, { soft: true });
          }
        });
      }, 400);
    };

    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('focus', onForeground);

    return () => {
      cancelled = true;
      window.clearTimeout(bootFallback);
      window.clearTimeout(focusTimer);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('focus', onForeground);
    };
  }, [applySessionUser]);

  const login = async (email: string, password: string) => {
    assertLoginAllowed();

    const emailError = validateLoginEmail(email);
    if (emailError) throw new Error(emailError);

    const passwordError = validateLoginPassword(password);
    if (passwordError) throw new Error(passwordError);

    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      recordLoginFailure();
      throw new Error(mapSupabaseAuthError(error));
    }

    if (!data.user) {
      recordLoginFailure();
      throw new Error('No se pudo iniciar sesión. Verifique correo y contraseña.');
    }

    try {
      // Fuera de onAuthStateChange: seguro hacer await a PostgREST.
      const mapped = await withTimeout(
        resolveAuthenticatedWebUser(data.user as SupaUser),
        PROFILE_TIMEOUT_MS,
        'Validación de acceso',
      );
      recordLoginSuccess();
      setUser(mapped);
      bootDoneRef.current = true;
      setIsLoading(false);
    } catch (gateErr) {
      recordLoginFailure();
      const msg = gateErr instanceof Error ? gateErr.message : WEB_ACCESS_DENIED_MESSAGE;
      throw new Error(msg);
    }
  };

  const logout = async () => {
    clearIngresosCartDraft();
    clearEgresosCartDraft();
    clearComprasDocDraft();
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      logout,
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
