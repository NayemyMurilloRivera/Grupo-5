import { forbidden } from '../../../domain/pagos/errors.js'
import type { PaymentsRepository } from '../../ports/pagos.repository.js'
import { getAccount } from './getAccount.js'
/** El titular sale de la sesión, nunca de un parámetro de la petición. */
export const getMyAccount = (repo: PaymentsRepository, idPaciente: string | undefined) => {
  if (!idPaciente) throw forbidden()
  return getAccount(repo, idPaciente)
}
