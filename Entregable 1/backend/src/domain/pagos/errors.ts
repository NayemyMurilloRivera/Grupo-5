export class PagoError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, readonly code: string, message: string) {
    super(message)
    this.name = 'PagoError'
  }
}
export const invalid = (message: string) => new PagoError(400, 'ENTRADA_INVALIDA', message)
export const forbidden = () => new PagoError(403, 'PROHIBIDO', 'No tiene permiso para esta operación.')
export const notFound = (message: string) => new PagoError(404, 'NO_ENCONTRADO', message)
export const conflict = (code: string, message: string) => new PagoError(409, code, message)
export const knownPaymentError = (error: unknown): PagoError | undefined => (error instanceof PagoError ? error : undefined)
