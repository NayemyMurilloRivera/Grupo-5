export type DocumentKind = 'boleta' | 'factura'

export interface PaymentMethod { id_metodopago: string; nombre: string }

export interface BoletaInput { tipo: 'boleta'; serie: string; numero?: string; nombre_receptor: string | null; documento_receptor: string | null }
export interface FacturaInput { tipo: 'factura'; serie: string; numero?: string; razon_social_receptor: string; ruc_receptor: string }
export type DocumentInput = BoletaInput | FacturaInput

export interface PaymentInput {
  id_obligacion: string
  id_metodopago: string
  importe: string
  referencia: string | null
  documento?: DocumentInput
}

export interface ReceivablesFilters { desde?: string; hasta?: string; saldoMinimo: string; formato: 'json' | 'csv' }

export interface ReceivableRow { id_paciente: string; paciente: string; obligaciones: string; obligado: string; pagado: string; saldo: string }
export interface Totals { obligaciones: string; obligado: string; pagado: string; saldo: string }

/** Los importes se manejan como texto decimal y se comparan en centavos enteros: nunca con float. */
export function toCents(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?\d*$/.exec(value.trim())
  if (!match) throw new Error('Importe decimal inválido: ' + value)
  const cents = BigInt(match[2]) * 100n + BigInt((match[3] ?? '').padEnd(2, '0') || '0')
  return match[1] ? -cents : cents
}
export function fromCents(cents: bigint): string {
  const sign = cents < 0n ? '-' : ''
  const abs = cents < 0n ? -cents : cents
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`
}
export function sumTotals(rows: ReceivableRow[]): Totals {
  const add = (pick: (row: ReceivableRow) => string) => rows.reduce((sum, row) => sum + toCents(pick(row)), 0n)
  return {
    obligaciones: rows.reduce((sum, row) => sum + BigInt(row.obligaciones), 0n).toString(),
    obligado: fromCents(add(row => row.obligado)),
    pagado: fromCents(add(row => row.pagado)),
    saldo: fromCents(add(row => row.saldo)),
  }
}
