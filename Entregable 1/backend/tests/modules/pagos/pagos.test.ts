import assert from 'node:assert/strict'
import test from 'node:test'
import type { DocumentRow, NewDocument, PaymentRow, PaymentsRepository, PaymentTx } from '../../../src/application/ports/pagos.repository.js'
import { createPayment } from '../../../src/application/use-cases/pagos/createPayment.js'
import { getReceipt } from '../../../src/application/use-cases/pagos/getReceipt.js'
import { getMyAccount } from '../../../src/application/use-cases/pagos/getMyAccount.js'
import { getReceivablesReport, toCsv } from '../../../src/application/use-cases/pagos/getReceivablesReport.js'
import { PagoError } from '../../../src/domain/pagos/errors.js'
import { fromCents, toCents } from '../../../src/domain/pagos/entities.js'
import { paymentInput, reportFilters, requiredId } from '../../../src/interfaces/http/validators/pagos.validator.js'

/** Repositorio en memoria con semántica de transacción: bloqueo por obligación y ROLLBACK real. */
function memoryRepo(debt = '100.00') {
  const state = { pagos: [] as PaymentRow[], docs: [] as DocumentRow[], seq: 0 }
  let queue = Promise.resolve()
  const repo = {
    async transaction<T>(work: (tx: PaymentTx) => Promise<T>): Promise<T> {
      let release!: () => void
      const turn = new Promise<void>(r => (release = r))
      const previous = queue; queue = queue.then(() => turn)  // equivale a SELECT ... FOR UPDATE: una a la vez
      await previous
      const snapshot = structuredClone(state)
      const tx: PaymentTx = {
        lockObligation: async id => (id === '1' ? { id_obligacion: '1', importe: debt } : null),
        paidTotal: async () => fromCents(state.pagos.reduce((s, p) => s + toCents(p.importe), 0n)),
        methodExists: async id => id === '1',
        insertPayment: async i => { await new Promise(r => setTimeout(r, 5)); const row = { id_pago: String(++state.seq), fecha_hora: '2026-11-26T08:00:00', ...i }; state.pagos.push(row); return row },
        nextNumber: async tipo => String(state.docs.filter(d => d.tipo === tipo).length + 1),
        insertDocument: async (d: NewDocument) => {
          if (state.docs.some(x => x.tipo === d.tipo && x.serie === d.serie && x.numero === d.numero)) throw new PagoError(409, 'NUMERACION_DUPLICADA', 'dup')
          const row: DocumentRow = { ...d, fecha_emision: '2026-11-26' }; state.docs.push(row); return row
        },
      }
      try { return await work(tx) }
      catch (error) { Object.assign(state, snapshot); throw error }
      finally { release() }
    },
  } as unknown as PaymentsRepository
  return { repo, state }
}
const pay = (importe: string, extra: object = {}) => paymentInput({ id_obligacion: '1', id_metodopago: '1', importe, ...extra })

test('rechaza importes no positivos o con formato inválido', () => {
  for (const bad of ['0', '-5', 'abc', '10.999', '', null, 0]) assert.throws(() => pay(bad as string), PagoError)
})

test('rechaza un pago mayor al saldo y no lo registra', async () => {
  const { repo, state } = memoryRepo()
  await createPayment(repo, pay('30.00'))
  await assert.rejects(createPayment(repo, pay('70.01')), (e: PagoError) => e.status === 409 && e.code === 'SOBREPAGO')
  assert.equal(state.pagos.length, 1)
})

test('si falla el documento se revierte también el pago (rollback)', async () => {
  const { repo, state } = memoryRepo()
  const doc = { tipo: 'boleta', serie: 'B001', numero: '7' }
  await createPayment(repo, pay('10', { documento: doc }))
  await assert.rejects(createPayment(repo, pay('10', { documento: doc })), (e: PagoError) => e.status === 409)
  assert.equal(state.pagos.length, 1)
  assert.equal(state.docs.length, 1)
})

test('boleta y factura tienen numeración independiente y son excluyentes', async () => {
  const { repo, state } = memoryRepo()
  await createPayment(repo, pay('10', { documento: { tipo: 'boleta', serie: 'B001' } }))
  await createPayment(repo, pay('10', { documento: { tipo: 'factura', serie: 'F001', razon_social_receptor: 'Clínica SAC', ruc_receptor: '20123456789' } }))
  assert.deepEqual(state.docs.map(d => [d.tipo, d.numero]), [['boleta', '1'], ['factura', '1']])
  assert.throws(() => pay('10', { documento: { tipo: 'boleta', serie: 'B001', ruc_receptor: '20123456789' } }), PagoError)
  assert.throws(() => pay('10', { documento: { tipo: 'factura', serie: 'F001', razon_social_receptor: 'X', ruc_receptor: '123' } }), PagoError)
  assert.throws(() => pay('10', { documento: { tipo: 'factura', serie: 'F001', ruc_receptor: '20123456789' } }), PagoError)
})

test('deuda 100 con dos pagos simultáneos de 80: uno se confirma, el otro falla y el saldo queda en 20', async () => {
  const { repo, state } = memoryRepo('100.00')
  const results = await Promise.allSettled([createPayment(repo, pay('80')), createPayment(repo, pay('80'))])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.filter(r => r.status === 'rejected').length, 1)
  assert.equal(fromCents(toCents('100') - state.pagos.reduce((s, p) => s + toCents(p.importe), 0n)), '20.00')
})

test('obligación 100 con abonos 30 y 20: 100 obligado, 50 pagado, 50 pendiente (JSON y CSV)', async () => {
  const rows = [{ id_paciente: '1', paciente: 'Ana Pérez', obligaciones: '1', obligado: '100.00', pagado: '50.00', saldo: '50.00' }]
  const repo = { receivables: async () => rows } as unknown as PaymentsRepository
  const report = await getReceivablesReport(repo, reportFilters({ formato: 'csv' }))
  assert.deepEqual(report.totales, { obligaciones: '1', obligado: '100.00', pagado: '50.00', saldo: '50.00' })
  const csv = toCsv(report).replace('﻿', '').split('\r\n')
  assert.equal(csv[0], 'id_paciente,paciente,obligaciones,obligado,pagado,saldo')
  assert.equal(csv[1], '1,Ana Pérez,1,100.00,50.00,50.00')
  assert.equal(csv[2], 'TOTAL,,1,100.00,50.00,50.00')
})

test('el CSV neutraliza fórmulas de Excel en los nombres', async () => {
  const repo = { receivables: async () => [{ id_paciente: '1', paciente: '=HYPERLINK("x")', obligaciones: '1', obligado: '1.00', pagado: '0.00', saldo: '1.00' }] } as unknown as PaymentsRepository
  assert.match(toCsv(await getReceivablesReport(repo, reportFilters({}))), /"'=HYPERLINK/)
})

test('filtros del reporte: fechas reales, orden y saldo mínimo', () => {
  assert.equal(reportFilters({}).saldoMinimo, '0.01')
  assert.throws(() => reportFilters({ desde: '2026-02-30' }), PagoError)
  assert.throws(() => reportFilters({ desde: '2026-05-02', hasta: '2026-05-01' }), PagoError)
  assert.throws(() => reportFilters({ formato: 'xml' }), PagoError)
  assert.throws(() => reportFilters({ otro: '1' }), PagoError)
})

test('comprobante: 404 si el pago no tiene documento y 404 si el pago no existe', async () => {
  const sin = { getReceipt: async () => ({ existePago: true, documento: null, importe: '10.00' }) } as unknown as PaymentsRepository
  const no = { getReceipt: async () => ({ existePago: false, documento: null, importe: null }) } as unknown as PaymentsRepository
  await assert.rejects(getReceipt(sin, '1'), (e: PagoError) => e.status === 404)
  await assert.rejects(getReceipt(no, '1'), (e: PagoError) => e.status === 404)
})

test('mi estado de cuenta usa solo el titular de la sesión y no admite otro', () => {
  assert.throws(() => getMyAccount({} as PaymentsRepository, undefined), (e: PagoError) => e.status === 403)
})

test('los IDs BIGINT se validan como texto exacto', () => {
  assert.equal(requiredId('9223372036854775807'), '9223372036854775807')
  for (const bad of ['0', '-1', '1.5', '9223372036854775808', Number.MAX_SAFE_INTEGER + 1, 'abc']) assert.throws(() => requiredId(bad), PagoError)
})
