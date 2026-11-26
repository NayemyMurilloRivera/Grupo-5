import type { SecurityRepository } from '../../ports/seguridad.repository.js'
import type { AccountPatch } from '../../../domain/seguridad/entities.js'
import { lastAdministrator, missing, validateOwner } from '../../../domain/seguridad/errors.js'
import { hashPassword } from '../../../infrastructure/auth/credentials.js'

export async function updateUser(repo: SecurityRepository, actorId: string, userId: string, input: AccountPatch) {
  const { password, ...patch } = input
  const credential = password === undefined ? undefined : await hashPassword(password)
  return repo.withAdministration(actorId, async (tx, adminRoleId) => {
    const account = await tx.getUserForUpdate(userId)
    if (!account) throw missing('El usuario no existe.')
    const roleId = patch.id_rol ?? account.id_rol
    const status = patch.estado ?? account.estado
    if (patch.id_rol) validateOwner(await tx.findRole(roleId), account.id_empleado, account.id_paciente)
    if (account.estado === 'activo' && account.id_rol === adminRoleId && account.id_empleado &&
        (roleId !== adminRoleId || status !== 'activo') && !await tx.hasOtherAdministrator(adminRoleId, userId)) {
      throw lastAdministrator()
    }
    return tx.updateUser(userId, { ...patch, credencial_acceso: credential })
  })
}
