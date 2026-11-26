import type { SecurityRepository } from '../../ports/seguridad.repository.js'

export async function listRoles(repo: SecurityRepository) {
  return { items: await repo.listRoles() }
}
