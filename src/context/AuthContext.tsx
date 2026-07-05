// src/context/AuthContext.tsx — Supabase Auth real
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import {
  assertLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
  loginAttemptDelay,
} from '../utils/loginGuard';
import type { AppUser } from '../types';

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GENERIC_LOGIN_ERROR =
  'Credenciales inválidas. Verifique su correo y contraseña o intente más tarde.';

function mapAuthError(error: { message?: string; status?: number }): string {
  const msg = (error.message ?? '').toLowerCase();
  if (error.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return 'Demasiados intentos. Espere unos minutos e intente de nuevo.';
  }
  if (msg.includes('invalid api key')) {
    return 'Error de conexión. Recargue la página o contacte al administrador.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Debe confirmar su correo antes de ingresar.';
  }
  return GENERIC_LOGIN_ERROR;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const mapUser = (supaUser: { id: string; email?: string; app_metadata?: { role?: string } }): AppUser => ({
    id: supaUser.id,
    email: supaUser.email || '',
    role: (supaUser.app_metadata?.role?.trim() || 'operario') as AppUser['role'],
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(mapUser(session.user));
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(mapUser(session.user));
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    assertLoginAllowed();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || password.length < 6 || password.length > 128) {
      recordLoginFailure();
      throw new Error(GENERIC_LOGIN_ERROR);
    }

    await loginAttemptDelay();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      recordLoginFailure();
      throw new Error(mapAuthError(error));
    }

    recordLoginSuccess();
    if (data.user) {
      setUser(mapUser(data.user));
    }
  };

  const logout = async () => {
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
