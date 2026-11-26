import type { Row } from '../types/module'
export function responseRows(response: unknown): Row[] {
 if (response === null || response === undefined) return []
 const envelope = response as { items?: unknown; data?: unknown }
 const value = envelope.items ?? envelope.data ?? response
 const rows = Array.isArray(value) ? value : [value]
 if (!rows.every(row => typeof row === 'object' && row !== null && !Array.isArray(row))) throw new Error('Respuesta de consulta inválida')
 return rows as Row[]
}
export function parseJsonFields(values: Record<string, unknown>, fields: string[]): Record<string, unknown> {
 const body = { ...values }
 for (const field of fields) {
  if (body[field] === '' || body[field] === undefined) delete body[field]
  else if (typeof body[field] === 'string') body[field] = JSON.parse(body[field] as string)
 }
 return body
}
