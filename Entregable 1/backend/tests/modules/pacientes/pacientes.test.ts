import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { getPatient } from '../../../src/application/use-cases/pacientes/getPatient.js'
import { listPatientsInput, patientId, patientScope } from '../../../src/interfaces/http/validators/pacientes.validator.js'

const isError = (status: number) => (error: unknown) =>
  error instanceof Error && 'status' in error && error.status === status

test('los filtros admiten búsqueda y paginación acotadas sin aceptar campos de autorización', () => {
  assert.deepEqual(listPatientsInput({}), { q: undefined, tipo_documento: undefined,
    numero_documento: undefined, pagina: 1, limite: 25 })
  assert.equal(listPatientsInput({ q: ' Salazar ', pagina: '2', limite: '10' }).q, 'Salazar')
  for (const query of [
    { pagina: '0' }, { pagina: '1.5' }, { pagina: '1000001' }, { limite: '101' },
    { q: ['uno', 'dos'] }, { q: '' }, { q: 'x'.repeat(151) }, { q: 'a\nb' },
    { tipo_documento: 'x'.repeat(21) }, { numero_documento: 'x'.repeat(31) },
    { alcance: 'global' }, { id_paciente: '2' }, { pagina: ['1', '2'] },
  ]) assert.throws(() => listPatientsInput(query), isError(400))
})

test('los identificadores conservan precisión y el alcance se obtiene del middleware', () => {
  assert.equal(patientId('9007199254740993'), '9007199254740993')
  assert.equal(patientId('9223372036854775807'), '9223372036854775807')
  for (const value of ['0', '-1', '1.2', '01', '9223372036854775808', Number.MAX_SAFE_INTEGER + 1, ['1']]) {
    assert.throws(() => patientId(value), isError(400))
  }
  assert.deepEqual(patientScope({ alcance: 'propio', idPaciente: '9' }), { alcance: 'propio', idPaciente: '9' })
  assert.deepEqual(patientScope({ alcance: 'asignado', idEmpleado: '7' }), { alcance: 'asignado', idEmpleado: '7' })
  for (const scope of [undefined, {}, { alcance: 'propio' }, { alcance: 'asignado' }, { alcance: 'otro' }]) {
    assert.throws(() => patientScope(scope), isError(403))
  }
})

test('la consulta de detalle informa que un paciente no está disponible', async () => {
  await assert.rejects(getPatient({ findPatient: async () => null, listPatients: async () => { throw new Error('No corresponde') } },
    '1', { alcance: 'global' }), isError(404))
})

const databaseUrl = process.env.PATIENTS_TEST_DATABASE_URL

test('consultas de pacientes con PostgreSQL y autorización reales', { skip: !databaseUrl }, async t => {
  const url = new URL(databaseUrl!)
  assert.equal(url.protocol, 'postgresql:')
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.pathname.includes('prueba'),
    'Use una base PostgreSQL local, vacía y con «prueba» en el nombre.')
  assert.equal(url.search, '')
  process.env.DATABASE_URL = url.toString()
  process.env.DB_SSL_MODE = 'disable'
  process.env.AUTH_TOKEN_SECRET = randomBytes(32).toString('hex')
  const { pool } = await import('../../../src/infrastructure/database/sql/connection.js')
  t.after(() => pool.end())
  assert.equal((await pool.query("SELECT 1 FROM pg_namespace WHERE nspname='sis_god'")).rowCount, 0,
    'La base de ejecución debe estar vacía.')
  for (const file of ['base/SIS_GOD_BASE_20.sql', 'base/DATOS_BASE.sql', 'ddl/asignados/01_seguridad.sql', 'seeds/asignadas/01_seguridad.sql']) {
    await pool.query(await readFile(new URL('../../../../database/' + file, import.meta.url), 'utf8'))
  }
  const { rows: patients } = await pool.query('SELECT id_paciente FROM sis_god."PACIENTE" ORDER BY id_paciente')
  const { rows: employees } = await pool.query('SELECT id_empleado FROM sis_god."EMPLEADO" ORDER BY id_empleado')
  const owner = patients[0].id_paciente as string
  const other = patients[1].id_paciente as string
  const assigned = patients[2].id_paciente as string
  const dentist = employees[1].id_empleado as string
  const { rows: roles } = await pool.query('SELECT id_rol, nombre FROM sis_god."ROL"')
  const roleId = (name: string): string => roles.find(row => row.nombre === name)!.id_rol
  const password = 'Consulta local de pacientes 2026!'
  const { hashPassword } = await import('../../../src/infrastructure/auth/credentials.js')
  const hash = await hashPassword(password)
  for (const [name, role, employee, patient] of [
    ['consulta-admin', 'Administrador', employees[0].id_empleado, null],
    ['consulta-recepcion', 'Recepcionista', employees[3].id_empleado, null],
    ['consulta-odontologo', 'Odontólogo', dentist, null],
    ['consulta-sin-asignacion', 'Odontólogo', employees[2].id_empleado, null],
    ['consulta-asistente', 'Asistente dental', employees[4].id_empleado, null],
    ['consulta-paciente', 'Paciente', null, owner],
  ]) {
    await pool.query(`INSERT INTO sis_god."USUARIO" (nombre_acceso, correo, credencial_acceso, id_rol, id_empleado, id_paciente)
      VALUES ($1,$2,$3,$4,$5,$6)`, [name, name + '@example.invalid', hash, roleId(role!), employee, patient])
  }
  const { withTransaction } = await import('../../../src/infrastructure/database/sql/transaction.js')
  await withTransaction(async client => {
    for (const patient of [owner, owner, assigned]) {
      const { rows: [plan] } = await client.query(`INSERT INTO sis_god."PLAN_TRATAMIENTO" (fecha_creacion, id_historia, id_odontologo)
        SELECT CURRENT_DATE, id_historia, $2 FROM sis_god."HISTORIA_CLINICA" WHERE id_paciente=$1 RETURNING id_plan`, [patient, dentist])
      await client.query(`INSERT INTO sis_god."DETALLE_PLAN" (orden, cantidad, precio_acordado, id_plan, id_tratamiento)
        SELECT 1, 1, 80, $1, min(id_tratamiento) FROM sis_god."TRATAMIENTO"`, [plan.id_plan])
    }
    await client.query(`INSERT INTO sis_god."PACIENTE" (id_paciente,tipo_documento,numero_documento,nombres,apellidos,telefono)
      OVERRIDING SYSTEM VALUE VALUES (9007199254740993,'CE','GRAN-ID','Identificador','Amplio','900000099')`)
    await client.query(`INSERT INTO sis_god."HISTORIA_CLINICA" (fecha_apertura,id_paciente)
      VALUES (CURRENT_DATE,9007199254740993)`)
  })

  const { createApp } = await import('../../../src/app.js')
  const seguridad = await import('../../../src/interfaces/http/controllers/seguridad.controller.js')
  const pacientes = await import('../../../src/interfaces/http/controllers/pacientes.controller.js')
  const server = createApp(undefined, { seguridad, pacientes }).listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => { if (server.listening) resolve(); else server.once('listening', resolve); server.once('error', reject) })
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const base = 'http://127.0.0.1:' + address.port + '/api/v1'
  async function request(path: string, status: number, token?: string) {
    const response = await fetch(base + path, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
    const data = await response.json()
    assert.equal(response.status, status, `${path}: ${JSON.stringify(data)}`)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    return data
  }
  const tokens: Record<string, string> = {}
  for (const name of ['admin', 'recepcion', 'odontologo', 'sin-asignacion', 'asistente', 'paciente']) {
    const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre_acceso: 'consulta-' + name, password }) })
    assert.equal(response.status, 200)
    tokens[name] = (await response.json()).token
  }

  await t.test('paginación estable y total correcto incluso en páginas vacías', async () => {
    const first = await request('/pacientes?limite=2', 200, tokens.admin)
    assert.equal(first.total, 6); assert.equal(first.total_paginas, 3)
    assert.equal(first.pagina, 1); assert.equal(first.limite, 2)
    assert.deepEqual(first.items.map((p: { id_paciente: string }) => p.id_paciente), [owner, other])
    const second = await request('/pacientes?pagina=2&limite=2', 200, tokens.admin)
    assert.equal(second.items[0].id_paciente, assigned)
    const empty = await request('/pacientes?pagina=9&limite=2', 200, tokens.admin)
    assert.deepEqual(empty.items, []); assert.equal(empty.total, 6)
    const last = await request('/pacientes?pagina=3&limite=2', 200, tokens.admin)
    assert.equal(last.items[1].id_paciente, '9007199254740993')
  })

  await t.test('búsqueda literal por nombre/documento y filtros combinados', async () => {
    assert.equal((await request('/pacientes?q=sALAzar', 200, tokens.admin)).items[0].id_paciente, owner)
    assert.equal((await request('/pacientes?q=99010002', 200, tokens.admin)).items[0].id_paciente, other)
    assert.equal((await request('/pacientes?tipo_documento=CE&numero_documento=GRAN-ID', 200, tokens.admin)).total, 1)
    assert.equal((await request('/pacientes?tipo_documento=DNI&numero_documento=GRAN-ID', 200, tokens.admin)).total, 0)
    for (const q of ['%', '_', "' OR 1=1 --"]) {
      assert.equal((await request('/pacientes?q=' + encodeURIComponent(q), 200, tokens.admin)).total, 0)
    }
  })

  await t.test('el detalle administrativo incluye solo los contactos del paciente', async () => {
    const detail = await request('/pacientes/' + owner, 200, tokens.recepcion)
    assert.equal(detail.id_paciente, owner); assert.equal(detail.fecha_nacimiento, '1998-04-12')
    assert.equal(detail.contactos.length, 1)
    const { rows: contacts } = await pool.query('SELECT id_contacto FROM sis_god."CONTACTO" WHERE id_paciente=$1', [owner])
    assert.equal(detail.contactos[0].id_contacto, contacts[0].id_contacto)
    for (const field of ['historia', 'antecedentes', 'observaciones_generales', 'cuestionario_complementario', 'credencial_acceso']) {
      assert.equal(Object.hasOwn(detail, field), false)
    }
    const large = await request('/pacientes/9007199254740993', 200, tokens.admin)
    assert.equal(large.id_paciente, '9007199254740993'); assert.deepEqual(large.contactos, [])
    assert.equal(large.fecha_nacimiento, null)
    assert.equal((await request('/pacientes', 200, tokens.recepcion)).total, 6)
  })

  await t.test('el paciente solo puede listar y consultar sus propios datos', async () => {
    const page = await request('/pacientes', 200, tokens.paciente)
    assert.equal(page.total, 1); assert.equal(page.items[0].id_paciente, owner)
    assert.equal((await request('/pacientes?q=99010002', 200, tokens.paciente)).total, 0)
    const empty = await request('/pacientes?pagina=2&limite=1', 200, tokens.paciente)
    assert.equal(empty.total, 1); assert.deepEqual(empty.items, [])
    await request('/pacientes/' + owner, 200, tokens.paciente)
    await request('/pacientes/' + other, 403, tokens.paciente)
    await request('/pacientes?id_paciente=' + other, 400, tokens.paciente)
    await request('/pacientes?alcance=global', 400, tokens.paciente)
  })

  await t.test('el odontólogo solo recibe pacientes asignados sin duplicarlos por sus planes', async () => {
    const page = await request('/pacientes', 200, tokens.odontologo)
    assert.equal(page.total, 2)
    assert.deepEqual(page.items.map((p: { id_paciente: string }) => p.id_paciente), [owner, assigned])
    await request('/pacientes/' + owner, 200, tokens.odontologo)
    await request('/pacientes/' + other, 403, tokens.odontologo)
    assert.equal((await request('/pacientes', 200, tokens['sin-asignacion'])).total, 0)
    await request('/pacientes', 403, tokens.asistente)
  })

  await t.test('se rechazan sesiones, filtros e identificadores inválidos', async () => {
    await request('/pacientes', 401)
    await request('/pacientes/' + owner, 401, 'token-alterado')
    for (const path of ['/pacientes/0', '/pacientes/no-es-id', '/pacientes/9223372036854775808',
      '/pacientes?limite=0', '/pacientes?pagina=1.5', '/pacientes?limite=101', '/pacientes?q=a&q=b']) {
      await request(path, 400, tokens.admin)
    }
    assert.equal((await request('/pacientes/9223372036854775807', 404, tokens.admin)).error.codigo, 'PACIENTE_NO_EXISTE')
  })

  await t.test('el repositorio mantiene el alcance incluso al consultarlo directamente', async () => {
    const { patientRepository } = await import('../../../src/infrastructure/database/sql/repositories/pacientes.repository.js')
    assert.equal(await patientRepository.findPatient(other, { alcance: 'propio', idPaciente: owner }), null)
    assert.equal(await patientRepository.findPatient(other, { alcance: 'asignado', idEmpleado: dentist }), null)
  })
})
