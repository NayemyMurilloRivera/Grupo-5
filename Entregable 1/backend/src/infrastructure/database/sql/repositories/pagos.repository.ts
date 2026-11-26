import type { Pool, PoolClient } from 'pg'
import type { DocumentKind } from '../../../../domain/pagos/entities.js'
import { conflict, invalid, notFound } from '../../../../domain/pagos/errors.js'
import type { DocumentRow, PaymentRow, PaymentsRepository, PaymentTx } from '../../../../application/ports/pagos.repository.js'
import { pool as defaultPool } from '../connection.js'
import { withTransaction } from '../transaction.js'

// Tablas fijas por tipo: nunca se interpola texto del usuario en el SQL.
const DOC_TABLE: Record<DocumentKind, string> = { boleta: 'sis_god."BOLETA"', factura: 'sis_god."FACTURA"' }

const FROM_PAYMENT = `
  sis_god."PAGO" p
  JOIN sis_god."OBLIGACION" o ON o.id_obligacion = p.id_obligacion
  JOIN sis_god."PRESUPUESTO" pr ON pr.id_presupuesto = o.id_presupuesto
  JOIN sis_god."PLAN_TRATAMIENTO" pl ON pl.id_plan = pr.id_plan
  JOIN sis_god."HISTORIA_CLINICA" h ON h.id_historia = pl.id_historia
  JOIN sis_god."PACIENTE" pa ON pa.id_paciente = h.id_paciente`

const PAYMENT_COLS = `id_pago::text, to_char(fecha_hora, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_hora, importe::text, referencia, id_obligacion::text, id_metodopago::text`

function mapDocumentError(error: unknown): never {
  const e = error as { code?: string; constraint?: string; message?: string }
  if (e?.code === '23505') throw conflict('NUMERACION_DUPLICADA', 'Ya existe un documento con esa serie y número, o el pago ya tiene comprobante.')
  if (e?.code === '23514' || e?.code === '23502' || e?.code === '22001') throw invalid('Los datos del documento no cumplen las restricciones.')
  if (e?.code === '23503') throw notFound('El pago asociado no existe.')
  // Trigger de exclusividad boleta/factura u otra regla de la base.
  if (e?.code === 'P0001' || e?.code === '23P01') throw conflict('DOCUMENTO_EXCLUYENTE', 'El pago ya tiene otro tipo de documento (boleta y factura son excluyentes).')
  throw error
}

function transactionOf(client: PoolClient): PaymentTx {
  return {
    async lockObligation(id) {
      const { rows } = await client.query(`SELECT id_obligacion::text, importe::text FROM sis_god."OBLIGACION" WHERE id_obligacion = $1 FOR UPDATE`, [id])
      return rows[0] ?? null
    },
    async paidTotal(id) {
      const { rows } = await client.query(`SELECT COALESCE(SUM(importe), 0)::text AS total FROM sis_god."PAGO" WHERE id_obligacion = $1`, [id])
      return rows[0].total
    },
    async methodExists(id) {
      const { rowCount } = await client.query(`SELECT 1 FROM sis_god."METODO_PAGO" WHERE id_metodopago = $1`, [id])
      return (rowCount ?? 0) > 0
    },
    async insertPayment(i) {
      const { rows } = await client.query(
        `INSERT INTO sis_god."PAGO" (fecha_hora, importe, referencia, id_obligacion, id_metodopago)
         VALUES (LOCALTIMESTAMP, $1::numeric, $2, $3, $4) RETURNING ${PAYMENT_COLS}`,
        [i.importe, i.referencia, i.id_obligacion, i.id_metodopago])
      return rows[0] as PaymentRow
    },
    async nextNumber(tipo, serie) {
      // Bloqueo por (tipo, serie) hasta el COMMIT: dos cobros simultáneos no obtienen el mismo número.
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`pagos:${tipo}:${serie}`])
      const { rows } = await client.query(`SELECT (COALESCE(MAX(numero), 0) + 1)::text AS n FROM ${DOC_TABLE[tipo]} WHERE serie = $1`, [serie])
      return rows[0].n
    },
    async insertDocument(doc) {
      try {
        const sql = doc.tipo === 'boleta'
          ? `INSERT INTO sis_god."BOLETA" (serie, numero, fecha_emision, nombre_receptor, documento_receptor, id_pago)
             VALUES ($1, $2::bigint, CURRENT_DATE, $3, $4, $5) RETURNING serie, numero::text, fecha_emision::text`
          : `INSERT INTO sis_god."FACTURA" (serie, numero, fecha_emision, razon_social_receptor, ruc_receptor, id_pago)
             VALUES ($1, $2::bigint, CURRENT_DATE, $3, $4, $5) RETURNING serie, numero::text, fecha_emision::text`
        const { rows } = await client.query(sql, [doc.serie, doc.numero, doc.receptor || null, doc.documento_receptor, doc.id_pago])
        return { tipo: doc.tipo, id_pago: doc.id_pago, receptor: doc.receptor, documento_receptor: doc.documento_receptor, ...rows[0] } as DocumentRow
      } catch (error) { mapDocumentError(error) }
    },
  }
}

export function postgresPaymentsRepository(pool: Pick<Pool, 'connect' | 'query'> = defaultPool): PaymentsRepository {
  return {
    transaction: work => withTransaction(client => work(transactionOf(client)), pool),

    async listMethods() {
      const { rows } = await pool.query(`SELECT id_metodopago::text, nombre FROM sis_god."METODO_PAGO" ORDER BY nombre`)
      return rows
    },
    async createMethod(nombre) {
      try {
        const { rows } = await pool.query(`INSERT INTO sis_god."METODO_PAGO" (nombre) VALUES ($1) RETURNING id_metodopago::text, nombre`, [nombre])
        return rows[0]
      } catch (error) {
        if ((error as { code?: string }).code === '23505') throw conflict('METODO_DUPLICADO', 'Ya existe un método de pago con ese nombre.')
        throw error
      }
    },
    async getPayment(id) {
      const { rows } = await pool.query(
        `SELECT p.id_pago::text, to_char(p.fecha_hora, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_hora, p.importe::text, p.referencia,
                p.id_obligacion::text, p.id_metodopago::text, m.nombre AS metodo,
                pa.id_paciente::text, pa.nombres || ' ' || pa.apellidos AS paciente,
                COALESCE(b.serie || '-' || lpad(b.numero::text, 8, '0'), f.serie || '-' || lpad(f.numero::text, 8, '0')) AS comprobante
         FROM ${FROM_PAYMENT}
         JOIN sis_god."METODO_PAGO" m ON m.id_metodopago = p.id_metodopago
         LEFT JOIN sis_god."BOLETA" b ON b.id_pago = p.id_pago
         LEFT JOIN sis_god."FACTURA" f ON f.id_pago = p.id_pago
         WHERE p.id_pago = $1`, [id])
      return rows[0] ?? null
    },
    async getAccount(idPaciente) {
      const person = await pool.query(`SELECT id_paciente::text, nombres || ' ' || apellidos AS paciente FROM sis_god."PACIENTE" WHERE id_paciente = $1`, [idPaciente])
      if (!person.rows[0]) return null
      // Los pagos se agrupan por obligación ANTES del JOIN: así un importe no se multiplica por sus abonos.
      const { rows } = await pool.query(
        `WITH pagado AS (SELECT id_obligacion, SUM(importe) AS total FROM sis_god."PAGO" GROUP BY id_obligacion)
         SELECT o.id_obligacion::text, o.fecha_emision::text, o.fecha_vencimiento::text,
                o.importe::text AS obligado, COALESCE(g.total, 0)::text AS pagado, (o.importe - COALESCE(g.total, 0))::text AS saldo
         FROM sis_god."OBLIGACION" o
         JOIN sis_god."PRESUPUESTO" pr ON pr.id_presupuesto = o.id_presupuesto
         JOIN sis_god."PLAN_TRATAMIENTO" pl ON pl.id_plan = pr.id_plan
         JOIN sis_god."HISTORIA_CLINICA" h ON h.id_historia = pl.id_historia
         LEFT JOIN pagado g ON g.id_obligacion = o.id_obligacion
         WHERE h.id_paciente = $1 ORDER BY o.id_obligacion`, [idPaciente])
      return { ...person.rows[0], obligaciones: rows }
    },
    async getReceipt(idPago) {
      const { rows } = await pool.query(
        `SELECT p.importe::text,
                d.tipo, d.serie, d.numero::text, d.fecha_emision::text, d.receptor, d.documento_receptor
         FROM sis_god."PAGO" p
         LEFT JOIN LATERAL (
           SELECT 'boleta' AS tipo, serie, numero, fecha_emision, nombre_receptor AS receptor, documento_receptor FROM sis_god."BOLETA" WHERE id_pago = p.id_pago
           UNION ALL
           SELECT 'factura', serie, numero, fecha_emision, razon_social_receptor, ruc_receptor FROM sis_god."FACTURA" WHERE id_pago = p.id_pago
         ) d ON TRUE
         WHERE p.id_pago = $1 LIMIT 1`, [idPago])
      const row = rows[0]
      if (!row) return { existePago: false, documento: null, importe: null }
      return { existePago: true, importe: row.importe, documento: row.tipo ? { id_pago: idPago, tipo: row.tipo, serie: row.serie, numero: row.numero, fecha_emision: row.fecha_emision, receptor: row.receptor, documento_receptor: row.documento_receptor } : null }
    },
    async receivables({ desde, hasta, saldoMinimo }) {
      const { rows } = await pool.query(
        `WITH pagado AS (SELECT id_obligacion, SUM(importe) AS total FROM sis_god."PAGO" GROUP BY id_obligacion)
         SELECT pa.id_paciente::text, pa.nombres || ' ' || pa.apellidos AS paciente,
                COUNT(*)::text AS obligaciones, SUM(o.importe)::text AS obligado,
                SUM(COALESCE(g.total, 0))::text AS pagado, SUM(o.importe - COALESCE(g.total, 0))::text AS saldo
         FROM sis_god."OBLIGACION" o
         JOIN sis_god."PRESUPUESTO" pr ON pr.id_presupuesto = o.id_presupuesto
         JOIN sis_god."PLAN_TRATAMIENTO" pl ON pl.id_plan = pr.id_plan
         JOIN sis_god."HISTORIA_CLINICA" h ON h.id_historia = pl.id_historia
         JOIN sis_god."PACIENTE" pa ON pa.id_paciente = h.id_paciente
         LEFT JOIN pagado g ON g.id_obligacion = o.id_obligacion
         WHERE ($1::date IS NULL OR o.fecha_emision >= $1::date) AND ($2::date IS NULL OR o.fecha_emision <= $2::date)
         GROUP BY pa.id_paciente, pa.nombres, pa.apellidos
         HAVING SUM(o.importe - COALESCE(g.total, 0)) >= $3::numeric
         ORDER BY SUM(o.importe - COALESCE(g.total, 0)) DESC, pa.id_paciente`,
        [desde ?? null, hasta ?? null, saldoMinimo])
      return rows
    },
  }
}
export const pagosRepository = postgresPaymentsRepository()
