import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as seguridad from '../src/modules/seguridad/api'
import * as pacientes from '../src/modules/pacientes/api'
import * as personal from '../src/modules/personal/api'
import * as planes from '../src/modules/planes/api'
import * as pagos from '../src/modules/pagos/api'
import { modules } from '../src/data/modules'
import { callEndpoint } from '../src/services/endpoint'
const clients = { seguridad, pacientes, personal, planes, pagos } as Record<string, Record<string, Function>>
test('los clientes de los cinco módulos envían las 40 operaciones al contrato HTTP', async () => {
 const endpoints = JSON.parse(await readFile(new URL('../../contracts/endpoints.json', import.meta.url), 'utf8'))
 const original = globalThis.fetch
 let url = ''; let options: RequestInit | undefined
 globalThis.fetch = async (input, init) => { url = String(input); options = init; return new Response(JSON.stringify({ items: [] }), { status: 200 }) }
 try {
  for (const endpoint of endpoints) {
   const params = Object.fromEntries([...endpoint.ruta.matchAll(/:([A-Za-z0-9_]+)/g)].map((match: RegExpMatchArray) => [match[1], 'a/b']))
   const body = endpoint.metodo === 'GET' ? undefined : { comprobacion: true }
   await clients[endpoint.module][endpoint.handler]({ params, token: 'token-de-prueba', body, query: { pagina: 2 } })
   assert.equal(url, '/api/v1' + endpoint.ruta.replace(/:[A-Za-z0-9_]+/g, 'a%2Fb') + '?pagina=2')
   assert.equal(options?.method, endpoint.metodo)
   assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer token-de-prueba')
   assert.equal(options?.body, body ? JSON.stringify(body) : undefined)
  }
  for (const module of modules) {
   assert.deepEqual(await module.load({ token: 'prueba', role: 'ADMINISTRADOR', resourceId: '7' }), [])
   assert.ok(url.startsWith('/api/v1'))
  }
  await modules.find(module => module.id === 'cuentas')!.load({ token: 'prueba', role: 'PACIENTE', resourceId: '' })
  assert.equal(url, '/api/v1/mi/estado-cuenta')
  assert.throws(() => callEndpoint('GET', '/pacientes/:id', {}), /identificador/)
 } finally { globalThis.fetch = original }
})
