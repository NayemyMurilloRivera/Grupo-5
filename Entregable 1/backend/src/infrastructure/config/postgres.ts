import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PoolConfig } from 'pg'

function positiveInteger(value: string | undefined, fallback: number, name: string) {
 const number = value === undefined || value === '' ? fallback : Number(value)
 if (!Number.isInteger(number) || number < 1) throw new Error(name + ' debe ser un entero positivo.')
 return number
}

export function postgresOptions(env: NodeJS.ProcessEnv = process.env): PoolConfig {
 const options: PoolConfig = {
  max: positiveInteger(env.DB_POOL_MAX, 3, 'DB_POOL_MAX'),
  connectionTimeoutMillis: positiveInteger(env.DB_CONNECT_TIMEOUT_MS, 10000, 'DB_CONNECT_TIMEOUT_MS'),
  application_name: env.DB_APPLICATION_NAME || 'sis-god-local',
 }
 if (!env.DATABASE_URL && !env.PGHOST) return options
 let url: URL
 try {
  url = new URL(env.DATABASE_URL || 'postgresql://localhost')
  if (!env.DATABASE_URL) {
   if (!/^[A-Za-z0-9.:-]+$/.test(env.PGHOST!)) throw new Error('Host no válido')
   url.hostname = env.PGHOST!
   url.port = String(positiveInteger(env.PGPORT, 5432, 'PGPORT'))
   url.username = env.PGUSER || 'postgres'
   url.password = env.PGPASSWORD || ''
   url.pathname = '/' + encodeURIComponent(env.PGDATABASE || 'postgres')
  }
 } catch { throw new Error('La configuración de conexión PostgreSQL no tiene un formato válido.') }
 if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL debe ser una conexión PostgreSQL.')
 const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname)
 const mode = env.DB_SSL_MODE || url.searchParams.get('sslmode') || (local ? 'disable' : 'verify-full')
 if (!['disable', 'require', 'verify-ca', 'verify-full'].includes(mode)) throw new Error('DB_SSL_MODE no válido.')
 if (!local && mode === 'disable') throw new Error('Las conexiones remotas requieren TLS.')
 for (const key of ['sslcert', 'sslkey', 'sslrootcert']) {
  if (url.searchParams.has(key)) throw new Error('Configure el certificado de confianza mediante DB_SSL_CA_FILE.')
 }
 url.searchParams.delete('sslmode')
 options.connectionString = url.toString()
 options.ssl = mode === 'disable' ? false : {
  rejectUnauthorized: true,
  ...(env.DB_SSL_CA_FILE ? { ca: readFileSync(resolve(fileURLToPath(new URL('../../../', import.meta.url)), env.DB_SSL_CA_FILE), 'utf8') } : {}),
 }
 return options
}
