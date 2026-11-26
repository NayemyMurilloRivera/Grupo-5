import type { Module } from '../../types/module'
import * as api from './api'
import { toRows, toPayload, toHistoryRows } from './adapters'
import type { Field } from '../../types/module'
const patientFields:Field[]=[{key:'tipo_documento',label:'Tipo de documento',required:true},{key:'numero_documento',label:'Documento',required:true},{key:'nombres',label:'Nombres',required:true},{key:'apellidos',label:'Apellidos',required:true},{key:'fecha_nacimiento',label:'Nacimiento',type:'date'},{key:'telefono',label:'Teléfono',required:true},{key:'correo',label:'Correo',type:'email'}]
export const views: Module[] = [
 {id:'pacientes',title:'Pacientes',caption:'Datos personales y contactos del paciente.',path:'/pacientes',createPath:'/pacientes',action:'Nuevo paciente',columns:[['nombre','Paciente'],['documento','Documento'],['telefono','Teléfono'],['correo','Correo']],fields:patientFields, load: async (context) => toRows(await api.listPatients({ token: context.token, params: { id: context.resourceId } })), create: (values, token) => api.createPatient({ token, body: toPayload(values) })},
 {id:'historias',title:'Historias clínicas',caption:'Registro de apertura y antecedentes.',path:'/pacientes/:id/historia',idLabel:'ID del paciente',columns:[['id_historia','Historia'],['paciente','Paciente'],['fecha_apertura','Apertura'],['cantidad_antecedentes','Antecedentes']], load: async (context) => toHistoryRows(await api.getHistory({ token: context.token, params: { id: context.resourceId } }))},
]
