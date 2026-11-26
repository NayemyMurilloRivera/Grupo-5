import { callEndpoint, type EndpointInput } from '../../services/endpoint'
export const createPatient = (input: EndpointInput) => callEndpoint('POST', '/pacientes', input)
export const listPatients = (input: EndpointInput) => callEndpoint('GET', '/pacientes', input)
export const getPatient = (input: EndpointInput) => callEndpoint('GET', '/pacientes/:id', input)
export const updatePatient = (input: EndpointInput) => callEndpoint('PATCH', '/pacientes/:id', input)
export const getHistory = (input: EndpointInput) => callEndpoint('GET', '/pacientes/:id/historia', input)
export const createAntecedent = (input: EndpointInput) => callEndpoint('POST', '/pacientes/:id/antecedentes', input)
export const updateQuestionnaire = (input: EndpointInput) => callEndpoint('PATCH', '/historias/:id/cuestionario', input)
export const deleteContact = (input: EndpointInput) => callEndpoint('DELETE', '/pacientes/:id/contactos/:contactoId', input)
