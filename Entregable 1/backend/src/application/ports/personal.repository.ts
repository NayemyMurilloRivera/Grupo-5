import type {
  Dentist, DentistFilters, Employee, EmployeeData, EmployeeFilters, Page, Treatment, TreatmentFilters, TreatmentInput, TreatmentPatch,
} from '../../domain/personal/entities.js'

export interface PersonalRepository {
  listEmployees(filters: EmployeeFilters): Promise<Page<Employee>>
  findEmployee(id: string): Promise<Employee | null>
  listDentists(filters: DentistFilters): Promise<Page<Dentist>>
  listTreatments(filters: TreatmentFilters): Promise<Page<Treatment>>
  createTreatment(input: TreatmentInput): Promise<Treatment>
  updateTreatment(id: string, patch: TreatmentPatch): Promise<Treatment | null>
  /** Ejecuta las escrituras de EMPLEADO y su subtipo con un mismo cliente entre BEGIN y COMMIT. */
  withTransaction<T>(work: (tx: PersonalWrites) => Promise<T>): Promise<T>
}

export interface PersonalWrites {
  insertEmployee(data: EmployeeData): Promise<string>
  insertDentist(id: string, numeroColegiatura: string): Promise<void>
  insertSupport(id: string, cargo: string): Promise<void>
  lockEmployee(id: string): Promise<Employee | null>
  updateEmployee(id: string, data: Partial<EmployeeData>): Promise<void>
  updateDentist(id: string, numeroColegiatura: string): Promise<void>
  updateSupport(id: string, cargo: string): Promise<void>
  /** Adelanta los constraints diferidos para que su error se informe antes de COMMIT. */
  checkDeferred(): Promise<void>
  findEmployee(id: string): Promise<Employee | null>
}
