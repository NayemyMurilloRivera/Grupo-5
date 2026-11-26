export type Role = 'ADMINISTRADOR'|'RECEPCIONISTA'|'ODONTOLOGO'|'ASISTENTE'|'PACIENTE'
export interface Session { token: string; user: { name: string; role: Role; idPaciente?: string; idEmpleado?: string } }
export const roleNames: Record<Role,string> = { ADMINISTRADOR:'Administrador', RECEPCIONISTA:'Recepcionista', ODONTOLOGO:'Odontólogo', ASISTENTE:'Asistente dental', PACIENTE:'Paciente' }

