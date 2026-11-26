import { callEndpoint, type EndpointInput } from '../../services/endpoint'
export const listPaymentMethods = (input: EndpointInput) => callEndpoint('GET', '/metodos-pago', input)
export const createPaymentMethod = (input: EndpointInput) => callEndpoint('POST', '/metodos-pago', input)
export const createPayment = (input: EndpointInput) => callEndpoint('POST', '/pagos', input)
export const getPayment = (input: EndpointInput) => callEndpoint('GET', '/pagos/:id', input)
export const getAccount = (input: EndpointInput) => callEndpoint('GET', '/pacientes/:id/estado-cuenta', input)
export const getReceipt = (input: EndpointInput) => callEndpoint('GET', '/pagos/:id/comprobante', input)
export const getReceivablesReport = (input: EndpointInput) => callEndpoint('GET', '/reportes/cuentas-por-cobrar', input)
export const getMyAccount = (input: EndpointInput) => callEndpoint('GET', '/mi/estado-cuenta', input)
import { downloadFile } from '../../services/api'
export const downloadReport = (token: string) => downloadFile('/reportes/cuentas-por-cobrar?formato=csv', 'cuentas-por-cobrar.csv', token)
