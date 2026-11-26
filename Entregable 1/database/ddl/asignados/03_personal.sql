-- Ajustes de esquema del módulo personal. Aplicar una vez después de SIS_GOD_BASE_20.sql.
-- La base común ya define EMPLEADO, ODONTOLOGO, PERSONAL_APOYO y TRATAMIENTO con sus PK/FK,
-- UNIQUE de documento y colegiatura, CHECK de estado y precio, y el disparador diferido
-- validar_subtipo_empleado, que exige exactamente un subtipo por empleado. No se crean tablas.
-- Es idempotente: cada restricción se agrega solo si todavía no existe.
BEGIN;

DO $$
DECLARE
    r record;
BEGIN
    -- NOT NULL acepta cadenas vacías o de espacios; estos CHECK impiden registros sin contenido real.
    FOR r IN SELECT * FROM (VALUES
        ('EMPLEADO', 'ck_empleado_documento_no_vacio', 'btrim(tipo_documento) <> '''' AND btrim(numero_documento) <> '''''),
        ('EMPLEADO', 'ck_empleado_nombre_no_vacio', 'btrim(nombres) <> '''' AND btrim(apellidos) <> '''''),
        ('EMPLEADO', 'ck_empleado_telefono_no_vacio', 'btrim(telefono) <> '''''),
        ('ODONTOLOGO', 'ck_odontologo_colegiatura_no_vacia', 'btrim(numero_colegiatura) <> '''''),
        ('PERSONAL_APOYO', 'ck_apoyo_cargo_no_vacio', 'btrim(cargo) <> '''''),
        ('TRATAMIENTO', 'ck_tratamiento_nombre_no_vacio', 'btrim(nombre) <> ''''')
    ) AS t(tabla, nombre, condicion)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_constraint
                WHERE conname = r.nombre AND connamespace = 'sis_god'::regnamespace) THEN
            EXECUTE format('ALTER TABLE sis_god.%I ADD CONSTRAINT %I CHECK (%s)', r.tabla, r.nombre, r.condicion);
        END IF;
    END LOOP;
END;
$$;

-- El catálogo no debe tener dos tratamientos con el mismo nombre escrito con distinta capitalización
-- o espacios; los planes referencian el tratamiento por id y no dependen de este índice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tratamiento_nombre_normalizado
    ON sis_god."TRATAMIENTO" (lower(btrim(nombre)));

COMMIT;
