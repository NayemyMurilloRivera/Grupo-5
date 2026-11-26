export class PersonalError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

export const invalidPersonalInput = (message: string) => new PersonalError(400, 'ENTRADA_INVALIDA', message)
export const personalAccessDenied = () => new PersonalError(403, 'ACCESO_DENEGADO', 'La cuenta no tiene acceso a esta operación.')
export const employeeNotFound = () => new PersonalError(404, 'EMPLEADO_NO_EXISTE', 'El empleado no existe.')
export const treatmentNotFound = () => new PersonalError(404, 'TRATAMIENTO_NO_EXISTE', 'El tratamiento no existe.')
export const subtypeMismatch = (field: string) =>
  new PersonalError(409, 'SUBTIPO_INCOMPATIBLE', `El campo ${field} no corresponde al subtipo actual del empleado.`)

// Restricciones de la base que el cliente puede provocar con datos válidos en forma.
const constraints: Record<string, [number, string, string]> = {
  uq_empleado_documento: [409, 'DOCUMENTO_DUPLICADO', 'Ya existe un empleado con ese documento.'],
  uq_odontologo_colegiatura: [409, 'COLEGIATURA_DUPLICADA', 'La colegiatura ya está registrada.'],
  uq_tratamiento_nombre_normalizado: [409, 'TRATAMIENTO_DUPLICADO', 'Ya existe un tratamiento con ese nombre.'],
  ck_tratamiento_precio: [400, 'ENTRADA_INVALIDA', 'El precio referencial no puede ser negativo.'],
  ck_empleado_estado: [400, 'ENTRADA_INVALIDA', 'Estado inválido.'],
}

export function knownPersonalError(error: unknown): PersonalError | undefined {
  if (error instanceof PersonalError) return error
  if (!error || typeof error !== 'object') return
  const constraint = 'constraint' in error ? error.constraint : undefined
  if (typeof constraint === 'string' && Object.hasOwn(constraints, constraint)) return new PersonalError(...constraints[constraint])
  // El disparador diferido validar_subtipo_empleado responde 23514 si el empleado no queda con un único subtipo.
  const code = 'code' in error ? error.code : undefined
  const where = 'where' in error && typeof error.where === 'string' ? error.where : ''
  if (code === '23514' && where.includes('validar_subtipo_empleado')) {
    return new PersonalError(409, 'SUBTIPO_INVALIDO', 'El empleado debe tener exactamente un subtipo.')
  }
}
