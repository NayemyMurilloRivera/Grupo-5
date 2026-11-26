import type { Pool } from 'pg'
import { contactNotFound } from '../../../../domain/pacientes/errors.js'
import type { PatientRepository } from '../../../../application/ports/pacientes.repository.js'
import type { Patient, PatientDetail, PatientScope, Contact, Antecedent, PatientHistory, RegisteredAntecedent } from '../../../../domain/pacientes/entities.js'
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

async function readPatient(source: Pick<Pool, 'query'>, id: string, scope: PatientScope) {
  const { rows } = await source.query<PatientDetail>(`
    SELECT ${columns}, COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id_contacto', c.id_contacto::text,
        'nombre', c.nombre, 'parentesco', c.parentesco, 'telefono', c.telefono) ORDER BY c.id_contacto)
      FROM sis_god."CONTACTO" c WHERE c.id_paciente = p.id_paciente
    ), '[]'::jsonb) AS contactos
    FROM sis_god."PACIENTE" p WHERE ${authorized} AND p.id_paciente = $4::bigint`,
  [...scopeValues(scope), id])
  return rows[0] ?? null
}

export function postgresPatientRepository(source: Pick<Pool, 'query' | 'connect'> = pool): PatientRepository {
  return {
    async findHistory(id, scope) {
      const { rows } = await source.query<PatientHistory>(`
        SELECT h.id_historia::text, h.id_paciente::text, concat_ws(' ', p.nombres, p.apellidos) AS paciente,
          h.fecha_apertura::text, h.observaciones_generales, h.cuestionario_complementario,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('id_antecedente', a.id_antecedente::text,
            'tipo', a.tipo, 'descripcion', a.descripcion, 'fecha_registro', a.fecha_registro::text)
            ORDER BY a.fecha_registro DESC, a.id_antecedente DESC)
            FROM sis_god."ANTECEDENTE" a WHERE a.id_historia=h.id_historia), '[]'::jsonb) AS antecedentes
        FROM sis_god."PACIENTE" p JOIN sis_god."HISTORIA_CLINICA" h USING (id_paciente)
        WHERE ${authorized} AND p.id_paciente=$4::bigint`, [...scopeValues(scope), id])
      return rows[0] ?? null
    },
    async createAntecedent(id, input, scope) {
      // La historia se obtiene del paciente autorizado; la solicitud no elige una historia distinta.
      const { rows } = await source.query<RegisteredAntecedent>(`
        INSERT INTO sis_god."ANTECEDENTE" (tipo, descripcion, fecha_registro, id_historia)
        SELECT $5::text, $6::text, COALESCE($7::date,CURRENT_DATE), h.id_historia
        FROM sis_god."PACIENTE" p JOIN sis_god."HISTORIA_CLINICA" h USING (id_paciente)
        WHERE ${authorized} AND p.id_paciente=$4::bigint
        RETURNING id_antecedente::text, id_historia::text, tipo, descripcion, fecha_registro::text`,
      [...scopeValues(scope), id, input.tipo, input.descripcion, input.fecha_registro])
      return rows[0] ?? null
    },
    updatePatient: (id, input, scope) => withTransaction(async client => {
      // Bloquear primero al paciente mantiene un orden común para sus modificaciones y bajas de contactos.
      const patient = await client.query(`SELECT p.id_paciente FROM sis_god."PACIENTE" p
        WHERE ${authorized} AND p.id_paciente=$4::bigint FOR UPDATE OF p`, [...scopeValues(scope), id])
      if (!patient.rowCount) return null
      const contactIds = (input.contactos ?? []).flatMap(contact => 'id_contacto' in contact ? [contact.id_contacto] : [])
      if (contactIds.length) {
        const contacts = await client.query(`SELECT id_contacto FROM sis_god."CONTACTO"
          WHERE id_paciente=$1 AND id_contacto=ANY($2::bigint[]) ORDER BY id_contacto FOR UPDATE`, [id, contactIds])
        if (contacts.rowCount !== contactIds.length) throw contactNotFound()
      }
      const fields = ['tipo_documento', 'numero_documento', 'nombres', 'apellidos',
        'fecha_nacimiento', 'telefono', 'correo', 'direccion'] as const
      const changed = fields.filter(field => Object.hasOwn(input, field))
      if (changed.length) {
        const assignments = changed.map((field, index) => `${field}=$${index + 1}`).join(', ')
        await client.query(`UPDATE sis_god."PACIENTE" SET ${assignments} WHERE id_paciente=$${changed.length + 1}`,
          [...changed.map(field => input[field]), id])
      }
      for (const contact of input.contactos ?? []) {
        if ('id_contacto' in contact) {
          await client.query(`UPDATE sis_god."CONTACTO" SET
            nombre=CASE WHEN $3::boolean THEN $4 ELSE nombre END,
            parentesco=CASE WHEN $5::boolean THEN $6 ELSE parentesco END,
            telefono=CASE WHEN $7::boolean THEN $8 ELSE telefono END
            WHERE id_contacto=$1 AND id_paciente=$2`,
          [contact.id_contacto, id, Object.hasOwn(contact, 'nombre'), contact.nombre,
            Object.hasOwn(contact, 'parentesco'), contact.parentesco, Object.hasOwn(contact, 'telefono'), contact.telefono])
        } else {
          await client.query(`INSERT INTO sis_god."CONTACTO" (nombre, parentesco, telefono, id_paciente)
            VALUES ($1,$2,$3,$4)`, [contact.nombre, contact.parentesco, contact.telefono, id])
        }
      }
      return readPatient(client, id, scope)
    }, source),
    deleteContact: (id, contactId, scope) => withTransaction(async client => {
      const patient = await client.query(`SELECT p.id_paciente FROM sis_god."PACIENTE" p
        WHERE ${authorized} AND p.id_paciente=$4::bigint FOR UPDATE OF p`, [...scopeValues(scope), id])
      if (!patient.rowCount) return false
      const deleted = await client.query(`DELETE FROM sis_god."CONTACTO"
        WHERE id_contacto=$1 AND id_paciente=$2 RETURNING id_contacto`, [contactId, id])
      if (!deleted.rowCount) throw contactNotFound()
      return true
    }, source),
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
    findPatient: (id, scope) => readPatient(source, id, scope),
  }
}

export const patientRepository = postgresPatientRepository()
