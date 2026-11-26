import type { Module } from '../../types/module'
import * as api from './api'
import { toRows, toPayload } from './adapters'
export const views: Module[] = [
 {id:'usuarios',title:'Usuarios',caption:'Cuentas de acceso y estado de los usuarios.',path:'/usuarios',createPath:'/usuarios',action:'Nuevo usuario',columns:[['nombre','Usuario'],['correo','Correo'],['rol','Rol'],['estado','Estado']],fields:[{key:'nombre_acceso',label:'Usuario',required:true},{key:'correo',label:'Correo',type:'email',required:true},{key:'password',label:'Contraseña',type:'password',required:true},{key:'id_rol',label:'ID de rol',required:true},{key:'id_empleado',label:'ID de empleado (o paciente)'},{key:'id_paciente',label:'ID de paciente (o empleado)'}], load: async (context) => toRows(await api.listUsers({ token: context.token, params: { id: context.resourceId } })), create: (values, token) => api.createUser({ token, body: toPayload(values) })},
 {id:'roles',title:'Roles y permisos',caption:'Roles y permisos del sistema.',path:'/roles',columns:[['nombre','Rol'],['alcance','Alcance'],['estado','Disponibilidad']], load: async (context) => toRows(await api.listRoles({ token: context.token, params: { id: context.resourceId } }))},
]
