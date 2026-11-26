import pg from 'pg'
import dotenv from 'dotenv'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { TLSSocket } from 'node:tls'
import { postgresOptions } from '../backend/src/infrastructure/config/postgres.ts'
dotenv.config({ path: fileURLToPath(new URL('../backend/.env', import.meta.url)), quiet: true })
const action=process.argv[2]
if(!process.env.DATABASE_URL && !process.env.PGHOST)throw new Error('Configure DATABASE_URL o PGHOST y las credenciales en backend/.env.')
if(!['install','seed','test','status'].includes(action))throw new Error('Acción válida: install, seed, test o status')
const databaseName=process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).pathname : process.env.PGDATABASE || 'postgres'
if(action==='test' && (process.env.ALLOW_TEST_DATABASE!=='true' || !databaseName.includes('prueba')))throw new Error('Las pruebas requieren ALLOW_TEST_DATABASE=true y una base cuyo nombre contenga prueba.')
const client=new pg.Client(postgresOptions())
await client.connect()
try{
 if(action==='status'){
  const identity=(await client.query('SELECT current_database() AS database, current_user AS usuario, version() AS version')).rows[0]
  const tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='sis_god' ORDER BY tablename")).rows.map(row=>row.tablename)
  const serverSsl=(await client.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0]?.ssl ?? false
  // Con un pooler, pg_stat_ssl describe su conexión a Postgres, no el tramo desde Node.
  const socket=client.connection.stream
  const tls=socket instanceof TLSSocket && socket.encrypted===true
  const certificateVerified=tls && socket.authorized===true
  const scope=JSON.parse(await readFile(new URL('../contracts/scope.json',import.meta.url),'utf8'))
  const expected=Object.values(scope.tables).flat().sort()
  const matches=JSON.stringify(tables)===JSON.stringify(expected)
  const rows=matches ? (await client.query(expected.map(name=>`SELECT '${name}' AS tabla, count(*)::int AS registros FROM sis_god."${name}"`).join(' UNION ALL '))).rows : []
  console.log(JSON.stringify({database:identity.database,usuario:identity.usuario,version:identity.version,tls,certificadoValidado:certificateVerified,tlsPoolerAPostgres:serverSsl,tablas:tables,alcanceCompleto:matches,registrosPorTabla:Object.fromEntries(rows.map(row=>[row.tabla,row.registros]))},null,2))
  if(!matches)process.exitCode=1
 }else if(action==='test'){
  const { testBase }=await import('./test-database.mjs');await testBase(client)
 }else{
  if(action==='install' && (await client.query("SELECT 1 FROM pg_namespace WHERE nspname='sis_god'")).rowCount)throw new Error('El esquema sis_god ya existe. No reinstalar la base compartida; revisar sus migraciones.')
  const file=action==='install'?'SIS_GOD_BASE_20.sql':'DATOS_BASE.sql'
  await client.query(await readFile(new URL('../database/base/'+file,import.meta.url),'utf8'))
  console.log(action==='install'?'Base de 20 tablas instalada.':'Datos iniciales cargados; las cuentas y operaciones se implementan por módulo.')
 }
}catch(error){await client.query('ROLLBACK').catch(()=>{});console.error(error.message);process.exitCode=1}
finally{await client.end()}
