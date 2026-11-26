# SIS-GOD · Entregable 1

Sistema de Gestión Odontológica y Dental. Frontend React/Vite, API Express y PostgreSQL compartido en Supabase. El entregable contiene 20 tablas y 40 endpoints de negocio.

Esta carpeta se ubica en Grupo-5/Entregable 1. El README de esta subcarpeta corresponde a la aplicación; el README de la raíz del repositorio se conserva por separado.

## Requisitos

- Node.js 24 LTS y npm.
- Acceso a internet para conectar con Supabase.
- Contraseña PostgreSQL del proyecto para configurar el backend.

## Primera instalación

Abrir CMD, PowerShell o la terminal del editor en esta carpeta:

```cmd
npm ci
npm run setup
```

Completar PGPASSWORD en backend/.env. Mantener DATABASE_URL vacío si se usan los parámetros PGHOST, PGPORT, PGUSER y PGDATABASE de la plantilla. El certificado público ya está incluido en backend/certs/supabase-ca.crt.

setup crea los .env ausentes sin sobrescribir los existentes. Las credenciales se mantienen en archivos locales excluidos de Git.

```cmd
npm run db:status
```

La comprobación debe mostrar alcanceCompleto=true, tls=true y certificadoValidado=true.

## Iniciar el entorno

```cmd
npm run dev
```

Inicia frontend y backend. Mantener la terminal abierta; Ctrl+C detiene ambos. En las siguientes sesiones solo se necesita este comando.

| Servicio | Dirección |
|---|---|
| Página | http://127.0.0.1:5173 |
| API | http://127.0.0.1:3000/api/v1 |
| Salud del proceso | http://127.0.0.1:3000/health |
| Salud de PostgreSQL | http://127.0.0.1:3000/api/v1/health/db |

Si los puertos están ocupados, cerrar la ejecución anterior. Los cambios de código se recargan automáticamente; reiniciar al modificar .env o dependencias. Después de actualizar el repositorio, ejecutar npm ci si cambió package-lock.json.

## División del trabajo

| Integrante | Módulo | Tablas |
|---|---|---|
| Erick | pacientes | PACIENTE, HISTORIA_CLINICA, CONTACTO, ANTECEDENTE |
| Nayemy | seguridad | ROL, PERMISO, ROL_PERMISO, USUARIO |
| Josenrique | personal | EMPLEADO, ODONTOLOGO, PERSONAL_APOYO, TRATAMIENTO |
| Esaul | planes | PLAN_TRATAMIENTO, DETALLE_PLAN, PRESUPUESTO, OBLIGACION |
| Rodrigo | pagos | PAGO, METODO_PAGO, BOLETA, FACTURA |

Cada módulo tiene ocho endpoints. contracts/ownership.json identifica los archivos de cada integrante y contracts/endpoints.json sus operaciones. El frontend propio está en frontend/src/modules/MODULO y el contrato HTTP en backend/openapi/MODULO.json.

## Pruebas

| Comando | Comprobación |
|---|---|
| npm run build | Compilación frontend y backend. |
| npm run typecheck | Tipos de ambos workspaces. |
| npm test | Infraestructura, clientes HTTP y pruebas implementadas de módulos. |
| npm run test:modules -- pacientes | Pruebas del módulo indicado. |
| npm run test:ui | Recorrido visual; necesita el entorno iniciado y Edge disponible. |
| npm run db:status | Conexión, TLS, tablas y conteos; solo lectura. |
| npm run check:ownership | Asignación de archivos y endpoints. |
| npm run docs:api | Generación del contrato OpenAPI integrado. |

Los archivos de prueba vacíos no aportan cobertura. HTTP 501 indica un controlador pendiente; 503 SEGURIDAD_PENDIENTE indica que falta completar autenticación o autorización. La vista previa permite revisar el diseño sin iniciar sesión ni persistir registros.

## Base de datos

La base compartida sis-god-db ya contiene el esquema y los datos iniciales. No repetir db:install ni db:seed sobre ese proyecto. Los cambios SQL se aplican una sola vez y no se ejecutan al iniciar el servidor o actualizar Git.

Para recrear el esquema en una base nueva, configurar su conexión y ejecutar npm run db:install y npm run db:seed. La aplicación utiliza database/base/SIS_GOD_BASE_20.sql y database/base/DATOS_BASE.sql dentro de esta subcarpeta.

Las pruebas destructivas y benchmarks utilizan otra base. Para comprobar el esquema en una base PostgreSQL local vacía llamada sis_god_prueba, abrir otra CMD en esta carpeta:

```cmd
set "DATABASE_URL=postgresql://USUARIO:CLAVE@127.0.0.1:5432/sis_god_prueba"
set "DB_SSL_MODE=disable"
set "ALLOW_TEST_DATABASE=true"
npm run db:install
npm run db:seed
npm run test:database
```

Sustituir USUARIO y CLAVE por las credenciales locales. Cerrar esa CMD al terminar para conservar la configuración normal de Supabase en las demás terminales.

## Ejecución desde la raíz del repositorio

Sin cambiar el README de la raíz, se puede iniciar la aplicación desde Grupo-5 con:

```cmd
npm --prefix "Entregable 1" run dev
```
