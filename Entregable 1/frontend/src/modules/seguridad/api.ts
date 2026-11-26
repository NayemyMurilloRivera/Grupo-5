import { callEndpoint, type EndpointInput } from '../../services/endpoint'
import type { Session } from '../../types/session'
export const login = (input: EndpointInput) => callEndpoint<Session>('POST', '/auth/login', input)
export const getMe = (input: EndpointInput) => callEndpoint('GET', '/auth/me', input)
export const listRoles = (input: EndpointInput) => callEndpoint('GET', '/roles', input)
export const listPermissions = (input: EndpointInput) => callEndpoint('GET', '/permisos', input)
export const createUser = (input: EndpointInput) => callEndpoint('POST', '/usuarios', input)
export const listUsers = (input: EndpointInput) => callEndpoint('GET', '/usuarios', input)
export const updateUser = (input: EndpointInput) => callEndpoint('PATCH', '/usuarios/:id', input)
export const replaceRolePermissions = (input: EndpointInput) => callEndpoint('PUT', '/roles/:id/permisos', input)
