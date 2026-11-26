import { callEndpoint, type EndpointInput } from '../../services/endpoint'
export const createEmployee = (input: EndpointInput) => callEndpoint('POST', '/empleados', input)
export const listEmployees = (input: EndpointInput) => callEndpoint('GET', '/empleados', input)
export const getEmployee = (input: EndpointInput) => callEndpoint('GET', '/empleados/:id', input)
export const updateEmployee = (input: EndpointInput) => callEndpoint('PATCH', '/empleados/:id', input)
export const listDentists = (input: EndpointInput) => callEndpoint('GET', '/odontologos', input)
export const listTreatments = (input: EndpointInput) => callEndpoint('GET', '/tratamientos', input)
export const createTreatment = (input: EndpointInput) => callEndpoint('POST', '/tratamientos', input)
export const updateTreatment = (input: EndpointInput) => callEndpoint('PATCH', '/tratamientos/:id', input)
