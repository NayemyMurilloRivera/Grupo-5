import type { Request, RequestHandler, Response } from 'express'
import type { PatientRepository } from '../../../application/ports/pacientes.repository.js'
import { listPatients as list } from '../../../application/use-cases/pacientes/listPatients.js'
import { getPatient as get } from '../../../application/use-cases/pacientes/getPatient.js'
import { PatientError } from '../../../domain/pacientes/errors.js'
import { patientRepository } from '../../../infrastructure/database/sql/repositories/pacientes.repository.js'
import { listPatientsInput, patientId, patientScope } from '../validators/pacientes.validator.js'

function handle(work: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return async (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    try {
      res.status(200).json(await work(req, res))
    } catch (error) {
      if (error instanceof PatientError) {
        res.status(error.status).json({ error: { codigo: error.code, mensaje: error.message, detalles: [] } })
      } else next(error)
    }
  }
}

export function pacientesController(repo: PatientRepository) {
  return {
    listPatients: handle((req, res) => list(repo, listPatientsInput(req.query), patientScope(res.locals.authorization))),
    getPatient: handle((req, res) => get(repo, patientId(req.params.id), patientScope(res.locals.authorization))),
  }
}

export const { listPatients, getPatient } = pacientesController(patientRepository)
