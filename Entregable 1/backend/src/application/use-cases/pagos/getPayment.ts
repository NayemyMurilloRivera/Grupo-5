import { notFound } from '../../../domain/pagos/errors.js'
import type { PaymentsRepository } from '../../ports/pagos.repository.js'
export async function getPayment(repo: PaymentsRepository, id: string) {
  const payment = await repo.getPayment(id)
  if (!payment) throw notFound('El pago no existe.')
  return { ...payment, codigo: 'PAG-' + payment.id_pago }
}
