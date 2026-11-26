import type { PersonalRepository } from '../../ports/personal.repository.js'
import type { TreatmentPatch } from '../../../domain/personal/entities.js'
import { treatmentNotFound } from '../../../domain/personal/errors.js'

/** Cambia el catálogo. Los detalles de plan ya creados conservan su precio_acordado. */
export async function updateTreatment(repo: PersonalRepository, id: string, patch: TreatmentPatch) {
  const treatment = await repo.updateTreatment(id, patch)
  if (!treatment) throw treatmentNotFound()
  return treatment
}
