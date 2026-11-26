import { readdir, stat } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const modules = ['seguridad', 'pacientes', 'personal', 'planes', 'pagos']
const selected = process.argv[2]
if (selected && !modules.includes(selected)) throw new Error('Módulo desconocido: ' + selected)
const files = []
async function collect(url) {
 for (const entry of await readdir(url, { withFileTypes: true })) {
  const target = new URL(entry.name + (entry.isDirectory() ? '/' : ''), url)
  if (entry.isDirectory()) await collect(target)
  else if (/\.test\.ts$/.test(entry.name) && (await stat(target)).size > 0) files.push(fileURLToPath(target))
 }
}
for (const module of selected ? [selected] : modules) await collect(new URL('../backend/tests/modules/' + module + '/', import.meta.url))
if (!files.length) console.log('No hay pruebas implementadas en los módulos seleccionados; no se acredita cobertura de negocio.')
else {
 const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], { stdio: 'inherit' })
 if (result.error) throw result.error
 process.exitCode = result.status ?? 1
}
