export type EmployeeStatus = 'activo' | 'inactivo'
/** Especialización exclusiva de EMPLEADO: ODONTOLOGO o PERSONAL_APOYO comparten su id_empleado. */
export type EmployeeSubtype = 'odontologo' | 'apoyo'

export interface Employee {
  id_empleado: string
  tipo_documento: string
  numero_documento: string
  nombres: string
  apellidos: string
  telefono: string
  estado: EmployeeStatus
  subtipo: EmployeeSubtype
  numero_colegiatura: string | null
  cargo: string | null
}

export interface EmployeeData {
  tipo_documento: string
  numero_documento: string
  nombres: string
  apellidos: string
  telefono: string
  estado: EmployeeStatus
}

export type EmployeeInput = EmployeeData & (
  | { subtipo: 'odontologo'; numero_colegiatura: string }
  | { subtipo: 'apoyo'; cargo: string }
)

/** El subtipo no se modifica: solo los datos propios del subtipo que ya tiene el empleado. */
export type EmployeePatch = Partial<EmployeeData> & {
  numero_colegiatura?: string
  cargo?: string
}

export interface EmployeeFilters {
  pagina: number
  limite: number
  q?: string
  estado?: EmployeeStatus
  subtipo?: EmployeeSubtype
}

export interface Dentist {
  id_empleado: string
  nombres: string
  apellidos: string
  numero_colegiatura: string
  telefono: string
}

export interface DentistFilters {
  pagina: number
  limite: number
  q?: string
}

/** Entrada del catálogo: precio referencial, no una ejecución clínica ni el precio acordado de un plan. */
export interface Treatment {
  id_tratamiento: string
  nombre: string
  descripcion: string | null
  precio_referencial: string
}

export interface TreatmentInput {
  nombre: string
  descripcion: string | null
  precio_referencial: string
}

export type TreatmentPatch = Partial<TreatmentInput>

export interface TreatmentFilters {
  pagina: number
  limite: number
  q?: string
}

export interface Page<T> {
  items: T[]
  total: number
  pagina: number
  limite: number
  total_paginas: number
}

export type EmployeeScope = { alcance: 'global' } | { alcance: 'propio'; idEmpleado: string }

export function page<T>(items: T[], total: number, filters: { pagina: number; limite: number }): Page<T> {
  return { items, total, pagina: filters.pagina, limite: filters.limite, total_paginas: Math.ceil(total / filters.limite) }
}
