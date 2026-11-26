import type { Pool } from 'pg'
import type { PatientRepository } from '../../../../application/ports/pacientes.repository.js'
import type { Patient, PatientDetail, PatientScope, Contact, Antecedent } from '../../../../domain/pacientes/entities.js'
import { pool } from '../connection.js'
import { withTransaction } from '../transaction.js'

const columns = `p.id_paciente::text AS id_paciente, p.tipo_documento, p.numero_documento,
  p.nombres, p.apellidos, p.fecha_nacimiento::text AS fecha_nacimiento, p.telefono, p.correo, p.direccion`

// El alcance también limita el conteo y la paginación; EXISTS evita duplicar pacientes con varios planes.
const authorized = `($1::text = 'global'
  OR ($1 = 'propio' AND p.id_paciente = $2::bigint)
  OR ($1 = 'asignado' AND EXISTS (
    SELECT 1 FROM sis_god."HISTORIA_CLINICA" h
    JOIN sis_god."PLAN_TRATAMIENTO" plan USING (id_historia)
    WHERE h.id_paciente = p.id_paciente AND plan.id_odontologo = $3::bigint
  )))`

function scopeValues(scope: PatientScope) {
  return [scope.alcance, scope.alcance === 'propio' ? scope.idPaciente : null,
    scope.alcance === 'asignado' ? scope.idEmpleado : null]
}

export function postgresPatientRepository(source: Pick<Pool, 'query' | 'connect'> = pool): PatientRepository {
  return {
    createPatient: input => withTransaction(async client => {
      const { rows: [patient] } = await client.query<Patient>(`
        INSERT INTO sis_god."PACIENTE" (tipo_documento, numero_documento, nombres, apellidos,
          fecha_nacimiento, telefono, correo, direccion)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id_paciente::text, tipo_documento, numero_documento, nombres, apellidos,
          fecha_nacimiento::text, telefono, correo, direccion`,
      [input.tipo_documento, input.numero_documento, input.nombres, input.apellidos,
        input.fecha_nacimiento, input.telefono, input.correo, input.direccion])
      const { rows: [history] } = await client.query<{ id_historia: string; fecha_apertura: string }>(`
        INSERT INTO sis_god."HISTORIA_CLINICA" (fecha_apertura, id_paciente)
        VALUES (CURRENT_DATE, $1) RETURNING id_historia::text, fecha_apertura::text`, [patient.id_paciente])
      const contactos: Contact[] = []
      for (const contact of input.contactos) {
        const { rows: [created] } = await client.query<Contact>(`
          INSERT INTO sis_god."CONTACTO" (nombre, parentesco, telefono, id_paciente)
          VALUES ($1,$2,$3,$4) RETURNING id_contacto::text, nombre, parentesco, telefono`,
        [contact.nombre, contact.parentesco, contact.telefono, patient.id_paciente])
        contactos.push(created)
      }
      const antecedentes: Antecedent[] = []
      for (const record of input.antecedentes) {
        const { rows: [created] } = await client.query<Antecedent>(`
          INSERT INTO sis_god."ANTECEDENTE" (tipo, descripcion, fecha_registro, id_historia)
          VALUES ($1,$2,COALESCE($3::date,CURRENT_DATE),$4)
          RETURNING id_antecedente::text, tipo, descripcion, fecha_registro::text`,
        [record.tipo, record.descripcion, record.fecha_registro, history.id_historia])
        antecedentes.push(created)
      }
      return { ...patient, contactos, historia: { ...history, antecedentes } }
    }, source),
    async listPatients(filters, scope) {
      const { rows: [page] } = await source.query<{ items: Patient[]; total: number }>(`
        WITH filtered AS (
          SELECT ${columns} FROM sis_god."PACIENTE" p WHERE ${authorized}
            AND ($4::text IS NULL OR strpos(lower(concat_ws(' ', p.nombres, p.apellidos)), lower($4)) > 0
              OR strpos(lower(p.numero_documento), lower($4)) > 0)
            AND ($5::text IS NULL OR p.tipo_documento = $5)
            AND ($6::text IS NULL OR p.numero_documento = $6)
        ), paged AS (
          SELECT * FROM filtered ORDER BY id_paciente::bigint LIMIT $7 OFFSET $8
        )
        SELECT COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY id_paciente::bigint) FROM paged), '[]'::jsonb) AS items,
          (SELECT count(*)::integer FROM filtered) AS total`,
      [...scopeValues(scope), filters.q ?? null, filters.tipo_documento ?? null, filters.numero_documento ?? null,
        filters.limite, (filters.pagina - 1) * filters.limite])
      return { ...page, pagina: filters.pagina, limite: filters.limite,
        total_paginas: Math.ceil(page.total / filters.limite) }
    },
    async findPatient(id, scope) {
      const { rows } = await source.query<PatientDetail>(`
        SELECT ${columns}, COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id_contacto', c.id_contacto::text,
            'nombre', c.nombre, 'parentesco', c.parentesco, 'telefono', c.telefono) ORDER BY c.id_contacto)
          FROM sis_god."CONTACTO" c WHERE c.id_paciente = p.id_paciente
        ), '[]'::jsonb) AS contactos
        FROM sis_god."PACIENTE" p WHERE ${authorized} AND p.id_paciente = $4::bigint`,
      [...scopeValues(scope), id])
      return rows[0] ?? null
    },
  }
}

export const patientRepository = postgresPatientRepository()
