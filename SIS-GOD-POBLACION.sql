
BEGIN;

INSERT INTO sis_god."PACIENTE" (tipo_documento, numero_documento,
    nombres, apellidos, fecha_nacimiento, telefono, correo) VALUES
    ('DNI', '99010001', 'Lucía', 'Salazar Ríos', '1998-04-12', '900100001', 'lucia.salazar@example.invalid'),
    ('DNI', '99010002', 'Mateo', 'Vargas León', '1995-08-23', '900100002', 'mateo.vargas@example.invalid'),
    ('DNI', '99010003', 'Camila', 'Torres Vega', '2001-02-07', '900100003', 'camila.torres@example.invalid'),
    ('DNI', '99010004', 'Diego', 'Mendoza Soto', '1987-11-18', '900100004', 'diego.mendoza@example.invalid'),
    ('DNI', '99010005', 'Valeria', 'Castro Luna', '1992-06-30', '900100005', 'valeria.castro@example.invalid');

-- Paciente e historia se confirman juntos por la restricción diferida.
WITH datos (documento, observaciones) AS (
    VALUES
        ('99010001', 'Historia abierta para evaluación inicial.'),
        ('99010002', 'Historia abierta para evaluación inicial.'),
        ('99010003', 'Historia abierta para evaluación inicial.'),
        ('99010004', 'Historia abierta para evaluación inicial.'),
        ('99010005', 'Historia abierta para evaluación inicial.')
)
INSERT INTO sis_god."HISTORIA_CLINICA" (fecha_apertura, observaciones_generales, id_paciente)
SELECT DATE '2026-10-29', d.observaciones,
    (SELECT p.id_paciente FROM sis_god."PACIENTE" p
        WHERE p.tipo_documento = 'DNI' AND p.numero_documento = d.documento)
FROM datos d;

COMMIT;

INSERT INTO sis_god."EMPLEADO" (tipo_documento, numero_documento,
    nombres, apellidos, telefono) VALUES
    ('DNI', '99020001', 'Andrea', 'Ramos Flores', '900200001'),
    ('DNI', '99020002', 'Luis', 'Medina Paredes', '900200002'),
    ('DNI', '99020003', 'Sofía', 'Cruz Herrera', '900200003'),
    ('DNI', '99020004', 'Daniel', 'Ortiz Campos', '900200004'),
    ('DNI', '99020005', 'Paola', 'Reyes Aguilar', '900200005');

WITH datos (documento, colegiatura) AS (
    VALUES
        ('99020001', 'PRUEBA-COP-001'),
        ('99020002', 'PRUEBA-COP-002'),
        ('99020003', 'PRUEBA-COP-003'),
        ('99020004', 'PRUEBA-COP-004'),
        ('99020005', 'PRUEBA-COP-005')
)
INSERT INTO sis_god."ODONTOLOGO" (id_empleado, numero_colegiatura)
SELECT (SELECT e.id_empleado FROM sis_god."EMPLEADO" e
        WHERE e.tipo_documento = 'DNI' AND e.numero_documento = d.documento),
    d.colegiatura
FROM datos d;

COMMIT;

BEGIN;

INSERT INTO sis_god."ESPECIALIDAD" (nombre, descripcion) VALUES
    ('Odontología general', 'Prevención y atención odontológica general.'),
    ('Ortodoncia', 'Evaluación y tratamiento de la posición dental.'),
    ('Endodoncia', 'Tratamiento de la pulpa y conductos dentales.'),
    ('Periodoncia', 'Atención de encías y tejidos de soporte.'),
    ('Rehabilitación oral', 'Restauración de la función y estructura dental.');

WITH datos (colegiatura, especialidad) AS (
    VALUES
        ('PRUEBA-COP-001', 'Odontología general'),
        ('PRUEBA-COP-002', 'Ortodoncia'),
        ('PRUEBA-COP-003', 'Endodoncia'),
        ('PRUEBA-COP-004', 'Periodoncia'),
        ('PRUEBA-COP-005', 'Rehabilitación oral')
)
INSERT INTO sis_god."ODONTOLOGO_ESPECIALIDAD" (id_empleado, id_especialidad)
SELECT (SELECT o.id_empleado FROM sis_god."ODONTOLOGO" o
        WHERE o.numero_colegiatura = d.colegiatura),
    (SELECT e.id_especialidad FROM sis_god."ESPECIALIDAD" e
        WHERE e.nombre = d.especialidad)
FROM datos d;

COMMIT;

-- Turno 04 - Esaul
BEGIN;

INSERT INTO sis_god."CONSULTORIO" (numero, ubicacion) VALUES
    ('A-01', 'Primer piso'),
    ('A-02', 'Primer piso'),
    ('A-03', 'Primer piso'),
    ('A-04', 'Primer piso'),
    ('A-05', 'Primer piso');

WITH datos (documento, colegiatura, consultorio) AS (
    VALUES
        ('99010001', 'PRUEBA-COP-001', 'A-01'),
        ('99010002', 'PRUEBA-COP-002', 'A-02'),
        ('99010003', 'PRUEBA-COP-003', 'A-03'),
        ('99010004', 'PRUEBA-COP-004', 'A-04'),
        ('99010005', 'PRUEBA-COP-005', 'A-05')
)
INSERT INTO sis_god."CITA" (fecha, hora_inicio, hora_fin, motivo,
    id_paciente, id_odontologo, id_consultorio)
SELECT DATE '2026-11-02', TIME '09:00', TIME '09:30', 'Evaluación inicial',
    (SELECT p.id_paciente FROM sis_god."PACIENTE" p
        WHERE p.tipo_documento = 'DNI' AND p.numero_documento = d.documento),
    (SELECT o.id_empleado FROM sis_god."ODONTOLOGO" o
        WHERE o.numero_colegiatura = d.colegiatura),
    (SELECT c.id_consultorio FROM sis_god."CONSULTORIO" c
        WHERE c.numero = d.consultorio)
FROM datos d;

COMMIT;
