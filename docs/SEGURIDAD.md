# Seguridad (Fase 3)

> Estado consolidado (controles verificados y pendientes, autorización por rol, hallazgos corregidos y abiertos, riesgo residual): [`docs/kan-23/SEGURIDAD.md`](kan-23/SEGURIDAD.md) (hito KAN-23, Fase 7). Este archivo conserva el detalle técnico de cada control de la Fase 3.

Endurecimiento del POS académico. Cada cambio indica el riesgo que corrige y la prueba que lo verifica.
Pruebas: `cd backend && npm test` (383 en verde al cerrar la fase). Las de esta fase están en
`tests/integration/seguridad.test.js` y `tests/unit/middleware.test.js`.

## Resumen

| # | Cambio | Riesgo corregido | Prueba |
|---|---|---|---|
| 1 | CORS con lista de orígenes | Cualquier sitio podía leer respuestas de la API | `seguridad.test.js` › *CORS con orígenes permitidos* |
| 2 | Errores 500 genéricos | Fuga de detalles internos (SQL, rutas, usuarios de BD) | `middleware.test.js` › *error no controlado…*; `seguridad.test.js` › *Errores sin detalles internos* |
| 3 | Límite de intentos de login | Fuerza bruta y prueba masiva de contraseñas | `seguridad.test.js` › *Límite de intentos de inicio de sesión* |
| 4 | Sesión en cookie HttpOnly + CSRF | Robo del token desde `localStorage` mediante XSS | `seguridad.test.js` › *Sesión del navegador…*; `middleware.test.js` › *cookie de sesión y CSRF* |
| 5 | Credenciales demo solo en local | Mostrar usuarios/contraseñas en un despliegue real | `seguridad.test.js` › *Credenciales de demostración* |
| 6 | Cabeceras HTTP + CSP | XSS, clickjacking, MIME sniffing, caché de datos fiscales | `seguridad.test.js` › *Cabeceras HTTP de seguridad*; recorrido en navegador |
| 7 | Dependencias | Superficie innecesaria | `npm audit` (0 vulnerabilidades) + suite completa |
| 8 | Endurecimientos menores | Ver detalle | Ver detalle |

---

## 1. CORS con orígenes permitidos

- **Antes:** `app.use(cors())` → `Access-Control-Allow-Origin: *` para cualquier sitio.
- **Ahora:** `middleware/seguridad.js` (`corsConfigurado`). Lista en `CORS_ORIGENES` (coma); vacía = `http://localhost:PORT` y `http://127.0.0.1:PORT`. Un origen no listado no recibe cabeceras CORS y el navegador bloquea la respuesta. Peticiones sin `Origin` (mismo origen, curl, Postman) funcionan igual. `credentials: true` solo para los orígenes permitidos.
- **Funcionamiento local:** el frontend lo sirve el mismo Express (mismo origen), así que no necesita CORS.
- **Prueba:** origen local permitido, origen ajeno sin cabeceras, preflight de un origen configurado (permite `X-CSRF-Token`), petición sin `Origin`.

## 2. Errores 500 sin detalles internos

- **Antes:** `mensaje: err.message` → podía devolver el texto de SQL Server (nombres de tablas, usuario `sa`, host). `/api/health` también incluía el error del driver.
- **Ahora:** `middleware/errores.js` responde `"Error interno del servidor (referencia ABCD1234)"`; el error completo se escribe en el log con la misma referencia, para encontrarlo. Los `AppError` (validaciones y reglas de negocio) conservan su mensaje. Errores del parser: 400 (JSON mal formado), 413 (cuerpo > 1 MB), otros 4xx con texto fijo. `health` responde `"No se pudo conectar a la base de datos"`.
- **Prueba:** unitaria con un error que contiene `dbo`/`password` (no aparecen en la respuesta y la referencia sí está en el log); integración forzando un error en `productosService.listar` y en `db.query` del health; cuerpo de 1.1 MB → 413.

## 3. Límite de intentos de inicio de sesión

- **Ahora:** `middleware/limiteLogin.js` antes de `POST /api/auth/login`. En memoria, ventana deslizante, cuenta solo respuestas 401:
  - 5 fallos por **usuario + IP** en 15 min → ese par queda bloqueado 15 min;
  - 20 fallos por **IP** (cualquier usuario) → la IP queda bloqueada.
  - Bloqueado → 429 `DEMASIADOS_INTENTOS` con `Retry-After`, aunque la contraseña sea correcta. Un login correcto reinicia el contador de su usuario + IP. Los 400 de validación no cuentan.
- **Por qué usuario + IP y no solo usuario:** un atacante no puede bloquear la cuenta de un cajero desde otra máquina.
- **Configuración:** `LOGIN_MAX_INTENTOS`, `LOGIN_MAX_INTENTOS_IP`, `LOGIN_VENTANA_MIN`, `LOGIN_BLOQUEO_MIN`. Detrás de un proxy, `TRUST_PROXY` para que `req.ip` sea la IP real.
- **Además (authService):** si el usuario no existe se compara contra un hash de relleno, así el tiempo de respuesta no revela qué usuarios existen. `LOGIN_FALLIDO` sigue registrándose en la bitácora.
- **Limitación:** el estado se pierde al reiniciar y no se comparte entre instancias (suficiente para el proyecto; en producción usar Redis o similar).
- **Prueba:** 5 fallos → 429 con `Retry-After` y sin cookies; otro usuario desde la misma IP entra; un éxito reinicia el contador; límite por IP; los 400 no cuentan; límite configurable. En navegador: el 6.º intento muestra "Demasiados intentos".

## 4. Token: de `localStorage` a cookie HttpOnly + CSRF

- **Riesgo:** con el JWT en `localStorage`, cualquier XSS podía leerlo y usarlo desde otra máquina durante 8 h.
- **Ahora:**
  - El login responde igual (`{ token, usuario }`, para clientes de API) y además pone `pos_token` (JWT, **HttpOnly**, `SameSite=Strict`) y `pos_csrf` (legible). `Secure` con `COOKIE_SECURE=1` o si la petición llegó por HTTPS.
  - `middleware/auth.js` acepta `Authorization: Bearer` (sin CSRF; el navegador nunca lo agrega solo) **o** la cookie. Con cookie, todo `POST/PUT/DELETE` exige `X-CSRF-Token` igual al claim `csrf` del JWT (comparación en tiempo constante) → si no, 403 `CSRF_INVALIDO`. Un Bearer inválido no cae a la cookie. `jwt.verify` fija `HS256` (rechaza `alg: none`).
  - Nuevas rutas: `POST /api/auth/logout` (borra cookies) y `GET /api/auth/sesion` (el frontend restaura la sesión al recargar).
  - `frontend/js/api.js`: no guarda token ni usuario en `localStorage` (borra los restos de versiones anteriores); usuario en memoria; `credentials: 'same-origin'`; manda `X-CSRF-Token` en las escrituras; el PDF también. En modo mock (sin servidor) el token falso va a `sessionStorage`.
- **CSRF, doble defensa:** `SameSite=Strict` impide que otro sitio envíe la cookie, y el token CSRF cubre navegadores antiguos o subdominios.
- **Pruebas:** sin cambios en las pruebas existentes (siguen usando Bearer). Nuevas: atributos de las cookies, `Secure` con `COOKIE_SECURE=1`, `/auth/sesion`, POST con cookie sin CSRF / con CSRF ajeno → 403 y no crea nada, con CSRF correcto → 201, Bearer sin CSRF → 201, logout borra cookies; unitarias de cookie/CSRF y `alg: none`. En navegador: login, nada de sesión en `localStorage`/`sessionStorage`, `document.cookie` no ve `pos_token`, alta de cliente, emisión + PDF, `fetch` sin CSRF → 403, recarga mantiene la sesión, logout la borra.
- **Lo que no cubre:** un XSS todavía puede *actuar* dentro de la página mientras está abierta (no robar el token). La defensa de fondo es la CSP (punto 6) y escapar todo lo que se pinta (`_h()`). El logout no revoca el JWT en el servidor.

## 5. Credenciales de demostración

- **Antes:** `index.html` mostraba siempre `admin / admin123 · vendedor / vendedor123`.
- **Ahora:** el HTML ya no las contiene. `GET /api/health` devuelve `demo.credenciales` solo si `DEMO_CREDENCIALES=1`, o si no está definida, `NODE_ENV` no es `production` y el host es `localhost`/`127.0.0.1`; si no, `demo: null` y `app.js` no muestra nada. En esa misma condición `/js/mocks.js` (que contiene los usuarios del seed) se sirve vacío.
- **Prueba:** local → credenciales y mocks presentes; con `DEMO_CREDENCIALES=0`, `NODE_ENV=production` u otro dominio → `demo: null`, mocks vacíos y la página sin contraseñas.
- **Pendiente para un despliegue real:** cambiar las contraseñas del seed (`db/02_seed.sql`), que son públicas en el repositorio.

## 6. Cabeceras HTTP de seguridad y CSP

`middleware/seguridad.js` (`cabecerasSeguridad`), sin dependencias nuevas:

| Cabecera | Valor | Para qué |
|---|---|---|
| `Content-Security-Policy` | ver abajo | Limita qué scripts, estilos y conexiones se cargan |
| `X-Content-Type-Options` | `nosniff` | Evita que el navegador interprete archivos con otro tipo |
| `X-Frame-Options` + `frame-ancestors 'none'` | `DENY` | Clickjacking |
| `Referrer-Policy` | `no-referrer` | No filtrar URLs a terceros |
| `Cross-Origin-Opener-Policy` / `-Resource-Policy` | `same-origin` | Aislamiento entre ventanas y orígenes |
| `Permissions-Policy` | cámara, micrófono, ubicación y pago desactivados | Mínimo privilegio |
| `Strict-Transport-Security` | solo si la petición llegó por HTTPS | Forzar HTTPS |
| `Cache-Control` | `no-store` en `/api/*` | No guardar datos fiscales ni de sesión en cachés |
| `X-Powered-By` | eliminada | No anunciar Express |

**CSP:** `default-src 'self'; script-src 'self'; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`.

- El frontend tiene ~100 manejadores inline (`onclick="…"`). `script-src-attr 'unsafe-inline'` los permite **solo como atributos**, mientras `script-src 'self'` bloquea cualquier `<script>` inline o de otro dominio inyectado. No hay `<script>` inline en `index.html`.
- **Pendiente para una CSP estricta:** migrar los `onclick` a `addEventListener` y quitar `script-src-attr 'unsafe-inline'`; mover los `style="…"` a clases para quitar `'unsafe-inline'` de estilos.
- **Prueba:** integración (cabeceras en `/` y `/api/health`, `no-store`, sin `X-Powered-By`). En Edge sin ventana: login y navegación con clics reales (los `onclick` funcionan), un `<script>` inyectado no se ejecuta y dispara `securitypolicyviolation`, sin otros errores de CSP ni de JavaScript.

## 7. Dependencias

- **Eliminada:** `uuid`. Ningún archivo de `src/` ni de `tests/` la usaba (los UUID salen de `crypto.randomUUID`).
- **Revisadas y necesarias:** `express`, `cors` (ahora configurado), `mssql`, `jsonwebtoken`, `bcryptjs`, `dotenv`, `pdfkit`, `qrcode`; dev: `jest`, `supertest`, `ajv`, `ajv-formats`.
- **No se agregó ninguna** (cabeceras, cookies y límite de login implementados sin `helmet`/`cookie-parser`/`express-rate-limit`).
- `npm audit`: 0 vulnerabilidades.

## 8. Endurecimientos menores

- **JWT_SECRET débil** (vacío, < 32 caracteres o el de ejemplo): con `NODE_ENV=production` el servidor no arranca; en local avisa. Prueba unitaria `config/seguridad › JWT_SECRET débil`.
- **`TRUST_PROXY`** opcional para usar la IP real y detectar HTTPS detrás de un proxy inverso.
- **`.env.example`** documenta las variables nuevas, sin valores reales.

## Secretos

- `backend/.env` está en `.gitignore`; el repositorio no contiene `.env`, certificados ni claves (`git ls-files` revisado).
- `.env.example` solo tiene marcadores (`cambiar`). Las únicas contraseñas en el repositorio son las del seed académico, públicas por diseño y que deben cambiarse en un despliegue real.

## Variables nuevas (`backend/.env`)

| Variable | Defecto | Uso |
|---|---|---|
| `CORS_ORIGENES` | localhost y 127.0.0.1 con `PORT` | Orígenes permitidos (coma) |
| `COOKIE_SECURE` | `0` | `1` = cookies `Secure` (HTTPS) |
| `TRUST_PROXY` | vacío | Saltos o IP del proxy inverso |
| `LOGIN_MAX_INTENTOS` / `LOGIN_MAX_INTENTOS_IP` | `5` / `20` | Fallos antes del bloqueo |
| `LOGIN_VENTANA_MIN` / `LOGIN_BLOQUEO_MIN` | `15` / `15` | Ventana y duración del bloqueo |
| `DEMO_CREDENCIALES` | vacío (automático) | `1` mostrar, `0` ocultar |
| `NODE_ENV` | — | `production` oculta la demo y exige un JWT_SECRET fuerte |
