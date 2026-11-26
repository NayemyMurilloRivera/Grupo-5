import type { DocumentInput, PaymentInput, ReceivablesFilters } from '../../../domain/pagos/entities.js'
import { invalid } from '../../../domain/pagos/errors.js'

const MAX_BIGINT = 9223372036854775807n

function fields(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('Envíe un objeto JSON válido.')
  if (Object.keys(value).some(key => !allowed.includes(key))) throw invalid('La solicitud contiene campos no permitidos.')
  return value as Record<string, unknown>
}
function text(value: unknown, field: string, max: number): string {
  const t = typeof value === 'string' ? value.trim() : ''
  if (!t || t.length > max || /[\x00-\x1f\x7f]/.test(t)) throw invalid(`Campo inválido: ${field}.`)
  return t
}
const optionalText = (value: unknown, field: string, max: number) =>
  value === undefined || value === null || value === '' ? null : text(value, field, max)

/** IDs BIGINT como texto: un número JS pierde precisión sobre 2^53. */
export function requiredId(value: unknown, field = 'id'): string {
  const raw = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value
  if (typeof raw !== 'string' || !/^[1-9]\d{0,18}$/.test(raw) || BigInt(raw) > MAX_BIGINT) throw invalid(`Identificador inválido: ${field}.`)
  return raw
}
/** Importe positivo con hasta dos decimales, como texto (sin float). */
export function amount(value: unknown, field = 'importe', allowZero = false): string {
  const raw = typeof value === 'number' ? String(value) : value
  if (typeof raw !== 'string' || !/^\d{1,10}(\.\d{1,2})?$/.test(raw.trim())) throw invalid(`Campo inválido: ${field}. Use hasta dos decimales.`)
  const t = raw.trim()
  if (!allowZero && Number(t) <= 0) throw invalid(`El campo ${field} debe ser mayor que cero.`)
  return t
}
const serie = (value: unknown) => {
  const s = text(value, 'serie', 10).toUpperCase()
  if (!/^[A-Z0-9]{1,10}$/.test(s)) throw invalid('Serie inválida.')
  return s
}
const numero = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  return requiredId(value, 'numero')
}

export function documentInput(value: unknown): DocumentInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('El documento debe ser un objeto.')
  const kind = (value as Record<string, unknown>).tipo
  if (kind === 'boleta') {
    const d = fields(value, ['tipo', 'serie', 'numero', 'nombre_receptor', 'documento_receptor'])
    return { tipo: 'boleta', serie: serie(d.serie), numero: numero(d.numero), nombre_receptor: optionalText(d.nombre_receptor, 'nombre_receptor', 200), documento_receptor: optionalText(d.documento_receptor, 'documento_receptor', 30) }
  }
  if (kind === 'factura') {
    const d = fields(value, ['tipo', 'serie', 'numero', 'razon_social_receptor', 'ruc_receptor'])
    const ruc = text(d.ruc_receptor, 'ruc_receptor', 11)
    if (!/^[0-9]{11}$/.test(ruc)) throw invalid('El RUC debe tener 11 dígitos.')
    return { tipo: 'factura', serie: serie(d.serie), numero: numero(d.numero), razon_social_receptor: text(d.razon_social_receptor, 'razon_social_receptor', 200), ruc_receptor: ruc }
  }
  throw invalid('El tipo de documento debe ser boleta o factura (nunca ambos).')
}

export function paymentInput(body: unknown): PaymentInput {
  const b = fields(body, ['id_obligacion', 'id_metodopago', 'importe', 'referencia', 'documento'])
  const input: PaymentInput = {
    id_obligacion: requiredId(b.id_obligacion, 'id_obligacion'),
    id_metodopago: requiredId(b.id_metodopago, 'id_metodopago'),
    importe: amount(b.importe),
    referencia: optionalText(b.referencia, 'referencia', 100),
  }
  if (b.documento !== undefined && b.documento !== null) input.documento = documentInput(b.documento)
  return input
}

export function methodInput(body: unknown): string {
  return text(fields(body, ['nombre']).nombre, 'nombre', 60)
}

const date = (value: unknown, field: string): string | undefined => {
  if (value === undefined || value === '') return undefined
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value + 'T00:00:00Z')) ||
      new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) throw invalid(`Fecha inválida: ${field}. Use AAAA-MM-DD.`)
  return value
}
export function reportFilters(query: unknown): ReceivablesFilters {
  const q = fields(query ?? {}, ['desde', 'hasta', 'saldoMinimo', 'formato'])
  const desde = date(q.desde, 'desde'), hasta = date(q.hasta, 'hasta')
  if (desde && hasta && desde > hasta) throw invalid('desde no puede ser posterior a hasta.')
  const formato = q.formato === undefined || q.formato === '' ? 'json' : q.formato
  if (formato !== 'json' && formato !== 'csv') throw invalid('formato debe ser json o csv.')
  return { desde, hasta, saldoMinimo: q.saldoMinimo === undefined || q.saldoMinimo === '' ? '0.01' : amount(q.saldoMinimo, 'saldoMinimo', true), formato }
}
