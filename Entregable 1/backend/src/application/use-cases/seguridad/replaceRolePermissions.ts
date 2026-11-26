import type { SecurityRepository } from '../../ports/seguridad.repository.js'
import { missing } from '../../../domain/seguridad/errors.js'

export async function replaceRolePermissions(repo: SecurityRepository, actorId: string, roleId: string, permissionIds: string[]) {
  return repo.withAdministration(actorId, async tx => {
    if (!await tx.findRole(roleId)) throw missing('El rol no existe.')
    await tx.replaceRolePermissions(roleId, permissionIds)
    return { id_rol: roleId, ids_permiso: permissionIds }
  })
}
