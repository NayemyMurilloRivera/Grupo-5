import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../../src/app.js'
import { endpoints } from '../../src/shared/endpoints.js'
import { withTransaction } from '../../src/infrastructure/database/sql/transaction.js'
test('infraestructura HTTP y rutas pendientes, sin funcionalidades simuladas',async()=>{
 const server=createApp(async()=>{}, {}).listen(0,'127.0.0.1')
 await new Promise<void>(resolve=>server.listening?resolve():server.once('listening',resolve))
 const address=server.address();assert.ok(address&&typeof address!=='string');const base='http://127.0.0.1:'+address.port
 try{
  assert.equal((await fetch(base+'/health')).status,200)
  assert.equal((await fetch(base+'/api/v1/health/db')).status,200)
  for(const e of endpoints){const response=await fetch(base+'/api/v1'+e.ruta.replace(/:[A-Za-z0-9_]+/g,'1'),{method:e.metodo,...(e.metodo==='GET'?{}:{headers:{'Content-Type':'application/json'},body:'{}'})});assert.equal(response.status,501,e.ruta);const data=await response.json() as {error:{codigo:string;responsable:string}};assert.equal(data.error.codigo,'ENDPOINT_PENDIENTE');assert.equal(data.error.responsable,e.owner)}
  assert.equal((await fetch(base+'/api/v1/citas')).status,404)
  assert.equal((await fetch(base+'/api/v1/pacientes',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400)
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
})
test('salud de base devuelve 503 al no estar disponible',async()=>{
 const server=createApp(async()=>{throw new Error('sin conexión')}, {}).listen(0,'127.0.0.1');await new Promise<void>(r=>server.listening?r():server.once('listening',r));const address=server.address();assert.ok(address&&typeof address!=='string')
 try{assert.equal((await fetch('http://127.0.0.1:'+address.port+'/api/v1/health/db')).status,503)}finally{await new Promise<void>(r=>server.close(()=>r()))}
})
for(const failure of ['ninguno','operación','commit'])test('transacción compartida: '+failure,async()=>{
 const calls:string[]=[];const client={query:async(sql:string)=>{calls.push(sql);if(failure==='commit'&&sql==='COMMIT')throw new Error('commit falló')},release:()=>calls.push('RELEASE')};const source={connect:async()=>client}
 const action=()=>withTransaction(async c=>{await c.query('OPERACIÓN');if(failure==='operación')throw new Error('operación falló');return 7},source as never)
 if(failure==='ninguno'){assert.equal(await action(),7);assert.deepEqual(calls,['BEGIN','OPERACIÓN','COMMIT','RELEASE'])}else{await assert.rejects(action);assert.equal(calls.at(-2),'ROLLBACK');assert.equal(calls.at(-1),'RELEASE')}
})

