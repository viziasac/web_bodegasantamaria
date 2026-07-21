// src/context/AuthContext.tsx — Supabase Auth + gate acceso_web
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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

/** Evita login en blanco si getSession/perfil no responden (red / CSP / Supabase caído). */
const SESSION_BOOT_TIMEOUT_MS = 8_000;

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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySessionUser = useCallback(async (supaUser: {
    id: string;
    email?: string | null;
    app_metadata?: Record<string, unknown>;
  } | null): Promise<AppUser | null> => {
    if (!supaUser) {
      setUser(null);
      return null;
    }
    try {
      const mapped = await withTimeout(
        resolveAuthenticatedWebUser(supaUser),
        SESSION_BOOT_TIMEOUT_MS,
        'Validación de sesión',
      );
      setUser(mapped);
      return mapped;
    } catch (err) {
      setUser(null);
      const msg = err instanceof Error ? err.message : '';
      const isAccessDenied =
        msg.includes('acceso web') ||
        msg.includes('acceso_web') ||
        msg.includes('inactivo') ||
        msg === WEB_ACCESS_DENIED_MESSAGE;
      if (isAccessDenied) {
        try {
          sessionStorage.setItem('bodega_auth_denied', 'web');
        } catch { /* ignore */ }
        try {
          await supabase.auth.signOut();
        } catch { /* ignore */ }
      }
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const finishLoading = () => {
      if (!cancelled) setIsLoading(false);
    };

    const boot = async () => {
      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_BOOT_TIMEOUT_MS,
          'Lectura de sesión',
        );
        if (cancelled) return;
        if (session?.user) {
          await applySessionUser(session.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.warn('[Auth] bootstrap sesión:', err);
        if (!cancelled) setUser(null);
      } finally {
        finishLoading();
      }
    };

    void boot();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return;
      if (cancelled) return;
      if (session?.user) {
        await applySessionUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
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
      const mapped = await withTimeout(
        resolveAuthenticatedWebUser(data.user),
        SESSION_BOOT_TIMEOUT_MS,
        'Validación de acceso',
      );
      recordLoginSuccess();
      setUser(mapped);
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
