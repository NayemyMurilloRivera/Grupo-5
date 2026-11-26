import type { PatientRepository } from '../../ports/pacientes.repository.js'
import type { PatientInput, PatientScope } from '../../../domain/pacientes/entities.js'
import { patientAccessDenied } from '../../../domain/pacientes/errors.js'

export function createPatient(repo: Pick<PatientRepository, 'createPatient'>, input: PatientInput,
  scope: PatientScope, canRegisterAntecedents = false) {
  if (scope.alcance !== 'global' || (input.antecedentes.length > 0 && !canRegisterAntecedents)) {
    throw patientAccessDenied()
  }
  return repo.createPatient(input)
}
