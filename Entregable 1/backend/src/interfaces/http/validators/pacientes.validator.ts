import type { PatientFilters, PatientScope } from '../../../domain/pacientes/entities.js'
import { invalidPatientInput, patientAccessDenied } from '../../../domain/pacientes/errors.js'

export function patientId(value: unknown, name = 'id'): string {
  if (typeof value === 'number' && Number.isSafeInteger(value)) value = String(value)
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) {
    throw invalidPatientInput(`Identificador inválido: ${name}.`)
  }
  return value
}

function optionalText(value: unknown, name: string, max: number): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\x00-\x1f\x7f]/.test(value)) {
    throw invalidPatientInput(`Campo inválido: ${name}.`)
  }
  return value.trim()
}

function pageNumber(value: unknown, name: string, fallback: number, max: number) {
  if (value === undefined) return fallback
  const result = Number(patientId(value, name))
  if (result > max) throw invalidPatientInput(`Campo fuera de rango: ${name}.`)
  return result
}

export function listPatientsInput(value: unknown): PatientFilters {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidPatientInput('Consulta inválida.')
  const data = value as Record<string, unknown>
  const allowed = ['q', 'tipo_documento', 'numero_documento', 'pagina', 'limite']
  if (Object.keys(data).some(key => !allowed.includes(key))) throw invalidPatientInput('La consulta contiene campos no permitidos.')
  return {
    q: optionalText(data.q, 'q', 150),
    tipo_documento: optionalText(data.tipo_documento, 'tipo_documento', 20),
    numero_documento: optionalText(data.numero_documento, 'numero_documento', 30),
    pagina: pageNumber(data.pagina, 'pagina', 1, 1_000_000),
    limite: pageNumber(data.limite, 'limite', 25, 100),
  }
}

export function patientScope(value: unknown): PatientScope {
  if (value && typeof value === 'object') {
    const scope = value as Record<string, unknown>
    if (scope.alcance === 'global') return { alcance: 'global' }
    if (scope.alcance === 'propio' && scope.idPaciente !== undefined) {
      return { alcance: 'propio', idPaciente: patientId(scope.idPaciente, 'idPaciente') }
    }
    if (scope.alcance === 'asignado' && scope.idEmpleado !== undefined) {
      return { alcance: 'asignado', idEmpleado: patientId(scope.idEmpleado, 'idEmpleado') }
    }
  }
  throw patientAccessDenied()
}
