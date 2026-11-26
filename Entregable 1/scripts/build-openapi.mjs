import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
const read = async name => JSON.parse(await readFile(new URL('../backend/openapi/' + name + '.json', import.meta.url), 'utf8'))
const document = await read('base')
document.paths = {}
document.components ??= {}
for (const module of ['seguridad', 'pacientes', 'personal', 'planes', 'pagos']) {
 const fragment = await read(module)
 for (const [path, operations] of Object.entries(fragment.paths ?? {})) {
  document.paths[path] ??= {}
  for (const [method, operation] of Object.entries(operations)) {
   assert.ok(!document.paths[path][method], 'Operación OpenAPI duplicada: ' + method + ' ' + path)
   document.paths[path][method] = operation
  }
 }
 for (const [kind, definitions] of Object.entries(fragment.components ?? {})) {
  document.components[kind] ??= {}
  for (const [name, definition] of Object.entries(definitions)) {
   assert.ok(!document.components[kind][name], 'Componente OpenAPI duplicado: ' + kind + '.' + name)
   document.components[kind][name] = definition
  }
 }
}
const endpoints = JSON.parse(await readFile(new URL('../contracts/endpoints.json', import.meta.url), 'utf8'))
for (const endpoint of endpoints) {
 const path = endpoint.ruta.replace(/:([A-Za-z0-9_]+)/g, '{$1}')
 assert.equal(document.paths[path]?.[endpoint.metodo.toLowerCase()]?.operationId, endpoint.handler, path)
}
await writeFile(new URL('../backend/openapi.json', import.meta.url), JSON.stringify(document, null, 2) + '\n')
console.log('OpenAPI integrado desde los cinco archivos de módulo.')
