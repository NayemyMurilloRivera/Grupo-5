import type { Request, RequestHandler, Response } from 'express'
import type { PatientRepository } from '../../../application/ports/pacientes.repository.js'
import { listPatients as list } from '../../../application/use-cases/pacientes/listPatients.js'
import { getPatient as get } from '../../../application/use-cases/pacientes/getPatient.js'
import { knownPatientError } from '../../../domain/pacientes/errors.js'
import { createPatient as create } from '../../../application/use-cases/pacientes/createPatient.js'
import type { AuthContext } from '../../../domain/seguridad/entities.js'
import { patientRepository } from '../../../infrastructure/database/sql/repositories/pacientes.repository.js'
import { createPatientInput, listPatientsInput, patientId, patientScope } from '../validators/pacientes.validator.js'

function handle(work: (req: Request, res: Response) => Promise<unknown>, status = 200): RequestHandler {
  return async (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    try {
      res.status(status).json(await work(req, res))
    } catch (error) {
      const known = knownPatientError(error)
      if (known) {
        res.status(known.status).json({ error: { codigo: known.code, mensaje: known.message, detalles: [] } })
      } else next(error)
    }
  }
}

export function pacientesController(repo: PatientRepository) {
  return {
    createPatient: handle((req, res) => {
      const auth = res.locals.auth as AuthContext | undefined
      const canRegisterAntecedents = auth?.permisos.some(permission => permission.recurso === 'antecedentes' &&
        permission.accion === 'crear' && permission.alcance === 'global') ?? false
      return create(repo, createPatientInput(req.body), patientScope(res.locals.authorization), canRegisterAntecedents)
    }, 201),
    listPatients: handle((req, res) => list(repo, listPatientsInput(req.query), patientScope(res.locals.authorization))),
    getPatient: handle((req, res) => get(repo, patientId(req.params.id), patientScope(res.locals.authorization))),
  }
}

export const { createPatient, listPatients, getPatient } = pacientesController(patientRepository)
