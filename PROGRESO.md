# PROGRESO

Índice breve del avance. Cada bloque actualiza su sección al terminar (ver `CLAUDE.md`).

## Estado general

- **B0 Andamiaje — HECHO (2026-11-04).** Estructura de carpetas, `package.json`, `.env.example`, `CLAUDE.md`, `PROGRESO.md`, `docs/API.md`. Sin lógica.
  - Decisiones de contrato (en `docs/API.md`): tabla de códigos de error; un rechazo/contingencia de MH responde `ok:true` con el estado del DTE (no es error HTTP); RECHAZADO no descuenta stock; `reintentar` solo desde CONTINGENCIA y conserva codigoGeneracion/numeroControl; `unidad` = código MH (59).
- **B1 BD + base de la API — HECHO (2026-11-04).** Tablas y seed cargados en la BD local; Express con health y manejo de errores.
- **B2 Auth + catálogos — HECHO (2026-11-04).** Login JWT, roles, productos, clientes, emisor, bitácora en escrituras.
- **B3 Emisión 01/03 — HECHO (2026-11-04).** `POST /api/dte/01` y `/api/dte/03` con firmador/MH simulados, correlativo con UPDLOCK y JSON validado contra `schemas-mh/`.
- **B4 NC + ciclo de vida + consultas — HECHO (2026-11-04).** `POST /api/dte/05`, `/:id/invalidar`, `/:id/reintentar`, `GET /api/dte`, `GET /api/dte/:id`, `GET /api/bitacora`.
- **Backend completo (B1–B4).** El frontend puede hacer F3 (01/03/05) y F4 (historial, invalidar, reintentar, bitácora).
- **F1 JS separado + cliente HTTP + mocks — HECHO (2026-11-04).** `index.html` solo HTML/CSS; lógica en `frontend/js/app.js`; `api.js` + `mocks.js` (USE_MOCK=true). Sin cambios de contrato.
- **F2 Login + catálogos — HECHO (2026-11-04).** Login/logout reales con rol, inventario (listar/buscar/crear/editar/desactivar ADMIN) y nuevo panel Clientes contra `api.*`. Sin cambios de contrato.
- **F3 Venta/emisión 01 y 03 — HECHO (2026-11-04).** Nueva venta emite contra `POST /api/dte/01|03` con selector de receptor, totales por tipo, "Simular MH" (ADMIN) y modal de resultado con JSON DTE y respuesta firmador/MH. Sin cambios de contrato.
- **F4 Transacciones + NC + ciclo de vida + bitácora — HECHO (2026-11-04).** `GET /api/dte` con filtros y badges, detalle en el modal de F3, Nota de crédito 05, Anular, Reintentar envío y bitácora con export CSV. **Frontend completo (F1–F4).** Sin cambios de contrato.
- **I1 Integración — HECHO (2026-11-04).** `USE_MOCK = false`; las pantallas se recorrieron contra la API real (sin diferencias de contrato en la API; se corrigió `mocks.js`). `README.md`, `docs/DEMO.md` y `db/03_reset_demo.sql`.
- ✅ **MVP COMPLETO (2026-11-04).** Backend B1–B4 + frontend F1–F4 integrados: login con roles, catálogos, emisión 01/03/05, invalidación, contingencia y reintento, transacciones y bitácora, todo contra SQL Server. Guion de demo verificado de punta a punta.

## Mapa de archivos

| Ruta | Propósito |
|---|---|
| `CLAUDE.md` | Reglas del proyecto, convenciones y reglas DTE |
| `PROGRESO.md` | Este índice de avance |
| `docs/API.md` | Contrato de la API (fuente de verdad) |
| `db/01_schema.sql` | Esquema idempotente (9 tablas): usuarios, emisor, clientes, productos, correlativos, dte, dte_detalle, evento_invalidacion, bitacora |
| `db/02_seed.sql` | Seed idempotente: admin/admin123, vendedor/vendedor123, emisor M001/P001, 10 productos, 2 consumidores, 2 contribuyentes, correlativos 01/03/05 = 0 |
| `db/03_reset_demo.sql` | Reinicia los datos de demo: borra DTE, eventos y bitácora; correlativos en 0; productos/clientes como el seed (borra los creados después); reinicia ids de DTE. No toca usuarios ni emisor |
| `db/genHash.js` | `node db/genHash.js <clave>...` imprime hashes bcrypt (usa bcryptjs de backend/) |
| `backend/package.json` | Dependencias; scripts `start` y `dev` (node --watch) |
| `backend/.env.example` | DB_SERVER (o DB_HOST), DB_PORT (opcional), DB_ENCRYPT/DB_TRUST_CERT (opcionales), DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET, PORT. Copiar a `.env` |
| `backend/src/server.js` | Carga `.env` y levanta el servidor |
| `backend/src/app.js` | Express: cors, json, rutas `/api/*`, 404 API, estáticos de `frontend/`, manejador de errores. **Registrar aquí las rutas nuevas** |
| `backend/src/config/db.js` | Pool mssql lazy; `query(sql, params)`; `withTransaction(async ({tx, query}) => ...)` |
| `backend/src/utils/respuesta.js` | `AppError(codigo, mensaje, status)`, `ok(res, data, status)`, `asyncHandler(fn)` |
| `backend/src/middleware/errores.js` | `noEncontrado` (404) y `manejadorErrores` → `{ok:false,error:{codigo,mensaje}}` |
| `backend/src/routes/health.js` | `GET /api/health` (SELECT 1) |
| `backend/src/routes/{auth,productos,clientes,emisor}.js` | Rutas + middlewares (`auth`, `requireRol`) → controllers. Patrón: routes → controllers → services |
| `backend/src/controllers/*Controller.js` | Leen req (params/query/body), llaman al service, responden con `ok()` |
| `backend/src/services/authService.js` | `login(usuario, password)` → bcrypt + JWT 8h |
| `backend/src/services/productosService.js` | `listar({q})`, `obtener(id)`, `crear`, `actualizar` (PUT parcial) |
| `backend/src/services/clientesService.js` | Igual que productos + validación CONTRIBUYENTE. B3 usa `obtener(id)` para el receptor |
| `backend/src/services/emisorService.js` | `obtener()` en forma de contrato. B3 lo usa para armar `emisor` del DTE |
| `backend/src/middleware/auth.js` | `auth` (Bearer JWT → `req.usuario`) y `requireRol(...roles)` |
| `backend/src/utils/bitacora.js` | `registrar(usuarioId, accion, entidad, id, detalle, q?)`; con `q` de `withTransaction` registra dentro de la transacción |
| `backend/src/utils/validar.js` | `texto`, `textoOpc`, `dinero`, `entero`, `digitos`, `id`, `falla` → lanzan `AppError VALIDACION` |
| `backend/src/utils/dinero.js` | `redondear2(n)` sin error de coma flotante (1.005 → 1.01). **Usar en todo cálculo de dinero** |
| `backend/src/dte/calculos.js` | `calcularFactura` (01, IVA incluido), `calcularCcf` (03) y `calcularNotaCredito` (05) → `{items, resumen, totales}`; `porcentaje()` en centavos |
| `backend/src/dte/numeroALetras.js` | `numeroALetras(113)` → `"CIENTO TRECE 00/100 USD"` |
| `backend/src/dte/correlativo.js` | `siguienteNumeroControl(tipo, tx, emisor)`: `UPDATE ... WITH (UPDLOCK) OUTPUT` dentro de la transacción |
| `backend/src/dte/builders/comun.js` | Piezas compartidas: identificacion, emisor, direcciones (con `distrito`), ítem, pagos |
| `backend/src/dte/builders/factura01.js`, `ccf03.js` | `construir({...})` → JSON completo 01 v2 / 03 v4 |
| `backend/src/dte/builders/notaCredito05.js` | `construir({..., ccf:{codigoGeneracion, fecEmi, receptor}})` → JSON 05 v4 (receptor copiado del CCF) |
| `backend/src/dte/builders/invalidacion.js` | `construir({codigoGeneracion, fecEmi, horEmi, emisor, dte, motivo})` → evento de invalidación v3 |
| `backend/src/dte/simuladores/mhAnulacion.js` | `anular({codigoGeneracion}, modo)` → respuesta MH del evento o `null` (sin respuesta) |
| `backend/src/dte/simuladores/firmador.js` | `firmar(json, modo)` → `{status:"OK", body: JWS falso}` |
| `backend/src/dte/simuladores/mhRecepcion.js` | `leerModo(req)` (X-Simular), `recibir({codigoGeneracion}, modo)` → respuesta MH o `null` (contingencia), `generarSello()`, `fhProcesamiento()` |
| `backend/src/services/dteService.js` | Escrituras, cada una en una transacción: `emitir` (01/03), `emitirNotaCredito` (05), `reintentar`, `invalidar`. Comparten `enviarYGuardar`, `ajustarStock`, `pendientesAcreditar` |
| `backend/src/services/dteConsultasService.js` | `listar(filtros)`, `obtener(id)` (JSON parseado, items con pendientes, NC, evento) |
| `backend/src/services/bitacoraService.js` | `listar(filtros)` para `GET /api/bitacora` |
| `backend/src/controllers/bitacoraController.js`, `routes/bitacora.js` | `GET /api/bitacora` (cualquier rol) |
| `backend/src/controllers/dteController.js`, `routes/dte.js` | `POST /api/dte/01|03|05` (201), `POST /:id/invalidar|reintentar` (200), `GET /`, `GET /:id` (cualquier rol) |
| `backend/requests.http` | Ejemplos de todos los endpoints (REST Client de VS Code) |
| `frontend/index.html` | Solo HTML + CSS del prototipo (≈63 KB, 979 líneas). Carga `js/mocks.js`, `api.js`, `pdf-data.js`, `app.js` en ese orden. Servido por Express en `/`. Mapa de vistas en *Frontend → Mapa del prototipo* |
| `frontend/js/app.js` | Lógica de UI (globales para los `onclick` inline). F2: sesión, inventario y clientes; F3: venta y emisión 01/03; F4: transacciones, NC 05, anular, reintentar y bitácora contra `api.*`. Panel gerencial, usuarios y config del admin siguen fijos |
| `frontend/js/api.js` | Cliente HTTP: `API_CONFIG` (`BASE_URL:'/api'`, `USE_MOCK: false` desde I1), `ApiError`, `api.*` por endpoint, token en localStorage |
| `frontend/js/mocks.js` | `MockApi.handle(method, path, query, body, headers)` → `{status, body}`: backend simulado en memoria con la forma exacta de `docs/API.md` (seed, firmador, respuestaMh, X-Simular) |
| `frontend/js/pdf-data.js` | `var PDF_DATA` = PDF de ejemplo en base64 (226 KB) que usa `downloadPdf()`. No abrir |
| `schemas-mh/` | Esquemas JSON oficiales MH (01 v2, 03 v4, 05 v4, invalidación v3, contingencia v4). Solo referencia |
| `.gitignore` | Ignora node_modules y .env |
| `README.md` | Instalación (scripts de `db/`, `.env`, `npm start`), usuarios de prueba, reinicio de demo, modo mocks, problemas frecuentes |
| `docs/DEMO.md` | Guion de demo de 5 minutos con los valores esperados (BD reiniciada) y plan B |

## Backend (B1–B4)

- [x] **B1 — BD + base de la API.**
  - Listo: `GET /api/health`; formato de error estándar (404 de API, JSON mal formado → VALIDACION, 500 → ERROR_INTERNO).
  - Decisiones: emisor es fila única (`CHECK id = 1`), dirección partida en departamento/municipio/complemento; `dte_detalle` copia código/descripción/precio al emitir; cantidades y stock son INT; `clientes` tiene un CHECK que exige nit/nrc/actividad a los CONTRIBUYENTE; columnas `activo` en usuarios/clientes/productos (borrado lógico); `dte.condicion_operacion` agregado; Express sirve `frontend/` (mismo origen, sin problemas de CORS).
  - Verificado: los scripts corren dos veces sin duplicar datos (sqlcmd con `-f 65001` para los acentos); la API responde 503/404/400 con el formato estándar. `/api/health` en verde **pendiente** de poner la clave real de `sa` en `backend/.env` (el servidor está en modo mixto y `sa` está habilitado).
  - Login/JWT pasa a B2.
- [x] **B2 — Auth + catálogos.**
  - Listo: `POST /api/auth/login`; `GET/POST/PUT /api/productos` (+ `GET /:id`, `?q`, escritura solo ADMIN); `GET/POST/PUT /api/clientes` (+ `GET /:id`, `?q&tipo`, cualquier rol); `GET /api/emisor`.
  - Decisiones: PUT parcial (mezcla con el registro actual y revalida todo); CONTRIBUYENTE exige nit, nrc **y** actividad (la BD y el CCF lo requieren); nit/nrc se guardan solo con dígitos; GET devuelve solo activos (`?incluirInactivos=1` para todos); borrado lógico con `PUT {activo:false}`; bitácora en LOGIN, LOGIN_FALLIDO, CREAR y ACTUALIZAR (detalle en JSON); `server.js` no arranca sin JWT_SECRET.
  - Verificado: 27 comprobaciones contra la BD real (con un driver de autenticación Windows solo para la prueba, fuera del repo). Se limpiaron los datos de prueba. Se corrigió el redondeo de 1.005.
- [x] **B3 — Emisión 01 y 03.**
  - Listo: `POST /api/dte/01`, `POST /api/dte/03` (201, respuesta de emisión del contrato). `X-Simular` ok/rechazo/contingencia. Ejemplos en `requests.http`.
  - Flujo (una transacción): valida payload → cliente (03: CONTRIBUYENTE con NIT/NRC/actividad) → productos `WITH (UPDLOCK)` + stock → cálculos → UUID mayúsculas + numeroControl (UPDLOCK) → JSON → firma → MH → INSERT dte + dte_detalle → descuenta stock si PROCESADO/CONTINGENCIA → bitácora `EMISION` (detalle JSON: tipoDte, numeroControl, codigoGeneracion, resultado, firmador, mensaje).
  - Decisiones: JSON según los esquemas (01 `version 2`, 03 `version 4`; sin `extension` ni `emisor.tipoEstablecimiento` porque `additionalProperties:false`; `distrito` "01"; dirección del receptor con depto/municipio del emisor). RECHAZADO se guarda y consume correlativo. Ítems con el mismo productoId se suman. `descuento` en la base del precio (con IVA en 01). Precio con IVA calculado en centavos (2.50 × 1.13 = 2.83, no 2.82). Fecha/hora local del servidor. `dte.firma` guarda el JSON completo del firmador. `dte.subtotal` en 01 = total − IVA. El servicio vive en `services/dteService.js` (patrón routes→controllers→services); la lógica DTE pura en `src/dte/`.
  - Verificado contra la BD real con `sa`: los 7 JSON generados (01 con y sin receptor, crédito, 03) **validan con ajv** contra `fe-f-v2.json` / `fe-ccf-v4.json`; rechazo no descuenta stock; contingencia sí; errores 400/404/409; 12 emisiones en paralelo → 12 números de control distintos. Datos de prueba limpiados (correlativos en 0, stock del seed).
  - `db.js` acepta `DB_HOST`, `DB_ENCRYPT`, `DB_TRUST_CERT` (el `.env` local los usa); se agregó `JWT_SECRET` y `PORT` al `.env`.
- [x] **B4 — 05 + ciclo de vida y consultas.**
  - Listo: `POST /api/dte/05`, `POST /api/dte/:id/invalidar`, `POST /api/dte/:id/reintentar`, `GET /api/dte` (tipo, estado, desde, hasta, clienteId), `GET /api/dte/:id`, `GET /api/bitacora` (accion, entidad, dteId, usuario, desde, hasta, limite). Flujo completo en `requests.http` (CCF → NC → invalidar factura → contingencia → reintentar), encadenado con `@name`.
  - NC: bloquea el CCF (UPDLOCK) para que dos NC simultáneas no pasen de lo pendiente; pendiente = cantidad del CCF − NC en PROCESADO/CONTINGENCIA; receptor copiado del JSON del CCF (`clienteId` opcional y debe coincidir); precio y venta gravada proporcionales a los del CCF (la última acreditación toma el resto exacto); devuelve stock.
  - Invalidación: PROCESADO; un 03 con NC vigente → 409; tipoAnulacion 1/3 exige `codigoGeneracionR` de otro DTE PROCESADO. Evento PROCESADO → INVALIDADO + revierte stock (05 vuelve a sacar; si no alcanza → 409). Evento RECHAZADO → se guarda y el DTE sigue PROCESADO. Contingencia → 503 `MH_NO_DISPONIBLE` (no hay contingencia para eventos), solo en bitácora (`SIN_RESPUESTA`).
  - Reintentar: CONTINGENCIA → mismo JSON y firma; PROCESADO guarda sello; RECHAZADO revierte el stock; contingencia otra vez = sin cambios. Bitácora `REINTENTO`.
  - Esquemas: 05 según `fe-nc-v4.json` (sin `otrosDocumentos`; receptor con tipoDocumento/numDocumento; ítems con `numeroDocumento`, `totalIva`; resumen con `totalIva`, `codigoRetencionMH`). Evento según `invalidacion-schema-v3.json` (`fecEmi/horEmi`, `fusion`, emisor con `codEstableMH`, documento con datos del receptor y **sin `montoIva`**; se corrigió la regla en CLAUDE.md).
  - Refactor: 01/03/05 comparten `enviarYGuardar` en `dteService`; movimientos de stock con `ajustarStock` (`UPDATE ... WHERE stock + delta >= 0`).
  - Verificado contra la BD real: todo el flujo y sus errores (exceso de NC, otro receptor, producto fuera del CCF, NC sobre 01, invalidar CCF con NC, doble invalidación, reintento fuera de contingencia, contingencia → rechazo devuelve stock); stock final cuadrado. Los 12 JSON (01, 03, 05, eventos) validan con ajv contra `schemas-mh/` (con `multipleOfPrecision`: el `multipleOf` estricto de ajv falla con decimales en coma flotante; ningún monto tiene más de 2 decimales). Datos de prueba limpiados.

## Frontend (F1–F4)

Plan propuesto (ajustable):

- [x] **F1 — Separación del JS + cliente HTTP + mocks (2026-11-04).** Sin cambios visuales ni de comportamiento.
  - `index.html` 309 KB → 50 KB: el `<script>` inline pasó **sin modificar** a `js/app.js` (verificado con diff) y el PDF base64 a `js/pdf-data.js`. Siguen siendo scripts clásicos (globales), así los `onclick` inline funcionan igual.
  - `js/api.js`: `api.request(method, path, {query, body, simular, auth})` → Promise con `data`; error → `ApiError {codigo, mensaje, status}`. Token/usuario en `localStorage` (`pos.token`, `pos.usuario`); `NO_AUTENTICADO` limpia la sesión y emite el evento `api:no-autenticado` en `document`. Red caída → `codigo: 'SIN_CONEXION'` (solo cliente). Helpers: `api.login` (guarda sesión), `logout`, `getUsuario`, `isLoggedIn`, `health`, `productos.{listar,obtener,crear,actualizar}`, `clientes.{…}`, `emisor`, `dte.{emitir(tipo,payload,simular), factura, ccf, notaCredito, invalidar(id,body,simular), reintentar(id,simular), listar, obtener}`, `bitacora(filtros)`.
  - `js/mocks.js` (`API_CONFIG.USE_MOCK = true`, latencia 250 ms): todos los endpoints de `docs/API.md` con su forma exacta y sus errores (401/400/403/404/409/503). Seed = `db/02_seed.sql` (admin/admin123, vendedor/vendedor123, P001–P010, clientes 1–4). Cálculos 01/03/05 como el backend (precio con IVA en centavos, 03 → 113.00 "CIENTO TRECE 00/100 USD"), correlativos, stock, pendientes de NC, invalidación, reintento, bitácora. Estado en memoria (se reinicia al recargar). Token falso (no es JWT firmado).
  - Verificado en Node: 30 comprobaciones del flujo completo vía `api.*` (login, 01/03/05, rechazo, contingencia → reintentar, invalidar, errores, stock, bitácora, permisos).
  - Para usar el backend real: `API_CONFIG.USE_MOCK = false` en `js/api.js`.
  - ~~Pendiente F2+: conectar las vistas a `api.*`~~ (login y catálogos en F2).
- [x] **F2 — Login + catálogos (2026-11-04).**
  - Archivos: `index.html` (login con ids, botones de rol, panel Inventario rehecho, panel Clientes nuevo, regla CSS `.solo-admin`), `js/app.js` (sesión, inventario, clientes; catálogo y carrito leen `codigo/descripcion/precio`).
  - Login: `doLogin()` → `api.login` (token + usuario en localStorage); al recargar restaura la sesión guardada; `logout()` limpia sesión y estado; evento `api:no-autenticado` (token vencido) → vuelve al login con alerta.
  - Roles: ADMIN y VENDEDOR entran al POS (`app-vendedor`). `body.rol-admin` muestra los elementos `.solo-admin`: botones "Panel gerencial" y "Administración" en el sidebar, form de producto y botones editar/desactivar. `enter('gerente'|'admin')` también lo valida. Gerente y Admin tienen "Punto de venta" para volver. **"Gerente" = ADMIN** (decisión F2).
  - Inventario: `cargarProductos()` llena `inventory` (catálogo de venta) y `buscarInventario()` usa `?q=` (debounce 250 ms) para la tabla. ADMIN crea (`unidad` 59), edita (el form pasa a modo edición) y desactiva (`PUT {activo:false}` con confirm). El carrito descarta productos que dejaron de existir.
  - Clientes: panel `v-clientes` con búsqueda `q` + filtro `tipo` y alta; NIT/NRC/cód. y desc. de actividad solo visibles si tipo = CONTRIBUYENTE (validación de presencia local; formato lo valida la API). Cualquier rol puede crear.
  - Errores: `alertaError(e)` → `toast(e.mensaje,'warn')` (componente de alertas del prototipo). Texto de la API escapado con `_h()`.
  - Verificado en Edge headless con mocks: 30 comprobaciones (login fallido/ok, rol, ocultar admin, permisos 403, búsqueda, crear/editar/desactivar producto, código repetido, clientes con/sin contribuyente, NIT inválido, filtro, logout, token inválido).
  - ~~Pendiente F3~~ (resuelto en F3): el carrito aún calcula IVA como subtotal × 0.13 sin distinguir 01/03; el form de cliente de Nueva venta sigue siendo libre (F3 debe elegir un cliente de `clientes`/API). Editar clientes no está en la UI (la API lo soporta).

### Mapa del prototipo (no releer los archivos completos)

Roles de UI del prototipo: vendedor / gerente / admin. La API solo tiene `ADMIN` y `VENDEDOR` (F2: "gerente" y "admin" solo para ADMIN; ambos roles usan la pantalla vendedor como POS).

**`frontend/index.html`** (CSS en 10–415; `.solo-admin` en 223; estilos F3 en 274–280, F4 en 281–293) — actualizado en F4

| Líneas | Vista / bloque | Datos hardcodeados |
|---|---|---|
| 418–446 | `#login`: `#login-user`, `#login-pass`, `#login-btn` → `doLogin()` | Pista de usuarios de prueba |
| 449–477 | `#app-vendedor` sidebar (Nueva venta, Inventario, Clientes, Transacciones, Borradores, `.solo-admin` Panel gerencial / Administración) + topbar (`#v-title`, `#v-avatar`) | Badge "MH en línea" |
| 479–528 | `#v-venta`: `#v-client-form`, `#v-prod-search`/`#v-catalog`, `#v-cart`, `#vt-01`/`#vt-03`, totales, pago, `.sim-mh` `#v-simular`, `#v-confirmar` | — |
| 530–566 | `#v-historial` (Transacciones / Mis ventas): `#h-search` (local), `#h-tipo`, `#h-estado`, `#h-desde`, `#h-hasta`, `.sim-mh` `#h-simular`, `#h-tbody`, `#h-count` | — |
| 568–579 | `#v-borradores` | 2 filas fijas en HTML |
| 582–604 | `#v-inventario` | — |
| 606–645 | `#v-clientes` | — |
| 651–754 | `#app-gerente`: `#g-dash`, `#g-ventas` (712), `#g-reportes` | KPIs, barras, dona, transacciones, ventas por vendedor fijos |
| 758–882 | `#app-admin`: `#a-usuarios` (784), `#a-bitacora` (830: `#b-accion`, `#b-usuario`, `#b-desde`, `#b-hasta`, `#b-tbody`, `#b-count`, botones Actualizar/CSV), `#a-config` (858) | Usuarios, contingencias, emisor y certificado fijos |
| 885–906 | `#dte-result-modal`: `#dr-title`, `#dr-estado`, `#dr-datos`, pestañas, `#dr-json`/`#dr-mh`, `#dr-acciones` | — |
| 908–922 | `#anular-modal`: `#an-doc`, `#an-motivo`, `#an-ok` | — |
| 924–949 | `#nc-modal`: `#nc-doc`, `#nc-receptor`, `#nc-tbody` (inputs `.nc-qty`), `#nc-sin-pendiente`, `#nc-subtotal/#nc-iva/#nc-total`, `#nc-ok` | — |
| 951–968 | `#email-modal` | — |
| 970–972 | `#scrim`, `#toast` | — |

**`frontend/js/app.js`** — actualizado en F4

| Líneas | Contenido | Datos hardcodeados |
|---|---|---|
| 4–20 | `titles`, `show`, `enter(role)` | — |
| 22–71 | Sesión: `usuarioActual`, `esAdmin`, `alertaError`, `_h`, `iniciales`, `doLogin`, `iniciarSesion`, `cerrarSesionLocal` (cierra modales y limpia listas), `logout`, listener `api:no-autenticado` | — |
| 73–98 | `setPanel`, `setPanelById`, `swapPanel` (al abrir `v-historial` / `a-bitacora` recarga desde la API) | — |
| 100–108 | `inventory`, `inventarioVista`, `productoEditando`, `cart`, `selectedDte`, `ymd`, `money` | — |
| 110–205 | Inventario API | — |
| 207–264 | Clientes API (panel) | — |
| 266–280 | Catálogo dropdown | — |
| 282–404 | Venta F3: estado, carrito, totales, `pickDte`, receptor (`renderClientForm`) | — |
| 405–487 | Emisión: `confirmSale`, `ESTADO_UI`, `mostrarResultadoDte(e, det)` (con `det`: receptor, usuario, CCF relacionado, NC, invalidación; pie `#dr-acciones`), `drTab`, `closeDteResult`, `copiarDrActivo` | — |
| 489–492 | Cierra el catálogo al hacer clic fuera | — |
| 494–579 | Transacciones: `MAIL_SVG`, `ESTADO_BADGE` (PROCESADO→Aceptado, INVALIDADO→Anulado, CONTINGENCIA, RECHAZADO), `TIPO_DTE`, `estadoBadge`, `fmtFechaHora`, `simularDe(selId)`, `dtes`, `cargarHistorial`, `accionesDte(d)`, `renderHistorial`, `limpiarFiltrosHistorial`, `verDte`, `trasOperacion` | — |
| 581–591 | `reintentarDte(id)` | — |
| 593–616 | Anular: `abrirAnular`, `closeAnular`, `confirmarAnular` (tipoAnulacion 2) | — |
| 618–671 | NC: `abrirNotaCredito` (GET detalle → `items[].pendiente`), `closeNotaCredito`, `itemsNc`, `calcularNc`, `confirmarNotaCredito` | — |
| 673–717 | Bitácora: `bitacora`, `cargarBitacora`, `cargarBitacoraDiferido`, `resultadoBadge`, `renderBitacora`, `exportarBitacoraCsv` | — |
| 719–771 | Utilidades DTE locales (no usadas por la API): `uuidGen`, `randCode`, `fmtFecha`, `EMISOR`, `numeroALetras`… | `EMISOR` ficticio |
| 773–834 | `buildDteHtml()` (no se llama) | 2 ítems fijos |
| 836–849 | Correo: `openEmailModal`, `closeEmailModal`, `sendEmail` (solo toast) | — |
| 851–882 | `buildPrintHtml()` (no se llama) | — |
| 884–898 | `downloadPdf()` → `PDF_DATA` | PDF fijo |
| 900–903 | Arranque: render inicial + restaurar sesión | — |
| 905–925 | `toggleSidebar`, `closeSidebars`, `toast` | — |

- [x] **F3 — Venta/emisión 01 y 03 (2026-11-04).**
  - Archivos: `index.html` (tipo `#vt-01/#vt-03` en vez de "Venta directa"/modal de facturación —eliminado `#venta-modal`—, etiquetas de totales con id, `.sim-mh` solo ADMIN, `#dte-result-modal` + CSS), `js/app.js` (bloque "Nueva venta" reescrito; quitados `saleMode`, `client`, `DEPARTAMENTOS/MUNICIPIOS/ACTIVIDADES`, `setVentaUI`, `chooseFE`).
  - Receptor: `<select>` con los clientes activos (`clientesVenta`, se recarga al crear un cliente). 01: opcional ("Consumidor final (sin receptor)" = `clienteId: null`). 03: solo CONTRIBUYENTE y obligatorio; al pasar a 03 se descarta un consumidor elegido. Muestra NIT/NRC/actividad del elegido y enlace a "Crear cliente".
  - Totales estimados (el definitivo lo calcula la API): 01 → precio unitario con IVA en centavos como el backend (2.50 → 2.83), "Total gravado (IVA incluido)" + "IVA incluido" = gravado/1.13×0.13; 03 → precio sin IVA, subtotal + IVA 13 % = total. El carrito no deja pasar del stock.
  - Confirmar: `api.dte.emitir(tipo, {clienteId, condicionOperacion:1, items:[{productoId,cantidad,descuento:0}]}, simular)`; luego `GET /api/dte/:id` para `jsonDte` (la respuesta de emisión no trae `totalLetras`). Limpia carrito y recarga productos (stock). Tarjeta/Efectivo = contado (`condicionOperacion` 1; el método no se envía).
  - "Simular MH: OK / Rechazo / Contingencia": `<select>` `.solo-admin`; solo se manda `X-Simular` si es ADMIN y ≠ ok. Se reinicia a OK al iniciar sesión.
  - Modal de resultado: estado (badge PROCESADO/RECHAZADO/CONTINGENCIA), número de control, código de generación, sello (o "sin sello"), fecha, total, total en letras, mensaje y observaciones MH; pestañas "JSON DTE" y "Respuesta firmador / MH" (`<pre>` con `JSON.stringify(...,2)`) y botón Copiar. Errores de la API (p. ej. `STOCK_INSUFICIENTE`) → `toast` warn, sin modal.
  - Verificado en Edge headless con mocks: 33 comprobaciones (01 sin receptor 2×P001 = $5.66 / "CINCO 66/100 USD", 03 40×P001 = 100 + 13 = $113.00 / "CIENTO TRECE 00/100 USD", 03 sin cliente bloqueado, filtro de contribuyentes, límite de stock, simular oculto a VENDEDOR, rechazo sin sello y sin descontar stock, contingencia con `respuestaMh: null` y stock descontado, error de API) + capturas del formulario y del modal.
  - Pendiente: 05 (NC) se emite desde el detalle de un CCF en F4 (necesita `items[].pendiente` de `GET /api/dte/:id`). "Guardar borrador" y el modal de correo siguen siendo solo toast. Sin descuentos por línea en la UI (la API los admite).
- [x] **F4 — Transacciones, NC, anular, reintentar y bitácora (2026-11-04).**
  - Archivos: `index.html` (panel `#v-historial` rehecho y nav "Transacciones"; `#a-bitacora` rehecho; modales `#anular-modal` y `#nc-modal`; pie `#dr-acciones` en el modal de resultado; CSS `.st-rejected`, `.btn-danger`, textarea, `.nc-qty`), `js/app.js` (bloque Transacciones/NC/anular/bitácora; se quitaron `sales`, `dayOffset`, `anularVenta`, `reenviarVenta`).
  - Transacciones / Mis ventas: `GET /api/dte` con `tipo`, `estado`, `desde`, `hasta` (se recarga al cambiar un filtro y al abrir el panel); la búsqueda de texto es local (N° control, código, receptor). Badges: PROCESADO→Aceptado, INVALIDADO→Anulado, CONTINGENCIA→Contingencia, RECHAZADO→Rechazado. Lista todos los DTE (la API no filtra por usuario), tanto para ADMIN como para VENDEDOR.
  - Detalle: "Ver" / clic en el N° control → `GET /api/dte/:id` en el modal de F3, que ahora agrega receptor, usuario, CCF relacionado, NC del CCF (con enlace) e invalidación; la pestaña MH incluye `eventoInvalidacion` (jsonEvento, firmador, respuestaMh). El pie del modal muestra las mismas acciones que la fila.
  - Acciones (`accionesDte`): "Nota de crédito" solo en 03 PROCESADO; "Anular" en PROCESADO; "Reintentar envío" en CONTINGENCIA; RECHAZADO e INVALIDADO sin acciones. Tras cada operación se recarga el listado y el stock y se abre el detalle actualizado.
  - NC: formulario con las líneas del CCF (cantidad, acreditada, pendiente, precio) e input por línea (0…pendiente, validado en el cliente); estimado = precio CCF × cantidad + 13 % (la API prorratea descuentos). `POST /api/dte/05 {dteRelacionadoId, items:[{productoId,cantidad}]}`.
  - Anular: modal con motivo obligatorio (máx. 200), `tipoAnulacion` 2. Evento rechazado → aviso y el DTE sigue vigente; contingencia → 503 `MH_NO_DISPONIBLE` en toast; CCF con NC vigente → 409 en toast.
  - "Simular MH" de Transacciones (`#h-simular`, solo ADMIN) aplica a NC, anular y reintentar; el de Nueva venta (`#v-simular`) solo a 01/03. `simularDe(selId)`.
  - Bitácora (panel de Administración): `GET /api/bitacora` con `accion`, `usuario` (con espera de 300 ms al escribir), `desde`, `hasta`, `limite` 500; columnas fecha, usuario, acción, entidad #id, resultado (badge), detalle. Export CSV en el cliente (BOM UTF-8, comillas escapadas, `bitacora-YYYY-MM-DD.csv`).
  - Verificado en Edge headless con mocks: 41 comprobaciones (filtros, badges, acciones por estado, detalle, NC con validaciones, stock devuelto y pendiente 40→35, documentoRelacionado, anular CCF con NC → 409, reintento → PROCESADO, anular sin motivo / contingencia / rechazo / ok → INVALIDADO y stock devuelto, bitácora con filtros y CSV, vendedor sin simulador) + capturas.
  - Pendiente (fuera de alcance): "Panel gerencial" (`#app-gerente`), Usuarios y Configuración del admin siguen con datos fijos; "Guardar borrador", el envío por correo y el PDF siguen simulados; anulación tipo 1/3 (con `codigoGeneracionR`) no está en la UI. Falta una prueba manual contra el backend real (`USE_MOCK = false`).

## Integración

- Express sirve `frontend/` en `http://localhost:3000/`; la API en `/api`. El frontend puede usar rutas relativas (`/api/...`).
- Instalar BD: `sqlcmd -S localhost -E -C -f 65001 -i db/01_schema.sql` y luego `db/02_seed.sql` (pasos completos en `README.md`).
- [x] **I1 — Integración frontend ↔ API real (2026-11-04).**
  - Estático: ya lo servía `backend/src/app.js` desde B1 (`express.static(frontend/)` después de las rutas `/api` y del 404 de API); verificado `GET /` y `/js/*.js` → 200.
  - `frontend/js/api.js`: `USE_MOCK: false`. `mocks.js` se sigue cargando para volver al modo sin backend cambiando una línea.
  - Contrato: script que corre el mismo flujo (32 pasos: login, catálogos, 01/03/05, errores 400/403/404/409/503, invalidación ok/rechazo/contingencia, reintento, listados, bitácora) contra `MockApi` y contra la API real y compara la forma de las respuestas. **Códigos HTTP y de error iguales en todos los pasos.** Las diferencias estaban en el mock (la API real coincide con `schemas-mh/`), así que se corrigió `mocks.js`: `resumen` con `ivaRete`/`ivaPerci`/`observaciones` (no `ivaRete1`/`ivaPerci1`/`reteRenta`), 05 con `totalNoGravado`, `totalPagar` y `noGravado` en ítems, `items[].ivaItem` numérico en 03/05, `datos` de bitácora de INVALIDACION como el backend. Resultado: 0 diferencias de forma. Los textos de algunos mensajes de error siguen redactados distinto en el mock (solo cosmético).
  - `docs/API.md`: solo aclaraciones (sin cambio de contrato): `ivaItem` siempre numérico en el detalle; forma de `datos` de bitácora por acción.
  - Recorrido de UI contra la API real (Edge headless, scripts de `localhost:3000`): 44 comprobaciones (login/roles/403, inventario crear-editar-desactivar con redondeo 1.005 → 1.01, clientes con NIT inválido/normalizado, 01, 03, NC, anular CCF bloqueado, anular factura con stock devuelto, contingencia → reintento, filtros, bitácora + CSV, token inválido) y el guion de `docs/DEMO.md` paso a paso: 26 comprobaciones con los montos y textos del guion. Sin cambios en `app.js`.
  - `db/03_reset_demo.sql` creado pero **no ejecutado** (la sesión no tuvo permiso para borrar datos de la BD).

## Cambios de contrato

- B1: nuevo `GET /api/health` (sin token); nuevo código de error `DB_NO_DISPONIBLE` (503); estado `BORRADOR` documentado como interno.
- B4: nuevo código `MH_NO_DISPONIBLE` (503); invalidar responde `estadoEvento` y `jsonEvento` según esquema v3 (sin `montoIva`, `fecEmi/horEmi` en lugar de `fecAnula/horAnula`, documento con datos del receptor); `tipoAnulacion` 1/3 con `codigoGeneracionR`; `GET /api/dte` agrega filtro `clienteId` y campos `clienteId`, `dteRelacionadoId`; `GET /api/dte/:id` agrega `subtotal`, `iva`, `condicionOperacion`, `usuario`, `cliente`, `dteRelacionado`, `notasCredito`, items con `acreditada/pendiente` en 03; `invalidacion` con `estado`; `GET /api/bitacora` con filtros y campos `entidad`, `entidadId`, `datos`.
- B3: emisión responde 201; `X-Simular` inválido → 400; contingencia descuenta stock; `jsonDte` sin `extension` (esquemas MH), 01 `version 2`, 03 `version 4`, direcciones con `distrito`; `clienteId` del ejemplo 03 = 3 (id real del seed).
- B2: nuevo código `SIN_PERMISO` (403); campo `activo` en productos y clientes; `GET /:id` en productos y clientes; `?incluirInactivos=1`; PUT parcial; POST responde 201; nit/nrc normalizados a dígitos; acciones de bitácora `LOGIN_FALLIDO`, `CREAR`, `ACTUALIZAR`.

## Pendientes

- **Antes de la demo:** la BD local tiene datos de las pruebas de I1 (22 DTE: 12 tipo 01, 5 tipo 03 y 5 tipo 05; 2 productos `I…` desactivados; 2 clientes "Cliente integración …"; el stock de P001, P002, P003, P006, P008 y P009 movido). Ejecutar `sqlcmd -S localhost -E -C -f 65001 -i db/03_reset_demo.sql` para que los números de control empiecen en 001, como en `docs/DEMO.md`.
- Fuera del MVP (simulado o fijo en la UI): panel gerencial, usuarios y configuración del admin, borradores, envío por correo/PDF, anulación tipo 1/3 en la UI, edición de clientes en la UI, descuentos por línea en la UI.
- ~~`/api/health` en verde con `sa`~~ (hecho en B3).
- Ninguno en backend. Opcional: reintentar invalidación más tarde si MH no responde (hoy el cliente simplemente repite la llamada).
