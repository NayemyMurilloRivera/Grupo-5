-- Base común reutilizada del DDL histórico SIS-GOD; no atribuye aportes nuevos.
-- Instalar una vez en una base vacía. Los archivos asignados permanecen vacíos.
BEGIN;
CREATE SCHEMA sis_god;

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

CREATE TABLE sis_god."TRATAMIENTO" (
    id_tratamiento BIGINT GENERATED ALWAYS AS IDENTITY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio_referencial NUMERIC(12,2) NOT NULL,
    CONSTRAINT pk_tratamiento PRIMARY KEY (id_tratamiento),
    CONSTRAINT ck_tratamiento_precio CHECK (precio_referencial >= 0)
);

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

CREATE TABLE sis_god."ROL_PERMISO" (
    id_rolpermiso BIGINT GENERATED ALWAYS AS IDENTITY,
    id_rol BIGINT NOT NULL,
    id_permiso BIGINT NOT NULL,
    CONSTRAINT pk_rol_permiso PRIMARY KEY (id_rolpermiso),
    CONSTRAINT uq_rol_permiso UNIQUE (id_rol, id_permiso),
    CONSTRAINT fk_rp_rol FOREIGN KEY (id_rol) REFERENCES sis_god."ROL" (id_rol) ON DELETE CASCADE,
    CONSTRAINT fk_rp_permiso FOREIGN KEY (id_permiso) REFERENCES sis_god."PERMISO" (id_permiso) ON DELETE CASCADE
);

CREATE TABLE sis_god."PLAN_TRATAMIENTO" (
    id_plan BIGINT GENERATED ALWAYS AS IDENTITY,
    fecha_creacion DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'propuesto',
    observaciones TEXT,
    id_historia BIGINT NOT NULL,
    id_odontologo BIGINT NOT NULL,
    CONSTRAINT pk_plan_tratamiento PRIMARY KEY (id_plan),
    CONSTRAINT fk_plan_historia FOREIGN KEY (id_historia) REFERENCES sis_god."HISTORIA_CLINICA" (id_historia),
    CONSTRAINT fk_plan_odontologo FOREIGN KEY (id_odontologo) REFERENCES sis_god."ODONTOLOGO" (id_empleado),
    CONSTRAINT ck_plan_estado CHECK (estado IN ('propuesto', 'en_curso', 'finalizado', 'cancelado'))
);

CREATE TABLE sis_god."DETALLE_PLAN" (
    id_detalleplan BIGINT GENERATED ALWAYS AS IDENTITY,
    orden INTEGER NOT NULL,
    cantidad NUMERIC(12,3) NOT NULL,
    precio_acordado NUMERIC(12,2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'propuesto',
    observaciones TEXT,
    id_plan BIGINT NOT NULL,
    id_tratamiento BIGINT NOT NULL,
    CONSTRAINT pk_detalle_plan PRIMARY KEY (id_detalleplan),
    CONSTRAINT uq_detalle_plan_orden UNIQUE (id_plan, orden),
    CONSTRAINT fk_dp_plan FOREIGN KEY (id_plan) REFERENCES sis_god."PLAN_TRATAMIENTO" (id_plan),
    CONSTRAINT fk_dp_tratamiento FOREIGN KEY (id_tratamiento) REFERENCES sis_god."TRATAMIENTO" (id_tratamiento),
    CONSTRAINT ck_dp_orden CHECK (orden > 0),
    CONSTRAINT ck_dp_cantidad CHECK (cantidad > 0),
    CONSTRAINT ck_dp_precio CHECK (precio_acordado >= 0),
    CONSTRAINT ck_dp_estado CHECK (estado IN ('propuesto', 'en_curso', 'finalizado', 'cancelado'))
);

CREATE TABLE sis_god."PRESUPUESTO" (
    id_presupuesto BIGINT GENERATED ALWAYS AS IDENTITY,
    fecha_emision DATE NOT NULL,
    importe NUMERIC(12,2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    id_plan BIGINT NOT NULL,
    CONSTRAINT pk_presupuesto PRIMARY KEY (id_presupuesto),
    CONSTRAINT fk_presupuesto_plan FOREIGN KEY (id_plan) REFERENCES sis_god."PLAN_TRATAMIENTO" (id_plan),
    CONSTRAINT ck_presupuesto_estado CHECK (estado IN ('pendiente', 'aceptado', 'rechazado', 'sustituido')),
    CONSTRAINT ck_presupuesto_importe CHECK (importe >= 0 AND (estado <> 'aceptado' OR importe > 0))
);

CREATE TABLE sis_god."OBLIGACION" (
    id_obligacion BIGINT GENERATED ALWAYS AS IDENTITY,
    fecha_emision DATE NOT NULL,
    importe NUMERIC(12,2) NOT NULL,
    fecha_vencimiento DATE,
    id_presupuesto BIGINT NOT NULL,
    CONSTRAINT pk_obligacion PRIMARY KEY (id_obligacion),
    CONSTRAINT uq_obligacion_presupuesto UNIQUE (id_presupuesto),
    CONSTRAINT fk_obligacion_presupuesto FOREIGN KEY (id_presupuesto) REFERENCES sis_god."PRESUPUESTO" (id_presupuesto),
    CONSTRAINT ck_obligacion_importe CHECK (importe > 0),
    CONSTRAINT ck_obligacion_vencimiento CHECK (fecha_vencimiento >= fecha_emision)
);

CREATE TABLE sis_god."PAGO" (
    id_pago BIGINT GENERATED ALWAYS AS IDENTITY,
    fecha_hora TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    importe NUMERIC(12,2) NOT NULL,
    referencia VARCHAR(100),
    id_obligacion BIGINT NOT NULL,
    id_metodopago BIGINT NOT NULL,
    CONSTRAINT pk_pago PRIMARY KEY (id_pago),
    CONSTRAINT fk_pago_obligacion FOREIGN KEY (id_obligacion) REFERENCES sis_god."OBLIGACION" (id_obligacion),
    CONSTRAINT fk_pago_metodo FOREIGN KEY (id_metodopago) REFERENCES sis_god."METODO_PAGO" (id_metodopago),
    CONSTRAINT ck_pago_importe CHECK (importe > 0)
);

CREATE TABLE sis_god."BOLETA" (
    id_boleta BIGINT GENERATED ALWAYS AS IDENTITY,
    serie VARCHAR(10) NOT NULL,
    numero BIGINT NOT NULL,
    fecha_emision DATE NOT NULL,
    nombre_receptor VARCHAR(200),
    documento_receptor VARCHAR(30),
    id_pago BIGINT NOT NULL,
    CONSTRAINT pk_boleta PRIMARY KEY (id_boleta),
    CONSTRAINT uq_boleta_numeracion UNIQUE (serie, numero),
    CONSTRAINT uq_boleta_pago UNIQUE (id_pago),
    CONSTRAINT fk_boleta_pago FOREIGN KEY (id_pago) REFERENCES sis_god."PAGO" (id_pago),
    CONSTRAINT ck_boleta_numero CHECK (numero > 0)
);

CREATE TABLE sis_god."FACTURA" (
    id_factura BIGINT GENERATED ALWAYS AS IDENTITY,
    serie VARCHAR(10) NOT NULL,
    numero BIGINT NOT NULL,
    fecha_emision DATE NOT NULL,
    razon_social_receptor VARCHAR(200) NOT NULL,
    ruc_receptor VARCHAR(11) NOT NULL,
    id_pago BIGINT NOT NULL,
    CONSTRAINT pk_factura PRIMARY KEY (id_factura),
    CONSTRAINT uq_factura_numeracion UNIQUE (serie, numero),
    CONSTRAINT uq_factura_pago UNIQUE (id_pago),
    CONSTRAINT fk_factura_pago FOREIGN KEY (id_pago) REFERENCES sis_god."PAGO" (id_pago),
    CONSTRAINT ck_factura_numero CHECK (numero > 0),
    CONSTRAINT ck_factura_ruc CHECK (ruc_receptor ~ '^[0-9]{11}$')
);

ALTER TABLE sis_god."HISTORIA_CLINICA"
    ADD COLUMN cuestionario_complementario JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT ck_historia_cuestionario_objeto CHECK (jsonb_typeof(cuestionario_complementario) = 'object');

ALTER TABLE sis_god."PRESUPUESTO"
    ADD COLUMN id_usuario_revisor BIGINT,
    ADD CONSTRAINT fk_presupuesto_revisor FOREIGN KEY (id_usuario_revisor)
        REFERENCES sis_god."USUARIO" (id_usuario) ON DELETE SET NULL;

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

CREATE FUNCTION sis_god.validar_documento_pago() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_fecha DATE;
BEGIN
    -- El bloqueo serializa la emision del mismo pago en READ COMMITTED.
    SELECT fecha_hora::DATE INTO v_fecha FROM sis_god."PAGO"
        WHERE id_pago = NEW.id_pago FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el pago %', NEW.id_pago USING ERRCODE = '23503';
    END IF;
    IF NEW.fecha_emision < v_fecha THEN
        RAISE EXCEPTION 'La emision no puede preceder al pago' USING ERRCODE = '23514';
    END IF;
    IF TG_TABLE_NAME = 'BOLETA' THEN
        IF EXISTS (SELECT 1 FROM sis_god."FACTURA" WHERE id_pago = NEW.id_pago) THEN
            RAISE EXCEPTION 'El pago % ya tiene FACTURA', NEW.id_pago USING ERRCODE = '23514';
        END IF;
    ELSE
        IF EXISTS (SELECT 1 FROM sis_god."BOLETA" WHERE id_pago = NEW.id_pago) THEN
            RAISE EXCEPTION 'El pago % ya tiene BOLETA', NEW.id_pago USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER ct_paciente_historia
AFTER INSERT OR UPDATE OR DELETE ON sis_god."PACIENTE"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sis_god.validar_paciente_historia();

CREATE CONSTRAINT TRIGGER ct_historia_paciente
AFTER INSERT OR UPDATE OR DELETE ON sis_god."HISTORIA_CLINICA"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sis_god.validar_paciente_historia();

CREATE CONSTRAINT TRIGGER ct_empleado_subtipo
AFTER INSERT OR UPDATE OR DELETE ON sis_god."EMPLEADO"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sis_god.validar_subtipo_empleado();

CREATE CONSTRAINT TRIGGER ct_odontologo_subtipo
AFTER INSERT OR UPDATE OR DELETE ON sis_god."ODONTOLOGO"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sis_god.validar_subtipo_empleado();

CREATE CONSTRAINT TRIGGER ct_apoyo_subtipo
AFTER INSERT OR UPDATE OR DELETE ON sis_god."PERSONAL_APOYO"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sis_god.validar_subtipo_empleado();

CREATE CONSTRAINT TRIGGER ct_plan_detalles
AFTER INSERT OR UPDATE OR DELETE ON sis_god."PLAN_TRATAMIENTO"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION
sis_god.validar_minimo_hijos('PLAN_TRATAMIENTO', 'DETALLE_PLAN', 'id_plan', '1');

CREATE CONSTRAINT TRIGGER ct_detalle_plan_minimo
AFTER INSERT OR UPDATE OR DELETE ON sis_god."DETALLE_PLAN"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION
sis_god.validar_minimo_hijos('PLAN_TRATAMIENTO', 'DETALLE_PLAN', 'id_plan', '1');

CREATE TRIGGER tr_boleta_pago BEFORE INSERT OR UPDATE ON sis_god."BOLETA"
FOR EACH ROW EXECUTE FUNCTION sis_god.validar_documento_pago();

CREATE TRIGGER tr_factura_pago BEFORE INSERT OR UPDATE ON sis_god."FACTURA"
FOR EACH ROW EXECUTE FUNCTION sis_god.validar_documento_pago();

CREATE UNIQUE INDEX uq_presupuesto_aceptado ON sis_god."PRESUPUESTO" (id_plan) WHERE estado = 'aceptado';

COMMIT;
