import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
const root = new URL('../', import.meta.url)
const ownership = JSON.parse(await readFile(new URL('contracts/ownership.json', root), 'utf8'))
const reserved = JSON.parse(await readFile(new URL('contracts/empty-files.json', root), 'utf8'))
const endpoints = JSON.parse(await readFile(new URL('contracts/endpoints.json', root), 'utf8'))
const scope = JSON.parse(await readFile(new URL('contracts/scope.json', root), 'utf8'))
const assigned = new Map()
for (const [module, group] of Object.entries(ownership)) {
 assert.equal(Object.keys(ownership).length, 5)
 assert.equal(scope.tables[group.owner]?.length, 4, 'Responsable sin sus cuatro tablas: ' + group.owner)
 const operations = endpoints.filter(endpoint => endpoint.module === module)
 assert.equal(operations.length, 8, 'El módulo debe tener ocho operaciones: ' + module)
 assert.ok(operations.every(endpoint => endpoint.owner === group.owner), 'Responsable distinto entre contrato y archivos: ' + module)
 for (const path of group.files) {
  assert.ok(!assigned.has(path), 'Archivo con dos responsables: ' + path)
  assert.ok((await stat(new URL(path, root))).isFile(), 'No existe: ' + path)
  assigned.set(path, module)
 }
}
for (const path of reserved) assert.ok(assigned.has(path), 'Archivo reservado sin responsable: ' + path)
console.log('OK: cinco módulos con archivos exclusivos; los 108 archivos reservados tienen un único responsable.')
