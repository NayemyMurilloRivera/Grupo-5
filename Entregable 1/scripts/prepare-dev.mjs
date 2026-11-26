import { constants } from 'node:fs'
import { access, copyFile, readFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const root = new URL('../', import.meta.url)
async function createLocalEnv(template, destination) {
 try {
  await copyFile(new URL(template, root), new URL(destination, root), constants.COPYFILE_EXCL)
  console.log('Creado ' + destination + ' desde su plantilla.')
 } catch (error) {
  if (error.code !== 'EEXIST') throw error
 }
}

async function checkPort(port, label) {
 await new Promise((resolve, reject) => {
  const server = createServer()
  server.once('error', error => reject(new Error(error.code === 'EADDRINUSE'
   ? `${label}: el puerto ${port} ya está ocupado. Cierra la ejecución anterior con Ctrl+C antes de volver a iniciar.`
   : `${label}: no se pudo reservar el puerto ${port} (${error.code}).`)))
  server.listen(port, '127.0.0.1', () => server.close(error => error ? reject(error) : resolve()))
 })
}

try {
 if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Instala Node.js 24 LTS o posterior antes de ejecutar el proyecto.')
 try { await access(new URL('node_modules/concurrently/package.json', root)) }
 catch { throw new Error('Faltan dependencias. Ejecuta npm ci desde Entregable 1.') }
 await createLocalEnv('backend/supabase.env.example', 'backend/.env')
 await createLocalEnv('frontend/.env.example', 'frontend/.env')
 const local = dotenv.parse(await readFile(new URL('backend/.env', root)))
 const env = { ...local, ...process.env }
 if (!env.DATABASE_URL && !env.PGPASSWORD) console.log('Completa PGPASSWORD en backend/.env para conectar con Supabase. El diseño puede abrirse sin esa conexión.')
 if (!process.argv.includes('--setup-only')) {
  const apiPort = Number(env.PORT || 3000)
  if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) throw new Error('PORT no válido en backend/.env.')
  await Promise.all([checkPort(apiPort, 'API'), checkPort(5173, 'Frontend')])
  console.log(`Frontend: http://127.0.0.1:5173 | API: http://127.0.0.1:${apiPort}`)
  console.log('Ctrl+C detiene ambos procesos. Los cambios de React y TypeScript se recargan automáticamente.')
 } else console.log('Entorno local preparado. Los archivos .env existentes se conservaron.')
} catch (error) {
 console.error(error.message)
 console.error('Carpeta del proyecto: ' + fileURLToPath(root))
 process.exitCode = 1
}
