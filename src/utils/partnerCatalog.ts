import type { MaCliente, MaProveedor } from '../types';

const CONDICION_LABELS: Record<string, string> = {
  CONTADO: 'Contado',
  CREDITO: 'Crédito',
};

const CLIENTE_TIPO_LABELS: Record<string, string> = {
  MAYORISTA: 'Mayorista',
  DISTRIBUIDOR: 'Distribuidor',
  TIENDA_PROPIA: 'Tienda propia',
  MINIMARKET: 'Minimarket',
  NATURAL: 'Persona natural',
  JURIDICA: 'Persona jurídica',
  MINORISTA: 'Minorista',
  OTRO: 'Otro',
};

export function getDefaultProveedorId(proveedores: MaProveedor[]): string {
  return proveedores.find((p) => p.es_default && p.activo !== false)?.id
    ?? proveedores.find((p) => p.activo !== false)?.id
    ?? '';
}

export function getDefaultClienteId(clientes: MaCliente[]): string {
  return clientes.find((c) => c.es_default && c.activo !== false)?.id
    ?? clientes.find((c) => c.activo !== false)?.id
    ?? '';
}

export function proveedorLabel(p: MaProveedor): string {
  const parts = [p.nombre];
  if (p.tipo) parts.push(p.tipo);
  if (p.condicion_pago) parts.push(CONDICION_LABELS[p.condicion_pago] ?? p.condicion_pago);
  return parts.join(' · ');
}

export function clienteLabel(c: MaCliente): string {
  const parts = [c.nombre];
  if (c.tipo) parts.push(CLIENTE_TIPO_LABELS[c.tipo] ?? c.tipo);
  if (c.condicion_pago) parts.push(CONDICION_LABELS[c.condicion_pago] ?? c.condicion_pago);
  return parts.join(' · ');
}
