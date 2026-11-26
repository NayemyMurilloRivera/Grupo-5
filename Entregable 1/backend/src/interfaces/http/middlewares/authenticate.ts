import type { RequestHandler } from 'express'
import type { SecurityRepository } from '../../../application/ports/seguridad.repository.js'
import { accountIdentity, type AuthContext } from '../../../domain/seguridad/entities.js'
import { invalidSession } from '../../../domain/seguridad/errors.js'
import { matchesCredential, verifyToken } from '../../../infrastructure/auth/tokens.js'
import { securityRepository } from '../../../infrastructure/database/sql/repositories/seguridad.repository.js'
import { sendSecurityError } from '../controllers/seguridad.controller.js'

export function createAuthenticate(repo: Pick<SecurityRepository, 'findById'>): RequestHandler {
  return async (req, res, next) => {
    try {
      const token = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') ?? '')?.[1]
      const claims = token && verifyToken(token)
      if (!claims) throw invalidSession()
      const record = await repo.findById(claims.sub)
      const identity = record && accountIdentity(record)
      if (!identity || !record || !matchesCredential(claims, record.credencial_acceso)) throw invalidSession()
      const auth: AuthContext = { ...identity, permisos: record.permisos }
      res.locals.auth = auth
      next()
    } catch (error) {
      if (!sendSecurityError(error, res)) next(error)
    }
  }
}

export const authenticate = createAuthenticate(securityRepository)
