import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { bodegaService } from '../services/bodegaService';
import type { CatUbicacion, MaItem, MaPresentacion, GasCategoria, MaProveedor, MaCliente } from '../types';

interface CatalogState {
  ubicaciones: CatUbicacion[];
  items: MaItem[];
  presentaciones: MaPresentacion[];
  categoriasGasto: GasCategoria[];
  proveedores: MaProveedor[];
  clientes: MaCliente[];
  canalesVenta: { codigo: string; nombre: string }[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

interface CatalogContextType extends CatalogState {
  ensureCatalogLoaded: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

const CACHE_KEY = 'bodega_catalog_v1';

export const CatalogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<CatalogState>({
    ubicaciones: [],
    items: [],
    presentaciones: [],
    categoriasGasto: [],
    proveedores: [],
    clientes: [],
    canalesVenta: [],
    loaded: false,
    loading: false,
    error: null,
  });

  const loadFromCache = (): boolean => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      setState((s) => ({ ...s, ...parsed, loaded: true }));
      return true;
    } catch {
      return false;
    }
  };

  const refreshCatalog = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [ubicaciones, items, presentaciones, categoriasGasto, proveedores, clientes, canalesVenta] = await Promise.all([
        bodegaService.getUbicaciones(),
        bodegaService.getItems(),
        bodegaService.getPresentaciones(),
        bodegaService.getCategoriasGasto(),
        bodegaService.getProveedores(),
        bodegaService.getClientes(),
        bodegaService.getCanalesVenta(),
      ]);
      const next = {
        ubicaciones,
        items,
        presentaciones,
        categoriasGasto,
        proveedores,
        clientes,
        canalesVenta: canalesVenta as { codigo: string; nombre: string }[],
        loaded: true,
        loading: false,
        error: null,
      };
      setState(next);
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        ubicaciones, items, presentaciones, categoriasGasto, proveedores, clientes, canalesVenta,
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Error cargando catálogos',
      }));
    }
  }, []);

  const ensureCatalogLoaded = useCallback(async () => {
    if (state.loaded && state.ubicaciones.length > 0) return;
    if (!state.loaded) loadFromCache();
    await refreshCatalog();
  }, [state.loaded, state.ubicaciones.length, refreshCatalog]);

  useEffect(() => {
    if (isAuthenticated) {
      ensureCatalogLoaded();
    } else {
      setState({
        ubicaciones: [],
        items: [],
        presentaciones: [],
        categoriasGasto: [],
        proveedores: [],
        clientes: [],
        canalesVenta: [],
        loaded: false,
        loading: false,
        error: null,
      });
    }
  }, [isAuthenticated, ensureCatalogLoaded]);

  return (
    <CatalogContext.Provider value={{ ...state, ensureCatalogLoaded, refreshCatalog }}>
      {children}
    </CatalogContext.Provider>
  );
};

export const useCatalog = () => {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog debe usarse dentro de CatalogProvider');
  return ctx;
};

export const clearCatalogCache = () => localStorage.removeItem(CACHE_KEY);
