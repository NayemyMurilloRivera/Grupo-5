import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createPatient } from '../../../src/application/use-cases/pacientes/createPatient.js'
import { getPatient } from '../../../src/application/use-cases/pacientes/getPatient.js'
import { createPatientInput, listPatientsInput, patientId, patientScope } from '../../../src/interfaces/http/validators/pacientes.validator.js'

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
  await assert.rejects(getPatient({ findPatient: async () => null },
    '1', { alcance: 'global' }), isError(404))
})

const basePatient = { tipo_documento: 'DNI', numero_documento: '99110001',
  nombres: 'Paciente', apellidos: 'De prueba', telefono: '900110001' }

test('el alta valida datos personales, fechas y los registros dependientes', () => {
  const result = createPatientInput({ ...basePatient, nombres: ' Paciente ', correo: 'PRUEBA@example.invalid',
    fecha_nacimiento: '2000-02-29', contactos: [{ nombre: 'Familiar', parentesco: 'Hermano', telefono: '900110002' }] })
  assert.equal(result.nombres, 'Paciente'); assert.equal(result.correo, 'prueba@example.invalid')
  assert.equal(result.contactos.length, 1); assert.deepEqual(result.antecedentes, [])
  assert.equal(createPatientInput({ ...basePatient, correo: '', fecha_nacimiento: '', direccion: ' ' }).correo, null)
  for (const changes of [
    { nombres: '' }, { nombres: 'x'.repeat(101) }, { telefono: null }, { numero_documento: 'x'.repeat(31) },
    { fecha_nacimiento: '2025-02-29' }, { fecha_nacimiento: '2999-01-01' }, { fecha_nacimiento: '0000-01-01' },
    { fecha_nacimiento: '2026-04-31' }, { fecha_nacimiento: '2020-01-01T00:00:00Z' }, { correo: 'sin-arroba' },
    { id_paciente: '2' }, { historia: { id_historia: '3' } }, { contactos: null }, { contactos: {} },
    { contactos: Array(21).fill({}) }, { contactos: [{ nombre: 'Familiar', parentesco: 'Otro' }] },
    { contactos: [{ nombre: 'Familiar', parentesco: 'Otro', telefono: '900110002', id_paciente: '2' }] },
    { antecedentes: [{ tipo: 'Alergia' }] }, { antecedentes: Array(101).fill({}) },
    { antecedentes: [{ tipo: 'Alergia', descripcion: 'Dato', fecha_registro: '2026-02-30' }] },
    { antecedentes: [{ tipo: 'Alergia', descripcion: 'Dato', id_historia: '1' }] },
  ]) assert.throws(() => createPatientInput({ ...basePatient, ...changes }), isError(400))
})

test('el caso de uso no registra pacientes sin alcance global ni antecedentes sin permiso', () => {
  const repo = { createPatient: async () => { throw new Error('No debe consultar el repositorio') } }
  const input = createPatientInput(basePatient)
  assert.throws(() => createPatient(repo, input, { alcance: 'propio', idPaciente: '1' }), isError(403))
  assert.throws(() => createPatient(repo, input, { alcance: 'asignado', idEmpleado: '1' }), isError(403))
  assert.throws(() => createPatient(repo, createPatientInput({ ...basePatient,
    antecedentes: [{ tipo: 'Alergia', descripcion: 'Dato de prueba' }] }), { alcance: 'global' }), isError(403))
})

const databaseUrl = process.env.PATIENTS_TEST_DATABASE_URL

test('consultas y altas de pacientes con PostgreSQL y autorización reales', { skip: !databaseUrl }, async t => {
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

  async function postPatient(body: unknown, status: number, token: string | undefined = tokens.admin) {
    const response = await fetch(base + '/pacientes', { method: 'POST', headers: {
      'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}),
    }, body: JSON.stringify(body) })
    const data = await response.json()
    assert.equal(response.status, status, JSON.stringify(data))
    assert.equal(response.headers.get('cache-control'), 'no-store')
    return data
  }
  async function counts() {
    const { rows: [row] } = await pool.query(`SELECT
      (SELECT count(*)::int FROM sis_god."PACIENTE") AS pacientes,
      (SELECT count(*)::int FROM sis_god."HISTORIA_CLINICA") AS historias,
      (SELECT count(*)::int FROM sis_god."CONTACTO") AS contactos,
      (SELECT count(*)::int FROM sis_god."ANTECEDENTE") AS antecedentes`)
    return row
  }

  await t.test('el alta confirma paciente, historia única, contactos y antecedentes', async () => {
    const before = await counts()
    const body = { ...basePatient, fecha_nacimiento: '2000-02-29',
      contactos: [{ nombre: 'Familiar uno', parentesco: 'Hermana', telefono: '900110002' },
        { nombre: 'Familiar dos', parentesco: 'Padre', telefono: '900110003' }],
      antecedentes: [{ tipo: 'Alergia', descripcion: 'Antecedente ficticio', fecha_registro: '2026-01-01' },
        { tipo: 'Otro', descripcion: 'Segundo antecedente ficticio' }] }
    const created = await postPatient(body, 201)
    assert.equal(typeof created.id_paciente, 'string'); assert.equal(typeof created.historia.id_historia, 'string')
    assert.equal(created.contactos.length, 2); assert.equal(created.historia.antecedentes.length, 2)
    const today = (await pool.query('SELECT CURRENT_DATE::text AS fecha')).rows[0].fecha
    assert.equal(created.historia.fecha_apertura, today)
    assert.equal(created.historia.antecedentes[0].fecha_registro, '2026-01-01')
    assert.equal(created.historia.antecedentes[1].fecha_registro, today)
    assert.deepEqual(await counts(), { pacientes: before.pacientes + 1, historias: before.historias + 1,
      contactos: before.contactos + 2, antecedentes: before.antecedentes + 2 })
    const { rows: history } = await pool.query('SELECT id_historia FROM sis_god."HISTORIA_CLINICA" WHERE id_paciente=$1', [created.id_paciente])
    assert.equal(history.length, 1); assert.equal(history[0].id_historia, created.historia.id_historia)
    const { rows: owners } = await pool.query(`SELECT c.id_paciente, a.id_historia FROM sis_god."CONTACTO" c
      JOIN sis_god."ANTECEDENTE" a ON a.id_historia=$2 WHERE c.id_paciente=$1`, [created.id_paciente, created.historia.id_historia])
    assert.equal(owners.length, 4)
    assert.equal((await request('/pacientes/' + created.id_paciente, 200, tokens.admin)).contactos.length, 2)
  })

  await t.test('recepción puede registrar un paciente sin datos opcionales ni crear cuentas', async () => {
    const created = await postPatient({ ...basePatient, numero_documento: '99110002', correo: '', fecha_nacimiento: '' }, 201, tokens.recepcion)
    assert.equal(created.correo, null); assert.equal(created.fecha_nacimiento, null)
    assert.deepEqual(created.contactos, []); assert.deepEqual(created.historia.antecedentes, [])
    assert.equal((await pool.query('SELECT 1 FROM sis_god."USUARIO" WHERE id_paciente=$1', [created.id_paciente])).rowCount, 0)
  })

  await t.test('el alta rechaza duplicados y datos inválidos sin guardar filas parciales', async () => {
    const before = await counts()
    assert.equal((await postPatient(basePatient, 409)).error.codigo, 'DOCUMENTO_DUPLICADO')
    await postPatient({ ...basePatient, numero_documento: '99110003', fecha_nacimiento: '2999-01-01' }, 400)
    await postPatient({ ...basePatient, numero_documento: '99110003', contactos: [{ nombre: 'Sin teléfono', parentesco: 'Otro' }] }, 400)
    assert.deepEqual(await counts(), before)
  })

  await t.test('la autorización del alta distingue datos administrativos y clínicos', async () => {
    const before = await counts()
    for (const role of ['paciente', 'odontologo', 'asistente']) await postPatient({ ...basePatient, numero_documento: '99110004' }, 403, tokens[role])
    const response = await fetch(base + '/pacientes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(basePatient) })
    assert.equal(response.status, 401)
    await postPatient({ ...basePatient, numero_documento: '99110004',
      antecedentes: [{ tipo: 'Alergia', descripcion: 'No autorizado' }] }, 403, tokens.recepcion)
    const { rows: grants } = await pool.query(`DELETE FROM sis_god."ROL_PERMISO" rp USING sis_god."PERMISO" p
      WHERE rp.id_rol=$1 AND rp.id_permiso=p.id_permiso AND p.recurso='antecedentes' AND p.accion='crear'
      RETURNING rp.id_permiso`, [roleId('Administrador')])
    try {
      await postPatient({ ...basePatient, numero_documento: '99110004',
        antecedentes: [{ tipo: 'Alergia', descripcion: 'Permiso retirado' }] }, 403)
    } finally {
      await pool.query(`INSERT INTO sis_god."ROL_PERMISO" (id_rol,id_permiso)
        SELECT $1, unnest($2::bigint[])`, [roleId('Administrador'), grants.map(row => row.id_permiso)])
    }
    assert.deepEqual(await counts(), before)
  })

  await t.test('un error SQL en el segundo contacto revierte el paciente y su historia', async () => {
    const before = await counts()
    await pool.query(`CREATE FUNCTION sis_god.prueba_contacto() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Contacto rechazado en la prueba'; END $$;
      CREATE TRIGGER prueba_contacto BEFORE INSERT ON sis_god."CONTACTO"
      FOR EACH ROW WHEN (NEW.nombre = 'Contacto rechazado') EXECUTE FUNCTION sis_god.prueba_contacto()`)
    try {
      await postPatient({ ...basePatient, numero_documento: '99110005', contactos: [
        { nombre: 'Contacto válido', parentesco: 'Otro', telefono: '900110002' },
        { nombre: 'Contacto rechazado', parentesco: 'Otro', telefono: '900110003' }],
        antecedentes: [{ tipo: 'Otro', descripcion: 'Dato ficticio' }] }, 500)
      assert.deepEqual(await counts(), before)
    } finally {
      await pool.query('DROP TRIGGER prueba_contacto ON sis_god."CONTACTO"; DROP FUNCTION sis_god.prueba_contacto()')
    }
  })

  await t.test('un error en un antecedente revierte también los contactos ya insertados', async () => {
    const before = await counts()
    await pool.query(`CREATE FUNCTION sis_god.prueba_antecedente() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Antecedente rechazado en la prueba'; END $$;
      CREATE TRIGGER prueba_antecedente BEFORE INSERT ON sis_god."ANTECEDENTE"
      FOR EACH ROW WHEN (NEW.tipo = 'Rechazado') EXECUTE FUNCTION sis_god.prueba_antecedente()`)
    try {
      await postPatient({ ...basePatient, numero_documento: '99110006', contactos: [
        { nombre: 'Contacto válido', parentesco: 'Otro', telefono: '900110002' }],
        antecedentes: [{ tipo: 'Válido', descripcion: 'Primer antecedente' },
          { tipo: 'Rechazado', descripcion: 'Segundo antecedente' }] }, 500)
      assert.deepEqual(await counts(), before)
    } finally {
      await pool.query('DROP TRIGGER prueba_antecedente ON sis_god."ANTECEDENTE"; DROP FUNCTION sis_god.prueba_antecedente()')
    }
  })

  await t.test('un fallo diferido al confirmar tampoco deja registros parciales', async () => {
    const before = await counts()
    await pool.query(`CREATE FUNCTION sis_god.prueba_confirmacion() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Confirmación rechazada en la prueba'; END $$;
      CREATE CONSTRAINT TRIGGER prueba_confirmacion AFTER INSERT ON sis_god."PACIENTE"
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.numero_documento = '99110007')
      EXECUTE FUNCTION sis_god.prueba_confirmacion()`)
    try {
      await postPatient({ ...basePatient, numero_documento: '99110007', contactos: [
        { nombre: 'Contacto válido', parentesco: 'Otro', telefono: '900110002' }] }, 500)
      assert.deepEqual(await counts(), before)
    } finally {
      await pool.query('DROP TRIGGER prueba_confirmacion ON sis_god."PACIENTE"; DROP FUNCTION sis_god.prueba_confirmacion()')
    }
  })

  await t.test('dos altas simultáneas con el mismo documento crean un solo paciente', async () => {
    const body = { ...basePatient, numero_documento: '99110008' }
    const before = await counts()
    const results = await Promise.all([1, 2].map(() => fetch(base + '/pacientes', {
      method: 'POST', headers: { Authorization: 'Bearer ' + tokens.admin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })))
    assert.deepEqual(results.map(result => result.status).sort(), [201, 409])
    const after = await counts()
    assert.equal(after.pacientes, before.pacientes + 1); assert.equal(after.historias, before.historias + 1)
    assert.equal(after.contactos, before.contactos); assert.equal(after.antecedentes, before.antecedentes)
  })
})
