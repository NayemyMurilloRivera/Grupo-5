import app from './app.js'
import { config } from './infrastructure/config/env.js'
import { pool } from './infrastructure/database/sql/connection.js'
const server = app.listen(config.port, '127.0.0.1', () => console.log('SIS-GOD API: http://127.0.0.1:'+config.port))
const stop = () => { server.close(() => { void pool.end().then(() => process.exit(0)) }) }
process.on('SIGTERM', stop)
process.on('SIGINT', stop)

