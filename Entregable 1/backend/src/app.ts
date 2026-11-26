import express, { type RequestHandler } from 'express'
import cors from 'cors'
import { config } from './infrastructure/config/env.js'
import { checkDatabase } from './infrastructure/database/sql/connection.js'
import { endpoints } from './shared/endpoints.js'
import { errorHandler } from './shared/httpErrors.js'
import * as seguridad from './interfaces/http/controllers/seguridad.controller.js'
import * as pacientes from './interfaces/http/controllers/pacientes.controller.js'
import * as personal from './interfaces/http/controllers/personal.controller.js'
import * as planes from './interfaces/http/controllers/planes.controller.js'
import * as pagos from './interfaces/http/controllers/pagos.controller.js'
import * as authentication from './interfaces/http/middlewares/authenticate.js'
import * as authorization from './interfaces/http/middlewares/authorizeRequest.js'
const modules = { seguridad, pacientes, personal, planes, pagos } as unknown as Record<string, Record<string, unknown>>
export function createApp(databaseHealth: () => Promise<void> = checkDatabase, controllerModules: Record<string, Record<string, unknown>> = modules) {
 const app = express()
 app.disable('x-powered-by')
 app.use(cors({ origin: config.frontendUrl }))
 app.use(express.json({ limit: '1mb' }))
 app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'sis-god-entregable-1', scope: { tables: 20, endpoints: 40 } }))
 app.get('/api/v1/health/db', async (_req, res) => { try { await databaseHealth(); res.json({ status: 'ok', database: 'PostgreSQL' }) } catch { res.status(503).json({ error: { codigo: 'BASE_NO_DISPONIBLE', mensaje: 'Configure DATABASE_URL e instale la base de 20 tablas.', detalles: [] } }) } })
 const router = express.Router()
 for (const endpoint of endpoints) {
  const candidate = controllerModules[endpoint.module]?.[endpoint.handler]
  const pending: RequestHandler = (_req, res) => { res.status(501).json({ error: { codigo: 'ENDPOINT_PENDIENTE', mensaje: 'Implementación pendiente del módulo.', detalles: [], responsable: endpoint.owner, handler: endpoint.handler, metodo: endpoint.metodo, ruta: endpoint.ruta } }) }
  if (typeof candidate !== 'function') { router.route(endpoint.ruta)[endpoint.metodo.toLowerCase() as 'get'|'post'|'patch'|'put'|'delete'](pending); continue }
  const chain: RequestHandler[] = []
  if (endpoint.ruta !== '/auth/login') {
   const authenticate = (authentication as Record<string,unknown>).authenticate
   const authorize = (authorization as Record<string,unknown>).authorizeRequest
   if (typeof authenticate !== 'function' || typeof authorize !== 'function') { chain.push((_req,res) => { res.status(503).json({ error: { codigo: 'SEGURIDAD_PENDIENTE', mensaje: 'Complete autenticación y autorización antes de activar este endpoint.', detalles: [] } }) }) }
   else chain.push(authenticate as RequestHandler, authorize as RequestHandler)
  }
  router.route(endpoint.ruta)[endpoint.metodo.toLowerCase() as 'get'|'post'|'patch'|'put'|'delete'](...chain, candidate as RequestHandler)
 }
 app.use('/api/v1', router)
 app.use((_req,res) => res.status(404).json({ error: { codigo: 'RUTA_NO_EXISTE', mensaje: 'Ruta fuera del alcance de Entregable 1.', detalles: [] } }))
 app.use(errorHandler)
 return app
}
export default createApp()

