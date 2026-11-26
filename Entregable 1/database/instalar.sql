-- Instalador reducido de SIS-GOD: recrea en una base VACÍA las 20 tablas del alcance activo,
-- los ajustes de esquema de cada módulo y sus datos iniciales. No depende de los módulos aplazados
-- (citas, agenda, especialidades, inventario, etc.) ni crea tablas fuera de contracts/scope.json.
--
-- Uso, desde la carpeta Entregable 1 y con una base vacía creada de antemano:
--   psql "postgresql://USUARIO@HOST:PUERTO/sis_god_prueba" -v ON_ERROR_STOP=1 -f database/instalar.sql
-- No ejecutar sobre la base compartida de Supabase: ya está instalada y sus cambios se coordinan aparte.
--
-- Cada archivo incluido conserva a su autor; este instalador solo fija el orden de dependencia.
-- Un archivo asignado que aún esté vacío se incluye sin efecto hasta que su responsable lo complete.
\set ON_ERROR_STOP on
\set QUIET on

-- 1. Esquema común (CREATE SCHEMA falla si sis_god ya existe, lo que evita reinstalar sobre datos).
\ir base/SIS_GOD_BASE_20.sql

-- 2. Ajustes de esquema por módulo, en el orden de las dependencias entre tablas.
\ir ddl/asignados/01_seguridad.sql
\ir ddl/asignados/02_pacientes.sql
\ir ddl/asignados/03_personal.sql
\ir ddl/asignados/04_planes.sql
\ir ddl/asignados/05_pagos.sql

-- 3. Datos ficticios comunes y semillas de cada módulo.
\ir base/DATOS_BASE.sql
\ir seeds/asignadas/01_seguridad.sql
\ir seeds/asignadas/02_pacientes.sql
\ir seeds/asignadas/03_personal.sql
\ir seeds/asignadas/04_planes.sql
\ir seeds/asignadas/05_pagos.sql

-- 4. Comprobación final: exactamente las 20 tablas y 21 FK internas del alcance.
DO $$
DECLARE
    tablas integer;
    fks integer;
BEGIN
    SELECT count(*) INTO tablas FROM pg_tables WHERE schemaname = 'sis_god';
    SELECT count(*) INTO fks FROM pg_constraint WHERE contype = 'f' AND connamespace = 'sis_god'::regnamespace;
    IF tablas <> 20 OR fks <> 21 THEN
        RAISE EXCEPTION 'Instalación incompleta: % tablas y % FK (se esperaban 20 y 21)', tablas, fks;
    END IF;
END;
$$;
\echo 'SIS-GOD instalado: 20 tablas, 21 FK, ajustes de módulos y datos iniciales.'
