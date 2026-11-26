import type { Pool, PoolClient } from 'pg'
import { pool } from './connection.js'
export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>, source: Pick<Pool, 'connect'> = pool): Promise<T> {
 const client = await source.connect()
 try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result }
 catch (error) { try { await client.query('ROLLBACK') } catch { /* Se conserva el error original. */ } throw error }
 finally { client.release() }
}

