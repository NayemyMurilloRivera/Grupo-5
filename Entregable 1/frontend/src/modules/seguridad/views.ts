import type { Module } from '../../types/module'
import * as api from './api'
import { toRows, toPayload, toRoleRows } from './adapters'

export const views: Module[] = [
  {
    id: 'usuarios',
    title: 'Usuarios',
    caption: 'Cuentas de acceso y estado de los usuarios.',
    path: '/usuarios',
    createPath: '/usuarios',
    action: 'Nuevo usuario',
    columns: [['nombre_acceso', 'Usuario'], ['titular', 'Titular'], ['correo', 'Correo'], ['rol', 'Rol'], ['estado', 'Estado']],
    fields: [
      { key: 'nombre_acceso', label: 'Usuario', required: true },
      { key: 'correo', label: 'Correo', type: 'email', required: true },
      { key: 'password', label: 'Contraseña (mínimo 12 caracteres)', type: 'password', required: true },
      { key: 'id_rol', label: 'ID de rol', required: true },
      { key: 'id_empleado', label: 'ID de empleado (si corresponde)' },
      { key: 'id_paciente', label: 'ID de paciente (si corresponde)' },
    ],
    load: async ({ token }) => toRows(await api.listUsers({ token })),
    create: (values, token) => api.createUser({ token, body: toPayload(values) }),
  },
  {
    id: 'roles',
    title: 'Roles y permisos',
    caption: 'Roles y permisos asociados a cada rol.',
    path: '/roles',
    columns: [['id_rol', 'ID de rol'], ['nombre', 'Rol'], ['cantidad_permisos', 'Permisos asociados']],
    load: async ({ token }) => toRoleRows(await api.listRoles({ token })),
  },
]
