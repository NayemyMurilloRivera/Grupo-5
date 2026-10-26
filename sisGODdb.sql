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


BEGIN;
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
