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
