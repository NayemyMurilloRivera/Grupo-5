import { responseRows, parseJsonFields } from '../../services/adapters'
export const toRows = responseRows
export const toPayload = (values: Record<string, unknown>) => parseJsonFields(values, [])
