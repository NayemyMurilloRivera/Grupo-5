-- Ejecutar en una base de pruebas con el esquema, DATOS_BASE, 03_personal.sql y su semilla.
-- Cada caso usa un subbloque: una excepción esperada revierte solo ese caso. Todo se revierte al final.
BEGIN;
DO $$
DECLARE
    empleado bigint;
    empleado_2 bigint;
    tratamiento bigint;
    historia bigint;
    plan bigint;
    precio numeric;
BEGIN
    -- 1. Un empleado sin subtipo se rechaza al comprobar el disparador diferido.
    BEGIN
        INSERT INTO sis_god."EMPLEADO" (tipo_documento, numero_documento, nombres, apellidos, telefono)
            VALUES ('DNI', 'SQL-SIN-SUBTIPO', 'Sin', 'Subtipo', '900999001');
        SET CONSTRAINTS ALL IMMEDIATE;
        RAISE EXCEPTION 'Se aceptó un empleado sin subtipo';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    SET CONSTRAINTS ALL DEFERRED;

    -- 2. Un empleado con los dos subtipos se rechaza.
    BEGIN
        INSERT INTO sis_god."EMPLEADO" (tipo_documento, numero_documento, nombres, apellidos, telefono)
            VALUES ('DNI', 'SQL-DOS-SUBTIPOS', 'Dos', 'Subtipos', '900999002') RETURNING id_empleado INTO empleado;
        INSERT INTO sis_god."ODONTOLOGO" (id_empleado, numero_colegiatura) VALUES (empleado, 'SQL-COP-DOBLE');
        INSERT INTO sis_god."PERSONAL_APOYO" (id_empleado, cargo) VALUES (empleado, 'Recepcionista');
        SET CONSTRAINTS ALL IMMEDIATE;
        RAISE EXCEPTION 'Se aceptó un empleado con dos subtipos';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    SET CONSTRAINTS ALL DEFERRED;

    -- 3. Alta válida: el subtipo usa el mismo identificador que EMPLEADO.
    INSERT INTO sis_god."EMPLEADO" (tipo_documento, numero_documento, nombres, apellidos, telefono)
        VALUES ('DNI', 'SQL-ODONTOLOGO', 'Prueba', 'Odontólogo', '900999003') RETURNING id_empleado INTO empleado;
    INSERT INTO sis_god."ODONTOLOGO" (id_empleado, numero_colegiatura) VALUES (empleado, 'SQL-COP-001');
    INSERT INTO sis_god."EMPLEADO" (tipo_documento, numero_documento, nombres, apellidos, telefono)
        VALUES ('DNI', 'SQL-APOYO', 'Prueba', 'Apoyo', '900999004') RETURNING id_empleado INTO empleado_2;
    INSERT INTO sis_god."PERSONAL_APOYO" (id_empleado, cargo) VALUES (empleado_2, 'Asistente dental');
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;

    -- 4. Colegiatura duplicada, documento duplicado, subtipo de un empleado inexistente y estado inválido.
    BEGIN
        INSERT INTO sis_god."EMPLEADO" (tipo_documento, numero_documento, nombres, apellidos, telefono)
            VALUES ('DNI', 'SQL-COLEGIATURA', 'Otra', 'Colegiatura', '900999005') RETURNING id_empleado INTO empleado_2;
        INSERT INTO sis_god."ODONTOLOGO" (id_empleado, numero_colegiatura) VALUES (empleado_2, 'SQL-COP-001');
        RAISE EXCEPTION 'Se aceptó una colegiatura duplicada';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO sis_god."EMPLEADO" (tipo_documento, numero_documento, nombres, apellidos, telefono)
            VALUES ('DNI', 'SQL-ODONTOLOGO', 'Documento', 'Repetido', '900999006');
        RAISE EXCEPTION 'Se aceptó un documento duplicado';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO sis_god."PERSONAL_APOYO" (id_empleado, cargo) VALUES (9223372036854775807, 'Sin titular');
        SET CONSTRAINTS ALL IMMEDIATE;
        RAISE EXCEPTION 'Se aceptó un subtipo sin empleado';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    SET CONSTRAINTS ALL DEFERRED;
    BEGIN
        UPDATE sis_god."EMPLEADO" SET estado = 'suspendido' WHERE id_empleado = empleado;
        RAISE EXCEPTION 'Se aceptó un estado inválido';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 5. Textos vacíos (CHECK agregados en 03_personal.sql).
    BEGIN
        UPDATE sis_god."ODONTOLOGO" SET numero_colegiatura = '   ' WHERE id_empleado = empleado;
        RAISE EXCEPTION 'Se aceptó una colegiatura vacía';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE sis_god."EMPLEADO" SET nombres = '' WHERE id_empleado = empleado;
        RAISE EXCEPTION 'Se aceptó un nombre vacío';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 6. Catálogo: precio negativo y nombre repetido con otra capitalización.
    BEGIN
        INSERT INTO sis_god."TRATAMIENTO" (nombre, precio_referencial) VALUES ('SQL precio negativo', -1);
        RAISE EXCEPTION 'Se aceptó un precio negativo';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO sis_god."TRATAMIENTO" (nombre, precio_referencial) VALUES ('SQL Tratamiento', 100)
        RETURNING id_tratamiento INTO tratamiento;
    BEGIN
        INSERT INTO sis_god."TRATAMIENTO" (nombre, precio_referencial) VALUES ('  sql tratamiento ', 90);
        RAISE EXCEPTION 'Se aceptó un tratamiento duplicado';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    -- 7. Cambiar el precio referencial no altera el precio acordado de un plan existente.
    SELECT id_historia INTO STRICT historia FROM sis_god."HISTORIA_CLINICA" ORDER BY id_historia LIMIT 1;
    INSERT INTO sis_god."PLAN_TRATAMIENTO" (fecha_creacion, id_historia, id_odontologo)
        VALUES (CURRENT_DATE, historia, empleado) RETURNING id_plan INTO plan;
    INSERT INTO sis_god."DETALLE_PLAN" (orden, cantidad, precio_acordado, id_plan, id_tratamiento)
        VALUES (1, 1, 100, plan, tratamiento);
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;
    UPDATE sis_god."TRATAMIENTO" SET precio_referencial = 250 WHERE id_tratamiento = tratamiento;
    SELECT precio_acordado INTO STRICT precio FROM sis_god."DETALLE_PLAN" WHERE id_plan = plan;
    IF precio <> 100 THEN
        RAISE EXCEPTION 'El cambio de catálogo modificó el precio acordado: %', precio;
    END IF;

    -- 8. La semilla deja personal de apoyo y un odontólogo inactivo que no se ofrece para planes.
    IF (SELECT count(*) FROM sis_god."PERSONAL_APOYO") < 2 THEN
        RAISE EXCEPTION 'La semilla no dejó personal de apoyo';
    END IF;
    IF EXISTS (SELECT 1 FROM sis_god."ODONTOLOGO" o JOIN sis_god."EMPLEADO" e USING (id_empleado)
            WHERE o.numero_colegiatura = 'PRUEBA-COP-006' AND e.estado = 'activo') THEN
        RAISE EXCEPTION 'El odontólogo de prueba inactivo figura como activo';
    END IF;

    RAISE NOTICE 'OK: subtipo exclusivo, identificador compartido, unicidad, CHECK y precio acordado conservado.';
END;
$$;
ROLLBACK;
