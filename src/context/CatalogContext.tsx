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
      const settled = await Promise.allSettled([
        bodegaService.getUbicaciones(),
        bodegaService.getItems(),
        bodegaService.getPresentaciones(),
        bodegaService.getCategoriasGasto(),
        bodegaService.getProveedores(),
        bodegaService.getClientes(),
        bodegaService.getCanalesVenta(),
      ]);

      const value = <T,>(i: number, fallback: T): T => {
        const r = settled[i];
        return r.status === 'fulfilled' ? (r.value as T) : fallback;
      };
      const failMsg = (i: number) => {
        const r = settled[i];
        return r.status === 'rejected'
          ? (r.reason instanceof Error ? r.reason.message : String(r.reason))
          : null;
      };

      // Núcleo operativo: sin ubicaciones/ítems la web no puede trabajar.
      const coreErr = failMsg(0) || failMsg(1) || failMsg(2);
      if (coreErr && value(0, [] as CatUbicacion[]).length === 0 && value(1, [] as MaItem[]).length === 0) {
        throw new Error(coreErr);
      }

      const ubicaciones = value(0, [] as CatUbicacion[]);
      const items = value(1, [] as MaItem[]);
      const presentaciones = value(2, [] as MaPresentacion[]);
      const categoriasGasto = value(3, [] as GasCategoria[]);
      const proveedores = value(4, [] as MaProveedor[]);
      const clientes = value(5, [] as MaCliente[]);
      const canalesVenta = value(6, [] as { codigo: string; nombre: string }[]);

      const softFails = [failMsg(3), failMsg(4), failMsg(5), failMsg(6)].filter(Boolean);
      const softWarn = softFails.length
        ? `Catálogo parcial: ${softFails[0]}${softFails.length > 1 ? ` (+${softFails.length - 1})` : ''}`
        : null;

      const next = {
        ubicaciones,
        items,
        presentaciones,
        categoriasGasto,
        proveedores,
        clientes,
        canalesVenta,
        loaded: true,
        loading: false,
        error: softWarn ?? (coreErr && (ubicaciones.length === 0 || items.length === 0) ? coreErr : null),
      };
      setState(next);
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        ubicaciones, items, presentaciones, categoriasGasto, proveedores, clientes, canalesVenta,
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        loaded: s.ubicaciones.length > 0 || s.items.length > 0 ? true : s.loaded,
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
