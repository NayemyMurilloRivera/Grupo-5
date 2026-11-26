import type { PersonalRepository } from '../../ports/personal.repository.js'
import type { EmployeeFilters } from '../../../domain/personal/entities.js'

export function listEmployees(repo: PersonalRepository, filters: EmployeeFilters) {
  return repo.listEmployees(filters)
}
