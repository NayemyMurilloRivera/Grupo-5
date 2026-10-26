-- SIS-GOD - PostgreSQL 17

-- La transaccion evita confirmar una instalacion parcial del turno.
BEGIN;
CREATE SCHEMA sis_god;
COMMENT ON SCHEMA sis_god IS 'SIS-GOD';

CREATE TABLE sis_god."PACIENTE" (
    id_paciente BIGINT GENERATED ALWAYS AS IDENTITY,
    tipo_documento VARCHAR(20) NOT NULL,
    numero_documento VARCHAR(30) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE,
    telefono VARCHAR(25) NOT NULL,
    correo VARCHAR(254),
    direccion VARCHAR(250),
    CONSTRAINT pk_paciente PRIMARY KEY (id_paciente),
    CONSTRAINT uq_paciente_documento UNIQUE (tipo_documento, numero_documento),
    CONSTRAINT ck_paciente_nacimiento CHECK (fecha_nacimiento <= CURRENT_DATE)
);

CREATE TABLE sis_god."EMPLEADO" (
    id_empleado BIGINT GENERATED ALWAYS AS IDENTITY,
    tipo_documento VARCHAR(20) NOT NULL,
    numero_documento VARCHAR(30) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    telefono VARCHAR(25) NOT NULL,
    estado VARCHAR(15) NOT NULL DEFAULT 'activo',
    CONSTRAINT pk_empleado PRIMARY KEY (id_empleado),
    CONSTRAINT uq_empleado_documento UNIQUE (tipo_documento, numero_documento),
    CONSTRAINT ck_empleado_estado CHECK (estado IN ('activo', 'inactivo'))
);

CREATE TABLE sis_god."ROL" (
    id_rol BIGINT GENERATED ALWAYS AS IDENTITY,
    nombre VARCHAR(60) NOT NULL,
    descripcion TEXT,
    CONSTRAINT pk_rol PRIMARY KEY (id_rol),
    CONSTRAINT uq_rol_nombre UNIQUE (nombre)
);

CREATE TABLE sis_god."PERMISO" (
    id_permiso BIGINT GENERATED ALWAYS AS IDENTITY,
    recurso VARCHAR(80) NOT NULL,
    accion VARCHAR(40) NOT NULL,
    alcance VARCHAR(15) NOT NULL,
    CONSTRAINT pk_permiso PRIMARY KEY (id_permiso),
    CONSTRAINT uq_permiso_definicion UNIQUE (recurso, accion, alcance),
    CONSTRAINT ck_permiso_alcance CHECK (alcance IN ('global', 'propio', 'asignado'))
);


CREATE TABLE sis_god."ESPECIALIDAD" (
    id_especialidad BIGINT GENERATED ALWAYS AS IDENTITY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    CONSTRAINT pk_especialidad PRIMARY KEY (id_especialidad),
    CONSTRAINT uq_especialidad_nombre UNIQUE (nombre)
);

CREATE TABLE sis_god."CONSULTORIO" (
    id_consultorio BIGINT GENERATED ALWAYS AS IDENTITY,
    numero VARCHAR(20) NOT NULL,
    ubicacion VARCHAR(150),
    estado VARCHAR(20) NOT NULL DEFAULT 'disponible',
    CONSTRAINT pk_consultorio PRIMARY KEY (id_consultorio),
    CONSTRAINT uq_consultorio_numero UNIQUE (numero),
    CONSTRAINT ck_consultorio_estado CHECK (estado IN ('disponible', 'en_atencion', 'mantenimiento'))
);

CREATE TABLE sis_god."CATEGORIA" (
    id_categoria BIGINT GENERATED ALWAYS AS IDENTITY,
    nombre VARCHAR(80) NOT NULL,
    descripcion TEXT,
    CONSTRAINT pk_categoria PRIMARY KEY (id_categoria),
    CONSTRAINT uq_categoria_nombre UNIQUE (nombre)
);

CREATE TABLE sis_god."PROVEEDOR" (
    id_proveedor BIGINT GENERATED ALWAYS AS IDENTITY,
    ruc VARCHAR(11) NOT NULL,
    razon_social VARCHAR(200) NOT NULL,
    telefono VARCHAR(25) NOT NULL,
    correo VARCHAR(254),
    CONSTRAINT pk_proveedor PRIMARY KEY (id_proveedor),
    CONSTRAINT uq_proveedor_ruc UNIQUE (ruc),
    CONSTRAINT ck_proveedor_ruc CHECK (ruc ~ '^[0-9]{11}$')
);
COMMIT;


INSERT INTO sis_god."ROL" (nombre) VALUES
    ('Administrador'), ('Recepcionista'), ('Odontólogo'),
    ('Asistente dental'), ('Encargado de inventario'), ('Paciente');
COMMIT;



BEGIN;
CREATE TABLE sis_god."DIAGNOSTICO" (
    id_diagnostico BIGINT GENERATED ALWAYS AS IDENTITY,
    codigo VARCHAR(30) NOT NULL,
    descripcion TEXT NOT NULL,
    CONSTRAINT pk_diagnostico PRIMARY KEY (id_diagnostico),
    CONSTRAINT uq_diagnostico_codigo UNIQUE (codigo)
);

CREATE TABLE sis_god."PROCEDIMIENTO" (
    id_procedimiento BIGINT GENERATED ALWAYS AS IDENTITY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    CONSTRAINT pk_procedimiento PRIMARY KEY (id_procedimiento)
);

CREATE TABLE sis_god."TRATAMIENTO" (
    id_tratamiento BIGINT GENERATED ALWAYS AS IDENTITY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio_referencial NUMERIC(12,2) NOT NULL,
    CONSTRAINT pk_tratamiento PRIMARY KEY (id_tratamiento),
    CONSTRAINT ck_tratamiento_precio CHECK (precio_referencial >= 0)
);

-- El codigo FDI es una clave natural; no requiere una secuencia adicional.
CREATE TABLE sis_god."PIEZA_DENTAL" (
    codigo_fdi SMALLINT NOT NULL,
    denominacion VARCHAR(100) NOT NULL,
    CONSTRAINT pk_pieza_dental PRIMARY KEY (codigo_fdi),
    CONSTRAINT ck_pieza_fdi CHECK (
        codigo_fdi BETWEEN 11 AND 18 OR codigo_fdi BETWEEN 21 AND 28
        OR codigo_fdi BETWEEN 31 AND 38 OR codigo_fdi BETWEEN 41 AND 48
    )
);
-- Denticion permanente: cuatro cuadrantes de ocho piezas cada uno.
INSERT INTO sis_god."PIEZA_DENTAL" (codigo_fdi, denominacion)
SELECT (q * 10 + p)::SMALLINT,
    (ARRAY['Incisivo central', 'Incisivo lateral', 'Canino', 'Primer premolar',
           'Segundo premolar', 'Primer molar', 'Segundo molar', 'Tercer molar'])[p]
    || ' - ' || (ARRAY['superior derecho', 'superior izquierdo',
                       'inferior izquierdo', 'inferior derecho'])[q]
FROM generate_series(1,4) AS q CROSS JOIN generate_series(1,8) AS p;

-- Funcion compartida para comprobar los minimos de participacion del MER.
CREATE FUNCTION sis_god.validar_minimo_hijos() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT; v_existe BOOLEAN; v_cantidad BIGINT;
BEGIN
    -- TG_ARGV: tabla padre, tabla hija, columna de enlace y minimo requerido.
    FOR v_id IN SELECT DISTINCT x FROM unnest(ARRAY[
        (to_jsonb(NEW)->>TG_ARGV[2])::BIGINT,
        (to_jsonb(OLD)->>TG_ARGV[2])::BIGINT]) AS x WHERE x IS NOT NULL
    LOOP
        -- %I delimita identificadores; $1 recibe el valor del enlace.
        EXECUTE format('SELECT TRUE FROM sis_god.%I WHERE %I = $1 FOR UPDATE',
            TG_ARGV[0], TG_ARGV[2]) INTO v_existe USING v_id;
        IF v_existe THEN
            EXECUTE format('SELECT count(*) FROM sis_god.%I WHERE %I = $1',
                TG_ARGV[1], TG_ARGV[2]) INTO v_cantidad USING v_id;
            IF v_cantidad < TG_ARGV[3]::INTEGER THEN
                RAISE EXCEPTION '% % requiere al menos % registros en %',
                    TG_ARGV[0], v_id, TG_ARGV[3], TG_ARGV[1] USING ERRCODE = '23514';
            END IF;
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$;
COMMIT;
