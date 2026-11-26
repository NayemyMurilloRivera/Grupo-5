import { callEndpoint, type EndpointInput } from '../../services/endpoint'
export const createPlan = (input: EndpointInput) => callEndpoint('POST', '/planes-tratamiento', input)
export const listPlans = (input: EndpointInput) => callEndpoint('GET', '/planes-tratamiento', input)
export const getPlan = (input: EndpointInput) => callEndpoint('GET', '/planes-tratamiento/:id', input)
export const updatePlan = (input: EndpointInput) => callEndpoint('PATCH', '/planes-tratamiento/:id', input)
export const createBudget = (input: EndpointInput) => callEndpoint('POST', '/planes-tratamiento/:id/presupuestos', input)
export const acceptBudget = (input: EndpointInput) => callEndpoint('POST', '/presupuestos/:id/aceptacion', input)
export const getObligation = (input: EndpointInput) => callEndpoint('GET', '/obligaciones/:id', input)
export const updateReviewer = (input: EndpointInput) => callEndpoint('PATCH', '/presupuestos/:id/revisor', input)
