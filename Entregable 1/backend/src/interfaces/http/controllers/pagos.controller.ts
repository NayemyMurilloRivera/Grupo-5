import type { Request, RequestHandler, Response } from 'express'
import type { PaymentsRepository } from '../../../application/ports/pagos.repository.js'
import { createPayment as registerPayment } from '../../../application/use-cases/pagos/createPayment.js'
import { createPaymentMethod as registerMethod } from '../../../application/use-cases/pagos/createPaymentMethod.js'
import * as account from '../../../application/use-cases/pagos/getAccount.js'
import { getMyAccount as ownAccount } from '../../../application/use-cases/pagos/getMyAccount.js'
import * as payment from '../../../application/use-cases/pagos/getPayment.js'
import * as receipt from '../../../application/use-cases/pagos/getReceipt.js'
import * as report from '../../../application/use-cases/pagos/getReceivablesReport.js'
import { listPaymentMethods as listMethods } from '../../../application/use-cases/pagos/listPaymentMethods.js'
import type { AuthContext } from '../../../domain/seguridad/entities.js'
import { knownPaymentError } from '../../../domain/pagos/errors.js'
import { pagosRepository } from '../../../infrastructure/database/sql/repositories/pagos.repository.js'
import { methodInput, paymentInput, reportFilters, requiredId } from '../validators/pagos.validator.js'

export function sendPaymentError(error: unknown, res: Response): boolean {
  const known = knownPaymentError(error)
  if (!known) return false
  res.set('Cache-Control', 'no-store').status(known.status).json({ error: { codigo: known.code, mensaje: known.message, detalles: [] } })
  return true
}

function handle(status: number, work: (req: Request, res: Response) => Promise<unknown> | unknown): RequestHandler {
  return async (req, res, next) => {
    try {
      const result = await work(req, res)
      if (!res.headersSent) res.set('Cache-Control', 'no-store').status(status).json(result)
    } catch (error) {
      if (!sendPaymentError(error, res)) next(error)
    }
  }
}
const session = (res: Response) => res.locals.auth as AuthContext

export function pagosController(repo: PaymentsRepository) {
  return {
    listPaymentMethods: handle(200, () => listMethods(repo)),
    createPaymentMethod: handle(201, req => registerMethod(repo, methodInput(req.body))),
    createPayment: handle(201, req => registerPayment(repo, paymentInput(req.body))),
    getPayment: handle(200, req => payment.getPayment(repo, requiredId(req.params.id))),
    getAccount: handle(200, req => account.getAccount(repo, requiredId(req.params.id))),
    getReceipt: handle(200, req => receipt.getReceipt(repo, requiredId(req.params.id))),
    getMyAccount: handle(200, (_req, res) => ownAccount(repo, session(res)?.idPaciente)),
    getReceivablesReport: handle(200, async (req, res) => {
      const filters = reportFilters(req.query)
      const data = await report.getReceivablesReport(repo, filters)
      if (filters.formato !== 'csv') return data
      res.set('Cache-Control', 'no-store')
        .type('text/csv; charset=utf-8')
        .set('Content-Disposition', 'attachment; filename="cuentas-por-cobrar.csv"')
        .status(200).send(report.toCsv(data))
    }),
  }
}

export const { listPaymentMethods, createPaymentMethod, createPayment, getPayment, getAccount, getReceipt, getReceivablesReport, getMyAccount } =
  pagosController(pagosRepository)
