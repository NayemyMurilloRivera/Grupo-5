-- Consultas de referencia del repositorio de seguridad. Los IDs son BIGINT y en la API se envían como cadenas.
-- $1: correo. Para buscar por nombre de acceso, usar u.nombre_acceso = $1.
PREPARE seguridad_login_correo(text) AS
SELECT u.id_usuario, u.nombre_acceso, u.correo, u.estado, u.id_rol, r.nombre AS rol, u.id_empleado, u.id_paciente,
    concat_ws(' ', coalesce(e.nombres, p.nombres), coalesce(e.apellidos, p.apellidos)) AS titular,
    u.credencial_acceso,
    COALESCE((SELECT jsonb_agg(
        jsonb_build_object('id_permiso', per.id_permiso::text, 'recurso', per.recurso, 'accion', per.accion, 'alcance', per.alcance)
        ORDER BY per.recurso, per.accion, per.alcance)
        FROM sis_god."ROL_PERMISO" rp JOIN sis_god."PERMISO" per USING (id_permiso) WHERE rp.id_rol = r.id_rol
    ), '[]'::jsonb) AS permisos
FROM sis_god."USUARIO" u JOIN sis_god."ROL" r ON r.id_rol = u.id_rol
LEFT JOIN sis_god."EMPLEADO" e ON e.id_empleado = u.id_empleado
LEFT JOIN sis_god."PACIENTE" p ON p.id_paciente = u.id_paciente
WHERE lower(u.correo) = lower($1) LIMIT 2;

-- $1: término literal, $2: rol, $3: estado, $4: límite, $5: desplazamiento.
PREPARE seguridad_listar_usuarios(text, bigint, text, integer, integer) AS
SELECT u.id_usuario, u.nombre_acceso, u.correo, u.estado, u.id_rol, r.nombre AS rol, u.id_empleado, u.id_paciente,
    concat_ws(' ', coalesce(e.nombres, p.nombres), coalesce(e.apellidos, p.apellidos)) AS titular
FROM sis_god."USUARIO" u JOIN sis_god."ROL" r ON r.id_rol = u.id_rol
LEFT JOIN sis_god."EMPLEADO" e ON e.id_empleado = u.id_empleado
LEFT JOIN sis_god."PACIENTE" p ON p.id_paciente = u.id_paciente
WHERE ($1 IS NULL OR strpos(lower(u.nombre_acceso), lower($1)) > 0 OR strpos(lower(u.correo), lower($1)) > 0
    OR strpos(lower(concat_ws(' ', coalesce(e.nombres, p.nombres), coalesce(e.apellidos, p.apellidos))), lower($1)) > 0)
    AND ($2 IS NULL OR u.id_rol = $2) AND ($3 IS NULL OR u.estado = $3)
ORDER BY u.id_usuario LIMIT $4 OFFSET $5;

-- $1: identificador del paciente; $2: identificador del empleado odontólogo.
PREPARE seguridad_asignacion(bigint, bigint) AS
SELECT EXISTS (
    SELECT 1 FROM sis_god."PLAN_TRATAMIENTO" plan JOIN sis_god."HISTORIA_CLINICA" h USING (id_historia)
    WHERE h.id_paciente = $1 AND plan.id_odontologo = $2
);

-- $1: identificador del pago. Comprueba el paciente y el odontólogo a través del plan.
PREPARE seguridad_titular_pago(bigint) AS
SELECT h.id_paciente, plan.id_odontologo
FROM sis_god."PLAN_TRATAMIENTO" plan JOIN sis_god."HISTORIA_CLINICA" h USING (id_historia)
JOIN sis_god."PRESUPUESTO" b USING (id_plan)
JOIN sis_god."OBLIGACION" o USING (id_presupuesto)
JOIN sis_god."PAGO" p USING (id_obligacion)
WHERE p.id_pago = $1;

-- Las escrituras administrativas comparten una conexión y bloquean primero el rol Administrador.
PREPARE seguridad_bloquear_admin AS
SELECT id_rol FROM sis_god."ROL" WHERE nombre = 'Administrador' FOR UPDATE;

-- $1: rol Administrador, $2: cuenta que se pretende desactivar o cambiar de rol.
PREPARE seguridad_otro_admin(bigint, bigint) AS
SELECT EXISTS (
    SELECT 1 FROM sis_god."USUARIO" WHERE id_rol = $1 AND id_usuario <> $2
    AND estado = 'activo' AND id_empleado IS NOT NULL
);

-- Ejecutar los tres pasos siguientes en la misma transacción, después del bloqueo.
-- Verificar que el primer SELECT devuelva todos los IDs solicitados antes de continuar.
PREPARE seguridad_validar_permisos(bigint[]) AS
SELECT id_permiso FROM sis_god."PERMISO" WHERE id_permiso = ANY($1) ORDER BY id_permiso FOR KEY SHARE;

PREPARE seguridad_limpiar_asociaciones(bigint) AS
DELETE FROM sis_god."ROL_PERMISO" WHERE id_rol = $1;

PREPARE seguridad_insertar_asociaciones(bigint, bigint[]) AS
INSERT INTO sis_god."ROL_PERMISO" (id_rol, id_permiso)
    SELECT $1, id_permiso FROM unnest($2) AS ids(id_permiso);
