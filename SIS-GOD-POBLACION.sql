
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

