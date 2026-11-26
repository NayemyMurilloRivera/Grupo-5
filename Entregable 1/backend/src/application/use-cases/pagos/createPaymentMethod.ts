import type { PaymentsRepository } from '../../ports/pagos.repository.js'
export const createPaymentMethod = (repo: PaymentsRepository, nombre: string) => repo.createMethod(nombre)
