import { roleCode, type Role } from './entities.js'

export class SecurityError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

export const invalid = (message: string) => new SecurityError(400, 'ENTRADA_INVALIDA', message)
export const invalidSession = () => new SecurityError(401, 'SESION_INVALIDA', 'Inicie sesión con un token válido.')
export const forbidden = () => new SecurityError(403, 'ACCESO_DENEGADO', 'La cuenta no tiene acceso a esta operación.')
export const missing = (message: string) => new SecurityError(404, 'REGISTRO_NO_EXISTE', message)
export const lastAdministrator = () => new SecurityError(409, 'ULTIMO_ADMINISTRADOR', 'Debe quedar al menos una cuenta administradora activa.')

export function validateOwner(role: Role | null, employee: string | null, patient: string | null) {
  if (!role) throw missing('El rol no existe.')
  const code = roleCode(role.nombre)
  if (!code || Boolean(employee) === Boolean(patient) || (code === 'PACIENTE') !== Boolean(patient)) {
    throw invalid('El rol debe corresponder a un único titular: paciente o empleado.')
  }
}

const constraints: Record<string, [number, string, string]> = {
  uq_usuario_nombre: [409, 'USUARIO_DUPLICADO', 'El nombre de acceso ya está en uso.'],
  uq_usuario_correo: [409, 'CORREO_DUPLICADO', 'El correo ya está en uso.'],
  uq_usuario_correo_normalizado: [409, 'CORREO_DUPLICADO', 'El correo ya está en uso.'],
  uq_usuario_empleado: [409, 'TITULAR_DUPLICADO', 'El empleado ya tiene una cuenta.'],
  uq_usuario_paciente: [409, 'TITULAR_DUPLICADO', 'El paciente ya tiene una cuenta.'],
  fk_usuario_empleado: [404, 'TITULAR_NO_EXISTE', 'El empleado no existe.'],
  fk_usuario_paciente: [404, 'TITULAR_NO_EXISTE', 'El paciente no existe.'],
  fk_usuario_rol: [404, 'ROL_NO_EXISTE', 'El rol no existe.'],
  fk_rp_permiso: [404, 'PERMISO_NO_EXISTE', 'Uno de los permisos no existe.'],
}

export function knownSecurityError(error: unknown): SecurityError | undefined {
  const constraint = error && typeof error === 'object' && 'constraint' in error ? error.constraint : undefined
  const known = typeof constraint === 'string' && Object.hasOwn(constraints, constraint) ? constraints[constraint] : undefined
  return error instanceof SecurityError ? error : known ? new SecurityError(...known) : undefined
}
