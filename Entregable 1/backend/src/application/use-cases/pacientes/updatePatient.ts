import type { PatientRepository } from '../../ports/pacientes.repository.js'
import type { PatientPatch, PatientScope } from '../../../domain/pacientes/entities.js'
import { patientNotFound } from '../../../domain/pacientes/errors.js'

export async function updatePatient(repo: Pick<PatientRepository, 'updatePatient'>, id: string,
  input: PatientPatch, scope: PatientScope) {
  const patient = await repo.updatePatient(id, input, scope)
  if (!patient) throw patientNotFound()
  return patient
}
