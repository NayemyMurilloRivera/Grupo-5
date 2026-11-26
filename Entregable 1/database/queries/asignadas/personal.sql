-- Consultas reales del repositorio de personal (backend/src/infrastructure/database/sql/repositories/personal.repository.ts).
-- Los IDs son BIGINT y en la API viajan como cadenas. Todos los valores se envían parametrizados.
-- El subtipo se obtiene de la fila de ODONTOLOGO o PERSONAL_APOYO que comparte el id_empleado.

-- $1: término literal (nombre, apellido o documento), $2: estado, $3: subtipo ('odontologo' | 'apoyo'),
-- $4: límite, $5: desplazamiento. count(*) OVER () devuelve el total filtrado con la misma lectura.
PREPARE personal_listar_empleados(text, text, text, integer, integer) AS
SELECT e.id_empleado, e.tipo_documento, e.numero_documento, e.nombres, e.apellidos, e.telefono, e.estado,
    CASE WHEN o.id_empleado IS NOT NULL THEN 'odontologo' ELSE 'apoyo' END AS subtipo,
    o.numero_colegiatura, a.cargo, count(*) OVER () AS total
FROM sis_god."EMPLEADO" e
LEFT JOIN sis_god."ODONTOLOGO" o ON o.id_empleado = e.id_empleado
LEFT JOIN sis_god."PERSONAL_APOYO" a ON a.id_empleado = e.id_empleado
WHERE ($1 IS NULL OR strpos(lower(concat_ws(' ', e.nombres, e.apellidos, e.numero_documento)), lower($1)) > 0)
    AND ($2 IS NULL OR e.estado = $2)
    AND ($3 IS NULL OR ($3 = 'odontologo') = (o.id_empleado IS NOT NULL))
ORDER BY e.id_empleado LIMIT $4 OFFSET $5;

-- $1: identificador del empleado. En la modificación se agrega FOR UPDATE OF e para serializar cambios.
PREPARE personal_ficha_empleado(bigint) AS
SELECT e.id_empleado, e.tipo_documento, e.numero_documento, e.nombres, e.apellidos, e.telefono, e.estado,
    CASE WHEN o.id_empleado IS NOT NULL THEN 'odontologo' ELSE 'apoyo' END AS subtipo,
    o.numero_colegiatura, a.cargo
FROM sis_god."EMPLEADO" e
LEFT JOIN sis_god."ODONTOLOGO" o ON o.id_empleado = e.id_empleado
LEFT JOIN sis_god."PERSONAL_APOYO" a ON a.id_empleado = e.id_empleado
WHERE e.id_empleado = $1;

-- Alta: ejecutar en una transacción con el mismo cliente. Primero EMPLEADO y después un solo subtipo
-- con el id devuelto; SET CONSTRAINTS ALL IMMEDIATE adelanta la comprobación diferida del subtipo.
-- $1..$6: tipo_documento, numero_documento, nombres, apellidos, telefono, estado.
PREPARE personal_alta_empleado(text, text, text, text, text, text) AS
INSERT INTO sis_god."EMPLEADO" (tipo_documento, numero_documento, nombres, apellidos, telefono, estado)
VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_empleado;

-- $1: id_empleado devuelto por el alta, $2: número de colegiatura (UNIQUE).
PREPARE personal_alta_odontologo(bigint, text) AS
INSERT INTO sis_god."ODONTOLOGO" (id_empleado, numero_colegiatura) VALUES ($1, $2);

-- $1: id_empleado devuelto por el alta, $2: cargo.
PREPARE personal_alta_apoyo(bigint, text) AS
INSERT INTO sis_god."PERSONAL_APOYO" (id_empleado, cargo) VALUES ($1, $2);

-- $1: id_empleado; $2..$7: campos nuevos o NULL para conservar el valor actual. No toca el subtipo.
PREPARE personal_modificar_empleado(bigint, text, text, text, text, text, text) AS
UPDATE sis_god."EMPLEADO" SET tipo_documento = COALESCE($2, tipo_documento),
    numero_documento = COALESCE($3, numero_documento), nombres = COALESCE($4, nombres),
    apellidos = COALESCE($5, apellidos), telefono = COALESCE($6, telefono), estado = COALESCE($7, estado)
WHERE id_empleado = $1;

-- $1: id_empleado, $2: nueva colegiatura. Solo si el empleado ya es odontólogo.
PREPARE personal_modificar_colegiatura(bigint, text) AS
UPDATE sis_god."ODONTOLOGO" SET numero_colegiatura = $2 WHERE id_empleado = $1;

-- $1: id_empleado, $2: nuevo cargo. Solo si el empleado ya es personal de apoyo.
PREPARE personal_modificar_cargo(bigint, text) AS
UPDATE sis_god."PERSONAL_APOYO" SET cargo = $2 WHERE id_empleado = $1;

-- $1: término literal (nombre, apellido o colegiatura), $2: límite, $3: desplazamiento.
-- Solo odontólogos activos: son los que pueden asignarse a un plan de tratamiento.
PREPARE personal_listar_odontologos(text, integer, integer) AS
SELECT e.id_empleado, e.nombres, e.apellidos, o.numero_colegiatura, e.telefono, count(*) OVER () AS total
FROM sis_god."ODONTOLOGO" o JOIN sis_god."EMPLEADO" e ON e.id_empleado = o.id_empleado
WHERE e.estado = 'activo'
    AND ($1 IS NULL OR strpos(lower(concat_ws(' ', e.nombres, e.apellidos, o.numero_colegiatura)), lower($1)) > 0)
ORDER BY e.apellidos, e.nombres, e.id_empleado LIMIT $2 OFFSET $3;

-- $1: término literal (nombre o descripción), $2: límite, $3: desplazamiento.
PREPARE personal_listar_tratamientos(text, integer, integer) AS
SELECT id_tratamiento, nombre, descripcion, precio_referencial, count(*) OVER () AS total
FROM sis_god."TRATAMIENTO"
WHERE ($1 IS NULL OR strpos(lower(concat_ws(' ', nombre, descripcion)), lower($1)) > 0)
ORDER BY nombre, id_tratamiento LIMIT $2 OFFSET $3;

-- $1: nombre, $2: descripción o NULL, $3: precio referencial (CHECK >= 0).
PREPARE personal_alta_tratamiento(text, text, numeric) AS
INSERT INTO sis_god."TRATAMIENTO" (nombre, descripcion, precio_referencial)
VALUES ($1, $2, $3) RETURNING id_tratamiento, nombre, descripcion, precio_referencial;

-- $1: id_tratamiento, $2: nombre o NULL, $3: TRUE si se envía descripción, $4: descripción, $5: precio o NULL.
-- Cambia solo el catálogo; DETALLE_PLAN.precio_acordado de los planes existentes no se modifica.
PREPARE personal_modificar_tratamiento(bigint, text, boolean, text, numeric) AS
UPDATE sis_god."TRATAMIENTO" SET nombre = COALESCE($2, nombre),
    descripcion = CASE WHEN $3 THEN $4 ELSE descripcion END,
    precio_referencial = COALESCE($5, precio_referencial)
WHERE id_tratamiento = $1 RETURNING id_tratamiento, nombre, descripcion, precio_referencial;
