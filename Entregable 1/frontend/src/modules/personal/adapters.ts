import { responseRows } from '../../services/adapters'

const subtypeLabels: Record<string, string> = { odontologo: 'Odontólogo', apoyo: 'Personal de apoyo' }

export function toEmployeeRows(response: unknown) {
  return responseRows(response).map(row => ({
    ...row,
    nombre: [row.nombres, row.apellidos].filter(Boolean).join(' '),
    tipo: subtypeLabels[String(row.subtipo)] ?? row.subtipo,
    registro: row.numero_colegiatura ?? row.cargo ?? '',
  }))
}

export function toTreatmentRows(response: unknown) {
  return responseRows(response).map(row => ({ ...row, precio: row.precio_referencial == null ? '' : `S/ ${row.precio_referencial}` }))
}

const clean = (value: unknown) => typeof value === 'string' ? value.trim() : value

/** El formulario recoge colegiatura o cargo en un solo campo; la API espera el campo propio de cada subtipo. */
export function toEmployeePayload(values: Record<string, unknown>) {
  const subtipo = String(clean(values.subtipo) ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const registro = clean(values.registro)
  const payload: Record<string, unknown> = {
    tipo_documento: clean(values.tipo_documento) || 'DNI',
    numero_documento: clean(values.numero_documento),
    nombres: clean(values.nombres),
    apellidos: clean(values.apellidos),
    telefono: clean(values.telefono),
    subtipo: subtipo.startsWith('odont') ? 'odontologo' : subtipo.startsWith('apoyo') ? 'apoyo' : subtipo,
  }
  payload[payload.subtipo === 'odontologo' ? 'numero_colegiatura' : 'cargo'] = registro
  return payload
}

export function toTreatmentPayload(values: Record<string, unknown>) {
  const descripcion = clean(values.descripcion)
  return {
    nombre: clean(values.nombre),
    ...(descripcion ? { descripcion } : {}),
    precio_referencial: String(clean(values.precio_referencial) ?? ''),
  }
}
