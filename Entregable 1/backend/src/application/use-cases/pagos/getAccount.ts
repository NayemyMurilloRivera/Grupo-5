import { fromCents, toCents } from '../../../domain/pagos/entities.js'
import { notFound } from '../../../domain/pagos/errors.js'
import type { PaymentsRepository } from '../../ports/pagos.repository.js'
export async function getAccount(repo: PaymentsRepository, idPaciente: string) {
  const found = await repo.getAccount(idPaciente)
  if (!found) throw notFound('El paciente no existe.')
  const account = found
  const sum = (pick: (o: typeof account.obligaciones[number]) => string) => fromCents(account.obligaciones.reduce((s, o) => s + toCents(pick(o)), 0n))
  return {
    id_paciente: account.id_paciente, paciente: account.paciente,
    obligado: sum(o => o.obligado), pagado: sum(o => o.pagado), saldo: sum(o => o.saldo),
    obligaciones: account.obligaciones,
  }
}
