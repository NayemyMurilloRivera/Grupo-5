import { views as seguridad } from '../modules/seguridad/views'
import { views as pacientes } from '../modules/pacientes/views'
import { views as personal } from '../modules/personal/views'
import { views as planes } from '../modules/planes/views'
import { views as pagos } from '../modules/pagos/views'
export type { Module, Field, Row } from '../types/module'
export { navigation } from './navigation'
export const modules = [ ...pacientes, ...personal, ...planes, ...pagos, ...seguridad ]
