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

BEGIN;
CREATE TABLE sis_god."METODO_PAGO" (
    id_metodopago BIGINT GENERATED ALWAYS AS IDENTITY,
    nombre VARCHAR(60) NOT NULL,
    CONSTRAINT pk_metodo_pago PRIMARY KEY (id_metodopago),
    CONSTRAINT uq_metodo_pago_nombre UNIQUE (nombre)
);

CREATE TABLE sis_god."HISTORIA_CLINICA" (
    id_historia BIGINT GENERATED ALWAYS AS IDENTITY,
    fecha_apertura DATE NOT NULL,
    observaciones_generales TEXT,
    id_paciente BIGINT NOT NULL,
    CONSTRAINT pk_historia_clinica PRIMARY KEY (id_historia),
    CONSTRAINT uq_historia_paciente UNIQUE (id_paciente),
    CONSTRAINT fk_historia_paciente FOREIGN KEY (id_paciente)
        REFERENCES sis_god."PACIENTE" (id_paciente) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE sis_god."CONTACTO" (
    id_contacto BIGINT GENERATED ALWAYS AS IDENTITY,
    nombre VARCHAR(150) NOT NULL,
    parentesco VARCHAR(50) NOT NULL,
    telefono VARCHAR(25) NOT NULL,
    id_paciente BIGINT NOT NULL,
    CONSTRAINT pk_contacto PRIMARY KEY (id_contacto),
    CONSTRAINT fk_contacto_paciente FOREIGN KEY (id_paciente) REFERENCES sis_god."PACIENTE" (id_paciente)
);

CREATE TABLE sis_god."ANTECEDENTE" (
    id_antecedente BIGINT GENERATED ALWAYS AS IDENTITY,
    tipo VARCHAR(60) NOT NULL,
    descripcion TEXT NOT NULL,
    fecha_registro DATE NOT NULL,
    id_historia BIGINT NOT NULL,
    CONSTRAINT pk_antecedente PRIMARY KEY (id_antecedente),
    CONSTRAINT fk_antecedente_historia FOREIGN KEY (id_historia) REFERENCES sis_god."HISTORIA_CLINICA" (id_historia)
);

-- FK y UNIQUE fijan el maximo 1:1; el trigger exige la historia del paciente.
CREATE FUNCTION sis_god.validar_paciente_historia() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT;
BEGIN
    FOR v_id IN SELECT DISTINCT x FROM unnest(ARRAY[
        (to_jsonb(NEW)->>'id_paciente')::BIGINT,
        (to_jsonb(OLD)->>'id_paciente')::BIGINT]) AS x WHERE x IS NOT NULL
    LOOP
        IF EXISTS (SELECT 1 FROM sis_god."PACIENTE" WHERE id_paciente = v_id)
           AND NOT EXISTS (SELECT 1 FROM sis_god."HISTORIA_CLINICA" WHERE id_paciente = v_id) THEN
            RAISE EXCEPTION 'El paciente % requiere exactamente una historia clinica', v_id
                USING ERRCODE = '23514';
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$;
-- Se difiere para registrar paciente e historia en la misma transaccion.
CREATE CONSTRAINT TRIGGER ct_paciente_historia
AFTER INSERT OR UPDATE OR DELETE ON sis_god."PACIENTE"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sis_god.validar_paciente_historia();
CREATE CONSTRAINT TRIGGER ct_historia_paciente
AFTER INSERT OR UPDATE OR DELETE ON sis_god."HISTORIA_CLINICA"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sis_god.validar_paciente_historia();
COMMIT;



BEGIN;
-- Los subtipos reutilizan la PK de EMPLEADO; no generan otro identificador.
CREATE TABLE sis_god."ODONTOLOGO" (
    id_empleado BIGINT NOT NULL,
    numero_colegiatura VARCHAR(30) NOT NULL,
    CONSTRAINT pk_odontologo PRIMARY KEY (id_empleado),
    CONSTRAINT uq_odontologo_colegiatura UNIQUE (numero_colegiatura),
    CONSTRAINT fk_odontologo_empleado FOREIGN KEY (id_empleado)
        REFERENCES sis_god."EMPLEADO" (id_empleado) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE sis_god."PERSONAL_APOYO" (
    id_empleado BIGINT NOT NULL,
    cargo VARCHAR(100) NOT NULL,
    CONSTRAINT pk_personal_apoyo PRIMARY KEY (id_empleado),
    CONSTRAINT fk_apoyo_empleado FOREIGN KEY (id_empleado)
        REFERENCES sis_god."EMPLEADO" (id_empleado) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE sis_god."HORARIO" (
    id_horario BIGINT GENERATED ALWAYS AS IDENTITY,
    dia_semana SMALLINT NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    id_empleado BIGINT NOT NULL,
    CONSTRAINT pk_horario PRIMARY KEY (id_horario),
    CONSTRAINT fk_horario_empleado FOREIGN KEY (id_empleado) REFERENCES sis_god."EMPLEADO" (id_empleado),
    CONSTRAINT ck_horario_dia CHECK (dia_semana BETWEEN 1 AND 7),
    CONSTRAINT ck_horario_intervalo CHECK (hora_inicio < hora_fin)
);

CREATE TABLE sis_god."ODONTOLOGO_ESPECIALIDAD" (
    id_odontologoespecialidad BIGINT GENERATED ALWAYS AS IDENTITY,
    id_empleado BIGINT NOT NULL,
    id_especialidad BIGINT NOT NULL,
    CONSTRAINT pk_odontologo_especialidad PRIMARY KEY (id_odontologoespecialidad),
    CONSTRAINT uq_odontologo_especialidad UNIQUE (id_empleado, id_especialidad),
    CONSTRAINT fk_oe_odontologo FOREIGN KEY (id_empleado) REFERENCES sis_god."ODONTOLOGO" (id_empleado),
    CONSTRAINT fk_oe_especialidad FOREIGN KEY (id_especialidad) REFERENCES sis_god."ESPECIALIDAD" (id_especialidad)
);

-- Especializacion total y excluyente: cada empleado tiene un solo subtipo.
CREATE FUNCTION sis_god.validar_subtipo_empleado() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT; v_cantidad INTEGER;
BEGIN
    FOR v_id IN SELECT DISTINCT x FROM unnest(ARRAY[
        (to_jsonb(NEW)->>'id_empleado')::BIGINT,
        (to_jsonb(OLD)->>'id_empleado')::BIGINT]) AS x WHERE x IS NOT NULL
    LOOP
        PERFORM 1 FROM sis_god."EMPLEADO" WHERE id_empleado = v_id FOR UPDATE;
        IF FOUND THEN
            SELECT (SELECT count(*) FROM sis_god."ODONTOLOGO" WHERE id_empleado = v_id)
                 + (SELECT count(*) FROM sis_god."PERSONAL_APOYO" WHERE id_empleado = v_id)
            INTO v_cantidad;
            IF v_cantidad <> 1 THEN
                RAISE EXCEPTION 'El empleado % requiere un solo subtipo; encontrados: %', v_id, v_cantidad
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER ct_empleado_subtipo
AFTER INSERT OR UPDATE OR DELETE ON sis_god."EMPLEADO"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sis_god.validar_subtipo_empleado();
CREATE CONSTRAINT TRIGGER ct_odontologo_subtipo
AFTER INSERT OR UPDATE OR DELETE ON sis_god."ODONTOLOGO"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sis_god.validar_subtipo_empleado();
CREATE CONSTRAINT TRIGGER ct_apoyo_subtipo
AFTER INSERT OR UPDATE OR DELETE ON sis_god."PERSONAL_APOYO"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sis_god.validar_subtipo_empleado();
COMMIT;



BEGIN;
CREATE TABLE sis_god."USUARIO" (
    id_usuario BIGINT GENERATED ALWAYS AS IDENTITY,
    nombre_acceso VARCHAR(80) NOT NULL,
    correo VARCHAR(254) NOT NULL,
    credencial_acceso TEXT NOT NULL,
    estado VARCHAR(15) NOT NULL DEFAULT 'activo',
    id_rol BIGINT NOT NULL,
    id_empleado BIGINT,
    id_paciente BIGINT,
    CONSTRAINT pk_usuario PRIMARY KEY (id_usuario),
    CONSTRAINT uq_usuario_nombre UNIQUE (nombre_acceso),
    CONSTRAINT uq_usuario_correo UNIQUE (correo),
    CONSTRAINT uq_usuario_empleado UNIQUE (id_empleado),
    CONSTRAINT uq_usuario_paciente UNIQUE (id_paciente),
    CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES sis_god."ROL" (id_rol),
    CONSTRAINT fk_usuario_empleado FOREIGN KEY (id_empleado) REFERENCES sis_god."EMPLEADO" (id_empleado),
    CONSTRAINT fk_usuario_paciente FOREIGN KEY (id_paciente) REFERENCES sis_god."PACIENTE" (id_paciente),
    CONSTRAINT ck_usuario_estado CHECK (estado IN ('activo', 'inactivo')),
    -- Arco obligatorio: la cuenta pertenece a un empleado o a un paciente.
    CONSTRAINT ck_usuario_titular CHECK (
        (id_empleado IS NOT NULL AND id_paciente IS NULL)
        OR (id_empleado IS NULL AND id_paciente IS NOT NULL)
    )
);
COMMENT ON COLUMN sis_god."USUARIO".credencial_acceso IS
    'Guardar un hash de contrasena generado por la aplicacion; nunca texto plano.';

CREATE TABLE sis_god."ROL_PERMISO" (
    id_rolpermiso BIGINT GENERATED ALWAYS AS IDENTITY,
    id_rol BIGINT NOT NULL,
    id_permiso BIGINT NOT NULL,
    CONSTRAINT pk_rol_permiso PRIMARY KEY (id_rolpermiso),
    CONSTRAINT uq_rol_permiso UNIQUE (id_rol, id_permiso),
    CONSTRAINT fk_rp_rol FOREIGN KEY (id_rol) REFERENCES sis_god."ROL" (id_rol),
    CONSTRAINT fk_rp_permiso FOREIGN KEY (id_permiso) REFERENCES sis_god."PERMISO" (id_permiso)
);

CREATE TABLE sis_god."PRODUCTO" (
    id_producto BIGINT GENERATED ALWAYS AS IDENTITY,
    codigo VARCHAR(40) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    unidad_medida VARCHAR(30) NOT NULL,
    stock_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
    id_categoria BIGINT NOT NULL,
    CONSTRAINT pk_producto PRIMARY KEY (id_producto),
    CONSTRAINT uq_producto_codigo UNIQUE (codigo),
    CONSTRAINT fk_producto_categoria FOREIGN KEY (id_categoria) REFERENCES sis_god."CATEGORIA" (id_categoria),
    CONSTRAINT ck_producto_stock_minimo CHECK (stock_minimo >= 0)
);

CREATE TABLE sis_god."COMPRA" (
    id_compra BIGINT GENERATED ALWAYS AS IDENTITY,
    fecha DATE NOT NULL,
    documento_proveedor VARCHAR(60) NOT NULL,
    id_proveedor BIGINT NOT NULL,
    CONSTRAINT pk_compra PRIMARY KEY (id_compra),
    CONSTRAINT uq_compra_documento UNIQUE (id_proveedor, documento_proveedor),
    CONSTRAINT fk_compra_proveedor FOREIGN KEY (id_proveedor) REFERENCES sis_god."PROVEEDOR" (id_proveedor)
);
COMMIT;
