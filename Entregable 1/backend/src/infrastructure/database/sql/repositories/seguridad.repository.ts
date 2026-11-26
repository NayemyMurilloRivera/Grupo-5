import type { Pool } from 'pg'
import type { Account, AccountFilters, AuthenticatedAccount, Permission, Role } from '../../../../domain/seguridad/entities.js'
import { forbidden, missing } from '../../../../domain/seguridad/errors.js'
import type { SecurityRepository, SecurityWrites } from '../../../../application/ports/seguridad.repository.js'
import { pool } from '../connection.js'
import { withTransaction } from '../transaction.js'

const accountColumns = `u.id_usuario, u.nombre_acceso, u.correo, u.estado, u.id_rol, r.nombre AS rol, u.id_empleado, u.id_paciente,
    concat_ws(' ', coalesce(e.nombres, p.nombres), coalesce(e.apellidos, p.apellidos)) AS titular`
const accountJoins = `JOIN sis_god."ROL" r ON r.id_rol = u.id_rol
    LEFT JOIN sis_god."EMPLEADO" e ON e.id_empleado = u.id_empleado
    LEFT JOIN sis_god."PACIENTE" p ON p.id_paciente = u.id_paciente`
const permissions = `COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('id_permiso', p.id_permiso::text, 'recurso', p.recurso, 'accion', p.accion, 'alcance', p.alcance)
      ORDER BY p.recurso, p.accion, p.alcance
    )
    FROM sis_god."ROL_PERMISO" rp JOIN sis_god."PERMISO" p USING (id_permiso)
    WHERE rp.id_rol = r.id_rol
  ), '[]'::jsonb)`
const selectAccount = `SELECT ${accountColumns} FROM sis_god."USUARIO" u ${accountJoins}`

function adminWrites(client: Pick<Pool, 'query'>): SecurityWrites {
  return {
    async findRole(id) {
      const { rows } = await client.query<Role>(`SELECT id_rol, nombre, descripcion FROM sis_god."ROL" WHERE id_rol = $1 FOR KEY SHARE`, [id])
      return rows[0] ?? null
    },
    async createUser(input) {
      const { rows } = await client.query<Account>(`WITH u AS (
        INSERT INTO sis_god."USUARIO" (nombre_acceso, correo, credencial_acceso, estado, id_rol, id_empleado, id_paciente)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
      ) SELECT ${accountColumns} FROM u ${accountJoins}`,
      [input.nombre_acceso, input.correo, input.credencial_acceso, input.estado, input.id_rol, input.id_empleado, input.id_paciente])
      return rows[0]
    },
    async getUserForUpdate(id) {
      const { rows } = await client.query<Account>(selectAccount + ' WHERE u.id_usuario = $1 FOR UPDATE OF u', [id])
      return rows[0] ?? null
    },
    async updateUser(id, input) {
      const { rows } = await client.query<Account>(`WITH u AS (
        UPDATE sis_god."USUARIO" SET nombre_acceso = COALESCE($2, nombre_acceso), correo = COALESCE($3, correo),
          credencial_acceso = COALESCE($4, credencial_acceso), estado = COALESCE($5, estado), id_rol = COALESCE($6, id_rol)
        WHERE id_usuario = $1 RETURNING *
      ) SELECT ${accountColumns} FROM u ${accountJoins}`,
      [id, input.nombre_acceso, input.correo, input.credencial_acceso, input.estado, input.id_rol])
      return rows[0]
    },
    async hasOtherAdministrator(roleId, userId) {
      const { rows } = await client.query<{ exists: boolean }>(`SELECT EXISTS (
        SELECT 1 FROM sis_god."USUARIO" WHERE id_rol = $1 AND id_usuario <> $2
          AND estado = 'activo' AND id_empleado IS NOT NULL
      )`, [roleId, userId])
      return rows[0].exists
    },
    async replaceRolePermissions(roleId, permissionIds) {
      const found = await client.query(`SELECT id_permiso FROM sis_god."PERMISO"
        WHERE id_permiso = ANY($1::bigint[]) ORDER BY id_permiso FOR KEY SHARE`, [permissionIds])
      if (found.rowCount !== permissionIds.length) throw missing('Uno o más permisos no existen.')
      await client.query('DELETE FROM sis_god."ROL_PERMISO" WHERE id_rol = $1', [roleId])
      await client.query(`INSERT INTO sis_god."ROL_PERMISO" (id_rol, id_permiso)
        SELECT $1, id_permiso FROM unnest($2::bigint[]) AS ids(id_permiso)`, [roleId, permissionIds])
    },
  }
}

export function postgresSecurityRepository(source: Pick<Pool, 'connect' | 'query'> = pool): SecurityRepository {
  async function findAccount(predicate: string, value: string) {
    const { rows } = await source.query<AuthenticatedAccount>(`SELECT ${accountColumns}, u.credencial_acceso,
      ${permissions} AS permisos FROM sis_god."USUARIO" u ${accountJoins} WHERE ${predicate} LIMIT 2`, [value])
    return rows.length === 1 ? rows[0] : null
  }

  return {
    findByLogin: (field, value) => findAccount(field === 'correo' ? 'lower(u.correo) = lower($1)' : 'u.nombre_acceso = $1', value),
    findById: id => findAccount('u.id_usuario = $1', id),
    async listRoles() {
      const { rows } = await source.query<Role & { permisos: Permission[] }>(
        `SELECT r.id_rol, r.nombre, r.descripcion, ${permissions} AS permisos FROM sis_god."ROL" r ORDER BY r.id_rol`)
      return rows
    },
    async listPermissions() {
      const { rows } = await source.query<Permission>(
        'SELECT id_permiso, recurso, accion, alcance FROM sis_god."PERMISO" ORDER BY recurso, accion, alcance')
      return rows
    },
    async listUsers({ q, id_rol, estado, pagina, limite }: AccountFilters) {
      const { rows } = await source.query<Account>(selectAccount + `
        WHERE ($1::text IS NULL OR strpos(lower(u.nombre_acceso), lower($1)) > 0 OR strpos(lower(u.correo), lower($1)) > 0
          OR strpos(lower(concat_ws(' ', coalesce(e.nombres, p.nombres), coalesce(e.apellidos, p.apellidos))), lower($1)) > 0)
          AND ($2::bigint IS NULL OR u.id_rol = $2) AND ($3::text IS NULL OR u.estado = $3)
        ORDER BY u.id_usuario LIMIT $4 OFFSET $5`, [q, id_rol, estado, limite, (pagina - 1) * limite])
      return rows
    },
    withAdministration: (actorId, work) => withTransaction(async client => {
      // Un orden común de bloqueo evita que dos cambios retiren a los últimos administradores simultáneamente.
      const { rows: roles } = await client.query<Role>(
        `SELECT id_rol FROM sis_god."ROL" WHERE nombre = 'Administrador' FOR UPDATE`)
      const adminRoleId = roles[0]?.id_rol
      if (!adminRoleId) throw forbidden()
      const repo = adminWrites(client)
      const actor = await repo.getUserForUpdate(actorId)
      if (actor?.estado !== 'activo' || actor.id_rol !== adminRoleId || !actor.id_empleado) throw forbidden()
      return work(repo, adminRoleId)
    }, source),
  }
}

export const securityRepository = postgresSecurityRepository()

export type AccessTarget = 'paciente' | 'historia' | 'empleado' | 'plan' | 'presupuesto' | 'obligacion' | 'pago'

const plan = `FROM sis_god."PLAN_TRATAMIENTO" plan JOIN sis_god."HISTORIA_CLINICA" h USING (id_historia)`
const budget = plan + ' JOIN sis_god."PRESUPUESTO" b USING (id_plan)'
const obligation = budget + ' JOIN sis_god."OBLIGACION" o USING (id_presupuesto)'
const planOwner = 'SELECT h.id_paciente, plan.id_odontologo '
const ownerSql: Record<AccessTarget, string> = {
  paciente: 'SELECT id_paciente, NULL::bigint AS id_odontologo FROM sis_god."PACIENTE" WHERE id_paciente = $1',
  historia: 'SELECT id_paciente, NULL::bigint AS id_odontologo FROM sis_god."HISTORIA_CLINICA" WHERE id_historia = $1',
  empleado: 'SELECT NULL::bigint AS id_paciente, id_empleado AS id_odontologo FROM sis_god."EMPLEADO" WHERE id_empleado = $1',
  plan: planOwner + plan + ' WHERE plan.id_plan = $1',
  presupuesto: planOwner + budget + ' WHERE b.id_presupuesto = $1',
  obligacion: planOwner + obligation + ' WHERE o.id_obligacion = $1',
  pago: planOwner + obligation + ' JOIN sis_god."PAGO" p USING (id_obligacion) WHERE p.id_pago = $1',
}

export function postgresAccessRepository(source: Pick<Pool, 'query'> = pool) {
  return {
    async ownerOf(target: AccessTarget, id: string) {
      const { rows } = await source.query<{ id_paciente: string | null; id_odontologo: string | null }>(ownerSql[target], [id])
      return rows[0] ?? null
    },
    async isAssigned(patientId: string, employeeId: string) {
      const { rows } = await source.query<{ exists: boolean }>(`SELECT EXISTS (
        SELECT 1 ${plan} WHERE h.id_paciente = $1 AND plan.id_odontologo = $2
      )`, [patientId, employeeId])
      return rows[0].exists
    },
    async contactBelongsTo(contactId: string, patientId: string) {
      const { rows } = await source.query<{ exists: boolean }>(`SELECT EXISTS (
        SELECT 1 FROM sis_god."CONTACTO" WHERE id_contacto = $1 AND id_paciente = $2
      )`, [contactId, patientId])
      return rows[0].exists
    },
  }
}

export const accessRepository = postgresAccessRepository()
