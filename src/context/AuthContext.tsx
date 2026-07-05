// src/context/AuthContext.tsx — Supabase Auth real
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import type { AppUser } from '../types';

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const mapUser = (supaUser: { id: string; email?: string; app_metadata?: { role?: string } }): AppUser => ({
    id: supaUser.id,
    email: supaUser.email || '',
    role: (supaUser.app_metadata?.role?.trim() || 'operario') as AppUser['role'],
  });

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(mapUser(session.user));
      }
      setIsLoading(false);
    });

    // Listen for auth changes
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
    setIsLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setIsLoading(false);
      const msg = error.message.toLowerCase();
      if (msg.includes('invalid api key')) {
        throw new Error('Error de conexión con Supabase. Recargue la página o contacte al administrador.');
      }
      if (error.message === 'Invalid login credentials') {
        throw new Error('Credenciales inválidas. Verifique su correo y contraseña.');
      }
      throw new Error(error.message);
    }
    if (data.user) {
      setUser(mapUser(data.user));
    }
    setIsLoading(false);
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
      isLoading
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
