import { positiveId, type AccountFilters, type AccountInput, type AccountPatch, type AccountStatus } from '../../../domain/seguridad/entities.js'
import { invalid } from '../../../domain/seguridad/errors.js'

function fields(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('Envíe un objeto JSON válido.')
  if (Object.keys(value).some(key => !allowed.includes(key))) throw invalid('La solicitud contiene campos no permitidos.')
  return value as Record<string, unknown>
}

function text(value: unknown, field: string, max: number, min = 1): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (trimmed.length < min || trimmed.length > max || /[\x00-\x1f\x7f]/.test(trimmed)) throw invalid(`Campo inválido: ${field}.`)
  return trimmed
}

export function requiredId(value: unknown, field = 'id'): string {
  const id = positiveId(value)
  if (!id) throw invalid(`Identificador inválido: ${field}.`)
  return id
}

function email(value: unknown) {
  const address = text(value, 'correo', 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw invalid('Correo inválido.')
  return address
}

function username(value: unknown) {
  const name = text(value, 'nombre_acceso', 80)
  if (/[@\s]/u.test(name)) throw invalid('El nombre de acceso no admite arroba ni espacios.')
  return name
}

function password(value: unknown, minimum: number) {
  if (typeof value !== 'string' || value.length < minimum || value.length > 256 || value.includes('\x00')) {
    throw invalid('Contraseña inválida.')
  }
  return value
}

function accountStatus(value: unknown): AccountStatus {
  if (value !== 'activo' && value !== 'inactivo') throw invalid('Estado inválido.')
  return value
}

export function loginInput(value: unknown) {
  const data = fields(value, ['email', 'correo', 'nombre_acceso', 'password'])
  const identifiers = (['email', 'correo', 'nombre_acceso'] as const).filter(key => Object.hasOwn(data, key))
  if (identifiers.length !== 1) throw invalid('Indique un correo o un nombre de acceso.')
  const inputField = identifiers[0]
  const identifier = text(data[inputField], inputField, inputField === 'nombre_acceso' ? 80 : 254)
  const field = inputField === 'email' ? identifier.includes('@') ? 'correo' : 'nombre_acceso' : inputField
  return { field, identifier, password: password(data.password, 1) }
}

const editable = ['nombre_acceso', 'correo', 'password', 'estado', 'id_rol'] as const

export function createUserInput(value: unknown): AccountInput {
  const data = fields(value, [...editable, 'id_empleado', 'id_paciente'])
  const id_empleado = data.id_empleado == null ? null : requiredId(data.id_empleado, 'id_empleado')
  const id_paciente = data.id_paciente == null ? null : requiredId(data.id_paciente, 'id_paciente')
  if (Boolean(id_empleado) === Boolean(id_paciente)) throw invalid('Indique exactamente un titular.')
  return {
    nombre_acceso: username(data.nombre_acceso),
    correo: email(data.correo),
    password: password(data.password, 12),
    estado: data.estado === undefined ? 'activo' : accountStatus(data.estado),
    id_rol: requiredId(data.id_rol, 'id_rol'),
    id_empleado,
    id_paciente,
  }
}

export function updateUserInput(value: unknown): AccountPatch {
  const data = fields(value, editable)
  if (Object.keys(data).length === 0) throw invalid('Indique al menos un campo a modificar.')
  return {
    nombre_acceso: data.nombre_acceso === undefined ? undefined : username(data.nombre_acceso),
    correo: data.correo === undefined ? undefined : email(data.correo),
    password: data.password === undefined ? undefined : password(data.password, 12),
    estado: data.estado === undefined ? undefined : accountStatus(data.estado),
    id_rol: data.id_rol === undefined ? undefined : requiredId(data.id_rol, 'id_rol'),
  }
}

function integer(value: unknown, field: string, fallback: number, max: number) {
  if (value === undefined) return fallback
  const parsed = Number(requiredId(value, field))
  if (parsed > max) throw invalid(`Campo fuera de rango: ${field}.`)
  return parsed
}

export function listUsersInput(value: unknown): AccountFilters {
  const data = fields(value, ['q', 'pagina', 'limite', 'estado', 'id_rol'])
  return {
    q: data.q === undefined ? undefined : text(data.q, 'q', 254),
    pagina: integer(data.pagina, 'pagina', 1, 1_000_000),
    limite: integer(data.limite, 'limite', 25, 100),
    estado: data.estado === undefined ? undefined : accountStatus(data.estado),
    id_rol: data.id_rol === undefined ? undefined : requiredId(data.id_rol, 'id_rol'),
  }
}

export function permissionIdsInput(value: unknown) {
  const { ids_permiso } = fields(value, ['ids_permiso'])
  if (!Array.isArray(ids_permiso) || ids_permiso.length > 250) throw invalid('Indique hasta 250 identificadores de permisos.')
  const ids = ids_permiso.map(value => requiredId(value, 'ids_permiso'))
  if (new Set(ids).size !== ids.length) throw invalid('Los permisos deben ser únicos.')
  return ids
}
