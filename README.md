# Mini POS académico con DTE simulado (MH El Salvador)

Punto de venta que **simula** la facturación electrónica del Ministerio de Hacienda: emite Factura (01), Comprobante de Crédito Fiscal (03) y Nota de Crédito (05), y los anula o reenvía. No hay firmador ni MH reales: el backend simula sus respuestas (aceptado, rechazo o contingencia).

**Stack:** SQL Server · Node.js + Express + mssql · frontend HTML/JS sin frameworks (lo sirve el mismo Express).

## Requisitos

- **Node.js 18 o superior** (probado con 22).
- **SQL Server** (Express o Developer) con:
  - autenticación **mixta** y un usuario SQL (p. ej. `sa`) habilitado, porque el backend se conecta con usuario y contraseña;
  - **TCP/IP habilitado** (SQL Server Configuration Manager → Protocolos) y el puerto conocido (1433 por defecto).
- **sqlcmd** para ejecutar los scripts (o abre los `.sql` en SSMS / Azure Data Studio y ejecútalos en orden).

## Instalación

### 1. Base de datos

Crea la base si aún no existe:

```sql
CREATE DATABASE BatallonAtlacatl;
```

Ejecuta los scripts de `db/` **en orden** (los dos son idempotentes; se pueden volver a correr sin duplicar datos):

```bash
sqlcmd -S localhost -E -C -f 65001 -i db/01_schema.sql
sqlcmd -S localhost -E -C -f 65001 -i db/02_seed.sql
```

- `-E` usa tu sesión de Windows; con usuario SQL usa `-U sa -P <clave>` en su lugar.
- `-f 65001` lee los archivos como UTF-8 (sin esto los acentos se guardan mal).
- `-C` confía en el certificado del servidor local.

**Al actualizar el proyecto**, vuelve a correr `db/01_schema.sql` sobre tu BD: agrega las tablas y columnas nuevas sin tocar los datos (p. ej. `config_tarea` y `ejecucion_tarea` de la Fase 5). Si faltan, el servidor arranca igual pero avisa que no puede leer la configuración del lote y la cola de consultas.

El seed crea dos usuarios, el emisor, 10 productos, 4 clientes (2 consumidores y 2 contribuyentes) y los correlativos 01/03/05 en 0.

### 2. Configuración del backend (`.env`)

```bash
cd backend
npm ci                      # o npm install
copy .env.example .env      # en macOS/Linux: cp .env.example .env
```

Edita `backend/.env`:

| Variable | Valor |
|---|---|
| `DB_SERVER` (o `DB_HOST`) | Servidor SQL, p. ej. `localhost` |
| `DB_PORT` | Puerto TCP (vacío = 1433) |
| `DB_NAME` | `BatallonAtlacatl` |
| `DB_USER` / `DB_PASSWORD` | Usuario SQL y su contraseña |
| `DB_ENCRYPT` | `true` o `false` según tu servidor (`false` suele bastar en local) |
| `DB_TRUST_CERT` | `true` en local (certificado autofirmado) |
| `JWT_SECRET` | Texto aleatorio de 32+ caracteres: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Sin él el servidor no arranca; si es débil avisa (y con `NODE_ENV=production` no arranca) |
| `PORT` | Puerto de la aplicación, por defecto `3000` |
| `CONTINGENCIA_LOTE_HORA` | Hora (`HH:mm`) del lote automático de contingencia del cierre del día, por defecto `23:55` |
| `CONTINGENCIA_LOTE_ACTIVO` | `1` (por defecto) o `0` para desactivar el lote automático |
| `CONSULTA_MH_INTERVALO_SEG` | Cada cuántos segundos la cola de consultas pregunta a MH por **un** DTE en contingencia (10–3600, por defecto `60`) |
| `CONSULTA_MH_ACTIVO` | `1` (por defecto) o `0` para desactivar la cola de consultas |

Las cuatro variables de contingencia son solo el **valor inicial**: la primera vez se guardan en SQL Server (`dbo.config_tarea`) y desde entonces manda lo que se configure en el panel *Contingencia* (o por `PUT /api/contingencia/programacion` y `/consultas`), también después de reiniciar el servidor. `db/03_reset_demo.sql` vuelve a los valores del `.env`.

Variables de seguridad (CORS, cookies, límite de inicios de sesión, credenciales de prueba en el login): ver `backend/.env.example` y [docs/SEGURIDAD.md](docs/SEGURIDAD.md). Los valores por defecto sirven para el entorno local.

### 3. Ejecutar

```bash
cd backend
npm start          # o npm run dev para recargar al guardar cambios
```

Abre **http://localhost:3000**. Para comprobar la conexión, abre http://localhost:3000/api/health: debe responder `"db": "ok"`.

### Usuarios de prueba

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | ADMIN: todo, más productos, simulador de MH, panel gerencial y administración |
| `vendedor` | `vendedor123` | VENDEDOR: ventas, clientes y transacciones (no anula DTE ni ve contingencia ni administración) |

La pantalla de login los muestra solo en el entorno local (`localhost`, sin `NODE_ENV=production`). En un despliegue real cambia estas contraseñas. Tras 5 intentos fallidos el login de ese usuario se bloquea 15 minutos.

## Uso rápido

- **Nueva venta:** elige Factura 01 o CCF 03, el cliente y los productos, y confirma. El modal muestra el estado de MH, el número de control, el código de generación, el sello y el JSON del DTE.
- **Simular MH** (solo ADMIN): fuerza `OK`, `Rechazo`, `Contingencia` o `Timeout` para la demo (envía el header `X-Simular`). *Timeout* = MH sí recibió el documento pero la respuesta se perdió: queda en contingencia hasta que la cola de consultas lo encuentra en MH.
- **Transacciones:** filtros, detalle, Nota de crédito (sobre un CCF), Anular y Reintentar envío.
- **Contingencia** (menú lateral o Administración → Contingencia, solo ADMIN): cola de DTE que MH no recibió, **📦 Enviar lote ahora** (evento de contingencia + recepción por lote con todos los pendientes), reintento uno por uno, historial de lotes, la programación del **lote automático del cierre del día** (hora y activo) y la **cola de consultas a MH**, que durante el día pregunta a Hacienda por un documento a la vez si de verdad lo recibió (los que sí, quedan aceptados con su sello).
- **Administración → Bitácora:** auditoría con filtros y exportación a CSV.

El guion de la demo de 5 minutos está en [docs/DEMO.md](docs/DEMO.md).

## Reiniciar los datos de la demo

Borra todos los DTE, los eventos, la bitácora y el registro de ejecuciones de las tareas programadas, pone los correlativos en 0, restaura productos y clientes del seed y devuelve la configuración del lote automático y de la cola de consultas a los valores del `.env`. Desde la Fase 6 también borra los borradores y deja solo los usuarios del seed (`admin`/`admin123`, `vendedor`/`vendedor123`) con sus contraseñas originales: los usuarios creados en *Administración → Usuarios* se eliminan. No toca el emisor.

```bash
sqlcmd -S localhost -E -C -f 65001 -i db/03_reset_demo.sql
```

## Pruebas automatizadas

```bash
cd backend
npm ci                 # dependencias exactas de package-lock.json
npm test               # 469 pruebas en 23 suites: unitarias + integración (~50 s)
npm run test:unit      # sin BD
npm run test:coverage  # reporte en backend/coverage/index.html
npm run test:e2e       # 16 pruebas del frontend con Playwright y Microsoft Edge (~45 s)
```

Las pruebas de integración y las e2e usan una BD aparte, `BatallonAtlacatl_Test`, que se crea y siembra sola con los scripts de `db/` (requiere SQL Server, `backend/.env` y permiso para `CREATE DATABASE`); nunca tocan la BD de la demo. La e2e levanta su propio servidor en el puerto 3099 y usa el Edge instalado (sin Edge: `E2E_CHANNEL=chrome`). No corras `npm test` y `npm run test:e2e` a la vez.

Último resultado (Fase 5, 2026-11-20): 469/469 y 16/16 aprobadas; cobertura del backend 96.49 % sentencias, 84.85 % ramas, 98.36 % funciones y 98.33 % líneas; BD de la demo sin cambios. Evidencia completa de QA (ejecución de 458 pruebas) en [docs/qa/2026-11-20/](docs/qa/2026-11-20/INFORME.md). Detalle y matriz de requisitos → pruebas en [docs/PRUEBAS.md](docs/PRUEBAS.md).

## Modo sin backend (mocks)

En `frontend/js/api.js`, con `API_CONFIG.USE_MOCK = true` el frontend usa `frontend/js/mocks.js`, un backend simulado en memoria con la misma forma de respuestas, y se puede abrir sin SQL Server. Se reinicia al recargar la página. Por defecto está en `false` (API real).

## Estructura

| Ruta | Contenido |
|---|---|
| `backend/` | API Express: `routes → controllers → services`; lógica DTE en `src/dte/` (cálculos, builders, firmador y MH simulados) |
| `frontend/` | `index.html` (HTML/CSS) y `js/` (`api.js` cliente HTTP, `app.js` pantallas, `mocks.js`) |
| `db/` | `01_schema.sql`, `02_seed.sql`, `03_reset_demo.sql` |
| `docs/API.md` | Contrato de la API |
| `docs/DEMO.md` | Guion de la demo |
| `schemas-mh/` | Esquemas JSON oficiales del MH usados como referencia (01 v2, 03 v4, 05 v4, invalidación v3) |
| `backend/requests.http` | Ejemplos de todos los endpoints (extensión REST Client de VS Code) |

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| `/api/health` → `DB_NO_DISPONIBLE` | TCP/IP deshabilitado, puerto distinto, usuario/clave incorrectos o `DB_ENCRYPT` no coincide con el servidor |
| Acentos raros en productos y clientes | Los scripts se corrieron sin `-f 65001` |
| `JWT_SECRET` requerido al arrancar | Falta en `backend/.env` |
| El login dice "No se pudo conectar con la API" | El backend no está corriendo o abriste `index.html` como archivo en vez de usar http://localhost:3000 |
