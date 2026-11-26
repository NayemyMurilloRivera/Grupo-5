-- Generador de datos sintéticos para las mediciones EXPLAIN de pacientes, planes y pagos.
-- Ejecutar UNA vez, después de database/instalar.sql, en una base separada cuyo nombre contenga
-- «prueba» o «bench». Nunca en la base compartida de Supabase.
--
-- Los datos son deterministas (sin random()): dos cargas con la misma escala producen el mismo
-- conjunto, de modo que las mediciones antes/después del índice comparan los mismos datos.
-- Se respetan todas las FK, CHECK y disparadores diferidos: cada paciente con su historia, cada
-- empleado con un único subtipo, cada plan con detalles, abonos que no superan la obligación y
-- un solo documento (boleta o factura) por pago. Las filas generadas usan el prefijo BENCH-.
--
-- Escala por defecto (modificar solo la tabla bench_escala):
--   20 000 pacientes e historias, 100 000 antecedentes, 60 000 planes, 120 000 detalles,
--   60 000 presupuestos, ~40 000 obligaciones y ~60 000 pagos.
BEGIN;

DO $$
BEGIN
    IF current_database() NOT LIKE '%prueba%' AND current_database() NOT LIKE '%bench%' THEN
        RAISE EXCEPTION 'Use una base separada cuyo nombre contenga prueba o bench (actual: %)', current_database();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'sis_god') THEN
        RAISE EXCEPTION 'Instale primero el esquema con database/instalar.sql';
    END IF;
    IF EXISTS (SELECT 1 FROM sis_god."PACIENTE" WHERE numero_documento LIKE 'BENCH-%') THEN
        RAISE EXCEPTION 'Los datos sintéticos ya están cargados en esta base';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM sis_god."METODO_PAGO") THEN
        RAISE EXCEPTION 'Faltan métodos de pago: cargue DATOS_BASE.sql';
    END IF;
END;
$$;

CREATE TEMP TABLE bench_escala ON COMMIT DROP AS SELECT
    20000 AS pacientes,
    200   AS odontologos,
    40    AS apoyo,
    50    AS tratamientos,
    5     AS antecedentes_por_historia,
    3     AS planes_por_historia;

-- Personal: cada décimo odontólogo queda inactivo y no recibe planes.
INSERT INTO sis_god."EMPLEADO" (tipo_documento, numero_documento, nombres, apellidos, telefono, estado)
SELECT 'DNI', 'BENCH-O-' || lpad(i::text, 6, '0'), 'Odontólogo ' || i, 'Sintético ' || i,
    '91' || lpad(i::text, 7, '0'), CASE WHEN i % 10 = 0 THEN 'inactivo' ELSE 'activo' END
FROM bench_escala, generate_series(1, odontologos) AS i;
INSERT INTO sis_god."ODONTOLOGO" (id_empleado, numero_colegiatura)
SELECT id_empleado, 'BENCH-COP-' || substr(numero_documento, 9) FROM sis_god."EMPLEADO"
WHERE numero_documento LIKE 'BENCH-O-%';

INSERT INTO sis_god."EMPLEADO" (tipo_documento, numero_documento, nombres, apellidos, telefono)
SELECT 'DNI', 'BENCH-A-' || lpad(i::text, 6, '0'), 'Apoyo ' || i, 'Sintético ' || i, '92' || lpad(i::text, 7, '0')
FROM bench_escala, generate_series(1, apoyo) AS i;
INSERT INTO sis_god."PERSONAL_APOYO" (id_empleado, cargo)
SELECT id_empleado, CASE WHEN substr(numero_documento, 9)::int % 2 = 0 THEN 'Recepcionista' ELSE 'Asistente dental' END
FROM sis_god."EMPLEADO" WHERE numero_documento LIKE 'BENCH-A-%';

INSERT INTO sis_god."TRATAMIENTO" (nombre, descripcion, precio_referencial)
SELECT 'BENCH tratamiento ' || lpad(i::text, 3, '0'), 'Tratamiento sintético de catálogo', 50 + (i * 37) % 900
FROM bench_escala, generate_series(1, tratamientos) AS i;

-- Correspondencias numeradas para repartir planes y detalles de forma determinista.
CREATE TEMP TABLE bench_odontologo ON COMMIT DROP AS
SELECT row_number() OVER (ORDER BY o.id_empleado) - 1 AS n, o.id_empleado
FROM sis_god."ODONTOLOGO" o JOIN sis_god."EMPLEADO" e USING (id_empleado)
WHERE e.estado = 'activo' AND e.numero_documento LIKE 'BENCH-O-%';
CREATE TEMP TABLE bench_tratamiento ON COMMIT DROP AS
SELECT row_number() OVER (ORDER BY id_tratamiento) - 1 AS n, id_tratamiento, precio_referencial
FROM sis_god."TRATAMIENTO" WHERE nombre LIKE 'BENCH tratamiento %';
CREATE TEMP TABLE bench_metodo ON COMMIT DROP AS
SELECT row_number() OVER (ORDER BY id_metodopago) - 1 AS n, id_metodopago FROM sis_god."METODO_PAGO";

-- Pacientes con su historia única y un contacto.
INSERT INTO sis_god."PACIENTE" (tipo_documento, numero_documento, nombres, apellidos, fecha_nacimiento, telefono)
SELECT 'DNI', 'BENCH-P-' || lpad(i::text, 7, '0'), 'Paciente ' || i, 'Sintético ' || i,
    DATE '1950-01-01' + (i * 97) % 24000, '93' || lpad(i::text, 7, '0')
FROM bench_escala, generate_series(1, pacientes) AS i;

CREATE TEMP TABLE bench_paciente ON COMMIT DROP AS
SELECT substr(numero_documento, 9)::int AS i, id_paciente FROM sis_god."PACIENTE" WHERE numero_documento LIKE 'BENCH-P-%';

INSERT INTO sis_god."HISTORIA_CLINICA" (fecha_apertura, observaciones_generales, id_paciente)
SELECT DATE '2023-01-01' + p.i % 900, 'Historia sintética', p.id_paciente FROM bench_paciente p;
INSERT INTO sis_god."CONTACTO" (nombre, parentesco, telefono, id_paciente)
SELECT 'Contacto ' || p.i, CASE WHEN p.i % 2 = 0 THEN 'Madre' ELSE 'Padre' END, '94' || lpad(p.i::text, 7, '0'), p.id_paciente
FROM bench_paciente p;

CREATE TEMP TABLE bench_historia ON COMMIT DROP AS
SELECT p.i, h.id_historia, h.fecha_apertura
FROM bench_paciente p JOIN sis_god."HISTORIA_CLINICA" h USING (id_paciente);

-- Antecedentes por historia y fecha (consulta medida por Erick).
INSERT INTO sis_god."ANTECEDENTE" (tipo, descripcion, fecha_registro, id_historia)
SELECT (ARRAY['Alergias', 'Enfermedades', 'Medicación', 'Cirugías', 'Hábitos'])[1 + (h.i + j) % 5],
    'Antecedente sintético ' || j, h.fecha_apertura + j * 30, h.id_historia
FROM bench_historia h, bench_escala, generate_series(1, antecedentes_por_historia) AS j;

-- Planes por historia y fecha (consulta medida por Esaul), cada uno con dos detalles.
INSERT INTO sis_god."PLAN_TRATAMIENTO" (fecha_creacion, estado, observaciones, id_historia, id_odontologo)
SELECT h.fecha_apertura + j * 45,
    (ARRAY['propuesto', 'en_curso', 'finalizado', 'cancelado'])[1 + (h.i + j) % 4],
    'BENCH plan ' || j, h.id_historia,
    (SELECT id_empleado FROM bench_odontologo WHERE n = (h.i * 7 + j) % (SELECT count(*) FROM bench_odontologo))
FROM bench_historia h, bench_escala, generate_series(1, planes_por_historia) AS j;

CREATE TEMP TABLE bench_plan ON COMMIT DROP AS
SELECT row_number() OVER (ORDER BY id_plan) AS k, id_plan, fecha_creacion
FROM sis_god."PLAN_TRATAMIENTO" WHERE observaciones LIKE 'BENCH plan %';

INSERT INTO sis_god."DETALLE_PLAN" (orden, cantidad, precio_acordado, id_plan, id_tratamiento)
SELECT d, 1, t.precio_referencial, p.id_plan, t.id_tratamiento
FROM bench_plan p CROSS JOIN generate_series(1, 2) AS d
JOIN bench_tratamiento t ON t.n = (p.k * 3 + d) % (SELECT count(*) FROM bench_tratamiento);

-- Un presupuesto por plan con el importe calculado de sus detalles; dos de cada tres se aceptan.
INSERT INTO sis_god."PRESUPUESTO" (fecha_emision, importe, estado, id_plan)
SELECT p.fecha_creacion, sum(d.cantidad * d.precio_acordado),
    CASE WHEN p.k % 3 = 0 THEN 'pendiente' ELSE 'aceptado' END, p.id_plan
FROM bench_plan p JOIN sis_god."DETALLE_PLAN" d USING (id_plan)
GROUP BY p.k, p.id_plan, p.fecha_creacion;

-- Una obligación por presupuesto aceptado (pagos de Rodrigo).
INSERT INTO sis_god."OBLIGACION" (fecha_emision, importe, fecha_vencimiento, id_presupuesto)
SELECT b.fecha_emision, b.importe, b.fecha_emision + 30, b.id_presupuesto
FROM sis_god."PRESUPUESTO" b JOIN bench_plan p USING (id_plan)
WHERE b.estado = 'aceptado';

-- Entre cero y tres abonos del 30 % del importe: el total nunca supera la obligación.
INSERT INTO sis_god."PAGO" (fecha_hora, importe, referencia, id_obligacion, id_metodopago)
SELECT o.fecha_emision + j * INTERVAL '1 day' + INTERVAL '10 hours', round(o.importe * 0.30, 2),
    'BENCH-PAGO-' || o.id_obligacion || '-' || j, o.id_obligacion,
    (SELECT id_metodopago FROM bench_metodo WHERE n = (o.id_obligacion + j) % (SELECT count(*) FROM bench_metodo))
FROM sis_god."OBLIGACION" o JOIN sis_god."PRESUPUESTO" b USING (id_presupuesto) JOIN bench_plan p USING (id_plan)
CROSS JOIN LATERAL generate_series(1, (o.id_obligacion % 4)::int) AS j;

-- Documento exclusivo: boleta para los pagos pares, factura para los múltiplos de 5 impares.
INSERT INTO sis_god."BOLETA" (serie, numero, fecha_emision, nombre_receptor, documento_receptor, id_pago)
SELECT 'BENCH', row_number() OVER (ORDER BY id_pago), fecha_hora::date, 'Receptor sintético', '99999999', id_pago
FROM sis_god."PAGO" WHERE referencia LIKE 'BENCH-PAGO-%' AND id_pago % 2 = 0;
INSERT INTO sis_god."FACTURA" (serie, numero, fecha_emision, razon_social_receptor, ruc_receptor, id_pago)
SELECT 'BENCH', row_number() OVER (ORDER BY id_pago), fecha_hora::date, 'Empresa sintética SAC',
    '20' || lpad((id_pago % 1000000000)::text, 9, '0'), id_pago
FROM sis_god."PAGO" WHERE referencia LIKE 'BENCH-PAGO-%' AND id_pago % 2 = 1 AND id_pago % 5 = 0;

-- Los disparadores diferidos (historia, subtipo y detalle mínimo) se comprueban aquí, antes de confirmar.
SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;

-- Estadísticas actualizadas para que EXPLAIN refleje el volumen cargado.
ANALYZE sis_god."PACIENTE", sis_god."HISTORIA_CLINICA", sis_god."CONTACTO", sis_god."ANTECEDENTE",
    sis_god."EMPLEADO", sis_god."ODONTOLOGO", sis_god."PERSONAL_APOYO", sis_god."TRATAMIENTO",
    sis_god."PLAN_TRATAMIENTO", sis_god."DETALLE_PLAN", sis_god."PRESUPUESTO", sis_god."OBLIGACION",
    sis_god."PAGO", sis_god."BOLETA", sis_god."FACTURA";

SELECT 'ANTECEDENTE' AS tabla, count(*) AS filas FROM sis_god."ANTECEDENTE"
UNION ALL SELECT 'PLAN_TRATAMIENTO', count(*) FROM sis_god."PLAN_TRATAMIENTO"
UNION ALL SELECT 'DETALLE_PLAN', count(*) FROM sis_god."DETALLE_PLAN"
UNION ALL SELECT 'OBLIGACION', count(*) FROM sis_god."OBLIGACION"
UNION ALL SELECT 'PAGO', count(*) FROM sis_god."PAGO"
UNION ALL SELECT 'BOLETA', count(*) FROM sis_god."BOLETA"
UNION ALL SELECT 'FACTURA', count(*) FROM sis_god."FACTURA";
