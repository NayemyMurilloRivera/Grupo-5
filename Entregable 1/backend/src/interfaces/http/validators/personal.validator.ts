import type {
  DentistFilters, EmployeeData, EmployeeFilters, EmployeeInput, EmployeePatch, EmployeeScope, EmployeeStatus, EmployeeSubtype,
  TreatmentFilters, TreatmentInput, TreatmentPatch,
} from '../../../domain/personal/entities.js'
import { positiveId } from '../../../domain/seguridad/entities.js'
import { invalidPersonalInput as invalid, personalAccessDenied } from '../../../domain/personal/errors.js'

function fields(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('Envíe un objeto JSON válido.')
  if (Object.keys(value).some(key => !allowed.includes(key))) throw invalid('La solicitud contiene campos no permitidos.')
  return value as Record<string, unknown>
}

function text(value: unknown, field: string, max: number): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed || trimmed.length > max || /[\x00-\x1f\x7f]/.test(trimmed)) throw invalid(`Campo inválido: ${field}.`)
  return trimmed
}

const optional = <T>(value: unknown, parse: (value: unknown) => T) => value === undefined ? undefined : parse(value)

export function requiredId(value: unknown, field = 'id'): string {
  const id = positiveId(value)
  if (!id) throw invalid(`Identificador inválido: ${field}.`)
  return id
}

function status(value: unknown): EmployeeStatus {
  if (value !== 'activo' && value !== 'inactivo') throw invalid('Estado inválido: use activo o inactivo.')
  return value
}

function subtype(value: unknown): EmployeeSubtype {
  if (value !== 'odontologo' && value !== 'apoyo') throw invalid('Subtipo inválido: use odontologo o apoyo.')
  return value
}

function phone(value: unknown) {
  const number = text(value, 'telefono', 25)
  if (!/^\+?[0-9][0-9 -]{5,23}$/.test(number)) throw invalid('Teléfono inválido.')
  return number
}

function documentNumber(value: unknown) {
  const number = text(value, 'numero_documento', 30)
  if (!/^[A-Za-z0-9-]+$/.test(number)) throw invalid('Número de documento inválido.')
  return number
}

const colegiatura = (value: unknown) => text(value, 'numero_colegiatura', 30)
const cargo = (value: unknown) => text(value, 'cargo', 100)

/** NUMERIC(12,2) no negativo. Se conserva como cadena para no perder precisión en el envío a PostgreSQL. */
function price(value: unknown): string {
  const raw = typeof value === 'number' && Number.isFinite(value) ? String(value) : value
  if (typeof raw !== 'string' || !/^[0-9]{1,10}(\.[0-9]{1,2})?$/.test(raw.trim())) {
    throw invalid('El precio referencial debe ser un importe no negativo con hasta dos decimales.')
  }
  return raw.trim()
}

function description(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || value.length > 2000 || value.includes('\x00')) throw invalid('Campo inválido: descripcion.')
  return value.trim() || null
}

const employeeFields = ['tipo_documento', 'numero_documento', 'nombres', 'apellidos', 'telefono', 'estado'] as const

function employeeData(data: Record<string, unknown>): Partial<EmployeeData> {
  return {
    tipo_documento: optional(data.tipo_documento, value => text(value, 'tipo_documento', 20).toUpperCase()),
    numero_documento: optional(data.numero_documento, documentNumber),
    nombres: optional(data.nombres, value => text(value, 'nombres', 100)),
    apellidos: optional(data.apellidos, value => text(value, 'apellidos', 100)),
    telefono: optional(data.telefono, phone),
    estado: optional(data.estado, status),
  }
}

export function createEmployeeInput(value: unknown): EmployeeInput {
  const data = fields(value, [...employeeFields, 'subtipo', 'numero_colegiatura', 'cargo'])
  for (const field of ['tipo_documento', 'numero_documento', 'nombres', 'apellidos', 'telefono'] as const) {
    if (data[field] === undefined) throw invalid(`Falta el campo obligatorio: ${field}.`)
  }
  const base = { ...employeeData(data), estado: data.estado === undefined ? 'activo' : status(data.estado) } as EmployeeData
  // Un empleado tiene exactamente un subtipo: se rechazan los datos de ambos o los del subtipo contrario.
  if (data.numero_colegiatura !== undefined && data.cargo !== undefined) {
    throw invalid('Un empleado tiene un solo subtipo: indique colegiatura o cargo, no ambos.')
  }
  const kind = subtype(data.subtipo)
  if (kind === 'odontologo') {
    if (data.cargo !== undefined) throw invalid('Un odontólogo no tiene cargo de apoyo.')
    return { ...base, subtipo: kind, numero_colegiatura: colegiatura(data.numero_colegiatura) }
  }
  if (data.numero_colegiatura !== undefined) throw invalid('El personal de apoyo no tiene colegiatura.')
  return { ...base, subtipo: kind, cargo: cargo(data.cargo) }
}

export function updateEmployeeInput(value: unknown): EmployeePatch {
  const data = fields(value, [...employeeFields, 'numero_colegiatura', 'cargo', 'subtipo', 'id_empleado'])
  if (data.subtipo !== undefined) throw invalid('El subtipo no se puede cambiar; registre un nuevo empleado.')
  if (data.id_empleado !== undefined) throw invalid('El identificador del empleado no se puede cambiar.')
  if (Object.keys(data).length === 0) throw invalid('Indique al menos un campo a modificar.')
  if (data.numero_colegiatura !== undefined && data.cargo !== undefined) throw invalid('Indique colegiatura o cargo, no ambos.')
  const patch: EmployeePatch = {
    ...employeeData(data),
    numero_colegiatura: optional(data.numero_colegiatura, colegiatura),
    cargo: optional(data.cargo, cargo),
  }
  return Object.fromEntries(Object.entries(patch).filter(([, field]) => field !== undefined)) as EmployeePatch
}

function integer(value: unknown, field: string, fallback: number, max: number) {
  if (value === undefined) return fallback
  const parsed = Number(requiredId(value, field))
  if (parsed > max) throw invalid(`Campo fuera de rango: ${field}.`)
  return parsed
}

function pagination(data: Record<string, unknown>) {
  return {
    q: optional(data.q, value => text(value, 'q', 150)),
    pagina: integer(data.pagina, 'pagina', 1, 1_000_000),
    limite: integer(data.limite, 'limite', 25, 100),
  }
}

export function listEmployeesInput(value: unknown): EmployeeFilters {
  const data = fields(value ?? {}, ['q', 'pagina', 'limite', 'estado', 'subtipo'])
  return { ...pagination(data), estado: optional(data.estado, status), subtipo: optional(data.subtipo, subtype) }
}

export function listDentistsInput(value: unknown): DentistFilters {
  return pagination(fields(value ?? {}, ['q', 'pagina', 'limite']))
}

export function listTreatmentsInput(value: unknown): TreatmentFilters {
  return pagination(fields(value ?? {}, ['q', 'pagina', 'limite']))
}

export function createTreatmentInput(value: unknown): TreatmentInput {
  const data = fields(value, ['nombre', 'descripcion', 'precio_referencial'])
  if (data.precio_referencial === undefined) throw invalid('Falta el campo obligatorio: precio_referencial.')
  return {
    nombre: text(data.nombre, 'nombre', 150),
    descripcion: data.descripcion === undefined ? null : description(data.descripcion),
    precio_referencial: price(data.precio_referencial),
  }
}

export function updateTreatmentInput(value: unknown): TreatmentPatch {
  const data = fields(value, ['nombre', 'descripcion', 'precio_referencial'])
  if (Object.keys(data).length === 0) throw invalid('Indique al menos un campo a modificar.')
  const patch: TreatmentPatch = {}
  if (data.nombre !== undefined) patch.nombre = text(data.nombre, 'nombre', 150)
  if (data.descripcion !== undefined) patch.descripcion = description(data.descripcion)
  if (data.precio_referencial !== undefined) patch.precio_referencial = price(data.precio_referencial)
  return patch
}

/** Alcance que authorizeRequest dejó en res.locals.authorization; nunca se toma de la petición. */
export function employeeScope(value: unknown): EmployeeScope {
  const scope = value as { alcance?: unknown; idEmpleado?: unknown } | undefined
  if (scope?.alcance === 'global') return { alcance: 'global' }
  if (scope?.alcance === 'propio' && typeof scope.idEmpleado === 'string' && positiveId(scope.idEmpleado)) {
    return { alcance: 'propio', idEmpleado: scope.idEmpleado }
  }
  throw personalAccessDenied()
}
