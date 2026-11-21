# KAN-23 · Aseguramiento de la calidad (QA)

Ejecución del 2026-11-20, regenerada tras la corrección de KAN-36. Todo número de este documento sale de [`evidencia/`](evidencia/); las tablas largas están en [`generado/`](generado/) y las produce `backend/tests/tools/reporteKan23.js`.

## 1. Resultado

| Ejecución | Comando | Resultado | Evidencia |
|---|---|---|---|
| Instalación limpia | `npm ci` | OK · 472 paquetes · 0 vulnerabilidades | `01-npm-ci.txt` |
| Auditoría | `npm audit` | **0 vulnerabilidades** | `02-npm-audit.txt` |
| Unitarias + integración + cobertura | `npx jest --runInBand --coverage --json` | **546/546 aprobadas, 24 suites, 0 fallidas** | `03-npm-test-coverage.txt`, `jest-resultados.json`, `cobertura/` |
| Funcionales del frontend (e2e) | `npm run test:e2e` | **21/21 aprobadas, 7 archivos, 0 inestables** | `04-npm-test-e2e.txt`, `e2e/` |
| Mutación de controles de acceso | `05-mutacion-autorizacion.txt` | **7/8 detectadas**, 1 equivalente | `05-mutacion-autorizacion.txt` |
| KAN-36 antes / después | pruebas nuevas contra la ruta original y corregida | **antes: 6 fallan** (VENDEDOR → 200) · **después: todas aprueban** | `08-kan36-antes.txt`, `09-kan36-despues.txt` |
| BD de la demo intacta | `huellaBdDemo.js --comparar` | **12 tablas, 0 con cambios** | `06-huella-bd-demo-comparacion.txt` |
| Secretos | barrido de la evidencia y de Git | **sin fugas** | `07-barrido-secretos.txt` |

## 2. Casos de prueba y resultados

**567 casos, 567 aprobados.** Lista completa, caso por caso: [generado/casos-prueba.md](generado/casos-prueba.md).

| Nivel | Herramienta | Archivos | Casos | Aprobados | Qué valida |
|---|---|---|---|---|---|
| Unitarias | Jest | 7 | 110 | 110 | Cálculos 01/03/05, montos en letras, redondeo, simuladores (firmador, MH), JSON validado con ajv contra `schemas-mh/`, middlewares de auth/errores/CSRF |
| Integración (API + SQL Server) | Jest + Supertest | 17 | 436 | 436 | Cada endpoint contra la BD de pruebas: flujos 01/03/05, rechazo, contingencia, eventos, lotes, cola de consultas, invalidación, seguridad, autorización, tareas programadas con procesos reales, Fase 6 |
| Funcionales del frontend (E2E) | Playwright + Edge | 7 | 21 | 21 | La interfaz real contra la API real |
| **Total** | | **31** | **567** | **567** | |

Casos por archivo de integración: `autorizacion` 110 · `catalogos` 41 · `fase6` 36 · `eventoContingencia` 24 · `invalidacion` 24 · `consultaMh` 22 · `dte01.factura` 22 · `contingencia` 21 · `dte05.notaCredito` 20 · `loteContingencia` 19 · `consultas` 22 · `tareasProgramadas` 15 · `dte03.ccf` 14 · `auth` 12 · `seguridad` 27 · `pdf` 6 · `resetDemo` 1.

Cambios respecto de la Fase 6 (537): +2 casos en `autorizacion` por la ruta que faltaba en la matriz (D5); y por **KAN-36** (D6), +2 en `autorizacion` (`GET /api/bitacora` pasa a solo ADMIN: Bearer, cookie y ADMIN en vez de una sola prueba de VENDEDOR) y +5 en `consultas` (ADMIN 200, VENDEDOR 403 con tres consultas, el registro de las acciones del VENDEDOR sigue funcionando).

## 3. Cobertura real del código

Backend (`backend/src/**`, salvo `server.js`), medida con Jest/istanbul en esta ejecución:

| Métrica | % | Cubiertas / total |
|---|---|---|
| Sentencias | **96.73 %** | 1982 / 2049 |
| Ramas | **84.86 %** | 1127 / 1328 |
| Funciones | **98.34 %** | 357 / 363 |
| Líneas | **98.45 %** | 1723 / 1750 |

Por archivo: [generado/cobertura.md](generado/cobertura.md) · reporte navegable: `evidencia/cobertura/html/index.html`.

**Dónde está lo no cubierto** (la cobertura de ramas es la métrica más baja):

- Controladores (`*Controller.js`) al 50 % de ramas: es el `req.body || {}` defensivo; ningún caso envía un cuerpo `null`.
- `config/db.js` (70 %): reintento del pool tras una caída de conexión y ramas de configuración (`DB_PORT`, cifrado). La caída de la BD a mitad de la ejecución no se prueba (también pendiente en la Fase 5).
- `middleware/limiteLogin.js` (70 %): limpieza periódica de entradas vencidas y variantes de configuración.
- `dte/pdf.js` (73 %): paginación de documentos con muchos ítems y combinaciones de sellos de agua.

**Lo que no se mide:**

- **Frontend sin cobertura de código.** `frontend/js/*.js` no se instrumenta; sus flujos se cubren con 21 pruebas e2e (ver §4). Pantallas o acciones sin e2e: Nota de crédito desde la UI (cubierta por la API en `dte05`), exportación CSV de la bitácora y de "Ventas" del panel gerencial, modo mock.
- `server.js` (arranque y apagado): se ejercita indirectamente en `tareasProgramadas.test.js`, que levanta servidores reales como procesos hijos.

## 4. Pruebas funcionales del frontend

Playwright 1.58.0 con Microsoft Edge, ventana 1366×860, contra el servidor real en el puerto 3099 y la BD `BatallonAtlacatl_Test`. Las 21 capturas y el PDF descargado están en `evidencia/e2e/capturas/`; el reporte navegable, en `evidencia/e2e/html/index.html`.

| Archivo | Caso | Resultado | Captura |
|---|---|---|---|
| `01-login` | Credenciales de prueba visibles solo en local | ✅ | 01 |
| | Contraseña incorrecta → mensaje y sigue en el login | ✅ | 02 |
| | Login correcto, cookie HttpOnly sin JWT en el almacenamiento, la recarga mantiene la sesión, logout la cierra | ✅ | 03 |
| `02-roles` | VENDEDOR sin opciones de ADMIN en menú, venta e inventario | ✅ | 04 |
| | VENDEDOR emite una factura y no ve "Anular" | ✅ | 05 |
| | La API rechaza con 403 lo que la UI oculta (invalidar, crear producto, contingencia, **leer la bitácora** — KAN-36) | ✅ | — |
| | ADMIN ve Contingencia, Administración, Simular MH y "Anular"; **lee la bitácora** (API 200 y panel con filas) | ✅ | 06 |
| `03-clientes` | Alta de consumidor final con DUI | ✅ | — |
| | Contribuyente con dirección del catálogo MH, edición y rechazo de NRC inválido | ✅ | 07, 08 |
| `04-venta-dte` | Factura 01: PROCESADO con sello, JSON y descuento de stock | ✅ | 09 |
| | CCF 03: IVA desglosado y tributo 20 | ✅ | 10 |
| | CCF 03 sin contribuyente → aviso y no emite | ✅ | — |
| `05-invalidacion-pdf` | ADMIN anula desde Transacciones: INVALIDADO, stock devuelto, bitácora | ✅ | 11, 12 |
| | Descarga del PDF real del DTE | ✅ | PDF |
| `06-contingencia` | MH no responde → CONTINGENCIA → lote manual → PROCESADO con sello | ✅ | 13–15 |
| | VENDEDOR reintenta un DTE en contingencia desde Transacciones | ✅ | 16 |
| `07-fase6` | Borradores: guardar, listar, continuar; se eliminan al emitir | ✅ | 17 |
| | Correo: el modal dice que es simulado, queda en bitácora y nunca dice "enviado" | ✅ | 18 |
| | Panel gerencial con los totales de la API (no los fijos) y CSV real | ✅ | 19 |
| | Usuarios: crear un vendedor que inicia sesión y desactivarlo | ✅ | 20 |
| | Configuración: emisor real en solo lectura y firmador rotulado como simulado | ✅ | 21 |

## 5. Defectos detectados y corregidos

| ID | Defecto | Severidad | Cómo se detectó | Corrección | Prueba de regresión |
|---|---|---|---|---|---|
| D0 | Una NC por 3 de 10 unidades de $1.10 respondía 500: `redondear2` devolvía `NaN` con residuos exponenciales (`4.4e-16`) | Alta | Suite de Q1 | Valores < 0.005 → 0 en `utils/dinero.js` | `utilidades.test.js`, `calculos.test.js` › *regresión*, `invalidacion.test.js` |
| D1 | `db/03_reset_demo.sql` no restauraba los clientes del seed editados o renombrados | Media | La matriz de autorización editaba un cliente y `dte01` falló en la corrida completa (456/457) | El reset reinserta y restaura los 4 clientes | `resetDemo.test.js` |
| D2 | El reporte de Playwright incluía `DB_PASSWORD` y `JWT_SECRET` reales | Alta (seguridad) | Revisión de secretos antes de guardar la evidencia de Q2 | `webServer.env` sin secretos; reportes regenerados; no llegó a Git | `07-barrido-secretos.txt` (repetido en esta fase) |
| D3 | Cinco pantallas afirmaban operaciones que no ocurrían (borrador "guardado", correo "enviado", "Configuración guardada", exportaciones, usuarios ficticios) | Media | Revisión funcional de la Fase 6 | Funcionalidades reales o rotuladas como simuladas | `fase6.test.js` (36), e2e `07-fase6` (5) |
| D4 | El reset dejaba usuarios creados o editados desde la UI (nuevo desde la Fase 6) | Baja | Análisis de la Fase 6 | El reset deja solo los 2 usuarios del seed con sus contraseñas | Todas las suites de integración arrancan con el reset e inician sesión con las contraseñas del seed |
| D5 | La matriz de autorización no cubría `GET /api/contingencia/ejecuciones` (39 de 40 rutas) | Baja (brecha de prueba) | Fase 7: comparación de las rutas registradas en `src/routes/` con las de la matriz | Ruta agregada (+2 casos) | `autorizacion.test.js` (110/110) |
| D6 | **KAN-36:** `GET /api/bitacora` permitía leer la bitácora a cualquier usuario autenticado (KAN-32 exige restringirla) | Media (seguridad) | Jira KAN-36; reproducido con pruebas nuevas que fallaron contra la ruta original (`08-kan36-antes.txt`: 6 fallan, VENDEDOR recibía 200) | `requireRol(...ROLES_LEER_BITACORA)` (solo ADMIN); el registro de las acciones de cualquier rol no cambia | `consultas.test.js` › *autorización (KAN-36)* (5), `autorizacion.test.js` (4 casos de la ruta), e2e `02-roles` (2); mutación M8 |

Fallos del **código de las pruebas** (no de la aplicación), corregidos durante su redacción y fuera de las ejecuciones registradas: en Q2, `selectOption` con una expresión regular y un texto esperado incorrecto; en la Fase 6, una aserción e2e que contradecía el aviso "Exportar a PDF no está disponible" y una comprobación de "sin efectos" que contaba un borrador creado por la propia preparación de la prueba.

**Defectos abiertos:** ninguno funcional. Los pendientes de seguridad están en [SEGURIDAD §4](SEGURIDAD.md#4-hallazgos-abiertos-y-riesgo-residual).

## 6. Pruebas de mutación de los controles de acceso

Para comprobar que las pruebas **detectan** una regresión (y no solo que hoy pasan), se rompió a propósito cada control, se corrieron las suites relevantes y se restauró el archivo. Cada restauración se verificó byte a byte (`cmp`) contra un respaldo. Salida completa: [`evidencia/05-mutacion-autorizacion.txt`](evidencia/05-mutacion-autorizacion.txt).

| # | Mutación | Archivo | Suites | Resultado con la mutación | Veredicto |
|---|---|---|---|---|---|
| M1 | `/api/usuarios` sin `requireRol('ADMIN')` | `routes/usuarios.js` | autorizacion + fase6 | 10 fallan / 146 | ✅ detectada |
| M2 | `/api/reportes` sin `requireRol('ADMIN')` | `routes/reportes.js` | autorizacion + fase6 | 3 fallan / 146 | ✅ detectada |
| M3 | Borradores sin el filtro por dueño | `services/borradoresService.js` | fase6 | 1 falla / 36 | ✅ detectada |
| M4 | Permitir dejar el sistema sin ADMIN activo | `services/usuariosService.js` | fase6 | 1 falla / 36 | ✅ detectada |
| M5 | `ROLES_INVALIDAR` incluye VENDEDOR | `config/politicas.js` | autorizacion + invalidacion | 6 fallan / 134 | ✅ detectada |
| M6 | `jwt.verify` acepta `alg: none` | `middleware/auth.js` | autorizacion + middleware | 0 fallan / 130 | ➖ equivalente |
| M7 | El correo responde `enviado: true` | `services/correoService.js` | fase6 | 1 falla / 36 | ✅ detectada |
| M8 | `/api/bitacora` sin `requireRol` (revierte KAN-36) | `routes/bitacora.js` | autorizacion + consultas | 6 fallan / 132 | ✅ detectada |

M6 sobrevive porque `jsonwebtoken` 9 ya rechaza un token sin firma cuando recibe un secreto: el control del código es redundante con la librería, y las pruebas de `alg: none` siguen dando 401. M3, M4 y M7 los detecta un solo caso cada uno: la detección es real pero depende de ese caso.

## 7. Matriz de trazabilidad requisito → prueba → resultado

Matriz completa con los casos por archivo: **[generado/trazabilidad.md](generado/trazabilidad.md)**. Requisitos tomados de `CLAUDE.md` (reglas DTE), `docs/API.md` (contrato), `docs/SEGURIDAD.md` y los bloques del proyecto.

| Grupo | Requisitos | Con todas sus pruebas aprobadas | Casos que los respaldan |
|---|---|---|---|
| Reglas generales del DTE (RQ-DTE) | 8 | 8 | 90 |
| 01 Factura · 03 CCF · 05 NC (RQ-01/03/05) | 6 | 6 | 65 |
| Contingencia, rechazo, eventos, lotes, cola y tareas (RQ-CON) | 8 | 8 | 106 |
| Invalidación y PDF (RQ-INV) | 3 | 3 | 36 |
| Catálogos y UI de venta (RQ-CAT, RQ-UI) | 4 | 4 | 67 |
| Seguridad (RQ-SEG), incluida RQ-SEG-13 (KAN-36) | 13 | 13 | 176 |
| Fase 6 (RQ-F6) | 5 | 5 | 42 |
| **Total** | **47** | **47** | |

Un mismo caso puede respaldar más de un requisito, así que la columna de casos (582) no coincide con el total de casos (567). El script sale con error si un requisito se queda sin pruebas o alguna falla. Para mantener la matriz, agregar el requisito y su selector en `REQUISITOS` dentro de `backend/tests/tools/reporteKan23.js`.

## 8. Limitaciones

- **Firmador y Hacienda son simulados:** se prueba el contrato de la simulación y la validez de los JSON contra los esquemas oficiales, no la integración con el MH real.
- e2e solo en Edge; no se probaron otros navegadores ni dispositivos móviles.
- Sin pruebas de carga ni de rendimiento (la única concurrencia probada son 8 emisiones en paralelo en `dte01`, que no repiten correlativo).
- Sin prueba automatizada de XSS ni de tiempos de respuesta del login (C-17 y C-06 se verificaron por revisión).
