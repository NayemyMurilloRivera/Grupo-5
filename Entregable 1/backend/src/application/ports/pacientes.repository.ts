import type { CreatedPatient, PatientInput, PatientPatch, PatientDetail, PatientFilters, PatientPage, PatientScope } from '../../domain/pacientes/entities.js'

export interface PatientRepository {
  createPatient(input: PatientInput): Promise<CreatedPatient>
  updatePatient(id: string, input: PatientPatch, scope: PatientScope): Promise<PatientDetail | null>
  deleteContact(patientId: string, contactId: string, scope: PatientScope): Promise<boolean>
  listPatients(filters: PatientFilters, scope: PatientScope): Promise<PatientPage>
  findPatient(id: string, scope: PatientScope): Promise<PatientDetail | null>
}
