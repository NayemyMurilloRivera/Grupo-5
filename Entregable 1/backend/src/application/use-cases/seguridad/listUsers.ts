import type { SecurityRepository } from '../../ports/seguridad.repository.js'
import type { AccountFilters } from '../../../domain/seguridad/entities.js'

export async function listUsers(repo: SecurityRepository, filters: AccountFilters) {
  return { items: await repo.listUsers(filters), pagina: filters.pagina, limite: filters.limite }
}
