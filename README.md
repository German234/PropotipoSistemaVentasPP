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

El seed crea dos usuarios, el emisor, 10 productos, 4 clientes (2 consumidores y 2 contribuyentes) y los correlativos 01/03/05 en 0.

### 2. Configuración del backend (`.env`)

```bash
cd backend
npm install
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
| `JWT_SECRET` | Cualquier texto largo y aleatorio (el servidor no arranca sin él) |
| `PORT` | Puerto de la aplicación, por defecto `3000` |

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
| `vendedor` | `vendedor123` | VENDEDOR: ventas, clientes y transacciones |

## Uso rápido

- **Nueva venta:** elige Factura 01 o CCF 03, el cliente y los productos, y confirma. El modal muestra el estado de MH, el número de control, el código de generación, el sello y el JSON del DTE.
- **Simular MH** (solo ADMIN): fuerza `OK`, `Rechazo` o `Contingencia` para la demo (envía el header `X-Simular`).
- **Transacciones:** filtros, detalle, Nota de crédito (sobre un CCF), Anular y Reintentar envío.
- **Administración → Bitácora:** auditoría con filtros y exportación a CSV.

El guion de la demo de 5 minutos está en [docs/DEMO.md](docs/DEMO.md).

## Reiniciar los datos de la demo

Borra todos los DTE, los eventos y la bitácora, pone los correlativos en 0 y restaura productos y clientes del seed. No toca usuarios ni emisor.

```bash
sqlcmd -S localhost -E -C -f 65001 -i db/03_reset_demo.sql
```

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
