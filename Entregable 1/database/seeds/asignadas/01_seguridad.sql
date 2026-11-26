-- Cargar una vez después de DATOS_BASE.sql para instalar la matriz inicial de acceso.
-- Las cuentas de demostración se crean aparte con una contraseña elegida para cada titular.
BEGIN;

WITH operaciones(recurso, accion) AS (
    VALUES
        ('pacientes','leer'), ('pacientes','crear'), ('pacientes','actualizar'),
        ('historias','leer'), ('historias','actualizar'), ('antecedentes','crear'), ('contactos','eliminar'),
        ('empleados','leer'), ('empleados','crear'), ('empleados','actualizar'), ('odontologos','leer'),
        ('tratamientos','leer'), ('tratamientos','crear'), ('tratamientos','actualizar'),
        ('planes','leer'), ('planes','crear'), ('planes','actualizar'),
        ('presupuestos','crear'), ('presupuestos','aceptar'), ('presupuestos','revisar'),
        ('obligaciones','leer'), ('metodos_pago','leer'), ('metodos_pago','crear'),
        ('pagos','leer'), ('pagos','crear'), ('comprobantes','leer'),
        ('estado_cuenta','leer'), ('reportes','leer')
), accesos(rol, recurso, accion, alcance) AS (
    SELECT 'Administrador', recurso, accion, 'global' FROM operaciones
    UNION ALL SELECT * FROM (VALUES
        ('Recepcionista','pacientes','leer','global'),
        ('Recepcionista','pacientes','crear','global'),
        ('Recepcionista','pacientes','actualizar','global'),
        ('Recepcionista','contactos','eliminar','global'),
        ('Recepcionista','planes','leer','global'),
        ('Recepcionista','metodos_pago','leer','global'),
        ('Recepcionista','pagos','leer','global'),
        ('Recepcionista','pagos','crear','global'),
        ('Recepcionista','comprobantes','leer','global'),
        ('Recepcionista','estado_cuenta','leer','global'),
        ('Recepcionista','reportes','leer','global'),
        ('Odontólogo','pacientes','leer','asignado'),
        ('Odontólogo','historias','leer','asignado'),
        ('Odontólogo','historias','actualizar','asignado'),
        ('Odontólogo','antecedentes','crear','asignado'),
        ('Odontólogo','tratamientos','leer','global'),
        ('Odontólogo','tratamientos','crear','global'),
        ('Odontólogo','tratamientos','actualizar','global'),
        ('Odontólogo','planes','leer','asignado'),
        ('Odontólogo','planes','crear','asignado'),
        ('Odontólogo','planes','actualizar','asignado'),
        ('Odontólogo','presupuestos','crear','asignado'),
        ('Odontólogo','presupuestos','aceptar','asignado'),
        ('Odontólogo','obligaciones','leer','asignado'),
        ('Asistente dental','tratamientos','leer','global'),
        ('Paciente','pacientes','leer','propio'),
        ('Paciente','historias','leer','propio'),
        ('Paciente','planes','leer','propio'),
        ('Paciente','presupuestos','aceptar','propio'),
        ('Paciente','obligaciones','leer','propio'),
        ('Paciente','pagos','leer','propio'),
        ('Paciente','comprobantes','leer','propio'),
        ('Paciente','estado_cuenta','leer','propio')
    ) AS a(rol, recurso, accion, alcance)
), permisos AS (
    INSERT INTO sis_god."PERMISO" (recurso, accion, alcance)
        SELECT DISTINCT recurso, accion, alcance FROM accesos
    ON CONFLICT (recurso, accion, alcance) DO UPDATE SET alcance = EXCLUDED.alcance
    RETURNING id_permiso, recurso, accion, alcance
)
INSERT INTO sis_god."ROL_PERMISO" (id_rol, id_permiso)
    SELECT r.id_rol, p.id_permiso
    FROM accesos a
    JOIN sis_god."ROL" r ON r.nombre = a.rol
    JOIN permisos p USING (recurso, accion, alcance)
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

COMMIT;
