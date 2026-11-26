import type { PaymentsRepository } from '../../ports/pagos.repository.js'
export const listPaymentMethods = async (repo: PaymentsRepository) => ({ items: await repo.listMethods() })
