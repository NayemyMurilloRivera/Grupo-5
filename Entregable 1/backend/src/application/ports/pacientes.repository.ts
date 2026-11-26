import type { CreatedPatient, PatientInput, PatientDetail, PatientFilters, PatientPage, PatientScope } from '../../domain/pacientes/entities.js'

export interface PatientRepository {
  createPatient(input: PatientInput): Promise<CreatedPatient>
  listPatients(filters: PatientFilters, scope: PatientScope): Promise<PatientPage>
  findPatient(id: string, scope: PatientScope): Promise<PatientDetail | null>
}
