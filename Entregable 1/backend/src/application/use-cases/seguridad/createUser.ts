import type { SecurityRepository } from '../../ports/seguridad.repository.js'
import type { AccountInput } from '../../../domain/seguridad/entities.js'
import { validateOwner } from '../../../domain/seguridad/errors.js'
import { hashPassword } from '../../../infrastructure/auth/credentials.js'

export async function createUser(repo: SecurityRepository, actorId: string, input: AccountInput) {
  const { password, ...account } = input
  const credential = await hashPassword(password)
  return repo.withAdministration(actorId, async tx => {
    validateOwner(await tx.findRole(input.id_rol), input.id_empleado, input.id_paciente)
    return tx.createUser({ ...account, credencial_acceso: credential })
  })
}
