import type { Request, RequestHandler, Response } from 'express'
import type { SecurityRepository } from '../../../application/ports/seguridad.repository.js'
import * as create from '../../../application/use-cases/seguridad/createUser.js'
import * as me from '../../../application/use-cases/seguridad/getMe.js'
import * as permissions from '../../../application/use-cases/seguridad/listPermissions.js'
import * as roles from '../../../application/use-cases/seguridad/listRoles.js'
import * as users from '../../../application/use-cases/seguridad/listUsers.js'
import * as access from '../../../application/use-cases/seguridad/login.js'
import * as replace from '../../../application/use-cases/seguridad/replaceRolePermissions.js'
import * as update from '../../../application/use-cases/seguridad/updateUser.js'
import type { AuthContext } from '../../../domain/seguridad/entities.js'
import { knownSecurityError } from '../../../domain/seguridad/errors.js'
import { securityRepository } from '../../../infrastructure/database/sql/repositories/seguridad.repository.js'
import { createUserInput, listUsersInput, loginInput, permissionIdsInput, requiredId, updateUserInput } from '../validators/seguridad.validator.js'

export function sendSecurityError(error: unknown, res: Response): boolean {
  const known = knownSecurityError(error)
  if (!known) return false
  res.set('Cache-Control', 'no-store').status(known.status).json({
    error: { codigo: known.code, mensaje: known.message, detalles: [] },
  })
  return true
}

function handle(status: number, work: (req: Request, res: Response) => unknown): RequestHandler {
  return async (req, res, next) => {
    try {
      const result = await work(req, res)
      res.set('Cache-Control', 'no-store').status(status).json(result)
    } catch (error) {
      if (!sendSecurityError(error, res)) next(error)
    }
  }
}

const context = (res: Response) => res.locals.auth as AuthContext

export function seguridadController(repo: SecurityRepository) {
  return {
    login: handle(200, req => {
      const input = loginInput(req.body)
      return access.login(repo, input.field, input.identifier, input.password)
    }),
    getMe: handle(200, (_req, res) => me.getMe(context(res))),
    listRoles: handle(200, () => roles.listRoles(repo)),
    listPermissions: handle(200, () => permissions.listPermissions(repo)),
    createUser: handle(201, (req, res) => create.createUser(repo, context(res).idUsuario, createUserInput(req.body))),
    listUsers: handle(200, req => users.listUsers(repo, listUsersInput(req.query))),
    updateUser: handle(200, (req, res) => update.updateUser(repo, context(res).idUsuario, requiredId(req.params.id), updateUserInput(req.body))),
    replaceRolePermissions: handle(200, (req, res) =>
      replace.replaceRolePermissions(repo, context(res).idUsuario, requiredId(req.params.id), permissionIdsInput(req.body))),
  }
}

export const { login, getMe, listRoles, listPermissions, createUser, listUsers, updateUser, replaceRolePermissions } =
  seguridadController(securityRepository)
