import test from 'node:test'
import assert from 'node:assert/strict'
import { postgresOptions } from '../../src/infrastructure/config/postgres.js'

test('PostgreSQL local y remoto usan la configuración común sin desactivar la validación TLS', () => {
 assert.equal(postgresOptions({ DATABASE_URL: 'postgresql://usuario:clave@127.0.0.1:5432/prueba' }).ssl, false)
 const options = postgresOptions({ DATABASE_URL: 'postgresql://usuario:clave@db.example.invalid:5432/postgres?sslmode=require', DB_POOL_MAX: '3' })
 assert.deepEqual(options.ssl, { rejectUnauthorized: true })
 assert.equal(new URL(options.connectionString!).searchParams.has('sslmode'), false)
 assert.equal(options.max, 3)
 const separate = postgresOptions({ PGHOST: 'db.example.invalid', PGUSER: 'usuario', PGPASSWORD: 'clave#@ con espacio', PGDATABASE: 'postgres' })
 assert.equal(decodeURIComponent(new URL(separate.connectionString!).password), 'clave#@ con espacio')
 assert.deepEqual(separate.ssl, { rejectUnauthorized: true })
 const withCertificate = postgresOptions({ PGHOST: 'db.example.invalid', DB_SSL_CA_FILE: 'certs/supabase-ca.crt' })
 assert.ok(typeof withCertificate.ssl === 'object' && withCertificate.ssl.ca?.toString().includes('BEGIN CERTIFICATE'))
 assert.throws(() => postgresOptions({ DATABASE_URL: 'postgresql://usuario:clave@db.example.invalid/postgres', DB_SSL_MODE: 'disable' }), /TLS/)
 assert.throws(() => postgresOptions({ DB_POOL_MAX: '0' }), /DB_POOL_MAX/)
})
