/**
 * Capa API modular por dominio.
 *
 * - core: parseNum, callRpc, getUserId
 * - catalog / inventory / recipes / production / transfers
 * - expenses / sales / reports / dashboard / writes / users
 *
 * Compat: `services/apiProvider.ts` reexporta este barrel.
 * Nuevo código puede importar desde aquí o un dominio (`./sales`).
 */
export * from './core';
export * from './catalog';
export * from './inventory';
export * from './recipes';
export * from './production';
export * from './transfers';
export * from './expenses';
export * from './sales';
export * from './reports';
export * from './dashboard';
export * from './writes';
export * from './users';
