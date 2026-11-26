import type { PatientRepository } from '../../ports/pacientes.repository.js'
import type { PatientScope } from '../../../domain/pacientes/entities.js'
import { patientNotFound } from '../../../domain/pacientes/errors.js'

export async function getPatient(repo: PatientRepository, id: string, scope: PatientScope) {
  const patient = await repo.findPatient(id, scope)
  if (!patient) throw patientNotFound()
  return patient
}
