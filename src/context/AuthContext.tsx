// src/context/AuthContext.tsx — Supabase Auth real
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import { Tables } from '../config/supabaseTables';
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
import type { AppUser } from '../types';

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function resolveUserRole(
  userId: string,
  appMetadata?: { role?: string },
): Promise<AppUser['role']> {
  const metaRole = appMetadata?.role?.trim();
  if (metaRole) return metaRole as AppUser['role'];

  const { data } = await supabase
    .from(Tables.appUserRole)
    .select('role')
    .eq('user_id', userId)
    .eq('activo', true)
    .maybeSingle();

  if (data?.role) return String(data.role).trim() as AppUser['role'];
  return 'operario';
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const mapUser = async (supaUser: {
    id: string;
    email?: string;
    app_metadata?: { role?: string };
  }): Promise<AppUser> => ({
    id: supaUser.id,
    email: supaUser.email || '',
    role: await resolveUserRole(supaUser.id, supaUser.app_metadata),
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(await mapUser(session.user));
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(await mapUser(session.user));
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

    recordLoginSuccess();
    if (data.user) {
      setUser(await mapUser(data.user));
    }
  };

  const logout = async () => {
    clearIngresosCartDraft();
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
