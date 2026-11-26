import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
export async function testBase(client){
 const scope=JSON.parse(await readFile(new URL('../contracts/scope.json',import.meta.url),'utf8'))
 const names=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='sis_god' ORDER BY tablename")).rows.map(r=>r.tablename)
 assert.deepEqual(names,Object.values(scope.tables).flat().sort())
 const counts=(await client.query("SELECT contype,count(*)::int AS n FROM pg_constraint WHERE connamespace='sis_god'::regnamespace GROUP BY contype")).rows
 assert.equal(counts.find(x=>x.contype==='f').n,21)
 const external=await client.query("SELECT c.conname FROM pg_constraint c JOIN pg_class p ON p.oid=c.confrelid WHERE c.contype='f' AND c.connamespace='sis_god'::regnamespace AND p.relnamespace<>'sis_god'::regnamespace")
 assert.equal(external.rowCount,0)
 await client.query('BEGIN')
 try{
  const role=(await client.query('INSERT INTO sis_god."ROL" (nombre) VALUES ($1) RETURNING id_rol',['PRUEBA_CASCADA'])).rows[0].id_rol
  const permission=(await client.query('INSERT INTO sis_god."PERMISO" (recurso,accion,alcance) VALUES ($1,$2,$3) RETURNING id_permiso',['prueba','leer','propio'])).rows[0].id_permiso
  await client.query('INSERT INTO sis_god."ROL_PERMISO" (id_rol,id_permiso) VALUES ($1,$2)',[role,permission])
  await client.query('DELETE FROM sis_god."ROL" WHERE id_rol=$1',[role])
  assert.equal((await client.query('SELECT count(*)::int n FROM sis_god."ROL_PERMISO" WHERE id_rol=$1',[role])).rows[0].n,0)
  const e=(await client.query('SELECT id_empleado FROM sis_god."EMPLEADO" ORDER BY id_empleado LIMIT 1')).rows[0]?.id_empleado
  const h=(await client.query('SELECT id_historia FROM sis_god."HISTORIA_CLINICA" LIMIT 1')).rows[0]?.id_historia
  const treatment=(await client.query('SELECT id_tratamiento FROM sis_god."TRATAMIENTO" LIMIT 1')).rows[0]?.id_tratamiento
  assert.ok(e&&h&&treatment,'Ejecutar db:seed antes de probar')
  const user=(await client.query('INSERT INTO sis_god."USUARIO" (nombre_acceso,correo,credencial_acceso,id_rol,id_empleado) VALUES ($1,$2,$3,(SELECT id_rol FROM sis_god."ROL" WHERE nombre=$4),$5) RETURNING id_usuario',['PRUEBA_REVISION','revision@example.invalid','fixture-no-utilizable','Administrador',e])).rows[0].id_usuario
  const plan=(await client.query('INSERT INTO sis_god."PLAN_TRATAMIENTO" (fecha_creacion,id_historia,id_odontologo) VALUES (CURRENT_DATE,$1,$2) RETURNING id_plan',[h,e])).rows[0].id_plan
  await client.query('INSERT INTO sis_god."DETALLE_PLAN" (orden,cantidad,precio_acordado,id_plan,id_tratamiento) VALUES (1,1,80,$1,$2)',[plan,treatment])
  const budget=(await client.query('INSERT INTO sis_god."PRESUPUESTO" (fecha_emision,importe,id_plan,id_usuario_revisor) VALUES (CURRENT_DATE,80,$1,$2) RETURNING id_presupuesto',[plan,user])).rows[0].id_presupuesto
  await client.query('DELETE FROM sis_god."USUARIO" WHERE id_usuario=$1',[user])
  assert.equal((await client.query('SELECT id_usuario_revisor FROM sis_god."PRESUPUESTO" WHERE id_presupuesto=$1',[budget])).rows[0].id_usuario_revisor,null)
  await client.query('SET CONSTRAINTS ALL IMMEDIATE')
 }finally{await client.query('ROLLBACK')}
 for(const sql of [
  `INSERT INTO sis_god."PACIENTE" (tipo_documento,numero_documento,nombres,apellidos,telefono) VALUES ('DNI','PRUEBA-SIN-HISTORIA','A','B','1')`,
  `INSERT INTO sis_god."EMPLEADO" (tipo_documento,numero_documento,nombres,apellidos,telefono) VALUES ('DNI','PRUEBA-SIN-SUBTIPO','A','B','1')`
 ]){
  await client.query('BEGIN');let failed=false
  try{await client.query(sql);await client.query('SET CONSTRAINTS ALL IMMEDIATE')}catch(e){assert.equal(e.code,'23514');failed=true}finally{await client.query('ROLLBACK')}
  assert.ok(failed,'La integridad diferida debe rechazar el registro incompleto')
 }
 console.log('OK: 20 tablas independientes, 21 FK, CASCADE, SET NULL e integridad diferida. Datos de ensayo revertidos.')
}
