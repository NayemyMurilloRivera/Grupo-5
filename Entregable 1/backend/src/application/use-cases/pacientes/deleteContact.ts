import type { PatientRepository } from '../../ports/pacientes.repository.js'
import type { PatientScope } from '../../../domain/pacientes/entities.js'
import { patientNotFound } from '../../../domain/pacientes/errors.js'

export async function deleteContact(repo: Pick<PatientRepository, 'deleteContact'>, patientId: string,
  contactId: string, scope: PatientScope) {
  if (!await repo.deleteContact(patientId, contactId, scope)) throw patientNotFound()
}
