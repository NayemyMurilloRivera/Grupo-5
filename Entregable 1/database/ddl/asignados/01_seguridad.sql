-- La base común define ROL, PERMISO, ROL_PERMISO y USUARIO, sus PK/FK,
-- el arco obligatorio de USUARIO y las dos FK de ROL_PERMISO con ON DELETE CASCADE.
-- Aplicar después de SIS_GOD_BASE_20.sql. La búsqueda por correo ignora mayúsculas,
-- por lo que este índice también hace única la forma normalizada del correo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_correo_normalizado
    ON sis_god."USUARIO" (lower(correo));
