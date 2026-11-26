import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import type { PersonalRepository, PersonalWrites } from '../../../src/application/ports/personal.repository.js'
import { getEmployee } from '../../../src/application/use-cases/personal/getEmployee.js'
import { updateEmployee } from '../../../src/application/use-cases/personal/updateEmployee.js'
import { updateTreatment } from '../../../src/application/use-cases/personal/updateTreatment.js'
import type { Employee } from '../../../src/domain/personal/entities.js'
import { knownPersonalError } from '../../../src/domain/personal/errors.js'
import {
  createEmployeeInput, createTreatmentInput, employeeScope, listEmployeesInput, listTreatmentsInput, requiredId,
  updateEmployeeInput, updateTreatmentInput,
} from '../../../src/interfaces/http/validators/personal.validator.js'

const isError = (status: number, code?: string) => (error: unknown) =>
  error instanceof Error && 'status' in error && error.status === status && (!code || ('code' in error && error.code === code))

const person = { tipo_documento: 'dni', numero_documento: '70000001', nombres: ' Ana ', apellidos: 'Ríos', telefono: '900000001' }

test('el alta exige exactamente un subtipo con su dato obligatorio', () => {
  const dentist = createEmployeeInput({ ...person, subtipo: 'odontologo', numero_colegiatura: 'COP-1' })
  assert.deepEqual(dentist, { tipo_documento: 'DNI', numero_documento: '70000001', nombres: 'Ana', apellidos: 'Ríos',
    telefono: '900000001', estado: 'activo', subtipo: 'odontologo', numero_colegiatura: 'COP-1' })
  assert.equal(createEmployeeInput({ ...person, subtipo: 'apoyo', cargo: 'Recepcionista', estado: 'inactivo' }).estado, 'inactivo')
  for (const body of [
    { ...person },
    { ...person, subtipo: 'odontologo' },
    { ...person, subtipo: 'apoyo' },
    { ...person, subtipo: 'odontologo', numero_colegiatura: 'COP-1', cargo: 'Recepcionista' },
    { ...person, subtipo: 'apoyo', cargo: 'Recepcionista', numero_colegiatura: 'COP-1' },
    { ...person, subtipo: 'odontologo', cargo: 'Recepcionista' },
    { ...person, subtipo: 'gerente', cargo: 'x' },
    { ...person, subtipo: 'apoyo', cargo: '   ' },
    { ...person, subtipo: 'apoyo', cargo: 'x', estado: 'suspendido' },
    { ...person, subtipo: 'apoyo', cargo: 'x', telefono: 'abc' },
    { ...person, subtipo: 'apoyo', cargo: 'x', id_empleado: '5' },
    { nombres: 'Sin documento', apellidos: 'x', telefono: '900000001', subtipo: 'apoyo', cargo: 'x' },
    [], null,
  ]) assert.throws(() => createEmployeeInput(body), isError(400), JSON.stringify(body))
})

test('la modificación no cambia el subtipo ni el identificador', () => {
  assert.deepEqual(updateEmployeeInput({ estado: 'inactivo', telefono: '900000002' }), { estado: 'inactivo', telefono: '900000002' })
  assert.deepEqual(updateEmployeeInput({ cargo: ' Asistente ' }), { cargo: 'Asistente' })
  for (const body of [{}, { subtipo: 'apoyo' }, { id_empleado: '2' }, { cargo: 'x', numero_colegiatura: 'y' }, { nombres: '' }, { otro: 1 }]) {
    assert.throws(() => updateEmployeeInput(body), isError(400), JSON.stringify(body))
  }
})

test('el precio referencial es un importe no negativo de hasta dos decimales', () => {
  assert.equal(createTreatmentInput({ nombre: 'Profilaxis', precio_referencial: 120 }).precio_referencial, '120')
  assert.equal(createTreatmentInput({ nombre: 'Profilaxis', precio_referencial: '0.50' }).precio_referencial, '0.50')
  assert.equal(createTreatmentInput({ nombre: 'Profilaxis', precio_referencial: 0 }).descripcion, null)
  for (const precio of [-1, '-0.01', '1.234', 'abc', '', null, Number.NaN, Infinity, '12345678901', [1]]) {
    assert.throws(() => createTreatmentInput({ nombre: 'Profilaxis', precio_referencial: precio }), isError(400), String(precio))
  }
  assert.throws(() => createTreatmentInput({ nombre: 'Profilaxis' }), isError(400))
  assert.throws(() => createTreatmentInput({ nombre: ' ', precio_referencial: 1 }), isError(400))
  assert.deepEqual(updateTreatmentInput({ descripcion: null }), { descripcion: null })
  assert.throws(() => updateTreatmentInput({}), isError(400))
  assert.throws(() => updateTreatmentInput({ id_tratamiento: '1' }), isError(400))
})

test('los filtros y el alcance se validan sin aceptar campos de autorización', () => {
  assert.deepEqual(listEmployeesInput({}), { q: undefined, pagina: 1, limite: 25, estado: undefined, subtipo: undefined })
  assert.equal(listEmployeesInput({ subtipo: 'apoyo', limite: '100' }).limite, 100)
  for (const query of [{ limite: '101' }, { pagina: '0' }, { estado: 'x' }, { subtipo: 'x' }, { q: ['a', 'b'] }, { alcance: 'global' }]) {
    assert.throws(() => listEmployeesInput(query), isError(400), JSON.stringify(query))
  }
  assert.throws(() => listTreatmentsInput({ id_tratamiento: '1' }), isError(400))
  assert.equal(requiredId('9223372036854775807'), '9223372036854775807')
  for (const id of ['0', '01', '-1', '1.5', '9223372036854775808', 'x']) assert.throws(() => requiredId(id), isError(400))
  assert.deepEqual(employeeScope({ alcance: 'propio', idEmpleado: '4' }), { alcance: 'propio', idEmpleado: '4' })
  for (const scope of [undefined, {}, { alcance: 'asignado', idEmpleado: '4' }, { alcance: 'propio' }]) {
    assert.throws(() => employeeScope(scope), isError(403))
  }
})

const dentistRecord: Employee = { id_empleado: '7', tipo_documento: 'DNI', numero_documento: '1', nombres: 'A', apellidos: 'B',
  telefono: '900000001', estado: 'activo', subtipo: 'odontologo', numero_colegiatura: 'COP-7', cargo: null }

function fakeRepository(current: Employee | null) {
  const calls: string[] = []
  const tx = new Proxy({} as PersonalWrites, {
    get: (_target, name: string) => async () => {
      calls.push(name)
      return name === 'lockEmployee' || name === 'findEmployee' ? current : undefined
    },
  })
  const repo = {
    withTransaction: (work: (writes: PersonalWrites) => Promise<unknown>) => work(tx),
    findEmployee: async () => current,
    updateTreatment: async () => null,
  } as unknown as PersonalRepository
  return { repo, calls }
}

test('los casos de uso protegen el subtipo, la titularidad y los registros inexistentes', async () => {
  const { repo, calls } = fakeRepository(dentistRecord)
  await assert.rejects(updateEmployee(repo, '7', { cargo: 'Recepcionista' }), isError(409, 'SUBTIPO_INCOMPATIBLE'))
  assert.deepEqual(calls, ['lockEmployee'])
  await updateEmployee(repo, '7', { numero_colegiatura: 'COP-8', telefono: '900000009' })
  assert.deepEqual(calls.slice(1), ['lockEmployee', 'updateEmployee', 'updateDentist', 'checkDeferred', 'findEmployee'])
  await assert.rejects(updateEmployee(fakeRepository(null).repo, '7', { telefono: '900000009' }), isError(404, 'EMPLEADO_NO_EXISTE'))
  await assert.rejects(getEmployee(repo, '8', { alcance: 'propio', idEmpleado: '7' }), isError(403))
  assert.equal((await getEmployee(repo, '7', { alcance: 'propio', idEmpleado: '7' })).id_empleado, '7')
  await assert.rejects(getEmployee(fakeRepository(null).repo, '7', { alcance: 'global' }), isError(404))
  await assert.rejects(updateTreatment(repo, '1', { nombre: 'x' }), isError(404, 'TRATAMIENTO_NO_EXISTE'))
})

test('los errores de PostgreSQL se traducen sin exponer detalles internos', () => {
  assert.equal(knownPersonalError({ code: '23505', constraint: 'uq_odontologo_colegiatura' })?.code, 'COLEGIATURA_DUPLICADA')
  assert.equal(knownPersonalError({ code: '23505', constraint: 'uq_empleado_documento' })?.status, 409)
  assert.equal(knownPersonalError({ code: '23514', where: 'PL/pgSQL function sis_god.validar_subtipo_empleado() line 13' })?.code,
    'SUBTIPO_INVALIDO')
  assert.equal(knownPersonalError({ code: '23514', where: 'PL/pgSQL function sis_god.validar_minimo_hijos()' }), undefined)
  assert.equal(knownPersonalError(new Error('otro')), undefined)
})

const databaseUrl = process.env.PERSONAL_TEST_DATABASE_URL

test('API de personal con PostgreSQL, instalador reducido y autorización reales', { skip: !databaseUrl }, async t => {
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
  assert.equal((await pool.query("SELECT 1 FROM pg_namespace WHERE nspname = 'sis_god'")).rowCount, 0,
    'La base de ejecución debe estar vacía.')

  // Se recrea la base con los mismos archivos y en el mismo orden que database/instalar.sql.
  const database = new URL('../../../../database/', import.meta.url)
  const installer = await readFile(new URL('instalar.sql', database), 'utf8')
  const files = [...installer.matchAll(/^\\ir (\S+)$/gm)].map(match => match[1])
  assert.ok(files.length >= 12 && files[0] === 'base/SIS_GOD_BASE_20.sql')
  for (const file of files) {
    const sql = await readFile(new URL(file, database), 'utf8')
    if (sql.trim()) await pool.query(sql)
  }

  await t.test('el instalador produce exactamente las 20 tablas y 21 FK del alcance', async () => {
    const scope = JSON.parse(await readFile(new URL('../../../../contracts/scope.json', import.meta.url), 'utf8'))
    const { rows } = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'sis_god' ORDER BY tablename")
    assert.deepEqual(rows.map(row => row.tablename), Object.values(scope.tables).flat().sort())
    const { rows: [fk] } = await pool.query(`SELECT count(*)::int AS n FROM pg_constraint
      WHERE contype = 'f' AND connamespace = 'sis_god'::regnamespace`)
    assert.equal(fk.n, 21)
    await pool.query(await readFile(new URL('queries/asignadas/personal.sql', database), 'utf8'))
    await pool.query(await readFile(new URL('tests/asignadas/personal.sql', database), 'utf8'))
  })

  const employeeId = async (doc: string) =>
    (await pool.query('SELECT id_empleado FROM sis_god."EMPLEADO" WHERE numero_documento = $1', [doc])).rows[0]?.id_empleado as string
  const { rows: roles } = await pool.query('SELECT id_rol, nombre FROM sis_god."ROL"')
  const roleId = (name: string): string => roles.find(row => row.nombre === name)!.id_rol
  const password = 'Prueba local de personal 2026!'
  const { hashPassword } = await import('../../../src/infrastructure/auth/credentials.js')
  const hash = await hashPassword(password)
  const patient = (await pool.query('SELECT min(id_paciente) AS id FROM sis_god."PACIENTE"')).rows[0].id as string
  for (const [name, role, employee, owner] of [
    ['personal-admin', 'Administrador', await employeeId('99020001'), null],
    ['personal-odontologo', 'Odontólogo', await employeeId('99020002'), null],
    ['personal-recepcion', 'Recepcionista', await employeeId('99020006'), null],
    ['personal-asistente', 'Asistente dental', await employeeId('99020007'), null],
    ['personal-paciente', 'Paciente', null, patient],
  ]) {
    await pool.query(`INSERT INTO sis_god."USUARIO" (nombre_acceso, correo, credencial_acceso, id_rol, id_empleado, id_paciente)
      VALUES ($1, $2, $3, $4, $5, $6)`, [name, name + '@example.invalid', hash, roleId(role!), employee, owner])
  }

  const { createApp } = await import('../../../src/app.js')
  const seguridad = await import('../../../src/interfaces/http/controllers/seguridad.controller.js')
  const personal = await import('../../../src/interfaces/http/controllers/personal.controller.js')
  const server = createApp(undefined, { seguridad, personal }).listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => { if (server.listening) resolve(); else server.once('listening', resolve); server.once('error', reject) })
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const base = 'http://127.0.0.1:' + address.port + '/api/v1'

  async function request(path: string, status: number, options: { token?: string; method?: string; body?: unknown } = {}) {
    const { token, method = 'GET', body } = options
    const response = await fetch(base + path, {
      method,
      headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await response.json()
    assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`)
    return data
  }
  const tokens: Record<string, string> = {}
  for (const name of ['admin', 'odontologo', 'recepcion', 'asistente', 'paciente']) {
    tokens[name] = (await request('/auth/login', 200, { method: 'POST', body: { nombre_acceso: 'personal-' + name, password } })).token
  }
  const admin = tokens.admin
  const post = (path: string, body: unknown, status: number, token = admin) => request(path, status, { token, method: 'POST', body })
  const patch = (path: string, body: unknown, status: number, token = admin) => request(path, status, { token, method: 'PATCH', body })
  const countByDocument = async (doc: string) =>
    (await pool.query('SELECT count(*)::int AS n FROM sis_god."EMPLEADO" WHERE numero_documento = $1', [doc])).rows[0].n as number
  const newPerson = (doc: string) => ({ numero_documento: doc, tipo_documento: 'DNI', nombres: 'Nuevo', apellidos: 'Empleado ' + doc, telefono: '900111222' })

  let dentist: Employee
  let support: Employee

  await t.test('crea un odontólogo y un personal de apoyo con el identificador compartido', async () => {
    dentist = await post('/empleados', { ...newPerson('70100001'), subtipo: 'odontologo', numero_colegiatura: 'COP-70100001' }, 201)
    assert.equal(dentist.subtipo, 'odontologo'); assert.equal(dentist.cargo, null); assert.equal(dentist.estado, 'activo')
    support = await post('/empleados', { ...newPerson('70100002'), subtipo: 'apoyo', cargo: 'Recepcionista' }, 201)
    assert.equal(support.subtipo, 'apoyo'); assert.equal(support.numero_colegiatura, null)
    const { rows: [shared] } = await pool.query(`SELECT
        (SELECT id_empleado FROM sis_god."ODONTOLOGO" WHERE numero_colegiatura = $1) AS odontologo,
        (SELECT count(*)::int FROM sis_god."ODONTOLOGO" WHERE id_empleado = $2) AS apoyo_como_odontologo,
        (SELECT id_empleado FROM sis_god."PERSONAL_APOYO" WHERE id_empleado = $2) AS apoyo`, ['COP-70100001', support.id_empleado])
    assert.equal(shared.odontologo, dentist.id_empleado)
    assert.equal(shared.apoyo, support.id_empleado)
    assert.equal(shared.apoyo_como_odontologo, 0)
  })

  await t.test('rechaza empleados sin subtipo o con los dos y revierte el alta si falla el subtipo', async () => {
    await post('/empleados', newPerson('70100003'), 400)
    await post('/empleados', { ...newPerson('70100003'), subtipo: 'odontologo', numero_colegiatura: 'X', cargo: 'Y' }, 400)
    assert.equal(await countByDocument('70100003'), 0)
    const duplicate = await post('/empleados', { ...newPerson('70100003'), subtipo: 'odontologo', numero_colegiatura: 'COP-70100001' }, 409)
    assert.equal(duplicate.error.codigo, 'COLEGIATURA_DUPLICADA')
    assert.equal(await countByDocument('70100003'), 0, 'El EMPLEADO no debe quedar sin subtipo tras el rollback')
    assert.equal((await post('/empleados', { ...newPerson('70100001'), subtipo: 'apoyo', cargo: 'x' }, 409)).error.codigo, 'DOCUMENTO_DUPLICADO')
  })

  await t.test('la base rechaza un empleado sin subtipo aunque se omita la validación HTTP', async () => {
    const { personalRepository } = await import('../../../src/infrastructure/database/sql/repositories/personal.repository.js')
    const error = await personalRepository.withTransaction(async tx => {
      await tx.insertEmployee({ ...newPerson('70100004'), estado: 'activo' })
      await tx.checkDeferred()
    }).then(() => null, (failure: unknown) => failure)
    assert.equal(knownPersonalError(error)?.code, 'SUBTIPO_INVALIDO')
    assert.equal(await countByDocument('70100004'), 0)
  })

  await t.test('lista con filtros de estado y subtipo y consulta la ficha', async () => {
    const all = await request('/empleados?limite=3', 200, { token: admin })
    assert.equal(all.total, 10); assert.equal(all.total_paginas, 4); assert.equal(all.items.length, 3)
    const apoyo = await request('/empleados?subtipo=apoyo', 200, { token: admin })
    assert.equal(apoyo.total, 3)
    assert.ok(apoyo.items.every((item: Employee) => item.subtipo === 'apoyo' && item.cargo))
    assert.equal((await request('/empleados?estado=inactivo', 200, { token: admin })).total, 1)
    const empty = await request('/empleados?q=70100001&pagina=5', 200, { token: admin })
    assert.deepEqual(empty.items, []); assert.equal(empty.total, 1)
    assert.equal((await request('/empleados?q=' + encodeURIComponent("' OR 1=1 --"), 200, { token: admin })).total, 0)
    assert.equal((await request('/empleados/' + dentist.id_empleado, 200, { token: admin })).numero_colegiatura, 'COP-70100001')
    assert.equal((await request('/empleados/9223372036854775807', 404, { token: admin })).error.codigo, 'EMPLEADO_NO_EXISTE')
    await request('/empleados/abc', 400, { token: admin })
    await request('/empleados?alcance=global', 400, { token: admin })
  })

  await t.test('modifica datos y estado sin transformar el subtipo', async () => {
    const updated = await patch('/empleados/' + support.id_empleado, { telefono: '900333444', cargo: 'Asistente dental' }, 200)
    assert.equal(updated.telefono, '900333444'); assert.equal(updated.cargo, 'Asistente dental'); assert.equal(updated.subtipo, 'apoyo')
    assert.equal((await patch('/empleados/' + support.id_empleado, { numero_colegiatura: 'COP-X' }, 409)).error.codigo, 'SUBTIPO_INCOMPATIBLE')
    assert.equal((await patch('/empleados/' + dentist.id_empleado, { cargo: 'Recepcionista' }, 409)).error.codigo, 'SUBTIPO_INCOMPATIBLE')
    await patch('/empleados/' + dentist.id_empleado, { subtipo: 'apoyo' }, 400)
    const colegiatura = await patch('/empleados/' + dentist.id_empleado, { numero_colegiatura: 'PRUEBA-COP-002' }, 409)
    assert.equal(colegiatura.error.codigo, 'COLEGIATURA_DUPLICADA')
    await patch('/empleados/9223372036854775807', { telefono: '900333444' }, 404)
    const { rows: [after] } = await pool.query('SELECT numero_colegiatura FROM sis_god."ODONTOLOGO" WHERE id_empleado = $1', [dentist.id_empleado])
    assert.equal(after.numero_colegiatura, 'COP-70100001')
  })

  await t.test('solo ofrece odontólogos activos para los planes', async () => {
    const before = await request('/odontologos?limite=100', 200, { token: admin })
    const ids = before.items.map((item: { id_empleado: string }) => item.id_empleado)
    assert.ok(ids.includes(dentist.id_empleado))
    assert.ok(!before.items.some((item: { numero_colegiatura: string }) => item.numero_colegiatura === 'PRUEBA-COP-006'))
    assert.ok(!ids.includes(support.id_empleado))
    await patch('/empleados/' + dentist.id_empleado, { estado: 'inactivo' }, 200)
    const after = await request('/odontologos', 200, { token: admin })
    assert.equal(after.total, before.total - 1)
    assert.equal((await request('/odontologos?q=COP-70100001', 200, { token: admin })).total, 0)
  })

  await t.test('mantiene el catálogo y no cambia el precio acordado de un plan existente', async () => {
    const created = await post('/tratamientos', { nombre: 'Carilla de resina', descripcion: 'Estética', precio_referencial: '220.50' }, 201)
    assert.equal(created.precio_referencial, '220.50')
    await post('/tratamientos', { nombre: 'Precio negativo', precio_referencial: -10 }, 400)
    assert.equal((await post('/tratamientos', { nombre: ' carilla DE resina ', precio_referencial: 1 }, 409)).error.codigo, 'TRATAMIENTO_DUPLICADO')
    const { withTransaction } = await import('../../../src/infrastructure/database/sql/transaction.js')
    const plan = await withTransaction(async client => {
      const { rows: [row] } = await client.query(`INSERT INTO sis_god."PLAN_TRATAMIENTO" (fecha_creacion, id_historia, id_odontologo)
        SELECT CURRENT_DATE, id_historia, $2 FROM sis_god."HISTORIA_CLINICA" WHERE id_paciente = $1 RETURNING id_plan`,
      [patient, await employeeId('99020002')])
      await client.query(`INSERT INTO sis_god."DETALLE_PLAN" (orden, cantidad, precio_acordado, id_plan, id_tratamiento)
        VALUES (1, 1, 220.50, $1, $2)`, [row.id_plan, created.id_tratamiento])
      return row.id_plan as string
    })
    const changed = await patch('/tratamientos/' + created.id_tratamiento, { precio_referencial: 300, descripcion: null }, 200)
    assert.equal(changed.precio_referencial, '300.00'); assert.equal(changed.descripcion, null); assert.equal(changed.nombre, 'Carilla de resina')
    const { rows: [detail] } = await pool.query('SELECT precio_acordado FROM sis_god."DETALLE_PLAN" WHERE id_plan = $1', [plan])
    assert.equal(detail.precio_acordado, '220.50')
    await patch('/tratamientos/9223372036854775807', { precio_referencial: 1 }, 404)
    const listed = await request('/tratamientos?q=carilla', 200, { token: admin })
    assert.equal(listed.total, 1); assert.equal(listed.items[0].precio_referencial, '300.00')
  })

  await t.test('aplica los permisos de cada actor', async () => {
    await request('/empleados', 401)
    await request('/tratamientos', 401, { token: 'token-alterado' })
    await request('/empleados', 403, { token: tokens.recepcion })
    await post('/empleados', { ...newPerson('70100005'), subtipo: 'apoyo', cargo: 'x' }, 403, tokens.recepcion)
    await request('/empleados/' + support.id_empleado, 403, { token: tokens.odontologo })
    await request('/odontologos', 403, { token: tokens.asistente })
    await request('/tratamientos', 200, { token: tokens.asistente })
    await post('/tratamientos', { nombre: 'Asistente', precio_referencial: 1 }, 403, tokens.asistente)
    assert.equal((await post('/tratamientos', { nombre: 'Sellante', precio_referencial: 70 }, 201, tokens.odontologo)).nombre, 'Sellante')
    await request('/tratamientos', 403, { token: tokens.paciente })
    await patch('/tratamientos/1', { precio_referencial: 1 }, 403, tokens.paciente)
    assert.equal(await countByDocument('70100005'), 0)
  })
})
