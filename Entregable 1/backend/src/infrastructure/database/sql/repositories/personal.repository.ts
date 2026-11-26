import type { Pool, QueryResultRow } from 'pg'
import type { PersonalRepository, PersonalWrites } from '../../../../application/ports/personal.repository.js'
import { page, type Employee, type Page, type Treatment } from '../../../../domain/personal/entities.js'
import { pool } from '../connection.js'
import { withTransaction } from '../transaction.js'

type Queryable = Pick<Pool, 'query'>

// El subtipo se deduce de la fila que existe en ODONTOLOGO o en PERSONAL_APOYO con el mismo id_empleado.
const employeeColumns = `e.id_empleado, e.tipo_documento, e.numero_documento, e.nombres, e.apellidos, e.telefono, e.estado,
    CASE WHEN o.id_empleado IS NOT NULL THEN 'odontologo' ELSE 'apoyo' END AS subtipo,
    o.numero_colegiatura, a.cargo`
const employeeJoins = `FROM sis_god."EMPLEADO" e
    LEFT JOIN sis_god."ODONTOLOGO" o ON o.id_empleado = e.id_empleado
    LEFT JOIN sis_god."PERSONAL_APOYO" a ON a.id_empleado = e.id_empleado`
const treatmentColumns = 'id_tratamiento, nombre, descripcion, precio_referencial'

/**
 * Página con total filtrado. count(*) OVER () evita repetir la consulta cuando la página tiene filas;
 * solo una página vacía necesita contar aparte. Los parámetros de filtro son $1..$n; LIMIT y OFFSET van después.
 */
async function paged<T extends QueryResultRow>(source: Queryable, columns: string, fromWhere: string, order: string,
  params: unknown[], filters: { pagina: number; limite: number }): Promise<Page<T>> {
  const n = params.length
  const { rows } = await source.query<T & { total: string }>(
    `SELECT ${columns}, count(*) OVER () AS total ${fromWhere} ORDER BY ${order} LIMIT $${n + 1} OFFSET $${n + 2}`,
    [...params, filters.limite, (filters.pagina - 1) * filters.limite])
  const total = rows.length ? Number(rows[0].total)
    : Number((await source.query<{ total: string }>(`SELECT count(*) AS total ${fromWhere}`, params)).rows[0].total)
  return page(rows.map(({ total: _total, ...item }) => item as unknown as T), total, filters)
}

async function findEmployee(client: Queryable, id: string, lock = false) {
  const { rows } = await client.query<Employee>(
    `SELECT ${employeeColumns} ${employeeJoins} WHERE e.id_empleado = $1${lock ? ' FOR UPDATE OF e' : ''}`, [id])
  return rows[0] ?? null
}

function writes(client: Queryable): PersonalWrites {
  return {
    async insertEmployee(data) {
      const { rows } = await client.query<{ id_empleado: string }>(`INSERT INTO sis_god."EMPLEADO"
        (tipo_documento, numero_documento, nombres, apellidos, telefono, estado)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_empleado`,
      [data.tipo_documento, data.numero_documento, data.nombres, data.apellidos, data.telefono, data.estado])
      return rows[0].id_empleado
    },
    async insertDentist(id, numeroColegiatura) {
      await client.query('INSERT INTO sis_god."ODONTOLOGO" (id_empleado, numero_colegiatura) VALUES ($1, $2)', [id, numeroColegiatura])
    },
    async insertSupport(id, cargo) {
      await client.query('INSERT INTO sis_god."PERSONAL_APOYO" (id_empleado, cargo) VALUES ($1, $2)', [id, cargo])
    },
    lockEmployee: id => findEmployee(client, id, true),
    async updateEmployee(id, data) {
      await client.query(`UPDATE sis_god."EMPLEADO" SET tipo_documento = COALESCE($2, tipo_documento),
          numero_documento = COALESCE($3, numero_documento), nombres = COALESCE($4, nombres),
          apellidos = COALESCE($5, apellidos), telefono = COALESCE($6, telefono), estado = COALESCE($7, estado)
        WHERE id_empleado = $1`,
      [id, data.tipo_documento, data.numero_documento, data.nombres, data.apellidos, data.telefono, data.estado])
    },
    async updateDentist(id, numeroColegiatura) {
      await client.query('UPDATE sis_god."ODONTOLOGO" SET numero_colegiatura = $2 WHERE id_empleado = $1', [id, numeroColegiatura])
    },
    async updateSupport(id, cargo) {
      await client.query('UPDATE sis_god."PERSONAL_APOYO" SET cargo = $2 WHERE id_empleado = $1', [id, cargo])
    },
    async checkDeferred() {
      await client.query('SET CONSTRAINTS ALL IMMEDIATE')
    },
    findEmployee: id => findEmployee(client, id),
  }
}

export function postgresPersonalRepository(source: Pick<Pool, 'connect' | 'query'> = pool): PersonalRepository {
  return {
    listEmployees: ({ q, estado, subtipo, ...filters }) => paged(source, employeeColumns, `${employeeJoins}
      WHERE ($1::text IS NULL OR strpos(lower(concat_ws(' ', e.nombres, e.apellidos, e.numero_documento)), lower($1)) > 0)
        AND ($2::text IS NULL OR e.estado = $2)
        AND ($3::text IS NULL OR ($3 = 'odontologo') = (o.id_empleado IS NOT NULL))`,
    'e.id_empleado', [q, estado, subtipo], filters),
    findEmployee: id => findEmployee(source, id),
    // Solo profesionales activos: son los que pueden asignarse a un plan.
    listDentists: ({ q, ...filters }) => paged(source, 'e.id_empleado, e.nombres, e.apellidos, o.numero_colegiatura, e.telefono',
      `FROM sis_god."ODONTOLOGO" o JOIN sis_god."EMPLEADO" e ON e.id_empleado = o.id_empleado
      WHERE e.estado = 'activo'
        AND ($1::text IS NULL OR strpos(lower(concat_ws(' ', e.nombres, e.apellidos, o.numero_colegiatura)), lower($1)) > 0)`,
    'e.apellidos, e.nombres, e.id_empleado', [q], filters),
    listTreatments: ({ q, ...filters }) => paged(source, treatmentColumns, `FROM sis_god."TRATAMIENTO"
      WHERE ($1::text IS NULL OR strpos(lower(concat_ws(' ', nombre, descripcion)), lower($1)) > 0)`,
    'nombre, id_tratamiento', [q], filters),
    async createTreatment(input) {
      const { rows } = await source.query<Treatment>(`INSERT INTO sis_god."TRATAMIENTO" (nombre, descripcion, precio_referencial)
        VALUES ($1, $2, $3) RETURNING ${treatmentColumns}`, [input.nombre, input.descripcion, input.precio_referencial])
      return rows[0]
    },
    async updateTreatment(id, patch) {
      // Solo cambia el catálogo: DETALLE_PLAN conserva su precio_acordado propio.
      const { rows } = await source.query<Treatment>(`UPDATE sis_god."TRATAMIENTO" SET nombre = COALESCE($2, nombre),
          descripcion = CASE WHEN $3::boolean THEN $4 ELSE descripcion END,
          precio_referencial = COALESCE($5, precio_referencial)
        WHERE id_tratamiento = $1 RETURNING ${treatmentColumns}`,
      [id, patch.nombre, patch.descripcion !== undefined, patch.descripcion ?? null, patch.precio_referencial])
      return rows[0] ?? null
    },
    withTransaction: work => withTransaction(client => work(writes(client)), source),
  }
}

export const personalRepository = postgresPersonalRepository()
