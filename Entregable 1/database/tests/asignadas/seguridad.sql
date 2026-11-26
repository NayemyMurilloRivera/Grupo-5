-- Ejecutar en una base de pruebas con el esquema, DATOS_BASE y el aporte de seguridad.
-- Los datos de esta prueba se revierten al terminar.
BEGIN;
DO $$
DECLARE
    rol_admin bigint;
    rol_temporal bigint;
    permiso_temporal bigint;
    empleado bigint;
    paciente bigint;
    paciente_2 bigint;
    usuario bigint;
BEGIN
    SELECT id_rol INTO STRICT rol_admin FROM sis_god."ROL" WHERE nombre = 'Administrador';
    SELECT id_empleado INTO STRICT empleado FROM sis_god."EMPLEADO"
        WHERE tipo_documento = 'DNI' AND numero_documento = '99020001';
    SELECT id_paciente INTO STRICT paciente FROM sis_god."PACIENTE"
        WHERE tipo_documento = 'DNI' AND numero_documento = '99010001';
    SELECT id_paciente INTO STRICT paciente_2 FROM sis_god."PACIENTE"
        WHERE tipo_documento = 'DNI' AND numero_documento = '99010002';

    BEGIN
        INSERT INTO sis_god."USUARIO" (nombre_acceso, correo, credencial_acceso, id_rol, id_empleado, id_paciente)
            VALUES ('sql-dos-titulares', 'sql-dos@example.invalid', 'fixture-inerte', rol_admin, empleado, paciente);
        RAISE EXCEPTION 'Se aceptaron dos titulares';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO sis_god."USUARIO" (nombre_acceso, correo, credencial_acceso, id_rol)
            VALUES ('sql-sin-titular', 'sql-sin@example.invalid', 'fixture-inerte', rol_admin);
        RAISE EXCEPTION 'Se aceptó una cuenta sin titular';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO sis_god."USUARIO" (nombre_acceso, correo, credencial_acceso, id_rol, id_empleado)
            VALUES ('sql-titular-ajeno', 'sql-ajeno@example.invalid', 'fixture-inerte', rol_admin, 9223372036854775807);
        RAISE EXCEPTION 'Se aceptó un titular inexistente';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    INSERT INTO sis_god."USUARIO" (nombre_acceso, correo, credencial_acceso, id_rol, id_empleado)
        VALUES ('sql-seguridad', 'sql-seguridad@example.invalid', 'fixture-inerte', rol_admin, empleado)
        RETURNING id_usuario INTO usuario;
    BEGIN
        INSERT INTO sis_god."USUARIO" (nombre_acceso, correo, credencial_acceso, id_rol, id_paciente)
            VALUES ('sql-seguridad', 'sql-otro@example.invalid', 'fixture-inerte', rol_admin, paciente);
        RAISE EXCEPTION 'Se aceptó el nombre de acceso duplicado';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO sis_god."USUARIO" (nombre_acceso, correo, credencial_acceso, id_rol, id_paciente)
            VALUES ('sql-otro', 'SQL-SEGURIDAD@example.invalid', 'fixture-inerte', rol_admin, paciente_2);
        RAISE EXCEPTION 'Se aceptó el correo duplicado con distinta capitalización';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO sis_god."USUARIO" (nombre_acceso, correo, credencial_acceso, id_rol, id_empleado)
            VALUES ('sql-titular-repetido', 'sql-repetido@example.invalid', 'fixture-inerte', rol_admin, empleado);
        RAISE EXCEPTION 'Se aceptó un titular duplicado';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        UPDATE sis_god."USUARIO" SET estado = 'otro' WHERE id_usuario = usuario;
        RAISE EXCEPTION 'Se aceptó un estado inválido';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    INSERT INTO sis_god."ROL" (nombre) VALUES ('SQL prueba cascada') RETURNING id_rol INTO rol_temporal;
    INSERT INTO sis_god."PERMISO" (recurso, accion, alcance)
        VALUES ('sql-prueba', 'leer', 'propio') RETURNING id_permiso INTO permiso_temporal;
    INSERT INTO sis_god."ROL_PERMISO" (id_rol, id_permiso) VALUES (rol_temporal, permiso_temporal);
    DELETE FROM sis_god."ROL" WHERE id_rol = rol_temporal;
    IF EXISTS (SELECT FROM sis_god."ROL_PERMISO" WHERE id_rol = rol_temporal) THEN
        RAISE EXCEPTION 'Falló CASCADE al borrar el rol';
    END IF;
    INSERT INTO sis_god."ROL_PERMISO" (id_rol, id_permiso) VALUES (rol_admin, permiso_temporal);
    DELETE FROM sis_god."PERMISO" WHERE id_permiso = permiso_temporal;
    IF EXISTS (SELECT FROM sis_god."ROL_PERMISO" WHERE id_permiso = permiso_temporal) THEN
        RAISE EXCEPTION 'Falló CASCADE al borrar el permiso';
    END IF;
END;
$$;
ROLLBACK;
