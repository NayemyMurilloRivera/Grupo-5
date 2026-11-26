import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true })
export const config = { port: Number(process.env.PORT ?? 3000), frontendUrl: process.env.FRONTEND_URL ?? 'http://127.0.0.1:5173', databaseUrl: process.env.DATABASE_URL, databaseHost: process.env.PGHOST, connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 10000) }

