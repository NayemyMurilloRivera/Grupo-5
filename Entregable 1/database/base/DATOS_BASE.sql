-- Datos ficticios de base; pacientes/personal reutilizados de la práctica anterior.
-- Cargar una sola vez. No crea credenciales de acceso ni pagos ficticiamente confirmados.
BEGIN;

INSERT INTO sis_god."ROL" (nombre) VALUES
    ('Administrador'), ('Recepcionista'), ('Odontólogo'), ('Asistente dental'), ('Paciente');
INSERT INTO sis_god."METODO_PAGO" (nombre) VALUES
    ('Efectivo'), ('Tarjeta'), ('Transferencia'), ('Billetera digital'), ('Depósito');
INSERT INTO sis_god."TRATAMIENTO" (nombre, descripcion, precio_referencial) VALUES
    ('Evaluación integral','Valoración odontológica',80),
    ('Profilaxis','Limpieza dental',120),
    ('Restauración simple','Restauración de una pieza',180),
    ('Control de seguimiento','Seguimiento del plan',60),
    ('Tratamiento preventivo','Cuidado preventivo',90);


INSERT INTO sis_god."PACIENTE" (tipo_documento, numero_documento,
    nombres, apellidos, fecha_nacimiento, telefono, correo) VALUES
    ('DNI', '99010001', 'Lucía', 'Salazar Ríos', '1998-04-12', '900100001', 'lucia.salazar@example.invalid'),
    ('DNI', '99010002', 'Mateo', 'Vargas León', '1995-08-23', '900100002', 'mateo.vargas@example.invalid'),
    ('DNI', '99010003', 'Camila', 'Torres Vega', '2001-02-07', '900100003', 'camila.torres@example.invalid'),
    ('DNI', '99010004', 'Diego', 'Mendoza Soto', '1987-11-18', '900100004', 'diego.mendoza@example.invalid'),
    ('DNI', '99010005', 'Valeria', 'Castro Luna', '1992-06-30', '900100005', 'valeria.castro@example.invalid');

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




WITH datos (documento, nombre, parentesco, telefono) AS (
    VALUES
        ('99010001', 'Elena Ríos Peña', 'Madre', '900300001'),
        ('99010002', 'Mario Vargas Solís', 'Padre', '900300002'),
        ('99010003', 'Rosa Vega Marín', 'Madre', '900300003'),
        ('99010004', 'Ana Soto Vidal', 'Hermana', '900300004'),
        ('99010005', 'Jorge Castro Paz', 'Hermano', '900300005')
)
INSERT INTO sis_god."CONTACTO" (nombre, parentesco, telefono, id_paciente)
SELECT d.nombre, d.parentesco, d.telefono,
    (SELECT p.id_paciente FROM sis_god."PACIENTE" p
        WHERE p.tipo_documento = 'DNI' AND p.numero_documento = d.documento)
FROM datos d;

WITH datos (documento, tipo, descripcion) AS (
    VALUES
        ('99010001', 'Alergias', 'Paciente refiere alergia a penicilina.'),
        ('99010002', 'Enfermedades', 'Paciente refiere hipertensión en control médico.'),
        ('99010003', 'Medicación', 'Paciente refiere no utilizar medicación habitual.'),
        ('99010004', 'Cirugías', 'Paciente refiere apendicectomía previa.'),
        ('99010005', 'Hábitos', 'Paciente refiere no fumar.')
)
INSERT INTO sis_god."ANTECEDENTE" (tipo, descripcion, fecha_registro, id_historia)
SELECT d.tipo, d.descripcion, DATE '2026-10-29',
    (SELECT h.id_historia FROM sis_god."HISTORIA_CLINICA" h
        JOIN sis_god."PACIENTE" p ON p.id_paciente = h.id_paciente
        WHERE p.tipo_documento = 'DNI' AND p.numero_documento = d.documento)
FROM datos d;



COMMIT;
