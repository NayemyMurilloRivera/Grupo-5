import type { PatientDetail, PatientFilters, PatientPage, PatientScope } from '../../domain/pacientes/entities.js'

export interface PatientRepository {
  listPatients(filters: PatientFilters, scope: PatientScope): Promise<PatientPage>
  findPatient(id: string, scope: PatientScope): Promise<PatientDetail | null>
}
