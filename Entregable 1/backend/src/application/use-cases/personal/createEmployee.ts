import type { PersonalRepository } from '../../ports/personal.repository.js'
import type { EmployeeInput } from '../../../domain/personal/entities.js'

/** Inserta EMPLEADO y su único subtipo con el mismo identificador; si falla cualquiera de los dos, no queda nada. */
export function createEmployee(repo: PersonalRepository, input: EmployeeInput) {
  return repo.withTransaction(async tx => {
    const { tipo_documento, numero_documento, nombres, apellidos, telefono, estado } = input
    const id = await tx.insertEmployee({ tipo_documento, numero_documento, nombres, apellidos, telefono, estado })
    if (input.subtipo === 'odontologo') await tx.insertDentist(id, input.numero_colegiatura)
    else await tx.insertSupport(id, input.cargo)
    await tx.checkDeferred()
    return (await tx.findEmployee(id))!
  })
}
