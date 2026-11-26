import type { PersonalRepository } from '../../ports/personal.repository.js'
import type { TreatmentInput } from '../../../domain/personal/entities.js'

export function createTreatment(repo: PersonalRepository, input: TreatmentInput) {
  return repo.createTreatment(input)
}
