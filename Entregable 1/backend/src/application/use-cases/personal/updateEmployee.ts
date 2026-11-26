import type { PersonalRepository } from '../../ports/personal.repository.js'
import type { EmployeePatch } from '../../../domain/personal/entities.js'
import { employeeNotFound, subtypeMismatch } from '../../../domain/personal/errors.js'

/** Modifica datos y estado sin transformar el subtipo: cada campo propio solo se acepta en su subtipo actual. */
export function updateEmployee(repo: PersonalRepository, id: string, patch: EmployeePatch) {
  return repo.withTransaction(async tx => {
    const current = await tx.lockEmployee(id)
    if (!current) throw employeeNotFound()
    const { numero_colegiatura, cargo, ...data } = patch
    if (numero_colegiatura !== undefined && current.subtipo !== 'odontologo') throw subtypeMismatch('numero_colegiatura')
    if (cargo !== undefined && current.subtipo !== 'apoyo') throw subtypeMismatch('cargo')
    if (Object.keys(data).length) await tx.updateEmployee(id, data)
    if (numero_colegiatura !== undefined) await tx.updateDentist(id, numero_colegiatura)
    if (cargo !== undefined) await tx.updateSupport(id, cargo)
    await tx.checkDeferred()
    return (await tx.findEmployee(id))!
  })
}
