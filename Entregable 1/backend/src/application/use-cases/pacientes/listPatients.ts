import type { PatientRepository } from '../../ports/pacientes.repository.js'
import type { PatientFilters, PatientScope } from '../../../domain/pacientes/entities.js'

export function listPatients(repo: PatientRepository, filters: PatientFilters, scope: PatientScope) {
  return repo.listPatients(filters, scope)
}
