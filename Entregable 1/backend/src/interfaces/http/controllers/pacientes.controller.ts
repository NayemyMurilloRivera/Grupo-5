import type { Request, RequestHandler, Response } from 'express'
import type { PatientRepository } from '../../../application/ports/pacientes.repository.js'
import { getHistory as history } from '../../../application/use-cases/pacientes/getHistory.js'
import { createAntecedent as registerAntecedent } from '../../../application/use-cases/pacientes/createAntecedent.js'
import { updatePatient as update } from '../../../application/use-cases/pacientes/updatePatient.js'
import { deleteContact as removeContact } from '../../../application/use-cases/pacientes/deleteContact.js'
import { listPatients as list } from '../../../application/use-cases/pacientes/listPatients.js'
import { getPatient as get } from '../../../application/use-cases/pacientes/getPatient.js'
import { knownPatientError } from '../../../domain/pacientes/errors.js'
import { createPatient as create } from '../../../application/use-cases/pacientes/createPatient.js'
import type { AuthContext } from '../../../domain/seguridad/entities.js'
import { patientRepository } from '../../../infrastructure/database/sql/repositories/pacientes.repository.js'
import { createPatientInput, createAntecedentInput, updatePatientInput, listPatientsInput, patientId, patientScope } from '../validators/pacientes.validator.js'

function handle(work: (req: Request, res: Response) => Promise<unknown>, status = 200): RequestHandler {
  return async (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    try {
      const result = await work(req, res)
      if (status === 204) res.status(status).end()
      else res.status(status).json(result)
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
    getHistory: handle((req, res) => history(repo, patientId(req.params.id), patientScope(res.locals.authorization))),
    createAntecedent: handle((req, res) => registerAntecedent(repo, patientId(req.params.id),
      createAntecedentInput(req.body), patientScope(res.locals.authorization)), 201),
    updatePatient: handle((req, res) => update(repo, patientId(req.params.id), updatePatientInput(req.body), patientScope(res.locals.authorization))),
    deleteContact: handle((req, res) => removeContact(repo, patientId(req.params.id), patientId(req.params.contactoId, 'contactoId'),
      patientScope(res.locals.authorization)), 204),
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

export const { createPatient, listPatients, getPatient, updatePatient, deleteContact, getHistory, createAntecedent } = pacientesController(patientRepository)
