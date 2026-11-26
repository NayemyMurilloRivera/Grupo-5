import pg from 'pg'
import { config } from '../../config/env.js'
import { postgresOptions } from '../../config/postgres.js'
export const pool = new pg.Pool(postgresOptions())
pool.on('error', error => console.error('Conexión PostgreSQL interrumpida:', error.message))
export async function checkDatabase() { if (!config.databaseUrl && !config.databaseHost) throw new Error('Conexión PostgreSQL no configurada'); await pool.query('SELECT 1') }

