/**
 * Lectura de gastos.
 */
import { supabase } from '../supabaseClient';
import { Tables } from '../../config/supabaseTables';
import type { GasGasto } from '../../types';

export async function getGastos(limit = 50): Promise<GasGasto[]> {
  const { data, error } = await supabase
    .from(Tables.gasGasto)
    .select('*, gas_categoria(id, nombre, centro_costo)')
    .order('fecha', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
