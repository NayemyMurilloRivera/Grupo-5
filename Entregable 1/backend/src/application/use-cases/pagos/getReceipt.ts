import { notFound } from '../../../domain/pagos/errors.js'
import type { PaymentsRepository } from '../../ports/pagos.repository.js'
export async function getReceipt(repo: PaymentsRepository, idPago: string) {
  const found = await repo.getReceipt(idPago)
  if (!found.existePago) throw notFound('El pago no existe.')
  if (!found.documento) throw notFound('El pago todavía no tiene boleta ni factura.')
  return { ...found.documento, importe: found.importe, codigo: `${found.documento.serie}-${found.documento.numero.padStart(8, '0')}` }
}
