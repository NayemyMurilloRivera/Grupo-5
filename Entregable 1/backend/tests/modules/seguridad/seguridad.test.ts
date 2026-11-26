import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { hashPassword, verifyPassword } from '../../../src/infrastructure/auth/credentials.js'
import { issueToken, matchesCredential, verifyToken } from '../../../src/infrastructure/auth/tokens.js'
import { createUserInput, permissionIdsInput, updateUserInput } from '../../../src/interfaces/http/validators/seguridad.validator.js'

const password = 'Contraseña de prueba 2026'
process.env.AUTH_TOKEN_SECRET = randomBytes(32).toString('hex')

test('las contraseñas se almacenan con sal aleatoria y se comprueban sin aceptar formatos inválidos', async () => {
  const a = await hashPassword(password)
  const b = await hashPassword(password)
  assert.notEqual(a, b)
  assert.ok(!a.includes(password))
  assert.equal(await verifyPassword(password, a), true)
  assert.equal(await verifyPassword('otra contraseña', a), false)
  assert.equal(await verifyPassword(password, 'fixture-inerte'), false)
})

test('el token firmado expira y se vincula a la credencial de la sesión', () => {
  const token = issueToken('9007199254740993', 'hash activo', 100)
  const claims = verifyToken(token, 101)
  assert.equal(claims?.sub, '9007199254740993')
  assert.equal(verifyToken(token, 99), null)
  assert.equal(verifyToken(token, 3700), null)
  assert.equal(verifyToken(token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'), 101), null)
  assert.ok(claims)
  assert.equal(matchesCredential(claims, 'hash activo'), true)
  assert.equal(matchesCredential(claims, 'hash anterior'), false)
})

test('la entrada rechaza titulares dobles, IDs inexactos, permisos duplicados y cambios de titular', () => {
  const base = { nombre_acceso: 'usuario', correo: 'Usuario@example.invalid', password, id_rol: '1' }
  assert.throws(() => createUserInput({ ...base, id_empleado: '1', id_paciente: '1' }))
  assert.throws(() => createUserInput({ ...base, id_empleado: Number.MAX_SAFE_INTEGER + 1 }))
  assert.throws(() => createUserInput({ ...base, id_empleado: '9223372036854775808' }))
  assert.throws(() => updateUserInput({ id_paciente: '1' }))
  assert.throws(() => permissionIdsInput({ ids_permiso: ['1', 1] }))
  assert.equal(createUserInput({ ...base, id_empleado: '9007199254740993' }).correo, 'usuario@example.invalid')
  assert.deepEqual(permissionIdsInput({ ids_permiso: [] }), [])
})

const databaseUrl = process.env.SECURITY_TEST_DATABASE_URL

test('API de seguridad con PostgreSQL y datos de demostración', { skip: !databaseUrl }, async t => {
  const url = new URL(databaseUrl!)
  assert.equal(url.protocol, 'postgresql:')
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.pathname.includes('prueba'),
    'Use una base PostgreSQL local, vacía y con «prueba» en el nombre.')
  assert.equal(url.search, '')
  process.env.DATABASE_URL = url.toString()
  process.env.DB_SSL_MODE = 'disable'

  const { pool } = await import('../../../src/infrastructure/database/sql/connection.js')
  t.after(() => pool.end())
  assert.equal((await pool.query("SELECT 1 FROM pg_namespace WHERE nspname = 'sis_god'")).rowCount, 0,
    'La base de ejecución debe estar vacía.')
  for (const name of [
    'base/SIS_GOD_BASE_20.sql', 'base/DATOS_BASE.sql', 'ddl/asignados/01_seguridad.sql',
    'seeds/asignadas/01_seguridad.sql', 'queries/asignadas/seguridad.sql', 'tests/asignadas/seguridad.sql',
  ]) {
    const sql = await readFile(new URL('../../../../database/' + name, import.meta.url), 'utf8')
    await pool.query(sql)
  }

  async function accountId(table: 'EMPLEADO' | 'PACIENTE', doc: string) {
    const { rows } = await pool.query(`SELECT id_${table.toLowerCase()} AS id FROM sis_god."${table}" WHERE numero_documento = $1`, [doc])
    return rows[0].id as string
  }

  const [adminEmployee, dentistEmployee, otherEmployee, receptionEmployee, patientId, otherPatientId] = await Promise.all([
    accountId('EMPLEADO', '99020001'), accountId('EMPLEADO', '99020002'), accountId('EMPLEADO', '99020003'),
    accountId('EMPLEADO', '99020004'), accountId('PACIENTE', '99010001'), accountId('PACIENTE', '99010002'),
  ])
  const { rows: roles } = await pool.query('SELECT id_rol, nombre FROM sis_god."ROL"')
  const roleId = (name: string): string => roles.find(row => row.nombre === name)!.id_rol
  const adminRole = roleId('Administrador')
  const patientRole = roleId('Paciente')
  const dentistRole = roleId('Odontólogo')
  const receptionRole = roleId('Recepcionista')
  const { rows: [admin] } = await pool.query(`INSERT INTO sis_god."USUARIO"
    (nombre_acceso, correo, credencial_acceso, id_rol, id_empleado) VALUES ($1, $2, $3, $4, $5) RETURNING id_usuario`,
  ['demo-admin', 'admin@example.invalid', await hashPassword(password), adminRole, adminEmployee])

  const { withTransaction } = await import('../../../src/infrastructure/database/sql/transaction.js')
  const plan = await withTransaction(async client => {
    const { rows: [row] } = await client.query(`INSERT INTO sis_god."PLAN_TRATAMIENTO" (fecha_creacion, id_historia, id_odontologo)
      SELECT CURRENT_DATE, id_historia, $2 FROM sis_god."HISTORIA_CLINICA" WHERE id_paciente = $1
      RETURNING id_plan, id_historia`, [patientId, dentistEmployee])
    await client.query(`INSERT INTO sis_god."DETALLE_PLAN" (orden, cantidad, precio_acordado, id_plan, id_tratamiento)
      SELECT 1, 1, 80, $1, min(id_tratamiento) FROM sis_god."TRATAMIENTO"`, [row.id_plan])
    return row
  })
  const { rows: [otherHistory] } = await pool.query('SELECT id_historia FROM sis_god."HISTORIA_CLINICA" WHERE id_paciente = $1', [otherPatientId])

  const { createApp } = await import('../../../src/app.js')
  const security = await import('../../../src/interfaces/http/controllers/seguridad.controller.js')
  const scopeProbe = (_req: unknown, res: import('express').Response) => res.json(res.locals.authorization)
  const app = createApp(undefined, {
    seguridad: security,
    pacientes: { getPatient: scopeProbe, getHistory: scopeProbe },
    planes: { listPlans: scopeProbe, getPlan: scopeProbe, createPlan: scopeProbe },
    pagos: { getAccount: scopeProbe, getMyAccount: scopeProbe },
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const base = 'http://127.0.0.1:' + address.port + '/api/v1'
  async function request(path: string, status: number | number[], options: { token?: string; method?: string; body?: unknown } = {}) {
    const { token, method = 'GET', body } = options
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await response.json()
    assert.ok((Array.isArray(status) ? status : [status]).includes(response.status),
      `${method} ${path} → ${response.status} (${data.error?.codigo ?? 'sin código'})`)
    assert.ok(!JSON.stringify(data).includes('credencial_acceso'))
    return { data, status: response.status }
  }
  const access = async (name: string, status = 200, supplied = password) => (await request('/auth/login', status, {
    method: 'POST', body: { email: name, password: supplied },
  })).data
  const adminSession = await access('ADMIN@EXAMPLE.INVALID')
  const token = adminSession.token as string
  const create = (body: Record<string, unknown>, status = 201) =>
    request('/usuarios', status, { token, method: 'POST', body: { password, ...body } })
  const patch = (id: string, body: Record<string, unknown>, status: number | number[], actingToken = token) =>
    request('/usuarios/' + id, status, { token: actingToken, method: 'PATCH', body })
  const replace = (id: string, ids: string[], status = 200) =>
    request('/roles/' + id + '/permisos', status, { token, method: 'PUT', body: { ids_permiso: ids } })

  await t.test('login, identidad, catálogos y rechazo de una sesión inválida', async () => {
    await access('demo-admin', 401, 'incorrecta')
    await request('/auth/me', 401)
    await request('/auth/me', 401, { token: token.slice(1) })
    const me = (await request('/auth/me', 200, { token })).data
    assert.equal(me.user.idUsuario, admin.id_usuario)
    assert.equal(me.user.role, 'ADMINISTRADOR')
    assert.equal(me.user.idEmpleado, adminEmployee)
    assert.ok(me.permisos.some((p: { recurso: string }) => p.recurso === 'empleados'))
    assert.equal((await request('/roles', 200, { token })).data.items.length, 5)
    assert.ok((await request('/permisos', 200, { token })).data.items.length > 5)
  })

  const patient = { nombre_acceso: 'demo-paciente', correo: 'paciente@example.invalid', id_rol: patientRole, id_paciente: patientId }
  let patientToken = ''
  let dentistToken = ''
  let secondAdmin: { id_usuario: string }
  await t.test('alta, filtros, cambio de datos e integridad de las cuentas', async () => {
    await create({ ...patient, id_empleado: dentistEmployee }, 400)
    await create({ ...patient, id_paciente: '9223372036854775807' }, 404)
    await create({ ...patient, id_rol: adminRole }, 400)
    const { data } = await create(patient)
    await create({ ...patient, id_paciente: otherPatientId, correo: 'otro@example.invalid' }, 409)
    await create({ ...patient, id_paciente: otherPatientId, correo: patient.correo.toUpperCase(), nombre_acceso: 'otro' }, 409)
    await create({ ...patient, correo: 'otro@example.invalid', nombre_acceso: 'otro' }, 409)
    await create({ ...patient, id_paciente: otherPatientId, correo: 'otro@example.invalid', nombre_acceso: 'otro' })
    await create({ nombre_acceso: 'demo-odontologo', correo: 'odontologo@example.invalid', id_rol: dentistRole, id_empleado: dentistEmployee })
    await create({ nombre_acceso: 'demo-recepcion', correo: 'recepcion@example.invalid', id_rol: receptionRole, id_empleado: receptionEmployee })
    secondAdmin = (await create({ nombre_acceso: 'demo-admin-2', correo: 'admin2@example.invalid', id_rol: adminRole, id_empleado: otherEmployee })).data
    const list = (await request(`/usuarios?pagina=2&limite=1&estado=activo&id_rol=${patientRole}`, 200, { token })).data
    assert.equal(list.items.length, 1)
    assert.equal(list.items[0].id_paciente, otherPatientId)
    assert.equal((await request('/usuarios?q=%25', 200, { token })).data.items.length, 0)
    await patch(data.id_usuario, { id_paciente: otherPatientId }, 400)
    await patch(data.id_usuario, { estado: 'inactivo' }, 200)
    await access(patient.nombre_acceso, 401)
    await patch(data.id_usuario, { estado: 'activo' }, 200)
    const formerToken = (await access(patient.nombre_acceso)).token
    await patch(data.id_usuario, { password: password + ' renovada' }, 200)
    await request('/auth/me', 401, { token: formerToken })
    const explicit = await request('/auth/login', 200, { method: 'POST', body: { nombre_acceso: patient.nombre_acceso, password: password + ' renovada' } })
    patientToken = explicit.data.token
    dentistToken = (await access('demo-odontologo')).token
    await patch(data.id_usuario, { id_rol: adminRole }, 403, patientToken)
  })

  await t.test('la autorización limita al titular y a los planes asignados', async () => {
    assert.ok(patientToken && dentistToken)
    const own = { token: patientToken }
    const dentist = { token: dentistToken }
    await request('/roles', 403, own)
    await request('/permisos', 403, own)
    await request('/pacientes/' + patientId, 200, own)
    await request('/pacientes/' + otherPatientId, 403, own)
    await request('/pacientes/' + patientId + '/historia', 200, own)
    await request('/pacientes/' + otherPatientId + '/historia', 403, own)
    await request('/pacientes/' + otherPatientId + '/estado-cuenta', 403, own)
    assert.deepEqual((await request('/mi/estado-cuenta?id_paciente=' + otherPatientId, 200, own)).data,
      { alcance: 'propio', idPaciente: patientId })
    assert.deepEqual((await request('/planes-tratamiento?id_paciente=' + otherPatientId, 200, own)).data,
      { alcance: 'propio', idPaciente: patientId })
    assert.deepEqual((await request('/planes-tratamiento', 200, dentist)).data, { alcance: 'asignado', idEmpleado: dentistEmployee })
    await request('/planes-tratamiento/' + plan.id_plan, 200, dentist)
    await request('/pacientes/' + otherPatientId + '/historia', 403, dentist)
    await request('/planes-tratamiento', 200, { ...dentist, method: 'POST', body: { id_historia: plan.id_historia, id_odontologo: dentistEmployee } })
    await request('/planes-tratamiento', 403, { ...dentist, method: 'POST', body: { id_historia: otherHistory.id_historia, id_odontologo: dentistEmployee } })
    await request('/planes-tratamiento', 403, { ...dentist, method: 'POST', body: { id_historia: plan.id_historia, id_odontologo: otherEmployee } })
  })

  await t.test('el reemplazo es atómico y los permisos se vuelven a leer en cada petición', async () => {
    const current = (await request('/auth/me', 200, { token: patientToken })).data.permisos
    const ids: string[] = current.map((p: { id_permiso: string }) => p.id_permiso)
    await replace(patientRole, [ids[0], '9223372036854775807'], 404)
    await replace(patientRole, [ids[0], ids[0]], 400)
    await pool.query(`CREATE FUNCTION sis_god.security_test_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Inserción de ensayo' USING ERRCODE = '23503', CONSTRAINT = 'fk_rp_permiso';
      END $$;
      CREATE TRIGGER security_test_insert BEFORE INSERT ON sis_god."ROL_PERMISO"
      FOR EACH ROW EXECUTE FUNCTION sis_god.security_test_insert();`)
    try {
      await replace(patientRole, [ids[0]], 404)
      assert.deepEqual((await request('/auth/me', 200, { token: patientToken })).data.permisos, current)
    } finally {
      await pool.query('DROP TRIGGER security_test_insert ON sis_god."ROL_PERMISO"; DROP FUNCTION sis_god.security_test_insert()')
    }
    await replace(patientRole, [])
    await request('/mi/estado-cuenta', 403, { token: patientToken })
    await replace(patientRole, ids)
    await request('/mi/estado-cuenta', 200, { token: patientToken })
  })

  await t.test('dos desactivaciones simultáneas conservan un administrador activo', async () => {
    const secondToken = (await access('demo-admin-2')).token
    const requests = await Promise.all([
      patch(admin.id_usuario, { estado: 'inactivo' }, [200, 409]),
      patch(secondAdmin.id_usuario, { estado: 'inactivo' }, [200, 409], secondToken),
    ])
    assert.deepEqual(requests.map(result => result.status).sort(), [200, 409])
    const activeToken = requests[0].status === 409 ? token : secondToken
    const activeId = requests[0].status === 409 ? admin.id_usuario : secondAdmin.id_usuario
    await patch(activeId, { id_rol: receptionRole }, 409, activeToken)
    await request('/roles/' + adminRole + '/permisos', 200, { token: activeToken, method: 'PUT', body: { ids_permiso: [] } })
    await request('/roles', 200, { token: activeToken })
  })
})
