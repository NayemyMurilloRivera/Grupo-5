import type { SecurityRepository } from '../../ports/seguridad.repository.js'

export async function listPermissions(repo: SecurityRepository) {
  return { items: await repo.listPermissions() }
}
