import type { Module } from '../../types/module'
import * as api from './api'
import { toRows, toPayload } from './adapters'
export const views: Module[] = [
 {id:'planes',title:'Planes de tratamiento',caption:'Consulta y administración de planes.',path:'/planes-tratamiento',createPath:'/planes-tratamiento',action:'Nuevo plan',columns:[['codigo','Plan'],['paciente','Paciente'],['odontologo','Odontólogo'],['estado','Estado']],fields:[{key:'id_historia',label:'ID de historia',required:true},{key:'id_odontologo',label:'ID de odontólogo',required:true},{key:'detalles',label:'Detalles del plan',required:true}], load: async (context) => toRows(await api.listPlans({ token: context.token, params: { id: context.resourceId } })), create: (values, token) => api.createPlan({ token, body: toPayload(values) })},
 {id:'presupuestos',title:'Presupuestos',caption:'Importes y estados de las propuestas.',path:'/planes-tratamiento/:id',idLabel:'ID del plan',columns:[['codigo','Presupuesto'],['plan','Plan'],['importe','Importe'],['estado','Estado']], load: async (context) => toRows(await api.getPlan({ token: context.token, params: { id: context.resourceId } }))},
]
