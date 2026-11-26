export interface Patient {
  id_paciente: string
  tipo_documento: string
  numero_documento: string
  nombres: string
  apellidos: string
  fecha_nacimiento: string | null
  telefono: string
  correo: string | null
  direccion: string | null
}

export interface Contact {
  id_contacto: string
  nombre: string
  parentesco: string
  telefono: string
}

export interface PatientDetail extends Patient {
  contactos: Contact[]
}

export interface PatientFilters {
  pagina: number
  limite: number
  q?: string
  tipo_documento?: string
  numero_documento?: string
}

export type PatientScope =
  | { alcance: 'global' }
  | { alcance: 'propio'; idPaciente: string }
  | { alcance: 'asignado'; idEmpleado: string }

export interface PatientPage {
  items: Patient[]
  pagina: number
  limite: number
  total: number
  total_paginas: number
}
