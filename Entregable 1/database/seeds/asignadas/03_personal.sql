-- Datos ficticios del módulo personal. Cargar después de DATOS_BASE.sql y 03_personal.sql.
-- DATOS_BASE.sql solo trae odontólogos; aquí se agrega personal de apoyo para las cuentas de
-- recepción y asistencia, un odontólogo inactivo para comprobar que no se ofrece en los planes
-- y tratamientos adicionales de catálogo. Se puede ejecutar más de una vez sin duplicar filas.
BEGIN;

WITH datos (documento, nombres, apellidos, telefono, estado) AS (
    VALUES
        ('99020006', 'Carmen', 'Quispe Rojas', '900200006', 'activo'),
        ('99020007', 'Jorge', 'Huamán Díaz', '900200007', 'activo'),
        ('99020008', 'Rosa', 'Paredes Lima', '900200008', 'inactivo')
)
INSERT INTO sis_god."EMPLEADO" (tipo_documento, numero_documento, nombres, apellidos, telefono, estado)
SELECT 'DNI', documento, nombres, apellidos, telefono, estado FROM datos
ON CONFLICT (tipo_documento, numero_documento) DO NOTHING;

-- Cada empleado recibe un único subtipo en la misma transacción; el disparador diferido lo comprueba al confirmar.
WITH datos (documento, cargo) AS (
    VALUES ('99020006', 'Recepcionista'), ('99020007', 'Asistente dental')
)
INSERT INTO sis_god."PERSONAL_APOYO" (id_empleado, cargo)
SELECT e.id_empleado, d.cargo FROM datos d
JOIN sis_god."EMPLEADO" e ON e.tipo_documento = 'DNI' AND e.numero_documento = d.documento
ON CONFLICT (id_empleado) DO NOTHING;

INSERT INTO sis_god."ODONTOLOGO" (id_empleado, numero_colegiatura)
SELECT e.id_empleado, 'PRUEBA-COP-006' FROM sis_god."EMPLEADO" e
WHERE e.tipo_documento = 'DNI' AND e.numero_documento = '99020008'
ON CONFLICT (id_empleado) DO NOTHING;

WITH datos (nombre, descripcion, precio) AS (
    VALUES
        ('Endodoncia unirradicular', 'Tratamiento de conducto de una raíz', 350.00),
        ('Exodoncia simple', 'Extracción de una pieza sin cirugía', 150.00),
        ('Blanqueamiento dental', 'Aclaramiento en consultorio', 400.00)
)
INSERT INTO sis_god."TRATAMIENTO" (nombre, descripcion, precio_referencial)
SELECT d.nombre, d.descripcion, d.precio FROM datos d
WHERE NOT EXISTS (SELECT 1 FROM sis_god."TRATAMIENTO" t WHERE lower(btrim(t.nombre)) = lower(d.nombre));

COMMIT;
