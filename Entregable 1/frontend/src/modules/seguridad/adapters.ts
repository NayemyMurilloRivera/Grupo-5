import { responseRows } from '../../services/adapters'
export const toRows = responseRows
export function toPayload(values: Record<string, unknown>) {
  const payload = { ...values }
  for (const field of ['id_empleado', 'id_paciente'] as const) {
    if (typeof payload[field] === 'string' && payload[field].trim() === '') delete payload[field]
  }
  return payload
}

export function toRoleRows(response: unknown) {
  return responseRows(response).map(row => {
    const permissions = Array.isArray(row.permisos) ? row.permisos : []
    return { ...row, cantidad_permisos: permissions.length }
  })
}
