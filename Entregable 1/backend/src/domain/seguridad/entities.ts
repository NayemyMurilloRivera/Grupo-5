export const roleCodes = {
  Administrador: 'ADMINISTRADOR',
  Recepcionista: 'RECEPCIONISTA',
  'Odontólogo': 'ODONTOLOGO',
  'Asistente dental': 'ASISTENTE',
  Paciente: 'PACIENTE',
} as const

export type RoleCode = typeof roleCodes[keyof typeof roleCodes]
export type AccountStatus = 'activo' | 'inactivo'
export type Scope = 'global' | 'propio' | 'asignado'

export interface Permission {
  id_permiso: string
  recurso: string
  accion: string
  alcance: Scope
}

export interface Role {
  id_rol: string
  nombre: string
  descripcion: string | null
}

export interface Account {
  id_usuario: string
  nombre_acceso: string
  correo: string
  estado: AccountStatus
  id_rol: string
  rol: string
  id_empleado: string | null
  id_paciente: string | null
  titular: string
}

export interface Identity {
  idUsuario: string
  idRol: string
  name: string
  role: RoleCode
  idEmpleado?: string
  idPaciente?: string
}

export interface AuthenticatedAccount extends Account {
  credencial_acceso: string
  permisos: Permission[]
}

export interface AuthContext extends Identity {
  permisos: Permission[]
}

export interface AccountInput {
  nombre_acceso: string
  correo: string
  password: string
  estado: AccountStatus
  id_rol: string
  id_empleado: string | null
  id_paciente: string | null
}

export type AccountPatch = Partial<Omit<AccountInput, 'id_empleado' | 'id_paciente'>>

export interface AccountFilters {
  pagina: number
  limite: number
  q?: string
  estado?: AccountStatus
  id_rol?: string
}

export function roleCode(name: string): RoleCode | undefined {
  return Object.hasOwn(roleCodes, name) ? roleCodes[name as keyof typeof roleCodes] : undefined
}

export function positiveId(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value)) value = String(value)
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value)) return
  if (BigInt(value) <= 9223372036854775807n) return value
}

export function accountIdentity(account: Account): Identity | undefined {
  const role = roleCode(account.rol)
  if (account.estado !== 'activo' || !role) return
  if (role === 'PACIENTE' ? !account.id_paciente : !account.id_empleado) return
  return {
    idUsuario: account.id_usuario,
    idRol: account.id_rol,
    name: account.titular,
    role,
    ...(account.id_paciente ? { idPaciente: account.id_paciente } : { idEmpleado: account.id_empleado! }),
  }
}
