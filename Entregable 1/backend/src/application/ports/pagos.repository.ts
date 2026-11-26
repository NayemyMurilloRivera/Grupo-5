import type { DocumentKind, PaymentMethod, ReceivableRow, ReceivablesFilters } from '../../domain/pagos/entities.js'

export interface PaymentRow { id_pago: string; fecha_hora: string; importe: string; referencia: string | null; id_obligacion: string; id_metodopago: string }
export interface DocumentRow { tipo: DocumentKind; id_pago: string; serie: string; numero: string; fecha_emision: string; receptor: string; documento_receptor: string | null }
export interface NewDocument {
  tipo: DocumentKind; id_pago: string; serie: string; numero: string
  receptor: string; documento_receptor: string | null
}

/** Operaciones que deben compartir una única transacción (mismo cliente de BEGIN a COMMIT). */
export interface PaymentTx {
  lockObligation(id: string): Promise<{ id_obligacion: string; importe: string } | null>
  paidTotal(idObligacion: string): Promise<string>
  methodExists(id: string): Promise<boolean>
  insertPayment(input: { id_obligacion: string; id_metodopago: string; importe: string; referencia: string | null }): Promise<PaymentRow>
  nextNumber(tipo: DocumentKind, serie: string): Promise<string>
  insertDocument(doc: NewDocument): Promise<DocumentRow>
}

export interface PaymentsRepository {
  transaction<T>(work: (tx: PaymentTx) => Promise<T>): Promise<T>
  listMethods(): Promise<PaymentMethod[]>
  createMethod(nombre: string): Promise<PaymentMethod>
  getPayment(id: string): Promise<(PaymentRow & { metodo: string; id_paciente: string; paciente: string; comprobante: string | null }) | null>
  getAccount(idPaciente: string): Promise<{
    id_paciente: string; paciente: string
    obligaciones: Array<{ id_obligacion: string; fecha_emision: string; fecha_vencimiento: string | null; obligado: string; pagado: string; saldo: string }>
  } | null>
  getReceipt(idPago: string): Promise<{ existePago: boolean; documento: DocumentRow | null; importe: string | null }>
  receivables(filters: Omit<ReceivablesFilters, 'formato'>): Promise<ReceivableRow[]>
}
