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

export interface ContactInput {
  nombre: string
  parentesco: string
  telefono: string
}

export interface AntecedentInput {
  tipo: string
  descripcion: string
  fecha_registro: string | null
}

export interface Antecedent extends Omit<AntecedentInput, 'fecha_registro'> {
  id_antecedente: string
  fecha_registro: string
}

export interface PatientInput extends Omit<Patient, 'id_paciente'> {
  contactos: ContactInput[]
  antecedentes: AntecedentInput[]
}

export interface CreatedPatient extends PatientDetail {
  historia: {
    id_historia: string
    fecha_apertura: string
    antecedentes: Antecedent[]
  }
}

export type ContactChange = ContactInput | ({ id_contacto: string } & Partial<ContactInput>)
export type PatientPatch = Partial<Omit<Patient, 'id_paciente'>> & { contactos?: ContactChange[] }

export interface PatientHistory {
  id_historia: string
  id_paciente: string
  paciente: string
  fecha_apertura: string
  observaciones_generales: string | null
  cuestionario_complementario: Record<string, unknown>
  antecedentes: Antecedent[]
}

export interface RegisteredAntecedent extends Antecedent {
  id_historia: string
}
