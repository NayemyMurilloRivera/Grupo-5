-- Listado: $1 alcance; $2 paciente titular; $3 empleado asignado; $4 búsqueda;
-- $5 tipo de documento; $6 número de documento; $7 límite; $8 desplazamiento.
-- Los filtros ausentes y los titulares que no correspondan se envían como NULL.
WITH filtered AS (
          SELECT p.id_paciente::text AS id_paciente, p.tipo_documento, p.numero_documento,
  p.nombres, p.apellidos, p.fecha_nacimiento::text AS fecha_nacimiento, p.telefono, p.correo, p.direccion FROM sis_god."PACIENTE" p WHERE ($1::text = 'global'
  OR ($1 = 'propio' AND p.id_paciente = $2::bigint)
  OR ($1 = 'asignado' AND EXISTS (
    SELECT 1 FROM sis_god."HISTORIA_CLINICA" h
    JOIN sis_god."PLAN_TRATAMIENTO" plan USING (id_historia)
    WHERE h.id_paciente = p.id_paciente AND plan.id_odontologo = $3::bigint
  )))
            AND ($4::text IS NULL OR strpos(lower(concat_ws(' ', p.nombres, p.apellidos)), lower($4)) > 0
              OR strpos(lower(p.numero_documento), lower($4)) > 0)
            AND ($5::text IS NULL OR p.tipo_documento = $5)
            AND ($6::text IS NULL OR p.numero_documento = $6)
        ), paged AS (
          SELECT * FROM filtered ORDER BY id_paciente::bigint LIMIT $7 OFFSET $8
        )
        SELECT COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY id_paciente::bigint) FROM paged), '[]'::jsonb) AS items,
          (SELECT count(*)::integer FROM filtered) AS total;

-- Detalle: $1 alcance; $2 paciente titular; $3 empleado asignado; $4 paciente consultado.
SELECT p.id_paciente::text AS id_paciente, p.tipo_documento, p.numero_documento,
  p.nombres, p.apellidos, p.fecha_nacimiento::text AS fecha_nacimiento, p.telefono, p.correo, p.direccion, COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id_contacto', c.id_contacto::text,
            'nombre', c.nombre, 'parentesco', c.parentesco, 'telefono', c.telefono) ORDER BY c.id_contacto)
          FROM sis_god."CONTACTO" c WHERE c.id_paciente = p.id_paciente
        ), '[]'::jsonb) AS contactos
        FROM sis_god."PACIENTE" p WHERE ($1::text = 'global'
  OR ($1 = 'propio' AND p.id_paciente = $2::bigint)
  OR ($1 = 'asignado' AND EXISTS (
    SELECT 1 FROM sis_god."HISTORIA_CLINICA" h
    JOIN sis_god."PLAN_TRATAMIENTO" plan USING (id_historia)
    WHERE h.id_paciente = p.id_paciente AND plan.id_odontologo = $3::bigint
  ))) AND p.id_paciente = $4::bigint;

-- Alta: todas las consultas usan el mismo cliente; ante cualquier error se ejecuta ROLLBACK.
BEGIN;
-- Paciente: $1 tipo_documento, $2 numero_documento, $3 nombres, $4 apellidos,
-- $5 fecha_nacimiento, $6 telefono, $7 correo, $8 direccion.
INSERT INTO sis_god."PACIENTE" (tipo_documento, numero_documento, nombres, apellidos,
          fecha_nacimiento, telefono, correo, direccion)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id_paciente::text, tipo_documento, numero_documento, nombres, apellidos,
          fecha_nacimiento::text, telefono, correo, direccion;
-- Historia: $1 id_paciente devuelto por la inserción anterior.
INSERT INTO sis_god."HISTORIA_CLINICA" (fecha_apertura, id_paciente)
        VALUES (CURRENT_DATE, $1) RETURNING id_historia::text, fecha_apertura::text;
-- Repetir por contacto: $1 nombre, $2 parentesco, $3 telefono, $4 id_paciente.
INSERT INTO sis_god."CONTACTO" (nombre, parentesco, telefono, id_paciente)
          VALUES ($1,$2,$3,$4) RETURNING id_contacto::text, nombre, parentesco, telefono;
-- Repetir por antecedente: $1 tipo, $2 descripcion, $3 fecha_registro, $4 id_historia.
INSERT INTO sis_god."ANTECEDENTE" (tipo, descripcion, fecha_registro, id_historia)
          VALUES ($1,$2,COALESCE($3::date,CURRENT_DATE),$4)
          RETURNING id_antecedente::text, tipo, descripcion, fecha_registro::text;
COMMIT;

-- Modificación: consultas ejecutadas con el mismo cliente y transacción.
BEGIN;
-- Bloqueo: $1 alcance, $2 paciente titular, $3 empleado asignado, $4 paciente consultado.
SELECT p.id_paciente FROM sis_god."PACIENTE" p
        WHERE ($1::text = 'global'
  OR ($1 = 'propio' AND p.id_paciente = $2::bigint)
  OR ($1 = 'asignado' AND EXISTS (
    SELECT 1 FROM sis_god."HISTORIA_CLINICA" h
    JOIN sis_god."PLAN_TRATAMIENTO" plan USING (id_historia)
    WHERE h.id_paciente = p.id_paciente AND plan.id_odontologo = $3::bigint
  ))) AND p.id_paciente=$4::bigint FOR UPDATE OF p;
-- Contactos existentes: $1 paciente, $2 arreglo de identificadores enviados.
SELECT id_contacto FROM sis_god."CONTACTO"
          WHERE id_paciente=$1 AND id_contacto=ANY($2::bigint[]) ORDER BY id_contacto FOR UPDATE;
-- El SET se forma con la lista fija de campos permitidos, con valores parametrizados.
-- Ejemplo para cambiar solo el teléfono: $1 telefono, $2 id_paciente.
UPDATE sis_god."PACIENTE" SET telefono=$1 WHERE id_paciente=$2;
-- Contacto: $1 id_contacto, $2 id_paciente; pares $3/$4, $5/$6 y $7/$8 indican
-- presencia y valor de nombre, parentesco y telefono, respectivamente.
UPDATE sis_god."CONTACTO" SET
            nombre=CASE WHEN $3::boolean THEN $4 ELSE nombre END,
            parentesco=CASE WHEN $5::boolean THEN $6 ELSE parentesco END,
            telefono=CASE WHEN $7::boolean THEN $8 ELSE telefono END
            WHERE id_contacto=$1 AND id_paciente=$2;
-- Los contactos sin id utilizan el INSERT de CONTACTO documentado en el alta.
COMMIT;

-- Baja: bloquear al paciente con la consulta anterior antes de eliminar el contacto.
BEGIN;
SELECT p.id_paciente FROM sis_god."PACIENTE" p
        WHERE ($1::text = 'global'
  OR ($1 = 'propio' AND p.id_paciente = $2::bigint)
  OR ($1 = 'asignado' AND EXISTS (
    SELECT 1 FROM sis_god."HISTORIA_CLINICA" h
    JOIN sis_god."PLAN_TRATAMIENTO" plan USING (id_historia)
    WHERE h.id_paciente = p.id_paciente AND plan.id_odontologo = $3::bigint
  ))) AND p.id_paciente=$4::bigint FOR UPDATE OF p;
-- $1 id_contacto, $2 id_paciente.
DELETE FROM sis_god."CONTACTO"
        WHERE id_contacto=$1 AND id_paciente=$2 RETURNING id_contacto;
COMMIT;

-- Historia: $1 alcance, $2 paciente titular, $3 empleado asignado, $4 paciente consultado.
SELECT h.id_historia::text, h.id_paciente::text, concat_ws(' ', p.nombres, p.apellidos) AS paciente,
          h.fecha_apertura::text, h.observaciones_generales, h.cuestionario_complementario,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('id_antecedente', a.id_antecedente::text,
            'tipo', a.tipo, 'descripcion', a.descripcion, 'fecha_registro', a.fecha_registro::text)
            ORDER BY a.fecha_registro DESC, a.id_antecedente DESC)
            FROM sis_god."ANTECEDENTE" a WHERE a.id_historia=h.id_historia), '[]'::jsonb) AS antecedentes
        FROM sis_god."PACIENTE" p JOIN sis_god."HISTORIA_CLINICA" h USING (id_paciente)
        WHERE ($1::text = 'global'
  OR ($1 = 'propio' AND p.id_paciente = $2::bigint)
  OR ($1 = 'asignado' AND EXISTS (
    SELECT 1 FROM sis_god."HISTORIA_CLINICA" h
    JOIN sis_god."PLAN_TRATAMIENTO" plan USING (id_historia)
    WHERE h.id_paciente = p.id_paciente AND plan.id_odontologo = $3::bigint
  ))) AND p.id_paciente=$4::bigint;

-- Antecedente: los mismos $1 a $4; $5 tipo, $6 descripcion, $7 fecha_registro.
INSERT INTO sis_god."ANTECEDENTE" (tipo, descripcion, fecha_registro, id_historia)
        SELECT $5::text, $6::text, COALESCE($7::date,CURRENT_DATE), h.id_historia
        FROM sis_god."PACIENTE" p JOIN sis_god."HISTORIA_CLINICA" h USING (id_paciente)
        WHERE ($1::text = 'global'
  OR ($1 = 'propio' AND p.id_paciente = $2::bigint)
  OR ($1 = 'asignado' AND EXISTS (
    SELECT 1 FROM sis_god."HISTORIA_CLINICA" h
    JOIN sis_god."PLAN_TRATAMIENTO" plan USING (id_historia)
    WHERE h.id_paciente = p.id_paciente AND plan.id_odontologo = $3::bigint
  ))) AND p.id_paciente=$4::bigint
        RETURNING id_antecedente::text, id_historia::text, tipo, descripcion, fecha_registro::text;
