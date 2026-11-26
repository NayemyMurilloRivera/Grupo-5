import type { Request, RequestHandler, Response } from 'express'
import type { PersonalRepository } from '../../../application/ports/personal.repository.js'
import { createEmployee as create } from '../../../application/use-cases/personal/createEmployee.js'
import { createTreatment as createCatalog } from '../../../application/use-cases/personal/createTreatment.js'
import { getEmployee as get } from '../../../application/use-cases/personal/getEmployee.js'
import { listDentists as dentists } from '../../../application/use-cases/personal/listDentists.js'
import { listEmployees as list } from '../../../application/use-cases/personal/listEmployees.js'
import { listTreatments as catalog } from '../../../application/use-cases/personal/listTreatments.js'
import { updateEmployee as update } from '../../../application/use-cases/personal/updateEmployee.js'
import { updateTreatment as updateCatalog } from '../../../application/use-cases/personal/updateTreatment.js'
import { knownPersonalError } from '../../../domain/personal/errors.js'
import { personalRepository } from '../../../infrastructure/database/sql/repositories/personal.repository.js'
import {
  createEmployeeInput, createTreatmentInput, employeeScope, listDentistsInput, listEmployeesInput, listTreatmentsInput,
  requiredId, updateEmployeeInput, updateTreatmentInput,
} from '../validators/personal.validator.js'

function handle(status: number, work: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return async (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    try {
      res.status(status).json(await work(req, res))
    } catch (error) {
      const known = knownPersonalError(error)
      if (known) res.status(known.status).json({ error: { codigo: known.code, mensaje: known.message, detalles: [] } })
      else next(error)
    }
  }
}

export function personalController(repo: PersonalRepository) {
  return {
    createEmployee: handle(201, req => create(repo, createEmployeeInput(req.body))),
    listEmployees: handle(200, req => list(repo, listEmployeesInput(req.query))),
    getEmployee: handle(200, (req, res) => get(repo, requiredId(req.params.id), employeeScope(res.locals.authorization))),
    updateEmployee: handle(200, req => update(repo, requiredId(req.params.id), updateEmployeeInput(req.body))),
    listDentists: handle(200, req => dentists(repo, listDentistsInput(req.query))),
    listTreatments: handle(200, req => catalog(repo, listTreatmentsInput(req.query))),
    createTreatment: handle(201, req => createCatalog(repo, createTreatmentInput(req.body))),
    updateTreatment: handle(200, req => updateCatalog(repo, requiredId(req.params.id), updateTreatmentInput(req.body))),
  }
}

export const {
  createEmployee, listEmployees, getEmployee, updateEmployee, listDentists, listTreatments, createTreatment, updateTreatment,
} = personalController(personalRepository)
