import type { AntecedentInput, RegisteredAntecedent, PatientHistory, CreatedPatient, PatientInput, PatientPatch, PatientDetail, PatientFilters, PatientPage, PatientScope } from '../../domain/pacientes/entities.js'

export interface PatientRepository {
  findHistory(patientId: string, scope: PatientScope): Promise<PatientHistory | null>
  createAntecedent(patientId: string, input: AntecedentInput, scope: PatientScope): Promise<RegisteredAntecedent | null>
  createPatient(input: PatientInput): Promise<CreatedPatient>
  updatePatient(id: string, input: PatientPatch, scope: PatientScope): Promise<PatientDetail | null>
  deleteContact(patientId: string, contactId: string, scope: PatientScope): Promise<boolean>
  listPatients(filters: PatientFilters, scope: PatientScope): Promise<PatientPage>
  findPatient(id: string, scope: PatientScope): Promise<PatientDetail | null>
}
