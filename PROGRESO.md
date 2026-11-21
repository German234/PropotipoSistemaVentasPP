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
- **C1 Evento de contingencia — HECHO (2026-11-05).** DTE emitidos en contingencia con `tipoModelo/tipoOperacion 2`; `POST/GET /api/contingencia` (esquema v4) y panel *Administración → Contingencia*. Cambio de contrato (ver abajo).
- **Q1 Pruebas automatizadas — HECHO (2026-11-06).** Jest + Supertest + Ajv: 256 pruebas al cerrar Q1, 281 tras C2, 309 tras C3 (7 suites unitarias, 11 de integración contra la BD aislada `BatallonAtlacatl_Test`), cobertura ≈ 99 % de líneas *(cifras históricas de Q1; vigentes en Q2)*. Flujos 01/03/05, rechazo, contingencia y reintento, evento de contingencia (C1), invalidación. Encontró y se corrigió un bug de `redondear2` (NC → 500). Sin cambios de contrato.
- **C2 Lotes de contingencia — HECHO (2026-11-06).** Lote manual ("Enviar lote ahora" con todos los pendientes) y lote automático del cierre del día (hora configurable); recepción por lote simulada con `codigoLote`; panel *Contingencia* rehecho y accesible desde el menú del POS. 281 pruebas en verde. Cambio de contrato (ver abajo).
- **C3 Cola de consultas a MH — HECHO (2026-11-06).** `X-Simular: timeout` (MH recibió pero la respuesta se perdió); durante el día se consulta en MH un DTE en contingencia por turno (round-robin, intervalo configurable) y los que MH sí tenía quedan PROCESADO con su sello original; consulta puntual `POST /api/dte/:id/consultar`. 309 pruebas en verde. Cambio de contrato (ver abajo).
- **P1 PDF real del DTE — HECHO (2026-11-06).** `GET /api/dte/:id/pdf` genera la representación gráfica con la plantilla del PDF de ejemplo; "Descargar PDF" (modal de correo en Transacciones) la descarga. Cambio de contrato (ver abajo).
- **P2 Datos completos del cliente con catálogos MH — HECHO (2026-11-06).** El formulario de clientes selecciona departamento → municipio → distrito (CAT-012/013, reforma 2024) y tipo de documento (CAT-022); captura nombre comercial y teléfono; el backend valida los códigos y los copia al receptor del DTE. Nuevo `GET /api/catalogos`. Cambio de contrato (ver abajo).
- **S1 Autorización de invalidación — HECHO (2026-11-20).** `POST /api/dte/:id/invalidar` solo para `ADMIN` (`requireRol` + política `ROLES_INVALIDAR`); VENDEDOR → 403 `SIN_PERMISO`; la UI oculta "Anular" a quien no tiene permiso. **Decisión de negocio pendiente de validar con el Product Owner** (¿qué roles pueden invalidar?). 329 pruebas en verde. Cambio de contrato (ver abajo).
- **C4 Tareas programadas persistentes (Fase 5) — HECHO (2026-11-20).** La configuración del lote automático y de la cola de consultas vive en SQL Server (`dbo.config_tarea`) y se recupera al reiniciar; candado en BD contra ejecuciones duplicadas (y un lote por día como máximo); cada ejecución y error en `dbo.ejecucion_tarea`; nuevo `GET /api/contingencia/ejecuciones`. Hacienda sigue simulada. 469/469 Jest (23 suites), 16/16 e2e. **Aplicar `db/01_schema.sql` a la BD de la demo.** Cambio de contrato (ver abajo).
- **Q2 Evidencia de QA (Fase 4) — HECHO (2026-11-20).** Ejecución registrada en `docs/qa/2026-11-20/`: `npm ci` OK; `npm test` **458/458 en 22 suites**; cobertura backend **96.39 % sentencias · 84.42 % ramas · 98.22 % funciones · 98.20 % líneas**; e2e Playwright **16/16**; BD de la demo sin cambios (huella SHA-256 de 12 tablas). Nuevas: matriz de autorización (74), regresión del reset (1), 6 archivos e2e. Defecto corregido: el reset no restauraba los clientes del seed. **Estas son las cifras vigentes**; las de bloques anteriores son históricas.
- **S2 Seguridad (Fase 3) — HECHO (2026-11-20).** CORS por lista, 500 genéricos, límite de intentos de login (429), sesión del navegador en cookie HttpOnly + CSRF (Bearer sigue igual), credenciales demo solo en local, cabeceras + CSP, `uuid` eliminado. Detalle, riesgos y pruebas en `docs/SEGURIDAD.md`. 383 pruebas en verde. Cambio de contrato (ver abajo).
- **KAN-34 Edición de clientes — HECHO (2026-11-20).** Botón Editar por cliente, formulario en modo edición con catálogos MH en cascada, `PUT /api/clientes/:id`, actualización de la fila sin recargar. 346 pruebas en verde. Sin cambios de contrato.
- **KAN-36 Bitácora solo ADMIN — HECHO (2026-11-20).** `GET /api/bitacora` pasa de cualquier rol autenticado a solo ADMIN (`requireRol(...ROLES_LEER_BITACORA)`, KAN-32); el registro de las acciones de todos los roles no cambia. Pruebas: matriz de autorización, `consultas` (VENDEDOR 403, ADMIN 200, registro del vendedor), e2e `02-roles`. Antes de corregir: 6 fallan; después: Jest 546/546, e2e 21/21; mutación M8 detectada. `docs/kan-23/` regenerado (567/567, 47/47 requisitos). Cambio de contrato (ver abajo).
- **F7 Evidencias KAN-23: seguridad, QA y riesgos (Fase 7) — HECHO (2026-11-20).** Carpeta `docs/kan-23/`: matriz de 28 controles (25 verificados con prueba) y 10 pendientes, autorización ruta × rol (40/40 rutas, 108 casos), 11 hallazgos corregidos y 11 abiertos (3 medios), QA (560/560 casos, cobertura 96.72/84.86/98.34/98.45), 6 defectos, trazabilidad 46/46 requisitos generada desde los resultados, mutación de controles 6/7 (1 equivalente), matriz de 30 riesgos (residual 2 altos, 10 medios, 18 bajos). BD de la demo intacta (huella). Sin cambios de contrato.
- **F6 Pantallas que eran maqueta (Fase 6) — HECHO (2026-11-20).** Borradores con backend real, envío por correo **simulado y declarado como tal** (solo bitácora), panel gerencial con `GET /api/reportes/resumen`, CRUD de usuarios y emisor real en solo lectura con el firmador identificado como simulado. Ningún botón dice que guardó/envió/exportó sin hacerlo. Jest 537/537 (24 suites), e2e 21/21. **Aplicar `db/01_schema.sql` a la BD de la demo** (tabla `borrador`). Cambio de contrato (ver abajo).
- ✅ **MVP COMPLETO (2026-11-04).** Backend B1–B4 + frontend F1–F4 integrados: login con roles, catálogos, emisión 01/03/05, invalidación, contingencia y reintento, transacciones y bitácora, todo contra SQL Server. Guion de demo verificado de punta a punta.

## Mapa de archivos

| Ruta | Propósito |
|---|---|
| `CLAUDE.md` | Reglas del proyecto, convenciones y reglas DTE |
| `PROGRESO.md` | Este índice de avance |
| `docs/API.md` | Contrato de la API (fuente de verdad) |
| `db/01_schema.sql` | Esquema idempotente (11 tablas): usuarios, emisor, clientes, productos, correlativos, dte, dte_detalle, evento_invalidacion, evento_contingencia (+ `origen`, `codigo_lote`, `respuesta_lote` con ALTER idempotente, C2), evento_contingencia_dte, bitacora; C3: `dte` + `consultas_mh`/`ultima_consulta_mh` (ms)/`resultado_consulta_mh` y tabla `mh_simulado_dte` (lado de Hacienda del simulador) |
| `db/02_seed.sql` | Seed idempotente: admin/admin123, vendedor/vendedor123, emisor M001/P001, 10 productos, 2 consumidores, 2 contribuyentes, correlativos 01/03/05 = 0 |
| `db/03_reset_demo.sql` | Reinicia los datos de demo: borra DTE, eventos (invalidación y contingencia) y bitácora; correlativos en 0; productos/clientes como el seed (borra los creados después); reinicia ids de DTE. No toca usuarios ni emisor |
| `db/genHash.js` | `node db/genHash.js <clave>...` imprime hashes bcrypt (usa bcryptjs de backend/) |
| `backend/package.json` | Dependencias; scripts `start`, `dev` (node --watch), `test`, `test:unit`, `test:integration`, `test:coverage` (devDeps: jest, supertest, ajv, ajv-formats) |
| `backend/.env.example` | DB_SERVER (o DB_HOST), DB_PORT (opcional), DB_ENCRYPT/DB_TRUST_CERT (opcionales), DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET, PORT, CONTINGENCIA_LOTE_HORA/ACTIVO (C2), CONSULTA_MH_ACTIVO/INTERVALO_SEG (C3). Copiar a `.env` |
| `backend/src/server.js` | Carga `.env`, levanta el servidor y arranca los temporizadores del lote automático y de la cola de consultas a MH |
| `backend/src/app.js` | Express: cors, json, rutas `/api/*`, 404 API, estáticos de `frontend/`, manejador de errores. **Registrar aquí las rutas nuevas** |
| `backend/src/config/db.js` | Pool mssql lazy; `query(sql, params)`; `withTransaction(async ({tx, query}) => ...)` |
| `backend/src/services/tareasProgramadas.js` | Fase 5: config persistente de tareas (`config_tarea`), candado de ejecución en BD (`adquirir`/`liberar`), registro (`ejecucion_tarea`), `listarEjecuciones` |
| `backend/tests/integration/tareasProgramadas.test.js` | Fase 5: reinicio real (procesos hijos), temporizador real de la cola, callbacks programados del lote y la cola, candado entre procesos, errores |
| `backend/tests/e2e/` | Playwright: `playwright.config.js` (servidor propio en 3099 con la BD de pruebas, Edge), `globalSetup.js`, `helpers.js` y 6 `*.spec.js` (login, roles, clientes, venta/DTE, invalidación/PDF, contingencia) |
| `backend/tests/integration/autorizacion.test.js` | Matriz de autorización: 28 rutas × sin token / token manipulado / VENDEDOR / ADMIN |
| `backend/tests/integration/resetDemo.test.js` | Regresión: `db/03_reset_demo.sql` restaura los clientes del seed |
| `backend/tests/tools/huellaBdDemo.js` | Huella de solo lectura (filas + SHA-256 por tabla) de la BD de la demo; `--comparar` |
| `backend/tests/tools/reporteKan23.js` | Fase 7: genera `docs/kan-23/generado/` (trazabilidad, autorización ruta × rol, casos, cobertura) desde los resultados de Jest/Playwright; sale con 1 si un requisito queda sin pruebas o falla |
| `docs/kan-23/` | Fase 7 (hito KAN-23): `README.md` (índice y cómo reproducir), `SEGURIDAD.md`, `QA.md`, `RIESGOS.md`, `generado/` y `evidencia/` (salidas, cobertura, e2e, mutación, huellas, barrido de secretos) |
| `docs/qa/2026-11-20/` | Evidencia de QA: `INFORME.md`, salidas de comandos, cobertura, reporte y capturas e2e, huellas de la BD |
| `backend/src/config/seguridad.js` | Config de seguridad desde `.env`: orígenes CORS, límite de login, cookie Secure, credenciales demo, JWT_SECRET débil |
| `backend/src/middleware/seguridad.js` | `corsConfigurado` (lista de orígenes) y `cabecerasSeguridad` (CSP, nosniff, frame, referrer, no-store en /api) |
| `backend/src/middleware/limiteLogin.js` | Límite de intentos fallidos de login en memoria (usuario+IP e IP) → 429 |
| `backend/src/utils/cookies.js` | Cookies `pos_token` (HttpOnly) y `pos_csrf`: leer, poner y borrar |
| `docs/SEGURIDAD.md` | Fase 3: cada cambio de seguridad, riesgo corregido, prueba y variables de entorno |
| `backend/src/services/usuariosService.js`, `controllers/usuariosController.js`, `routes/usuarios.js` | Fase 6: `GET/POST/PUT /api/usuarios` (solo ADMIN): bcrypt, no auto-desactivarse, siempre un ADMIN activo (UPDLOCK) |
| `backend/src/services/borradoresService.js`, `controllers/borradoresController.js`, `routes/borradores.js` | Fase 6: `GET/POST/PUT/DELETE /api/borradores` (por usuario; total estimado con `calculos.js`) |
| `backend/src/services/reportesService.js`, `routes/reportes.js` | Fase 6: `GET /api/reportes/resumen` (solo ADMIN): totales, por día/tipo/vendedor/estado en centavos |
| `backend/src/services/correoService.js` | Fase 6: `POST /api/dte/:id/correo` SIMULADO (solo bitácora `CORREO_SIMULADO`, `enviado:false`) |
| `backend/tests/integration/fase6.test.js` | Fase 6: usuarios, borradores, correo simulado y reportes (36 pruebas) |
| `backend/tests/e2e/07-fase6.spec.js` | Fase 6: las 5 pantallas en el navegador contra la API real |
| `backend/src/config/politicas.js` | Políticas de autorización por operación: `ROLES_INVALIDAR = ['ADMIN']` (pendiente de validar con el PO) |
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
| `backend/src/dte/builders/comun.js` | Piezas compartidas: identificacion, emisor, direcciones (con `distrito`), ítem, pagos; `enContingencia(json)` (tipoModelo/tipoOperacion 2, tipoContingencia 1) |
| `backend/src/dte/builders/factura01.js`, `ccf03.js` | `construir({...})` → JSON completo 01 v2 / 03 v4 |
| `backend/src/dte/builders/notaCredito05.js` | `construir({..., ccf:{codigoGeneracion, fecEmi, receptor}})` → JSON 05 v4 (receptor copiado del CCF) |
| `backend/src/dte/builders/contingencia.js` | `construir({codigoGeneracion, fTransmision, hTransmision, emisor, responsable, dtes, motivo})` → evento de contingencia v4 |
| `backend/src/dte/simuladores/mhContingencia.js` | `recibirEvento({codigoGeneracion}, modo)` → respuesta MH del evento de contingencia o `null` (sin respuesta); `recibirLote({idEnvio})` → `RECIBIDO` + `codigoLote` (C2) |
| `backend/src/dte/builders/invalidacion.js` | `construir({codigoGeneracion, fecEmi, horEmi, emisor, dte, motivo})` → evento de invalidación v3 |
| `backend/src/dte/simuladores/mhAnulacion.js` | `anular({codigoGeneracion}, modo)` → respuesta MH del evento o `null` (sin respuesta) |
| `backend/src/dte/simuladores/firmador.js` | `firmar(json, modo)` → `{status:"OK", body: JWS falso}` |
| `backend/src/dte/simuladores/mhConsulta.js` | C3: `consultar(registro, codigoGeneracion, modo)` → respuesta PROCESADO original, NO ENCONTRADO (004) o `null` |
| `backend/src/dte/simuladores/mhRegistro.js` | C3: "BD de Hacienda" (`mh_simulado_dte`): `guardarSinRespuesta(q, …)` (timeout) y `buscar(q, codigo)` |
| `backend/src/dte/simuladores/mhRecepcion.js` | `leerModo(req)` (X-Simular, incl. `timeout`), `sinRespuesta(modo)`, `recibir({codigoGeneracion}, modo)` → respuesta MH o `null` (contingencia), `generarSello()`, `fhProcesamiento()` |
| `backend/src/services/dteService.js` | (C3: timeout guarda el original en `mh_simulado_dte`; `transmitir` devuelve el sello original si MH ya lo tenía; `aplicarRegistroMh`, `cargarDteBloqueado` exportados) Escrituras, cada una en una transacción: `emitir` (01/03), `emitirNotaCredito` (05), `reintentar`, `invalidar`. Comparten `enviarYGuardar`, `ajustarStock`, `pendientesAcreditar`; `transmitir(q, d, usuario, modo, codigoEvento?)` (reintento y evento de contingencia) |
| `backend/src/services/contingenciaService.js` | `enviar(body, usuario, modo, origen)` (evento + recepción por lote + transmisión, una transacción), `listar()`, `obtener(id)`, `ultimoDeDte(dteId)`, `contarPendientes()` |
| `backend/src/services/consultaMhService.js` | C3: cola de consultas. `consultar(id, usuario, modo)` (puntual), `consultarSiguiente(modo)` (un turno, READPAST), `iniciar`/`detener`, `obtener`/`actualizar` (GET/PUT consultas). Config en memoria |
| `backend/src/services/loteAutomaticoService.js` | C2: lote del cierre del día. Config en memoria (`activo`, `hora`; inicial desde `.env`), `proximaEjecucion(hora)`, `ejecutar(modo)` (no lanza; `ultimaEjecucion`), `iniciar`/`detener` (setTimeout), `obtener`/`actualizar` (GET/PUT programacion) |
| `backend/src/controllers/contingenciaController.js`, `routes/contingencia.js` | `POST /api/contingencia` (ADMIN, 201), `GET /`, `GET /:id` (cualquier rol); `GET /programacion` (cualquier rol), `PUT /programacion` (ADMIN); `GET/PUT /consultas` (C3) |
| `backend/src/services/dteConsultasService.js` | `listar(filtros)`, `obtener(id)` (JSON parseado, items con pendientes, NC, evento de invalidación, `eventoContingencia`) |
| `backend/src/services/bitacoraService.js` | `listar(filtros)` para `GET /api/bitacora` |
| `backend/src/controllers/bitacoraController.js`, `routes/bitacora.js` | `GET /api/bitacora` (cualquier rol) |
| `backend/src/controllers/dteController.js`, `routes/dte.js` | `POST /api/dte/01|03|05` (201), `POST /:id/invalidar|reintentar|consultar` (200), `GET /`, `GET /:id` (cualquier rol) |
| `backend/requests.http` | Ejemplos de todos los endpoints (REST Client de VS Code) |
| `frontend/index.html` | Solo HTML + CSS del prototipo (≈67 KB, 1019 líneas). Carga `js/mocks.js`, `api.js`, `pdf-data.js`, `app.js` en ese orden. Servido por Express en `/`. Mapa de vistas en *Frontend → Mapa del prototipo* |
| `frontend/js/app.js` | Lógica de UI (globales para los `onclick` inline). F2: sesión, inventario y clientes; F3: venta y emisión 01/03; F4: transacciones, NC 05, anular, reintentar y bitácora contra `api.*`; C1: panel Contingencia; Fase 6: borradores, correo simulado, panel gerencial, usuarios y config del emisor (bloque antes de `toggleSidebar`) |
| `frontend/js/api.js` | Cliente HTTP: `API_CONFIG` (`BASE_URL:'/api'`, `USE_MOCK: false` desde I1), `ApiError`, `api.*` por endpoint, token en localStorage |
| `frontend/js/mocks.js` | `MockApi.handle(method, path, query, body, headers)` → `{status, body}`: backend simulado en memoria con la forma exacta de `docs/API.md` (seed, firmador, respuestaMh, X-Simular) |
| `frontend/js/pdf-data.js` | `var PDF_DATA` = PDF de ejemplo en base64 (226 KB); `downloadPdf()` solo lo usa en modo mock. Es la plantilla de `dte/pdf.js`. No abrir |
| `backend/src/dte/catalogosMh.js` | P2: catálogos MH (UMD): `departamentos` (CAT-012 → CAT-013 → distritos), `tiposDocumento` (CAT-022), `buscar(dep, mun, dis)`, `textoDireccion(dir)`. Express lo sirve como `/js/catalogos-mh.js` (global `CATALOGOS_MH`). Única fuente de esos códigos |
| `backend/src/controllers/catalogosController.js`, `routes/catalogos.js` | P2: `GET /api/catalogos` (cualquier rol) |
| `backend/src/dte/pdf.js` | P1: `generar(dte)` (resultado de `dteConsultasService.obtener`) → Buffer PDF con la plantilla de `pdf-data.js` (PDFKit + qrcode) |
| `backend/tests/integration/pdf.test.js` | P1: `GET /api/dte/:id/pdf` (01, 01 contingencia, 03, 05, 401, 404). `PDF_OUT=<carpeta>` guarda los PDF para revisarlos |
| `schemas-mh/` | Esquemas JSON oficiales MH (01 v2, 03 v4, 05 v4, invalidación v3, contingencia v4). Solo referencia |
| `.gitignore` | Ignora node_modules y .env |
| `README.md` | Instalación (scripts de `db/`, `.env`, `npm start`), usuarios de prueba, reinicio de demo, modo mocks, problemas frecuentes |
| `docs/DEMO.md` | Guion de demo de 5 minutos con los valores esperados (BD reiniciada) y plan B |
| `docs/PRUEBAS.md` | Cómo correr las pruebas y matriz requisito (CLAUDE.md / API.md) → prueba para QA |
| `backend/jest.config.js` | Proyectos Jest `unit` (sin BD) e `integration` (globalSetup crea la BD de pruebas); cobertura de `src/` |
| `backend/tests/setupEnv.js`, `globalSetup.js` | Carga `.env` y fuerza `DB_NAME=BatallonAtlacatl_Test` (o `DB_TEST_NAME`; prohíbe la BD de la demo); crea y siembra esa BD |
| `backend/tests/helpers/testDb.js` | `crearBd()` / `reiniciarBd()` con los scripts reales de `db/` (sin USE/PRINT/DBCC) |
| `backend/tests/helpers/api.js` | `prepararApi()` → reinicia BD, tokens admin/vendedor, `prod`/`cli` del seed, `emitir`, `reintentar`, `invalidar`, `detalle`, `stock`, `bitacora`; regex de UUID/sello/numeroControl |
| `backend/tests/helpers/schemas.js` | Ajv con `schemas-mh/` + matcher `toCumplirEsquemaMh('01'|'03'|'05'|'invalidacion')` |
| `backend/tests/fixtures/datos.js` | Emisor, productos y clientes fijos para las unitarias |
| `backend/tests/unit/*.test.js` | utilidades, numeroALetras, calculos, simuladores, builders (+ esquemas MH), contingencia (enContingencia + evento v4 + lote + próxima ejecución/temporizador + timeout/consulta MH + temporizador de la cola), middleware |
| `backend/tests/integration/*.test.js` | auth, catalogos, dte01.factura, dte03.ccf, dte05.notaCredito, contingencia, eventoContingencia, loteContingencia (C2), consultaMh (C3), invalidacion, consultas |

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

- [x] **Q1 — Pruebas automatizadas del backend (2026-11-06).**
  - `npm test` (desde `backend/`) corre 256 pruebas en ~13 s; `test:unit` no necesita BD; `test:coverage` → `backend/coverage/` (en `.gitignore`). Cobertura: 97 % sentencias, 85 % ramas, 99 % líneas *(al cerrar Q1; vigente: Q2)*.
  - Integración con Supertest sobre `app` (sin abrir puerto) contra `BatallonAtlacatl_Test`: se crea sola con `db/01` + `db/02` y cada archivo la reinicia con `db/03` en `beforeAll`. `--runInBand` obligatorio (comparten BD).
  - Todo JSON DTE y evento generado se valida con ajv contra `schemas-mh/` (`multipleOfPrecision`).
  - Bug corregido: `utils/dinero.js` `redondear2` devolvía `NaN` con residuos en notación exponencial (`4.4e-16`) → NC de 3 de 10 × $1.10 respondía 500. Ahora < 0.005 → 0. Con pruebas de regresión.
  - Matriz requisito → prueba en `docs/PRUEBAS.md`. ~~Pendiente (fuera de alcance): pruebas automatizadas del frontend~~ (Playwright en Q2).

- [x] **C4 — Tareas programadas persistentes, Fase 5 (2026-11-20).**
  - Archivos: nuevo `services/tareasProgramadas.js`; reescritos `services/loteAutomaticoService.js` y la parte de cola/temporizador de `services/consultaMhService.js` (`consultarEnTx` y `consultar` sin cambios: reintento y seguimiento de DTE intactos); `server.js` (espera la config guardada, mensajes de arranque, apagado ordenado SIGINT/SIGTERM); `routes/contingencia.js` + `controllers/contingenciaController.js` (`GET /ejecuciones`); `db/01_schema.sql` (`config_tarea`, `ejecucion_tarea`); `db/03_reset_demo.sql` (borra ambas); `.env.example`; pruebas: nuevo `tests/integration/tareasProgramadas.test.js` (15), quitados los 2 bloques unitarios de temporizador en memoria de `tests/unit/contingencia.test.js` (4 pruebas); docs `API.md`, `PRUEBAS.md`, `README.md`.
  - Decisiones: el `.env` solo siembra la primera fila; después manda la BD y el reset vuelve al `.env`. Cada disparo relee la config (si otro proceso la desactivó, no ejecuta). Candado = `UPDATE` condicionado con vencimiento (lote 10 min, cola 2 min) + el flag en memoria; el temporizador del lote exige no haber corrido ese día (`ultima_ejecucion_dia`). Se registra toda ejecución salvo los turnos de la cola con la cola vacía. `ERROR` con mensaje genérico; el detalle solo en `ejecucion_tarea.error` y el log. Sin recuperación de un lote perdido mientras el servidor estaba apagado (los DTE van en el siguiente). Si faltan las tablas o la BD cae, el servidor arranca igual y reintenta leer la config cada 60 s.
  - Verificado: 469/469 (23 suites), cobertura 96.49/84.85/98.36/98.33; e2e 16/16; arranque sin tablas probado contra `master` (servidor arriba, aviso claro); BD de la demo sin cambios (huella).
  - Pendiente: aplicar `db/01_schema.sql` a la BD de la demo; mostrar el registro de ejecuciones en el panel Contingencia (hoy solo por API); pruebas del reintento de 60 s con la BD caída (sin cubrir).

- [x] **Q2 — Evidencia de QA, Fase 4 (2026-11-20).** Informe: `docs/qa/2026-11-20/INFORME.md`.
  - Archivos nuevos: `tests/e2e/*` (Playwright), `tests/integration/autorizacion.test.js`, `tests/integration/resetDemo.test.js`, `tests/tools/huellaBdDemo.js`, `docs/qa/2026-11-20/*`. Modificados: `package.json` (`@playwright/test` 1.58.0 dev, script `test:e2e`), `jest.config.js` (reporter `json-summary`), `db/03_reset_demo.sql` (restaura los 4 clientes del seed con todos sus datos), `.gitignore` (`e2e-report/`, `test-results/`), `README.md` y `docs/PRUEBAS.md` (cifras reales, `npm ci`, e2e, JWT_SECRET, credenciales demo).
  - Resultados: línea base 383/383 (20 suites); final 458/458 (22 suites: 114 unitarias, 344 integración); e2e 16/16; cobertura 96.39/84.42/98.22/98.20; `npm audit` 0.
  - Decisiones: e2e con el Edge instalado (`channel: msedge`) para no descargar navegadores; servidor e2e propio en 3099 sin temporizadores; huella de la BD de la demo antes/después en vez de suponer el aislamiento. Playwright 1.49 descartado por GHSA-7mvr-c777-76hp.
  - D2 (herramienta de pruebas): el reporte de Playwright serializaba `process.env` (DB_PASSWORD, JWT_SECRET) por `webServer.env`; corregido antes de llegar a Git, reportes regenerados y revisados contra los valores reales de `.env`.
  - Defecto: D1 reset sin restaurar clientes (lo destapó la matriz de autorización; 456/457 antes de corregir). Verificación de la matriz por mutación (sin `requireRol` en `POST /api/productos` → 4 fallos).
  - Pendiente: cobertura de código del frontend; e2e en otros navegadores; e2e de Nota de crédito y bitácora en la UI.

- [x] **S2 — Seguridad, Fase 3 (2026-11-20).** Detalle completo en `docs/SEGURIDAD.md`.
  - Archivos nuevos: `config/seguridad.js`, `middleware/seguridad.js`, `middleware/limiteLogin.js`, `utils/cookies.js`, `tests/integration/seguridad.test.js`, `docs/SEGURIDAD.md`. Modificados: `app.js` (cabeceras, CORS, `x-powered-by` off, `TRUST_PROXY`, `/js/mocks.js` vacío fuera de local), `server.js` (aviso/bloqueo por JWT_SECRET débil, log de CORS), `middleware/auth.js` (Bearer o cookie + CSRF, `HS256` fijo), `middleware/errores.js` (500 genérico con referencia, 413), `routes/auth.js` + `controllers/authController.js` (límite, cookies, `logout`, `sesion`), `services/authService.js` (claim `csrf`, hash de relleno), `routes/health.js` (sin error del driver; `demo`), `package.json` (sin `uuid`), `.env.example`, `tests/unit/middleware.test.js`; frontend `js/api.js` (sin token en localStorage, `X-CSRF-Token`, `sesion()`, `logout()` al servidor), `js/app.js` (restaura sesión con `/auth/sesion`, credenciales demo desde health), `js/mocks.js` (`/auth/sesion`, `/auth/logout`, `demo`), `index.html` (sin credenciales fijas).
  - Decisiones: Bearer se conserva (pruebas y clientes de API, sin CSRF); el navegador usa la cookie. CSRF = claim del JWT comparado con `X-CSRF-Token`. CSP con `script-src-attr 'unsafe-inline'` para no reescribir los ~100 `onclick`. Límite de login en memoria (una instancia). Sin dependencias nuevas.
  - Verificado: 383/383 pruebas; recorrido en Edge sin ventana (CSP con clics reales, cookies, CSRF, PDF, recarga, logout, 429) y de nuevo el de KAN-34; modo mock probado en Node.
  - Pendiente: migrar `onclick` a `addEventListener` para una CSP estricta; revocación de JWT en el servidor; límite de login compartido (Redis) si hay varias instancias; cambiar contraseñas del seed en un despliegue real.

- [x] **S1 — Autorización de invalidación (2026-11-20).**
  - Archivos: nuevo `backend/src/config/politicas.js`; modificados `routes/dte.js` (`requireRol(...ROLES_INVALIDAR)` en `/:id/invalidar`), `tests/integration/invalidacion.test.js` (la prueba "VENDEDOR puede invalidar" pasa a: sin token 401 / VENDEDOR 403 sin efectos en estado, stock ni bitácora / ADMIN funcional), `frontend/js/app.js` (`puedeInvalidar()` oculta "Anular" en Transacciones y en el modal del DTE; guarda en `abrirAnular`), `frontend/js/mocks.js` (`requireAdmin` en invalidar), `docs/API.md`.
  - Decisiones: la autorización va antes de buscar el DTE (VENDEDOR recibe 403 aunque el id no exista); un intento denegado no se registra en bitácora (igual que los demás 403). La lista de roles del frontend replica la del backend; la API es la fuente de verdad.
  - Pendiente: **validar con el Product Owner** qué roles pueden invalidar (hoy solo ADMIN); si cambia, editar `ROLES_INVALIDAR` en `politicas.js` y en `app.js`.

## Frontend (F1–F4)

Plan propuesto (ajustable):

- [x] **F1 — Separación del JS + cliente HTTP + mocks (2026-11-04).** Sin cambios visuales ni de comportamiento.
  - `index.html` 309 KB → 50 KB: el `<script>` inline pasó **sin modificar** a `js/app.js` (verificado con diff) y el PDF base64 a `js/pdf-data.js`. Siguen siendo scripts clásicos (globales), así los `onclick` inline funcionan igual.
  - `js/api.js`: `api.request(method, path, {query, body, simular, auth})` → Promise con `data`; error → `ApiError {codigo, mensaje, status}`. Token/usuario en `localStorage` (`pos.token`, `pos.usuario`); `NO_AUTENTICADO` limpia la sesión y emite el evento `api:no-autenticado` en `document`. Red caída → `codigo: 'SIN_CONEXION'` (solo cliente). Helpers: `api.login` (guarda sesión), `logout`, `getUsuario`, `isLoggedIn`, `health`, `productos.{listar,obtener,crear,actualizar}`, `clientes.{…}`, `emisor`, `dte.{emitir(tipo,payload,simular), factura, ccf, notaCredito, invalidar(id,body,simular), reintentar(id,simular), listar, obtener}`, `bitacora(filtros)`; C1: `contingencia.{enviar(body,simular), listar, obtener}`.
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
  - ~~Pendiente F3~~ (resuelto en F3): el carrito aún calcula IVA como subtotal × 0.13 sin distinguir 01/03; el form de cliente de Nueva venta sigue siendo libre (F3 debe elegir un cliente de `clientes`/API). ~~Editar clientes no está en la UI~~ (hecho en KAN-34).
- [x] **KAN-34 — Edición de clientes en la UI (2026-11-20).**
  - Archivos: `index.html` (columna de acciones con ✏️ en la tabla de clientes, `#cli-form-title`, botón `#cli-cancel`; el botón guardar llama `guardarCliente()`), `js/app.js` (`editarCliente(id)`, `limpiarFormCliente()`, `reemplazarCliente(c)`; `crearCliente` → `guardarCliente` que crea o actualiza), `backend/tests/integration/catalogos.test.js` (bloque *Clientes · edición (KAN-34)*, 17 pruebas).
  - Flujo: ✏️ → `GET /api/clientes/:id` (datos vigentes) → el mismo formulario en modo edición, con depto → municipio → distrito cargados en cascada → `api.clientes.actualizar(id, datos)` → se reemplaza la fila en `clientes` y en `clientesVenta` (sin volver a listar) y se repinta el selector de Nueva venta.
  - Validaciones: se conservan las locales de alta (nombre, dirección completa, NIT/NRC/actividad del contribuyente, número de documento) y las de la API (`normalizar`); el error 400 se muestra como "No se pudo actualizar: <mensaje de la API>" y el formulario sigue en edición.
  - Decisiones: al editar un consumidor no se envían `nrc`/`codActividad`/`descActividad` (no están en su formulario; la API conserva los actuales). Una dirección anterior a P2 (solo texto) que no se toca no se envía, y la API la conserva. Sin cambios de contrato ni de backend.
  - Verificado: 346/346 pruebas; recorrido en Edge headless contra la API real (BD de pruebas): alta consumidor/contribuyente, editar, NRC/actividad inválidos, edición válida, fila actualizada sin listar de nuevo, GET del cliente, CCF emitido con el receptor editado, cancelar; sin errores JS.

### Mapa del prototipo (no releer los archivos completos)

Roles de UI del prototipo: vendedor / gerente / admin. La API solo tiene `ADMIN` y `VENDEDOR` (F2: "gerente" y "admin" solo para ADMIN; ambos roles usan la pantalla vendedor como POS).

**`frontend/index.html`** (CSS en 10–414; `.solo-admin` en 223; estilos F3 en 274–280, F4 en 281–293; `.dr-row > span` solo la etiqueta) — actualizado en C1

| Líneas | Vista / bloque | Datos hardcodeados |
|---|---|---|
| 419–447 | `#login`: `#login-user`, `#login-pass`, `#login-btn` → `doLogin()` | Pista de usuarios de prueba |
| 449–478 | `#app-vendedor` sidebar (Nueva venta, Inventario, Clientes, Transacciones, Borradores, `.solo-admin` Panel gerencial / Administración) + topbar (`#v-title`, `#v-avatar`) | Badge "MH en línea" |
| 480–529 | `#v-venta`: `#v-client-form`, `#v-prod-search`/`#v-catalog`, `#v-cart`, `#vt-01`/`#vt-03`, totales, pago, `.sim-mh` `#v-simular`, `#v-confirmar` | — |
| 531–567 | `#v-historial` (Transacciones / Mis ventas): `#h-search` (local), `#h-tipo`, `#h-estado`, `#h-desde`, `#h-hasta`, `.sim-mh` `#h-simular`, `#h-tbody`, `#h-count` | — |
| — | `#v-borradores` (Fase 6: `#bo-tbody`, `#bo-count`; en Nueva venta `#v-borrador-btn`, `#v-borrador-info`) | — |
| 583–605 | `#v-inventario` | — |
| 607–646 | `#v-clientes` | — |
| — | `#app-gerente` (Fase 6): filtros `#g-mes`/`#g-tipo`; `#g-dash` (`#kpi-netas`, `#kpi-docs`, `#kpi-ticket`, `#kpi-contingencia`, `#g-bars`, `#g-donut`, `#g-legend`), `#g-ventas` (`#gv-tbody`), `#g-reportes` (`#gr-vend-tbody`) | — |
| — | `#app-admin`: nav (Usuarios, Contingencia, Bitácora, Configuración), `#a-usuarios` (Fase 6: `#u-tbody`, `#u-inactivos`, form `#u-usuario/#u-nombre/#u-rol/#u-password/#u-save`, `#u-log`; tarjeta "Cola de contingencia" `#cq-badge`), `#a-contingencia`, `#a-bitacora` (`#b-accion` incl. ELIMINAR, CORREO_SIMULADO), `#a-config` (Fase 6: `#cfg-emisor` solo lectura + tarjeta "Firmador simulado") | — |
| 926–947 | `#dte-result-modal`: `#dr-title`, `#dr-estado`, `#dr-datos`, pestañas (`#dr-tab-json` cambia entre "JSON DTE" y "JSON evento"), `#dr-json`/`#dr-mh`, `#dr-acciones` | — |
| 949–963 | `#anular-modal`: `#an-doc`, `#an-motivo`, `#an-ok` | — |
| 965–990 | `#nc-modal`: `#nc-doc`, `#nc-receptor`, `#nc-tbody` (inputs `.nc-qty`), `#nc-sin-pendiente`, `#nc-subtotal/#nc-iva/#nc-total`, `#nc-ok` | — |
| — | `#email-modal` (Fase 6: badge "Simulado", `#email-send` "Registrar envío simulado") | — |
| 1011–1013 | `#scrim`, `#toast` | — |

**`frontend/js/app.js`** — actualizado en C1

| Líneas | Contenido | Datos hardcodeados |
|---|---|---|
| 4–21 | `titles`, `show`, `enter(role)` (gerente/admin → `contarContingencia()`) | — |
| 23–74 | Sesión: `usuarioActual`, `esAdmin`, `alertaError`, `_h`, `iniciales`, `doLogin`, `iniciarSesion`, `cerrarSesionLocal` (cierra modales y limpia listas), `logout`, listener `api:no-autenticado` | — |
| 75–101 | `setPanel`, `setPanelById`, `swapPanel` (al abrir `v-historial` / `a-contingencia` / `a-bitacora` recarga desde la API) | — |
| 103–111 | `inventory`, `inventarioVista`, `productoEditando`, `cart`, `selectedDte`, `ymd`, `money` | — |
| 113–208 | Inventario API | — |
| 210–267 | Clientes API (panel) | — |
| 269–283 | Catálogo dropdown | — |
| 285–407 | Venta F3: estado, carrito, totales, `pickDte`, receptor (`renderClientForm`) | — |
| 408–494 | Emisión: `confirmSale`, `ESTADO_UI`, `mostrarResultadoDte(e, det)` (con `det`: receptor, usuario, CCF relacionado, NC, evento de contingencia, invalidación; pie `#dr-acciones`), `drTab`, `closeDteResult`, `copiarDrActivo` | — |
| 496–499 | Cierra el catálogo al hacer clic fuera | — |
| 501–586 | Transacciones: `MAIL_SVG`, `ESTADO_BADGE`, `TIPO_DTE`, `estadoBadge`, `fmtFechaHora`, `simularDe(selId)`, `dtes`, `cargarHistorial`, `accionesDte(d)`, `renderHistorial`, `limpiarFiltrosHistorial`, `verDte`, `trasOperacion` | — |
| 588–598 | `reintentarDte(id)` | — |
| 600–623 | Anular: `abrirAnular`, `closeAnular`, `confirmarAnular` (tipoAnulacion 2) | — |
| 625–678 | NC: `abrirNotaCredito`, `closeNotaCredito`, `itemsNc`, `calcularNc`, `confirmarNotaCredito` | — |
| 680–788 | Contingencia (C1): `ctPendientes`, `ctEventos`, `TIPO_CONTINGENCIA`, `actualizarColaContingencia`, `contarContingencia`, `irAContingencia`, `cargarContingencia`, `renderContingencia`, selección (`seleccionContingencia`, `marcarTodosContingencia`, `syncTodosContingencia`), `enviarEventoContingencia`, `verEventoContingencia`, `mostrarEventoContingencia` (usa `#dte-result-modal`) | — |
| 790–834 | Bitácora: `bitacora`, `cargarBitacora`, `cargarBitacoraDiferido`, `resultadoBadge`, `renderBitacora`, `exportarBitacoraCsv` | — |
| 836–888 | Utilidades DTE locales (no usadas por la API): `uuidGen`, `randCode`, `fmtFecha`, `EMISOR`, `numeroALetras`… | `EMISOR` ficticio |
| 890–951 | `buildDteHtml()` (no se llama) | 2 ítems fijos |
| — | Correo: `openEmailModal` (propone el correo del receptor), `closeEmailModal`, `sendEmail` → `POST /api/dte/:id/correo` (simulado) | — |
| 968–999 | `buildPrintHtml()` (no se llama) | — |
| 1001–1015 | `downloadPdf()` → `PDF_DATA` | PDF fijo |
| 1017–1020 | Arranque: render inicial + restaurar sesión | — |
| 1022–1042 | `toggleSidebar`, `closeSidebars`, `toast` | — |

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

- [x] **F6 — Pantallas que eran maqueta, Fase 6 (2026-11-20).** Backend + frontend + mocks + pruebas.
  - Inventario previo: Borradores (2 filas fijas; "Guardar borrador" solo toast), correo ("Enviar" decía "enviado" sin enviar), panel gerencial (KPIs, gráficos, tablas y exportaciones fijos; solo el KPI de contingencia era real), usuarios (4 usuarios inventados, botones falsos), configuración (emisor ficticio distinto al de la BD, certificado "Habilitado" inventado, "Guardar" falso).
  - Aprobado por el usuario y hecho, por funcionalidad:

    | Pantalla | Ahora | Lo que sigue sin existir (y la UI lo dice) |
    |---|---|---|
    | Borradores | Tabla `borrador` + `/api/borradores` (por usuario). Guardar / actualizar, lista real, Continuar (avisa stock o productos/cliente que cambiaron), Eliminar; se borra al emitir (se conserva si MH rechaza) | No reservan stock |
    | Correo | `POST /api/dte/:id/correo` **simulado**: solo bitácora `CORREO_SIMULADO`, responde `enviado:false`. Modal con badge "Simulado", aviso y botón "Registrar envío simulado"; toast "NO se envió ningún correo". Propone el correo del receptor. "Descargar PDF" sigue real | No hay SMTP |
    | Panel gerencial | `GET /api/reportes/resumen` (ADMIN): ventas netas/brutas, NC, documentos, ticket, por estado/día/tipo/vendedor; filtros mes + tipo; tabla Ventas con `GET /api/dte` (+ `usuario`); CSV reales generados en el navegador | Exportar a PDF (botón quitado, aviso en la tarjeta) |
    | Usuarios | `GET/POST/PUT /api/usuarios` (ADMIN): crear, editar nombre/rol/contraseña, activar/desactivar; tarjeta de actividad con `GET /api/bitacora` | Revocación inmediata de sesiones (el JWT vive hasta 8 h; el confirm lo advierte) |
    | Configuración | Emisor real de `GET /api/emisor`, **solo lectura** (sin inputs ni "Guardar"); tarjeta "Firmador simulado — sin certificado" con badge "Simulado" | Edición del emisor; certificado y firma reales (el firmador simulado no se tocó) |

    Además: el badge del POS "MH en línea" pasó a "MH simulado".
  - Archivos backend: nuevos `services/{usuarios,borradores,reportes,correo}Service.js`, `controllers/{usuarios,borradores}Controller.js`, `routes/{usuarios,borradores,reportes}.js`; modificados `app.js` (3 rutas), `routes/dte.js` + `controllers/dteController.js` (`/:id/correo`), `services/dteConsultasService.js` (`usuario` en el listado), `db/01_schema.sql` (tabla `borrador`), `db/03_reset_demo.sql` (borra borradores; deja solo los 2 usuarios del seed con sus contraseñas). Pruebas: nuevo `tests/integration/fase6.test.js`, `tests/e2e/07-fase6.spec.js`; `autorizacion.test.js` (+11 rutas: 5 solo ADMIN, 6 de cualquier rol; la comprobación "sin efectos" mira solo la bitácora posterior a la foto), `consultas.test.js` (campo `usuario`).
  - Archivos frontend: `index.html` (5 pantallas, modal de correo, opciones de bitácora, badge MH), `js/app.js` (bloque Fase 6; `swapPanel`, `enter`, sesión, `confirmSale`, correo, `toast` tipo `info`), `js/api.js` (`usuarios`, `borradores`, `reportes`, `dte.correo`), `js/mocks.js` (los mismos endpoints; login respeta `activo`).
  - Decisiones: usuarios solo ADMIN; el login no se cambia; contraseña 8–72 bytes; duplicado → 400 como productos; quedarse sin ADMIN activo → 409 `ESTADO_INVALIDO`. Borradores: el de otro usuario → 404; sin validar el cliente del 03 (se valida al emitir). Reportes: vigente = PROCESADO + CONTINGENCIA; sumas en centavos; período máx. 366 días; el panel usa el mes completo. Correo de un DTE RECHAZADO → 409. El reset ahora restaura usuarios (antes "no tocaba usuarios") porque se pueden crear y editar desde la UI.
  - Verificado: Jest 537/537 (24 suites: 110 unitarias, 427 integración), cobertura 96.72 / 84.86 / 98.34 / 98.45; e2e 21/21 (Edge) con capturas revisadas; mocks probados en Node (borrador 5.66 → 113, ajeno 404, correo `enviado:false`, reportes, usuarios).
  - Pendiente: aplicar `db/01_schema.sql` a la BD de la demo (sin la tabla `borrador`, `/api/borradores` responde 500); revocar el JWT de un usuario desactivado; edición del emisor (si se aprueba: `PUT /api/emisor` con validaciones).

- [x] **F7 — Evidencias KAN-23, Fase 7 (2026-11-20).** Documentación de seguridad, QA y riesgos con evidencia regenerada.
  - Archivos: nuevos `docs/kan-23/{README,SEGURIDAD,QA,RIESGOS}.md`, `docs/kan-23/generado/*` (generados), `docs/kan-23/evidencia/*`, `backend/tests/tools/reporteKan23.js`; modificados `tests/integration/autorizacion.test.js` (+ `GET /api/contingencia/ejecuciones`, la única ruta protegida que faltaba: 40/40), `docs/PRUEBAS.md`, `docs/SEGURIDAD.md` (enlace), `PROGRESO.md`.
  - Ejecución: huella de la BD de la demo → `npm ci` → `npm audit` (0) → Jest con cobertura y `--json` (539/539) → e2e (21/21) → 7 mutaciones de controles de acceso (6 detectadas; M6 `alg: none` equivalente porque `jsonwebtoken` ya lo rechaza) → huella (0 cambios) → barrido de secretos (sin fugas; las coincidencias de `DB_PASSWORD` son casuales y no se reproducen en la evidencia).
  - Hallazgos nuevos (abiertos): **la app se conecta como `sa` con una contraseña local débil** (H-A2/H-A3); **un ADMIN degradado conserva permisos con su token hasta 8 h** (H-A1, agravado por la Fase 6); **la BD de la demo no tiene `config_tarea`, `ejecucion_tarea` ni `borrador`** (H-A9). Revisión de código: SQL 100 % parametrizado; ningún dato de la API llega a `innerHTML` sin `_h()`.
  - Decisiones: los responsables de la matriz de riesgos van por rol (PO, BE, FE, QA, DBA), porque el nombre se asigna en el tablero KAN; escala 3×3 (nivel = P × I).
  - Pendiente: acciones de `docs/kan-23/RIESGOS.md` § *Acciones recomendadas* (la 1, aplicar el esquema a la BD de la demo, antes de la demo).

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

## Contingencia

- [x] **C1 — Evento de contingencia (2026-11-05).** Backend + frontend + mocks.
  - Archivos nuevos: `dte/builders/contingencia.js`, `dte/simuladores/mhContingencia.js`, `services/contingenciaService.js`, `controllers/contingenciaController.js`, `routes/contingencia.js`. Modificados: `db/01_schema.sql` (+2 tablas), `db/03_reset_demo.sql`, `app.js` (ruta), `builders/comun.js` (`enContingencia`), `dteService.js` (JSON de contingencia + `transmitir`), `dteConsultasService.js` (`eventoContingencia`), `requests.http` (pasos 6–6d), `frontend/index.html`, `js/app.js`, `js/api.js`, `js/mocks.js`, `docs/API.md`, `docs/DEMO.md` (opcional "Evento de contingencia"), `CLAUDE.md` (regla de contingencia).
  - Emisión sin respuesta de MH: el JSON pasa a `tipoModelo 2`, `tipoOperacion 2`, `tipoContingencia 1`, `motivoContin null` y se vuelve a firmar (el PROCESADO sigue en modelo previo). `reintentar` reenvía ese mismo JSON.
  - `POST /api/contingencia` (ADMIN, 201): `{dteIds?, motivo?}`; sin `dteIds` = todos los CONTINGENCIA (máx. 1000). Una transacción: DTE con UPDLOCK → JSON v4 → firma → MH (X-Simular). PROCESADO → guarda el evento y transmite cada DTE con MH ok (`transmitir`, bitácora `REINTENTO` con `codigoGeneracionEvento`). RECHAZADO → se guarda; DTE siguen en CONTINGENCIA. Sin respuesta → 503 `MH_NO_DISPONIBLE`, solo bitácora `SIN_RESPUESTA`. `GET /api/contingencia` y `/:id` (cualquier rol).
  - BD: `evento_contingencia` (estado PROCESADO/RECHAZADO, json, firma, respuesta, sello, f_inicio/f_fin) y `evento_contingencia_dte` (evento_id, dte_id, no_item): un DTE puede estar en varios eventos (rechazado y luego aceptado). Aplicado a la BD local.
  - Decisiones: `tipoContingencia` fijo en 1 (lo único que simula el sistema; así coincide con el de los DTE); responsable = usuario del token con DUI `000000000` (como la invalidación); `fInicio` = emisión del DTE más antiguo del evento, `fFin` = envío; X-Simular aplica solo al evento (los DTE se transmiten con ok); el reintento individual se conserva.
  - UI: *Administración → Contingencia* (`#a-contingencia`): pendientes con checkboxes (todos marcados), motivo, Simular MH, "📡 Enviar evento y transmitir"; tabla de eventos con "Ver" → modal (pestañas JSON evento / firmador + MH, DTE con enlace a su detalle). El detalle del DTE muestra *Evento de contingencia* con enlace. Tarjeta "Cola de contingencia" de Usuarios y KPI del panel gerencial con el conteo real. Filtro de bitácora CONTINGENCIA. CSS `.dr-row > span`: los badges dentro del modal ya no heredan el ancho mínimo de la etiqueta (también afectaba a NC/invalidación).
  - Verificado: 44 comprobaciones de API contra la BD real (JSON 01/03/05 en contingencia y eventos validados con ajv contra `schemas-mh/`, permisos, 400/404/409/503, rechazo, subconjunto, todos, stock, reintento individual, bitácora); el mismo guion contra `mocks.js`: 44/44. Recorrido en Edge headless contra la API real: 25/28 (las 3 diferencias eran del guion: contaba los eventos de la prueba anterior) + capturas, sin errores JS.
  - Pendiente: la BD local quedó con datos de estas pruebas (DTE 3–10, 6 eventos de contingencia; antes había solo 2 DTE); correr `db/03_reset_demo.sql` antes de la demo. Tipos de contingencia 2–5 y el envío automático periódico no están (fuera de alcance).

- [x] **C2 — Lotes de contingencia (2026-11-06).** Backend + frontend + mocks + pruebas.
  - Archivos nuevos: `services/loteAutomaticoService.js`, `tests/integration/loteContingencia.test.js`. Modificados: `db/01_schema.sql` (3 columnas en `evento_contingencia`, ALTER idempotente; **aplicado a la BD local**), `mhContingencia.js` (`recibirLote`), `contingenciaService.js` (origen, lote, `contarPendientes`), controller/rutas (`/programacion`), `server.js` (temporizador), `.env.example`, `frontend/index.html`, `js/app.js`, `js/api.js` (`contingencia.programacion/programar`), `js/mocks.js`, `tests/unit/contingencia.test.js`, `docs/API.md`, `docs/PRUEBAS.md`, `docs/DEMO.md`, `README.md`.
  - Lote = evento de contingencia v4 + (si MH lo acepta) recepción por lote: `jsonLote {ambiente, idEnvio, version 2, nitEmisor, documentos: JWS de cada DTE}` → MH `RECIBIDO` + `codigoLote` → cada DTE se transmite (`transmitir`) y queda PROCESADO con sello. Se guarda en `codigo_lote`/`respuesta_lote`.
  - Manual: "📦 Enviar lote ahora (N DTE)" = `POST /api/contingencia` sin `dteIds` (todos los pendientes del momento). Se quitaron los checkboxes de selección de la UI (la API sigue aceptando `dteIds`). Reintento individual por fila.
  - Automático: `setTimeout` a la próxima `HH:mm` (hora local), luego se reprograma; todos los pendientes, firmado por el primer ADMIN activo, motivo fijo de cierre, MH en `ok`. Sin pendientes → `SIN_PENDIENTES` en bitácora (sin evento); rechazo / sin respuesta → los DTE quedan para el siguiente lote. Solo corre con `server.js` (las pruebas llaman a `ejecutar()`).
  - Decisiones: programación en memoria (inicial desde `.env`; un PUT se pierde al reiniciar) para no agregar otra tabla; un solo proceso de servidor (sin bloqueo distribuido; dos lotes simultáneos se serializan por UPDLOCK y el segundo encuentra la cola vacía); se marca en rojo un DTE con más de 24 h en contingencia (plazo para reportarlo).
  - UI (`#a-contingencia`): tarjeta *Lote automático* (estado, activo, hora, Guardar, próximo y último lote con enlace), cola con antigüedad + Reintentar, motivo, Simular MH, "Enviar lote ahora", tabla *Lotes enviados* (origen ⏰/✋, código de lote). Modal "Lote de contingencia" con código y resultado del lote; pestaña MH incluye `lote`. Botón **Contingencia** con contador en el menú del POS (solo ADMIN) y contador en el menú de Administración. `contarContingencia()` al iniciar sesión y tras cada operación.
  - Verificado: 281/281 pruebas; servidor real contra la BD de pruebas con la hora 2 min adelante → el temporizador disparó el lote (2 DTE PROCESADO, `codigoLote`) y se reprogramó para el día siguiente; recorrido en Edge headless (contador del menú, programación, guardar hora, lote manual, modal, cola vacía) sin errores JS + capturas.
  - Pendiente: la programación no persiste entre reinicios; los mocks no tienen temporizador (solo GET/PUT de programación).
- [x] **C3 — Cola de consultas a MH (2026-11-06).** Backend + frontend + mocks + pruebas.
  - Problema: un DTE puede quedar en CONTINGENCIA porque la **respuesta** de MH se perdió aunque MH sí lo recibió. Simulación: `X-Simular: timeout` guarda en `mh_simulado_dte` el JSON/firma original y su respuesta PROCESADO (sello) y para el POS se comporta como `contingencia`.
  - Archivos nuevos: `services/consultaMhService.js`, `dte/simuladores/mhConsulta.js`, `dte/simuladores/mhRegistro.js`, `tests/integration/consultaMh.test.js`. Modificados: `db/01_schema.sql` (3 columnas en `dte` + tabla `mh_simulado_dte`; **aplicado a la BD local**), `db/03_reset_demo.sql`, `mhRecepcion.js` (`timeout`, `sinRespuesta`), `mhAnulacion.js`, `mhContingencia.js`, `dteService.js`, `dteConsultasService.js` (`consultaMh`), controllers/rutas, `loteAutomaticoService.js` (exporta `usuarioSistema`), `server.js`, `.env.example`, `frontend/index.html`, `js/app.js`, `js/api.js`, `js/mocks.js`, `tests/unit/contingencia.test.js`, `docs/API.md`, `docs/PRUEBAS.md`, `docs/DEMO.md`, `README.md`, `CLAUDE.md` (X-Simular).
  - Cola: `setTimeout` encadenado cada `intervaloSeg` (defecto 60 s); cada turno toma **un** DTE en CONTINGENCIA (`UPDLOCK, READPAST`), orden: nunca consultados → consulta más antigua → id (`ultima_consulta_mh` DATETIME2(3) para que no empaten dos turnos en el mismo segundo). ENCONTRADO → PROCESADO con el sello original, JSON/firma de MH (modelo previo), stock igual. NO_ENCONTRADO / SIN_RESPUESTA → sigue y pasa al final. Firmada por el primer ADMIN activo, MH en `ok`.
  - Decisiones: bitácora `CONSULTA_MH` solo para consultas manuales y para ENCONTRADO (los turnos automáticos sin novedad solo actualizan columnas, para no inundar la bitácora); reintento y lote consultan `mh_simulado_dte` y no duplican el documento; config en memoria como C2.
  - UI: tarjeta *Cola de consultas a MH* (estado, activo, intervalo, próxima consulta con el DTE que sigue y cuenta regresiva, última consulta automática); columna *Consulta MH* en la cola (Siguiente / Turno N, consultas y resultado) y botón **Consultar** por fila; "Consultar MH" en Transacciones para DTE en CONTINGENCIA; fila *Consultas a MH* en el detalle; opción *Timeout (MH lo recibió)* en los tres "Simular MH". El panel se refresca solo cada 10 s mientras está abierto (sin pisar inputs editados) y el contador del menú también; tras un error (p. ej. 409 porque la cola ya lo resolvió) recarga.
  - Verificado: 309/309 pruebas; servidor real con la cola a 10 s y 3 DTE (contingencia, timeout, contingencia): un DTE por turno, el de timeout ENCONTRADO en su turno, los otros rotando; recorrido en Edge headless (consulta manual, auto-refresco, guardar intervalo) sin errores JS + capturas; mocks: emisión timeout, consulta, PUT, reintento.
  - Pendiente: config no persiste entre reinicios; la cola no se pausa durante el lote (no hace falta: los bloqueos lo serializan).

## Cambios de contrato

- KAN-36: `GET /api/bitacora` pasa de "cualquier rol autenticado" a **solo ADMIN**; otro rol → 403 `SIN_PERMISO`. La UI no cambia (la bitácora solo se muestra en Administración). Mocks iguales.

- F6: nuevos `GET/POST/PUT /api/usuarios` (solo ADMIN), `GET/POST/PUT/DELETE /api/borradores` (cualquier rol, por usuario), `GET /api/reportes/resumen` (solo ADMIN) y `POST /api/dte/:id/correo` (cualquier rol, **simulado**: `enviado:false`). `GET /api/dte` agrega `usuario`. Bitácora: acciones `ELIMINAR` y `CORREO_SIMULADO`, entidad `borrador`. `ESTADO_INVALIDO` también para "debe quedar al menos un ADMIN activo". `db/03_reset_demo.sql` borra borradores y restaura los usuarios del seed.

- C4: `GET/PUT /api/contingencia/programacion` y `/consultas` persisten la configuración (antes en memoria); `ultimaEjecucion`/`ultimaConsulta` salen de la BD y sobreviven a reinicios; nuevo resultado `OMITIDA`; `ERROR` con mensaje genérico; nuevo `GET /api/contingencia/ejecuciones?tarea=&limite=` (cualquier rol).
- S2: autenticación también por cookie HttpOnly `pos_token` (+ `X-CSRF-Token` en escrituras; 403 `CSRF_INVALIDO`); login pone cookies y su JWT trae el claim `csrf`; nuevos `POST /api/auth/logout` y `GET /api/auth/sesion`; 429 `DEMASIADOS_INTENTOS` en login; 500 con mensaje genérico; 413 por cuerpo > 1 MB; `GET /api/health` agrega `demo` y su 503 ya no incluye el error del driver; CORS solo para `CORS_ORIGENES`.
- S1: `POST /api/dte/:id/invalidar` pasa de "cualquier rol autenticado" a solo `ADMIN`; otro rol → 403 `SIN_PERMISO`.
- P2: clientes con `nombreComercial`, `tipoDocumento`, `numDocumento`, `telefono` y `direccion` **objeto** `{departamento, municipio, distrito, complemento}` con códigos MH validados (antes texto libre); CONTRIBUYENTE exige dirección completa y `codActividad` de 5–6 dígitos (antes 2–6). Nuevo `GET /api/catalogos`. `GET /api/emisor` agrega `direccion.distrito` (seed: municipio 23 San Salvador Centro, distrito 14). El receptor del DTE lleva documento, teléfono, nombre comercial (03) y la dirección del cliente.
- P1: nuevo `GET /api/dte/:id/pdf` (cualquier rol) → `application/pdf` (no JSON; errores sí en JSON estándar).
- C3: `X-Simular` admite `timeout` (para el POS = contingencia; MH sí guardó el DTE; en eventos = sin respuesta). Nuevos `POST /api/dte/:id/consultar` (cualquier rol), `GET /api/contingencia/consultas` (cualquier rol) y `PUT` (ADMIN, `{activo?, intervaloSeg?}`). `GET /api/dte/:id` agrega `consultaMh`. Reintento/lote de un DTE que MH ya tenía → sello original (con `observaciones`) y JSON de modelo previo. Bitácora: acción `CONSULTA_MH`; `ACTUALIZAR` con entidad `consultas_mh`.
- C2: `POST/GET /api/contingencia` y `GET /:id` agregan `origen` (`MANUAL`|`AUTOMATICO`) y `codigoLote`; `POST` y `GET /:id` agregan `lote` (`{codigoLote, idEnvio, procesados, rechazados, jsonLote, respuestaMh}` o `null` si el evento fue rechazado). Nuevos `GET /api/contingencia/programacion` (cualquier rol) y `PUT` (ADMIN, `{activo?, hora?}`). Bitácora: `CONTINGENCIA` con `origen` (y `SIN_PENDIENTES` del lote automático); `ACTUALIZAR` con entidad `programacion_contingencia`.

- C1: nuevos `POST /api/contingencia` (ADMIN, 201), `GET /api/contingencia`, `GET /api/contingencia/:id`; `GET /api/dte/:id` agrega `eventoContingencia`; el `jsonDte` de un DTE emitido en contingencia lleva `tipoModelo 2`, `tipoOperacion 2`, `tipoContingencia 1`; `MH_NO_DISPONIBLE` también para el evento de contingencia; bitácora: acción `CONTINGENCIA` (entidad `evento_contingencia`) y `REINTENTO` con `codigoGeneracionEvento`.
- B1: nuevo `GET /api/health` (sin token); nuevo código de error `DB_NO_DISPONIBLE` (503); estado `BORRADOR` documentado como interno.
- B4: nuevo código `MH_NO_DISPONIBLE` (503); invalidar responde `estadoEvento` y `jsonEvento` según esquema v3 (sin `montoIva`, `fecEmi/horEmi` en lugar de `fecAnula/horAnula`, documento con datos del receptor); `tipoAnulacion` 1/3 con `codigoGeneracionR`; `GET /api/dte` agrega filtro `clienteId` y campos `clienteId`, `dteRelacionadoId`; `GET /api/dte/:id` agrega `subtotal`, `iva`, `condicionOperacion`, `usuario`, `cliente`, `dteRelacionado`, `notasCredito`, items con `acreditada/pendiente` en 03; `invalidacion` con `estado`; `GET /api/bitacora` con filtros y campos `entidad`, `entidadId`, `datos`.
- B3: emisión responde 201; `X-Simular` inválido → 400; contingencia descuenta stock; `jsonDte` sin `extension` (esquemas MH), 01 `version 2`, 03 `version 4`, direcciones con `distrito`; `clienteId` del ejemplo 03 = 3 (id real del seed).
- B2: nuevo código `SIN_PERMISO` (403); campo `activo` en productos y clientes; `GET /:id` en productos y clientes; `?incluirInactivos=1`; PUT parcial; POST responde 201; nit/nrc normalizados a dígitos; acciones de bitácora `LOGIN_FALLIDO`, `CREAR`, `ACTUALIZAR`.

- [x] **P1 — PDF real del DTE (2026-11-06).**
  - Archivos: nuevo `backend/src/dte/pdf.js`, `tests/integration/pdf.test.js`; modificados `routes/dte.js` + `controllers/dteController.js` (`pdf`), `package.json` (`pdfkit`, `qrcode`), `frontend/js/api.js` (`api.dte.pdf(id)` → Blob), `frontend/js/app.js` (`openEmailModal(numeroControl, id)`; `downloadPdf()` pide el PDF real y cae a `PDF_DATA` en modo mock), `docs/API.md`.
  - Decisiones: el PDF se genera en el backend desde `jsonDte` (lo transmitido), carta, una página salvo muchos ítems (pagina con cabecera repetida y "Página X de Y"); la marca del encabezado usa el `nombreComercial` del emisor con el logo de la plantilla; QR = URL de consulta pública de MH (ambiente, codGen, fechaEmi); NIT/NRC/teléfono con guiones; sello de agua INVALIDADO/RECHAZADO/CONTINGENCIA.
  - Verificado: prueba de integración en verde y revisión visual de 01, 01 en contingencia, 03 y 05.
  - Pendiente: el envío por correo sigue simulado.

- [x] **P2 — Datos completos del cliente con catálogos MH (2026-11-06).**
  - Archivos nuevos: `dte/catalogosMh.js`, `controllers/catalogosController.js`, `routes/catalogos.js`. Modificados: `db/01_schema.sql` (clientes: `tipo_documento`, `num_documento`, `nombre_comercial`, `telefono`, `direccion_departamento/municipio/distrito`; emisor: `direccion_distrito`; **aplicado a la BD local**), `db/02_seed.sql` (emisor 06/23/14 y clientes del seed completos, también si ya existían), `services/clientesService.js` (validación contra el catálogo; exporta `COLS`/`aCliente`), `services/dteService.js` (`cargarCliente` con la misma forma), `services/emisorService.js`, `builders/comun.js` (`direccionCliente` usa los códigos del cliente; `numDocumento` DUI con guion), `factura01.js`, `ccf03.js`, `dte/pdf.js` (dirección con nombres), `app.js` (ruta + archivo estático), `frontend/index.html`, `js/app.js`, `js/api.js` (`api.catalogos()`), `js/mocks.js`, pruebas (`catalogos`, `dte01`, `dte03`, `builders`, fixtures), `docs/API.md`.
  - Decisiones: los catálogos viven en código (no en BD) porque son fijos; un solo archivo UMD para backend y mocks. Distrito = código del antiguo municipio dentro del departamento. Clientes anteriores a P2 (solo texto) siguen funcionando: el DTE usa los códigos del emisor. Actividad económica (CAT-019, ~770 códigos) sigue como código + descripción libres.
  - UI: selects encadenados Departamento → Municipio → Distrito + Complemento (obligatorios para contribuyente); tipo/número de documento para consumidor; nombre comercial y teléfono; columnas Documento y Ubicación en la lista; resumen del cliente en Nueva venta con documento, teléfono y dirección completa.
  - Verificado: 326/326 pruebas; mocks emitiendo 01/03 válidos contra `fe-f-v2`/`fe-ccf-v4`; recorrido en Edge headless contra la API real (crear contribuyente en San Miguel Centro, CCF con receptor 12/22/17, PDF) sin errores JS.
  - Pendiente: ~~edición de clientes en la UI~~ (KAN-34); validar los códigos de distrito contra el CAT oficial vigente del MH.

## Pendientes

- **Antes de la demo:** la BD local tiene los datos de las pruebas de C1 (DTE 3–10, 6 eventos de contingencia, bitácora y stock de P001, P002, P003, P005, P006 movidos). Ejecutar `sqlcmd -S localhost -E -C -f 65001 -i db/03_reset_demo.sql` para que los números de control empiecen en 001, como en `docs/DEMO.md`.
- ~~Fuera del MVP: panel gerencial, usuarios y configuración del admin, borradores, envío por correo~~ (Fase 6: reales, salvo el correo, que es simulado y lo dice; y el emisor, de solo lectura). Siguen fuera: anulación tipo 1/3 en la UI, descuentos por línea en la UI, exportar reportes a PDF, edición del emisor, SMTP real.
- **Fase 6:** aplicar `db/01_schema.sql` a la BD de la demo (tabla `borrador`).
- ~~`/api/health` en verde con `sa`~~ (hecho en B3).
- Ninguno en backend. Opcional: reintentar invalidación más tarde si MH no responde (hoy el cliente simplemente repite la llamada).
