import type { PatientRepository } from '../../ports/pacientes.repository.js'
import type { PatientScope } from '../../../domain/pacientes/entities.js'
import { historyNotFound } from '../../../domain/pacientes/errors.js'

export async function getHistory(repo: Pick<PatientRepository, 'findHistory'>, patientId: string, scope: PatientScope) {
  const history = await repo.findHistory(patientId, scope)
  if (!history) throw historyNotFound()
  return history
}
