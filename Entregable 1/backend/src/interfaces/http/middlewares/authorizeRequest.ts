import type { Request, RequestHandler } from 'express'
import { positiveId, type AuthContext, type Scope } from '../../../domain/seguridad/entities.js'
import { forbidden, invalidSession } from '../../../domain/seguridad/errors.js'
import { accessRepository, type AccessTarget, type postgresAccessRepository } from '../../../infrastructure/database/sql/repositories/seguridad.repository.js'
import { sendSecurityError } from '../controllers/seguridad.controller.js'
import { requiredId } from '../validators/seguridad.validator.js'

type AccessRepository = ReturnType<typeof postgresAccessRepository>
interface Rule {
  resource: string
  action: string
  target?: AccessTarget
  collection?: boolean
  ownAccount?: boolean
}
export interface AuthorizationScope {
  alcance: Scope
  idPaciente?: string
  idEmpleado?: string
}

const administration = new Set([
  'GET /roles', 'GET /permisos', 'POST /usuarios', 'GET /usuarios',
  'PATCH /usuarios/:id', 'PUT /roles/:id/permisos',
])

const rules: Record<string, Rule> = {
  'GET /pacientes': { resource: 'pacientes', action: 'leer', collection: true },
  'POST /pacientes': { resource: 'pacientes', action: 'crear' },
  'GET /pacientes/:id': { resource: 'pacientes', action: 'leer', target: 'paciente' },
  'PATCH /pacientes/:id': { resource: 'pacientes', action: 'actualizar', target: 'paciente' },
  'GET /pacientes/:id/historia': { resource: 'historias', action: 'leer', target: 'paciente' },
  'POST /pacientes/:id/antecedentes': { resource: 'antecedentes', action: 'crear', target: 'paciente' },
  'PATCH /historias/:id/cuestionario': { resource: 'historias', action: 'actualizar', target: 'historia' },
  'DELETE /pacientes/:id/contactos/:contactoId': { resource: 'contactos', action: 'eliminar', target: 'paciente' },
  'GET /empleados': { resource: 'empleados', action: 'leer' },
  'POST /empleados': { resource: 'empleados', action: 'crear' },
  'GET /empleados/:id': { resource: 'empleados', action: 'leer', target: 'empleado' },
  'PATCH /empleados/:id': { resource: 'empleados', action: 'actualizar', target: 'empleado' },
  'GET /odontologos': { resource: 'odontologos', action: 'leer' },
  'GET /tratamientos': { resource: 'tratamientos', action: 'leer' },
  'POST /tratamientos': { resource: 'tratamientos', action: 'crear' },
  'PATCH /tratamientos/:id': { resource: 'tratamientos', action: 'actualizar' },
  'GET /planes-tratamiento': { resource: 'planes', action: 'leer', collection: true },
  'POST /planes-tratamiento': { resource: 'planes', action: 'crear', target: 'historia' },
  'GET /planes-tratamiento/:id': { resource: 'planes', action: 'leer', target: 'plan' },
  'PATCH /planes-tratamiento/:id': { resource: 'planes', action: 'actualizar', target: 'plan' },
  'POST /planes-tratamiento/:id/presupuestos': { resource: 'presupuestos', action: 'crear', target: 'plan' },
  'POST /presupuestos/:id/aceptacion': { resource: 'presupuestos', action: 'aceptar', target: 'presupuesto' },
  'PATCH /presupuestos/:id/revisor': { resource: 'presupuestos', action: 'revisar', target: 'presupuesto' },
  'GET /obligaciones/:id': { resource: 'obligaciones', action: 'leer', target: 'obligacion' },
  'GET /metodos-pago': { resource: 'metodos_pago', action: 'leer' },
  'POST /metodos-pago': { resource: 'metodos_pago', action: 'crear' },
  'POST /pagos': { resource: 'pagos', action: 'crear', target: 'obligacion' },
  'GET /pagos/:id': { resource: 'pagos', action: 'leer', target: 'pago' },
  'GET /pagos/:id/comprobante': { resource: 'comprobantes', action: 'leer', target: 'pago' },
  'GET /pacientes/:id/estado-cuenta': { resource: 'estado_cuenta', action: 'leer', target: 'paciente' },
  'GET /reportes/cuentas-por-cobrar': { resource: 'reportes', action: 'leer' },
  'GET /mi/estado-cuenta': { resource: 'estado_cuenta', action: 'leer', ownAccount: true },
}

function targetId(req: Request, path: string) {
  if (path === 'POST /planes-tratamiento') return requiredId(req.body?.id_historia, 'id_historia')
  if (path === 'POST /pagos') return requiredId(req.body?.id_obligacion, 'id_obligacion')
  return requiredId(req.params.id)
}

async function ruleScope(repo: AccessRepository, req: Request, path: string, auth: AuthContext): Promise<AuthorizationScope> {
  const rule = rules[path]
  if (!rule) throw forbidden()
  const grants = auth.permisos.filter(permit => permit.recurso === rule.resource && permit.accion === rule.action)
  const granted = (scope: Scope) => grants.some(permit => permit.alcance === scope)
  const dentistPlanWrite = auth.role === 'ODONTOLOGO' &&
    (path === 'POST /planes-tratamiento' || path === 'PATCH /planes-tratamiento/:id')
  if (granted('global') && !auth.idPaciente && !rule.ownAccount && !dentistPlanWrite) return { alcance: 'global' }

  if (auth.idPaciente && granted('propio')) {
    if (rule.collection || rule.ownAccount) return { alcance: 'propio', idPaciente: auth.idPaciente }
    const owner = rule.target && await repo.ownerOf(rule.target, targetId(req, path))
    if (owner && owner.id_paciente === auth.idPaciente) {
      if (path === 'DELETE /pacientes/:id/contactos/:contactoId' &&
          !await repo.contactBelongsTo(requiredId(req.params.contactoId, 'contactoId'), auth.idPaciente)) throw forbidden()
      return { alcance: 'propio', idPaciente: auth.idPaciente }
    }
  }

  if (auth.idEmpleado && !rule.ownAccount) {
    if (rule.target === 'empleado' && granted('propio') && requiredId(req.params.id) === auth.idEmpleado) {
      return { alcance: 'propio', idEmpleado: auth.idEmpleado }
    }
    if (granted('asignado') && (auth.role === 'ODONTOLOGO' || auth.role === 'ASISTENTE')) {
      if (rule.collection) return { alcance: 'asignado', idEmpleado: auth.idEmpleado }
      if (rule.target && rule.target !== 'empleado') {
        const owner = await repo.ownerOf(rule.target, targetId(req, path))
        const assigned = owner && (owner.id_odontologo === auth.idEmpleado ||
          (owner.id_odontologo === null && owner.id_paciente && await repo.isAssigned(owner.id_paciente, auth.idEmpleado)))
        const requestedDentist = req.body?.id_odontologo
        const canSetDentist = path === 'POST /planes-tratamiento' ? positiveId(requestedDentist) === auth.idEmpleado :
          !dentistPlanWrite || requestedDentist === undefined || positiveId(requestedDentist) === auth.idEmpleado
        const changesHistory = path === 'PATCH /planes-tratamiento/:id' && req.body?.id_historia !== undefined
        if (assigned && canSetDentist && !changesHistory &&
            (path !== 'DELETE /pacientes/:id/contactos/:contactoId' ||
              await repo.contactBelongsTo(requiredId(req.params.contactoId, 'contactoId'), owner.id_paciente!))) {
          return { alcance: 'asignado', idEmpleado: auth.idEmpleado }
        }
      }
    }
  }
  throw forbidden()
}

export function createAuthorizeRequest(repo: AccessRepository): RequestHandler {
  return async (req, res, next) => {
    try {
      const auth = res.locals.auth as AuthContext | undefined
      if (!auth) throw invalidSession()
      const path = req.method + ' ' + req.route?.path
      if (administration.has(path)) {
        if (auth.role !== 'ADMINISTRADOR' || !auth.idEmpleado) throw forbidden()
        res.locals.authorization = { alcance: 'global' } satisfies AuthorizationScope
      } else if (path !== 'GET /auth/me') {
        res.locals.authorization = await ruleScope(repo, req, path, auth)
      }
      next()
    } catch (error) {
      if (!sendSecurityError(error, res)) next(error)
    }
  }
}

export const authorizeRequest = createAuthorizeRequest(accessRepository)
