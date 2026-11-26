export class PatientError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

export const invalidPatientInput = (message: string) => new PatientError(400, 'ENTRADA_INVALIDA', message)
export const patientNotFound = () => new PatientError(404, 'PACIENTE_NO_EXISTE', 'El paciente no existe o no está disponible para esta consulta.')
export const patientAccessDenied = () => new PatientError(403, 'ACCESO_DENEGADO', 'No se ha autorizado la consulta de pacientes.')

export function knownPatientError(error: unknown): PatientError | undefined {
  if (error instanceof PatientError) return error
  if (!error || typeof error !== 'object' || !('code' in error) || !('constraint' in error)) return
  if (error.code === '23505' && error.constraint === 'uq_paciente_documento') {
    return new PatientError(409, 'DOCUMENTO_DUPLICADO', 'Ya existe un paciente con ese tipo y número de documento.')
  }
  if (error.code === '23514' && error.constraint === 'ck_paciente_nacimiento') {
    return invalidPatientInput('La fecha de nacimiento no puede ser futura.')
  }
}

export const contactNotFound = () => new PatientError(404, 'CONTACTO_NO_EXISTE', 'El contacto no existe o no pertenece al paciente indicado.')

export const historyNotFound = () => new PatientError(404, 'HISTORIA_NO_EXISTE', 'La historia clínica no existe o no está disponible para esta consulta.')
