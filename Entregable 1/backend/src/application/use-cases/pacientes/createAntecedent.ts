import type { PatientRepository } from '../../ports/pacientes.repository.js'
import type { AntecedentInput, PatientScope } from '../../../domain/pacientes/entities.js'
import { historyNotFound } from '../../../domain/pacientes/errors.js'

export async function createAntecedent(repo: Pick<PatientRepository, 'createAntecedent'>, patientId: string,
  input: AntecedentInput, scope: PatientScope) {
  const antecedent = await repo.createAntecedent(patientId, input, scope)
  if (!antecedent) throw historyNotFound()
  return antecedent
}
