import { fromCents, toCents, type PaymentInput } from '../../../domain/pagos/entities.js'
import { conflict, invalid, notFound } from '../../../domain/pagos/errors.js'
import type { DocumentRow, PaymentsRepository } from '../../ports/pagos.repository.js'

/**
 * Cobro atómico: bloquea la obligación, valida el saldo, inserta el pago y su documento
 * (opcional, boleta o factura, nunca ambos). Si algo falla, el repositorio hace ROLLBACK completo.
 */
export function createPayment(repo: PaymentsRepository, input: PaymentInput) {
  return repo.transaction(async tx => {
    const obligation = await tx.lockObligation(input.id_obligacion) // SELECT ... FOR UPDATE
    if (!obligation) throw notFound('La obligación no existe.')
    if (!(await tx.methodExists(input.id_metodopago))) throw notFound('El método de pago no existe.')
    const amount = toCents(input.importe)
    if (amount <= 0n) throw invalid('El importe debe ser mayor que cero.')
    const balance = toCents(obligation.importe) - toCents(await tx.paidTotal(obligation.id_obligacion))
    if (amount > balance) throw conflict('SOBREPAGO', 'El importe supera el saldo pendiente de la obligación.')
    const payment = await tx.insertPayment({ id_obligacion: input.id_obligacion, id_metodopago: input.id_metodopago, importe: input.importe, referencia: input.referencia })
    let documento: DocumentRow | null = null
    const doc = input.documento
    if (doc) {
      const numero = doc.numero ?? (await tx.nextNumber(doc.tipo, doc.serie)) // numeración con bloqueo, sin carrera
      documento = await tx.insertDocument({
        tipo: doc.tipo, id_pago: payment.id_pago, serie: doc.serie, numero,
        receptor: doc.tipo === 'boleta' ? (doc.nombre_receptor ?? '') : doc.razon_social_receptor,
        documento_receptor: doc.tipo === 'boleta' ? doc.documento_receptor : doc.ruc_receptor,
      })
    }
    return { ...payment, saldo_restante: fromCents(balance - amount), documento }
  })
}
