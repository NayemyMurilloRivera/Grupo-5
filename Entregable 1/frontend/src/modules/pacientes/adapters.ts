import { responseRows, parseJsonFields } from '../../services/adapters'

export function toRows(response: unknown) {
  return responseRows(response).map(row => typeof row.nombres === 'string' && typeof row.apellidos === 'string'
    ? { ...row, nombre: `${row.nombres} ${row.apellidos}`, documento: `${row.tipo_documento} ${row.numero_documento}` }
    : row)
}

export const toPayload = (values: Record<string, unknown>) => parseJsonFields(values, [])
