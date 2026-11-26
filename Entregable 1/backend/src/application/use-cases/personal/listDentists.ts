import type { PersonalRepository } from '../../ports/personal.repository.js'
import type { DentistFilters } from '../../../domain/personal/entities.js'

/** Profesionales activos con colegiatura, disponibles para asignarse a un plan de tratamiento. */
export function listDentists(repo: PersonalRepository, filters: DentistFilters) {
  return repo.listDentists(filters)
}
