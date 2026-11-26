import type { PersonalRepository } from '../../ports/personal.repository.js'
import type { EmployeeScope } from '../../../domain/personal/entities.js'
import { employeeNotFound, personalAccessDenied } from '../../../domain/personal/errors.js'

export async function getEmployee(repo: PersonalRepository, id: string, scope: EmployeeScope) {
  // El alcance propio solo permite la ficha del empleado titular de la sesión.
  if (scope.alcance === 'propio' && scope.idEmpleado !== id) throw personalAccessDenied()
  const employee = await repo.findEmployee(id)
  if (!employee) throw employeeNotFound()
  return employee
}
