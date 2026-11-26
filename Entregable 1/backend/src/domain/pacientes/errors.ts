export class PatientError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

export const invalidPatientInput = (message: string) => new PatientError(400, 'ENTRADA_INVALIDA', message)
export const patientNotFound = () => new PatientError(404, 'PACIENTE_NO_EXISTE', 'El paciente no existe o no está disponible para esta consulta.')
export const patientAccessDenied = () => new PatientError(403, 'ACCESO_DENEGADO', 'No se ha autorizado la consulta de pacientes.')
