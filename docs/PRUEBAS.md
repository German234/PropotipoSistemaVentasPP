# Pruebas automatizadas (QA)

Suite de **Jest + Supertest + Ajv** en `backend/tests/`. Resultado actual: **309 pruebas, 18 suites, todas en verde**; cobertura del backend ≈ 96 % de sentencias y 98 % de líneas.

## Cómo correrlas

```bash
cd backend
npm install            # instala jest, supertest, ajv, ajv-formats (devDependencies)
npm test               # todo (unitarias + integración), ~25 s
npm run test:unit      # solo lógica pura, sin BD (~2 s)
npm run test:integration
npm run test:coverage  # + reporte en backend/coverage/index.html
```

**Requisitos de las pruebas de integración:** SQL Server encendido y `backend/.env` configurado (las mismas credenciales de la API). El usuario necesita permiso para `CREATE DATABASE`.

**Aislamiento:** las pruebas **nunca** tocan la BD de la demo (`BatallonAtlacatl`). Crean y usan `BatallonAtlacatl_Test` (otro nombre con `DB_TEST_NAME`), le aplican los scripts reales `db/01_schema.sql` y `db/02_seed.sql`, y cada archivo de integración la reinicia con `db/03_reset_demo.sql` antes de empezar. Se pueden correr las veces que haga falta; los resultados no dependen del orden.

## Estructura

| Archivo | Tipo | Qué demuestra |
|---|---|---|
| `tests/unit/utilidades.test.js` | Unitaria | Redondeo a 2 decimales (half-up), validaciones de entrada, respuesta estándar |
| `tests/unit/numeroALetras.test.js` | Unitaria | `totalLetras` (unidades, decenas, cientos, miles, millones, apócope UN/VEINTIÚN) |
| `tests/unit/calculos.test.js` | Unitaria | Cálculo de 01 (IVA incluido), 03 (IVA aparte) y 05 (proporcional al CCF) |
| `tests/unit/simuladores.test.js` | Unitaria | Firmador (JWS falso), MH recepción y MH anulación en los modos ok/rechazo/contingencia |
| `tests/unit/builders.test.js` | Unitaria | JSON 01/03/05 y evento de invalidación **validados con ajv contra `schemas-mh/`** (+ control negativo) |
| `tests/unit/contingencia.test.js` | Unitaria | `enContingencia` (tipoModelo/tipoOperacion 2) en 01/03/05 contra su esquema, builder del evento v4 y MH simulado del evento |
| `tests/unit/middleware.test.js` | Unitaria | JWT (válido, ausente, otra firma, vencido), roles y formato de errores |
| `tests/integration/auth.test.js` | API + BD | Health, login, 401 en todas las rutas protegidas, 404 de API |
| `tests/integration/catalogos.test.js` | API + BD | Productos (CRUD, solo ADMIN escribe, redondeo), clientes (CONTRIBUYENTE, NIT/NRC), emisor |
| `tests/integration/dte01.factura.test.js` | API + BD | **Flujo completo de la Factura 01** |
| `tests/integration/dte03.ccf.test.js` | API + BD | **Flujo completo del CCF 03** |
| `tests/integration/dte05.notaCredito.test.js` | API + BD | **Flujo completo de la Nota de crédito 05** |
| `tests/integration/contingencia.test.js` | API + BD | **Rechazo, contingencia y reintento** en 01, 03 y 05 |
| `tests/integration/eventoContingencia.test.js` | API + BD | **Evento de contingencia** (`/api/contingencia`): ok, rechazo, MH sin respuesta, selección de DTE, consultas |
| `tests/integration/consultaMh.test.js` | API + BD | **Cola de consultas a MH**: `X-Simular: timeout`, `POST /api/dte/:id/consultar`, un DTE por turno (round-robin), reenvío de un DTE que MH ya tenía, `GET/PUT /api/contingencia/consultas` |
| `tests/integration/loteContingencia.test.js` | API + BD | **Lote de contingencia**: lote manual y automático (cierre del día), recepción por lote, `GET/PUT /api/contingencia/programacion` |
| `tests/integration/invalidacion.test.js` | API + BD | **Invalidación** (ok, rechazo, MH sin respuesta, CCF con NC, tipos 1/2/3) |
| `tests/integration/consultas.test.js` | API + BD | Listado con filtros, detalle y bitácora |

Helpers: `tests/helpers/testDb.js` (BD de pruebas), `tests/helpers/api.js` (login admin/vendedor, `emitir`, `reintentar`, `invalidar`, `stock`, `bitacora`), `tests/helpers/schemas.js` (matcher `toCumplirEsquemaMh(tipo)`).

## Matriz de requisitos → pruebas

Requisitos tomados de las reglas DTE y convenciones de `CLAUDE.md` y del contrato `docs/API.md`.

### Reglas generales del DTE

| Requisito | Prueba(s) |
|---|---|
| `codigoGeneracion` UUID v4 en MAYÚSCULAS | dte01 «numeroControl … y codigoGeneracion UUID v4», dte03 «201 PROCESADO…», invalidacion «sello propio» |
| `numeroControl` = `DTE-{tipo}-{M001P001}-{15 dígitos}`, un correlativo por tipo | dte01 «empezando en 1», «consecutivos por tipo»; dte03 «independiente del 01»; dte05 «tipo 05» |
| Correlativo dentro de la transacción (sin repetidos en concurrencia) | dte01 «concurrencia: 8 emisiones en paralelo» |
| Un error de validación/stock no consume correlativo | dte01 «stock insuficiente → 409 … no consume correlativo» |
| Nodos `identificacion` … `apendice`, no usados en `null`, sin `extension` | builders «tiene los nodos del DTE (sin extension)», dte01/dte03 «sin extension» |
| JSON válido contra los esquemas oficiales MH | builders (01, 03, 05, invalidación) y todas las suites de integración con `toCumplirEsquemaMh` |
| Dinero en 2 decimales | utilidades «redondear2», calculos «porcentaje», catalogos «precio se redondea» |
| `totalLetras` (p. ej. `CIENTO TRECE 00/100 USD`) | numeroALetras (19 casos), dte01, dte03, dte05 |
| Ambiente `"00"` | builders, simuladores, auth «health» |
| Firmador: `{status:"OK", body: JWS falso b64url.b64url.b64url}` | simuladores «firmador», dte01 «el payload firmado es el JSON DTE guardado» |
| Respuesta MH: version, ambiente, versionApp, estado, sello (año + 36 = 40), `fhProcesamiento dd/MM/yyyy HH:mm:ss`, mensajes, observaciones | simuladores «MH recepción», dte01 «respuesta MH PROCESADO con sello de 40 caracteres» |
| Respuesta estándar `{ok, data}` / `{ok:false, error:{codigo, mensaje}}` y códigos HTTP del contrato | middleware, auth, y cada caso de error en integración (400/401/403/404/409/503) |

### 01 Factura

| Requisito | Prueba(s) |
|---|---|
| Precios CON IVA (`precio × 1.13`) | calculos «precio CON IVA», dte01 «IVA incluido» (2.50 → 2.83) |
| IVA incluido: `totalIva = gravado / 1.13 × 0.13`, `tributos = null` | calculos, dte01 (2 × P001 = 5.66, IVA 0.65) |
| Receptor opcional | dte01 sin receptor (`null`) y con receptor (Juan Pérez) |
| Descuento por línea en base CON IVA | calculos, dte01 «9.16 → NUEVE 16/100 USD» |
| Contado → `pagos`; crédito → `pagos: null` | builders, dte01 «a crédito» |
| Descuenta stock al quedar PROCESADO | dte01 «descuenta el stock» |
| Errores: sin ítems, cantidad inválida, producto/cliente inexistente, inactivo, descuento > línea, stock insuficiente (en todos los modos) | dte01 «errores» (10 casos) |

### 03 Comprobante de Crédito Fiscal

| Requisito | Prueba(s) |
|---|---|
| Cliente CONTRIBUYENTE obligatorio con NIT, NRC y actividad | dte03 «sin clienteId», «cliente CONSUMIDOR», «inexistente», «inactivo»; catalogos «CONTRIBUYENTE exige…» |
| Precios SIN IVA | calculos, dte03 «precios SIN IVA» |
| `resumen.tributos = [{codigo "20", "Impuesto al Valor Agregado 13%", valor}]` | calculos, builders, dte03 |
| 40 × P001 → 100 + 13 = 113.00 «CIENTO TRECE 00/100 USD» | dte03 «emisión exitosa» |
| Descuento en base SIN IVA | calculos, dte03 «33.90» |

### 05 Nota de crédito

| Requisito | Prueba(s) |
|---|---|
| Solo sobre un 03 `PROCESADO` | dte05 «sobre una Factura 01 → 400», «CCF RECHAZADO → 409», «CCF en CONTINGENCIA → 409»; invalidacion «CCF INVALIDADO → 409» |
| Mismo receptor | dte05 «mismo receptor que el CCF», «clienteId distinto → 400» |
| `documentoRelacionado = [{03, 2, codigoGeneracion del CCF, fechaEmision}]` | builders, dte05 |
| Cantidades ≤ pendientes de acreditar | dte05 «mayor a la pendiente → 400», «sin pendiente → 400»; NC rechazada no cuenta, NC en contingencia sí |
| Devuelve el stock | dte05 «devuelve el stock», contingencia «05 en contingencia → reintento rechazado» |
| Descuento del CCF acreditado en proporción; la última acreditación toma el resto exacto | dte05 «descuento del CCF…», calculos «regresión 3 de 10 × 1.10» |

### Contingencia, rechazo y reintento (`X-Simular`)

| Requisito | Prueba(s) |
|---|---|
| `X-Simular` inválido → 400 | contingencia «valor inválido», simuladores «leerModo» |
| Rechazo: `ok:true`, RECHAZADO, sin sello, con observaciones, guardado, consume correlativo, **no** descuenta stock | contingencia «Rechazo de MH en la emisión» (5 pruebas) |
| Contingencia: CONTINGENCIA, sin sello, `respuestaMh: null`, **sí** descuenta stock | contingencia «Contingencia (MH no responde)» |
| Reintentar solo desde CONTINGENCIA (RECHAZADO/PROCESADO → 409) | contingencia «no se puede reintentar», «reintentar un DTE PROCESADO» |
| Reintento conserva `codigoGeneracion`, `numeroControl` y firma | contingencia «reintento ok → PROCESADO…» |
| Reintento con MH aún caído → sigue en CONTINGENCIA | contingencia «reintento con MH aún caído» |
| Reintento rechazado → RECHAZADO y revierte el stock | contingencia «Contingencia → reintento rechazado», «05 en contingencia → reintento rechazado» |
| Contingencia en 03 → reintento → admite NC | contingencia «03 en contingencia → reintento ok → admite NC» |
| No se invalida un DTE en CONTINGENCIA | contingencia «no se puede invalidar mientras está en CONTINGENCIA» |
| Bitácora EMISION/REINTENTO con resultado | contingencia «bitácora…», consultas «registra cada operación» |

### Evento de contingencia (esquema v4)

| Requisito | Prueba(s) |
|---|---|
| DTE sin respuesta de MH: `tipoModelo 2`, `tipoOperacion 2`, `tipoContingencia 1`, `motivoContin null`, firmado así | unit contingencia «enContingencia», eventoContingencia «DTE emitido en contingencia» (01, 03, 05) |
| El JSON en contingencia sigue cumpliendo el esquema de su tipo | unit contingencia «01, 03 y 05 en contingencia…», eventoContingencia |
| Evento: `identificacion` v4, `emisor` con responsable, `detalleDTE`, `motivo`; cumple `contingencia-schema-v4.json` | unit contingencia «builder», eventoContingencia «jsonEvento cumple…» |
| Solo ADMIN; solo DTE en CONTINGENCIA (otro estado 409, inexistente 404); sin `dteIds` = todos; sin pendientes → 409 | eventoContingencia «validaciones», «sin dteIds incluye todos», «sin DTE en contingencia → 409» |
| Evento PROCESADO con sello propio → cada DTE pasa a PROCESADO con sello, mismo `codigoGeneracion`/`numeroControl` | eventoContingencia «Evento aceptado» |
| Evento RECHAZADO → se guarda; los DTE siguen en CONTINGENCIA | eventoContingencia «evento rechazado» |
| MH sin respuesta → 503 `MH_NO_DISPONIBLE`, no se guarda, bitácora `SIN_RESPUESTA` | eventoContingencia «MH no responde» |
| Bitácora `CONTINGENCIA` y un `REINTENTO` por DTE con `codigoGeneracionEvento`; `GET /api/dte/:id` trae `eventoContingencia` | eventoContingencia «bitácora…», «cada DTE quedó PROCESADO…» |
| `GET /api/contingencia` y `/:id` (estado actual de los DTE, 404/400/401) | eventoContingencia «GET /api/contingencia» |

### Lote de contingencia (manual y cierre del día)

| Requisito | Prueba(s) |
|---|---|
| Lote manual = todos los DTE en CONTINGENCIA del momento, `origen: MANUAL` | loteContingencia «toma todos los DTE en contingencia del momento» |
| Evento aceptado → recepción por lote: `jsonLote` con los JWS de los DTE, respuesta `RECIBIDO` con `codigoLote` | loteContingencia «recepción por lote», unit contingencia «recepción por lote» |
| Cada DTE del lote queda PROCESADO con sello; la cola queda vacía | loteContingencia «cada DTE del lote queda PROCESADO…» |
| Evento rechazado → sin lote (`codigoLote`/`lote` null), DTE siguen pendientes | loteContingencia «evento rechazado → sin lote» |
| Lote automático: origen AUTOMATICO, firmado por un ADMIN, motivo de cierre, esquema v4 | loteContingencia «con DTE pendientes → evento AUTOMATICO…» |
| Automático sin pendientes → SIN_PENDIENTES, no crea evento, bitácora | loteContingencia «sin DTE en contingencia → SIN_PENDIENTES» |
| Automático con MH rechazando o sin responder → no lanza; DTE quedan para el siguiente lote, que los recoge | loteContingencia «MH rechaza el evento», «MH no responde», «el siguiente lote automático…» |
| Programación: GET cualquier rol; PUT solo ADMIN; hora `HH:mm` y `activo` booleano (400); desactivado sin próxima ejecución; bitácora | loteContingencia «GET/PUT /api/contingencia/programacion» |
| Próxima ejecución (hoy / mañana / fin de mes) y temporizador programado y cancelado | unit contingencia «próxima ejecución», «temporizador» |

### Cola de consultas a MH (C3)

| Requisito | Prueba(s) |
|---|---|
| `timeout`: para el POS es contingencia (CONTINGENCIA, sin sello, modelo diferido, stock descontado); en eventos = sin respuesta (503) | consultaMh «X-Simular: timeout», unit contingencia «modo timeout» |
| Consulta de un DTE que MH tiene → ENCONTRADO: PROCESADO con sello, JSON/firma de modelo previo (cumple esquema), stock igual, bitácora | consultaMh «DTE que MH sí recibió → ENCONTRADO» |
| Contingencia real → NO_ENCONTRADO (código 004), sigue en CONTINGENCIA, cuenta consultas | consultaMh «contingencia real → NO_ENCONTRADO», unit «MH no lo tiene» |
| MH no responde a la consulta → SIN_RESPUESTA | consultaMh «MH tampoco responde a la consulta» |
| Solo DTE en CONTINGENCIA (409), 404, X-Simular inválido 400, sin token 401 | consultaMh «DTE que no está en CONTINGENCIA → 409…» |
| Reintento / lote de un DTE que MH ya tenía → sello original, sin duplicar | consultaMh «Reenvío de un DTE que MH ya tenía» |
| La cola consulta UN DTE por turno, round-robin (nunca consultados primero, luego el más antiguo) | consultaMh «cada turno consulta solo UN documento…», «MH sin respuesta en un turno → al final» |
| Turnos sin novedad no llenan la bitácora; cola vacía no hace nada | consultaMh «no llenan la bitácora», «sin DTE en contingencia» |
| Config: GET cualquier rol, PUT ADMIN, intervalo entero 10–3600, bitácora; temporizador programado y cancelado | consultaMh «PUT /api/contingencia/consultas», unit «Cola de consultas · temporizador» |

### Invalidación

| Requisito | Prueba(s) |
|---|---|
| Solo sobre DTE PROCESADO (doble invalidación, RECHAZADO, CONTINGENCIA → 409) | invalidacion «invalidar otra vez», contingencia (RECHAZADO y CONTINGENCIA) |
| Un 03 con NC vigente no se invalida; tras invalidar la NC sí | invalidacion «Invalidar un CCF con Nota de crédito» |
| JSON del evento según esquema v3: `identificacion`, `emisor`, `documento` (sin `montoIva`, `codigoGeneracionR`, datos del receptor), `motivo` | builders, invalidacion «jsonEvento cumple invalidacion-schema-v3.json» |
| `tipoAnulacion` 2 por defecto; 1/3 exigen `codigoGeneracionR` de otro DTE PROCESADO | invalidacion «tipos de anulación y validaciones» |
| Respuesta simulada con sello propio; DTE → INVALIDADO; devuelve stock (05 vuelve a sacar) | invalidacion «Invalidar una Factura 01», «invalidar la NC…» |
| Evento rechazado → DTE sigue PROCESADO | invalidacion «evento rechazado» |
| MH sin respuesta → 503 `MH_NO_DISPONIBLE`, bitácora `SIN_RESPUESTA`, se puede repetir | invalidacion «MH no responde», «luego se puede reintentar» |

### Seguridad y catálogos

| Requisito | Prueba(s) |
|---|---|
| JWT en todas las rutas salvo login y health | auth «Rutas protegidas», middleware |
| Roles: escritura de productos solo ADMIN (403 `SIN_PERMISO`) | catalogos «VENDEDOR no puede crear ni editar» |
| Borrado lógico y `incluirInactivos` | catalogos «PUT parcial y borrado lógico» |
| NIT/NRC normalizados a dígitos | catalogos «NIT/NRC con guiones…» |

## Defecto encontrado por la suite (corregido)

- **NC con prorrateo inexacto → 500.** Emitir una NC por 3 de 10 unidades de P006 ($1.10) fallaba con `ERROR_INTERNO` (`descuento` NULL en `dte_detalle`). `11 × 3 / 10` da `3.3000000000000003`; el residuo `4.4e-16` entraba a `redondear2`, que concatenaba `'4.4e-16' + 'e2'` → `NaN`. Corregido en `backend/src/utils/dinero.js` (valores < 0.005 → 0). Pruebas de regresión en `utilidades.test.js`, `calculos.test.js` e `invalidacion.test.js`.

## Fuera de alcance

- El frontend (`frontend/js/app.js`) no tiene pruebas automatizadas; se verificó a mano y en Edge headless (ver `PROGRESO.md`, F1–F4 e I1).
- Firmador y MH son simulados por diseño: las pruebas demuestran el contrato de la simulación, no una integración con el MH real.
