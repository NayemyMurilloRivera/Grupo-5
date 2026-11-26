import assert from 'node:assert/strict'
import { readFile,stat } from 'node:fs/promises'
const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'))
const files=await read('contracts/empty-files.json'), endpoints=await read('contracts/endpoints.json'), scope=await read('contracts/scope.json')
const registry=await readFile(new URL('../backend/src/shared/endpoints.ts',import.meta.url),'utf8')
assert.deepEqual(JSON.parse(registry.replace('export const endpoints = ','').replace(/ as const\s*$/,'')),endpoints)
for(const f of files)assert.equal((await stat(new URL('../'+f,import.meta.url))).size,0,'El archivo asignado debe seguir vacío: '+f)
assert.equal(endpoints.length,40);assert.equal(new Set(endpoints.map(e=>e.metodo+' '+e.ruta)).size,40)
const tables=Object.values(scope.tables).flat();assert.equal(tables.length,20);assert.equal(new Set(tables).size,20)
for(const [owner,list]of Object.entries(scope.tables)){assert.equal(list.length,4);assert.equal(endpoints.filter(e=>e.owner===owner).length,8)}
const sql=await readFile(new URL('../database/base/SIS_GOD_BASE_20.sql',import.meta.url),'utf8')
assert.equal([...sql.matchAll(/CREATE TABLE sis_god\."([A-Z_]+)"/g)].length,20)
for(const m of sql.matchAll(/REFERENCES sis_god\."([A-Z_]+)"/g))assert.ok(tables.includes(m[1]))
console.log('OK: '+files.length+' archivos a cero bytes, cinco responsables, 40 rutas y 20 tablas sin FK hacia las aplazadas.')

