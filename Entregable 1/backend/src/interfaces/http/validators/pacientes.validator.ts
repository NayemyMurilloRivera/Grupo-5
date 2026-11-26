import type { PatientFilters, PatientScope, PatientInput, PatientPatch, ContactChange, ContactInput } from '../../../domain/pacientes/entities.js'
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

function objectFields(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidPatientInput('Envíe un objeto JSON válido.')
  const data = value as Record<string, unknown>
  if (Object.keys(data).some(key => !allowed.includes(key))) throw invalidPatientInput('La solicitud contiene campos no permitidos.')
  return data
}

function requiredText(value: unknown, name: string, max: number): string {
  const result = optionalText(value, name, max)
  if (result === undefined) throw invalidPatientInput(`Campo obligatorio: ${name}.`)
  return result
}

function nullableText(value: unknown, name: string, max: number): string | null {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return null
  return requiredText(value, name, max)
}

function calendarDate(value: unknown, name: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith('0000')) {
    throw invalidPatientInput(`Fecha inválida: ${name}.`)
  }
  const date = new Date(value + 'T00:00:00.000Z')
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw invalidPatientInput(`Fecha inválida: ${name}.`)
  return value
}

function childRecords(value: unknown, name: string, max: number): unknown[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > max) throw invalidPatientInput(`Indique hasta ${max} registros en ${name}.`)
  return value
}

export function createPatientInput(value: unknown): PatientInput {
  const data = objectFields(value, ['tipo_documento', 'numero_documento', 'nombres', 'apellidos',
    'fecha_nacimiento', 'telefono', 'correo', 'direccion', 'contactos', 'antecedentes'])
  const birth = calendarDate(data.fecha_nacimiento, 'fecha_nacimiento')
  if (birth && birth > new Date().toISOString().slice(0, 10)) throw invalidPatientInput('La fecha de nacimiento no puede ser futura.')
  const email = nullableText(data.correo, 'correo', 254)?.toLowerCase() ?? null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalidPatientInput('Correo inválido.')
  return {
    tipo_documento: requiredText(data.tipo_documento, 'tipo_documento', 20),
    numero_documento: requiredText(data.numero_documento, 'numero_documento', 30),
    nombres: requiredText(data.nombres, 'nombres', 100),
    apellidos: requiredText(data.apellidos, 'apellidos', 100),
    fecha_nacimiento: birth,
    telefono: requiredText(data.telefono, 'telefono', 25),
    correo: email,
    direccion: nullableText(data.direccion, 'direccion', 250),
    contactos: childRecords(data.contactos, 'contactos', 20).map(value => {
      const contact = objectFields(value, ['nombre', 'parentesco', 'telefono'])
      return { nombre: requiredText(contact.nombre, 'contactos.nombre', 150),
        parentesco: requiredText(contact.parentesco, 'contactos.parentesco', 50),
        telefono: requiredText(contact.telefono, 'contactos.telefono', 25) }
    }),
    antecedentes: childRecords(data.antecedentes, 'antecedentes', 100).map(value => {
      const record = objectFields(value, ['tipo', 'descripcion', 'fecha_registro'])
      return { tipo: requiredText(record.tipo, 'antecedentes.tipo', 60),
        descripcion: requiredText(record.descripcion, 'antecedentes.descripcion', 10000),
        fecha_registro: calendarDate(record.fecha_registro, 'antecedentes.fecha_registro') }
    }),
  }
}

export function updatePatientInput(value: unknown): PatientPatch {
  const data = objectFields(value, ['tipo_documento', 'numero_documento', 'nombres', 'apellidos',
    'fecha_nacimiento', 'telefono', 'correo', 'direccion', 'contactos'])
  if (Object.keys(data).length === 0) throw invalidPatientInput('Indique al menos un campo a modificar.')
  const result: PatientPatch = {}
  const required = { tipo_documento: 20, numero_documento: 30, nombres: 100, apellidos: 100, telefono: 25 } as const
  for (const name of Object.keys(required) as (keyof typeof required)[]) {
    if (Object.hasOwn(data, name)) result[name] = requiredText(data[name], name, required[name])
  }
  if (Object.hasOwn(data, 'fecha_nacimiento')) {
    const date = calendarDate(data.fecha_nacimiento, 'fecha_nacimiento')
    if (date && date > new Date().toISOString().slice(0, 10)) throw invalidPatientInput('La fecha de nacimiento no puede ser futura.')
    result.fecha_nacimiento = date
  }
  if (Object.hasOwn(data, 'correo')) {
    const email = nullableText(data.correo, 'correo', 254)?.toLowerCase() ?? null
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalidPatientInput('Correo inválido.')
    result.correo = email
  }
  if (Object.hasOwn(data, 'direccion')) result.direccion = nullableText(data.direccion, 'direccion', 250)
  if (Object.hasOwn(data, 'contactos')) {
    result.contactos = childRecords(data.contactos, 'contactos', 20).map((value): ContactChange => {
      const contact = objectFields(value, ['id_contacto', 'nombre', 'parentesco', 'telefono'])
      const patch: Partial<ContactInput> = {}
      const fields = { nombre: 150, parentesco: 50, telefono: 25 } as const
      for (const name of Object.keys(fields) as (keyof typeof fields)[]) {
        if (Object.hasOwn(contact, name)) patch[name] = requiredText(contact[name], `contactos.${name}`, fields[name])
      }
      if (Object.hasOwn(contact, 'id_contacto')) {
        if (Object.keys(patch).length === 0) throw invalidPatientInput('Indique los datos a modificar del contacto.')
        return { ...patch, id_contacto: patientId(contact.id_contacto, 'id_contacto') }
      }
      return { nombre: requiredText(contact.nombre, 'contactos.nombre', 150),
        parentesco: requiredText(contact.parentesco, 'contactos.parentesco', 50),
        telefono: requiredText(contact.telefono, 'contactos.telefono', 25) }
    })
    const ids = result.contactos.flatMap(contact => 'id_contacto' in contact ? [contact.id_contacto] : [])
    if (new Set(ids).size !== ids.length) throw invalidPatientInput('Un contacto no puede aparecer dos veces en la misma modificación.')
  }
  return result
}
