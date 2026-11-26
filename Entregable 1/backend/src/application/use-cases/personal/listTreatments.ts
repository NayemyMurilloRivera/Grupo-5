import type { PersonalRepository } from '../../ports/personal.repository.js'
import type { TreatmentFilters } from '../../../domain/personal/entities.js'

export function listTreatments(repo: PersonalRepository, filters: TreatmentFilters) {
  return repo.listTreatments(filters)
}
