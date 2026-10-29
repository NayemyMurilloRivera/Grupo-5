
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

