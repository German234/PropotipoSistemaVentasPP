# Informe de QA · 2026-11-20

Evidencia de la Fase 4. Todos los números salen de las salidas guardadas en esta carpeta; nada se declaró aprobado sin ejecutarse.

## Resultado

| Ejecución | Comando | Suites | Pruebas | Resultado | Salida |
|---|---|---|---|---|---|
| Instalación | `npm ci` | — | — | OK, 0 vulnerabilidades | `01-npm-ci.txt` |
| Línea base (antes de esta fase) | `npm test` | 20 | **383 aprobadas, 0 fallidas** | OK | `02-npm-test.txt` |
| Con pruebas nuevas, antes de corregir el defecto | `npm test` | 21 (1 fallida) | **456 aprobadas, 1 fallida** | FALLA (defecto D1) | `03-npm-test-defecto-reset.txt` |
| **Final** | `npm test` | **22** | **458 aprobadas, 0 fallidas** | **OK** | `04-npm-test-final.txt` |
| **Cobertura** | `npm run test:coverage` | 22 | 458 aprobadas, 0 fallidas | OK | `05-npm-test-coverage.txt`, `cobertura/` |
| **Frontend e2e** | `npm run test:e2e` | 6 archivos | **16 aprobadas, 0 fallidas, 0 inestables** | **OK** | `06-npm-test-e2e.txt`, `e2e/` |
| BD de la demo intacta | `node tests/tools/huellaBdDemo.js --comparar …` | — | 12 tablas | **0 con cambios** | `07-huella-bd-demo-comparacion.txt` |

### Cobertura del backend (Jest, `src/**` sin `server.js`)

| Métrica | % | Cubiertas / total |
|---|---|---|
| Sentencias | **96.39 %** | 1553 / 1611 |
| Ramas | **84.42 %** | 916 / 1085 |
| Funciones | **98.22 %** | 276 / 281 |
| Líneas | **98.20 %** | 1364 / 1389 |

Detalle por archivo: `cobertura/html/index.html`; totales en `cobertura/coverage-summary.json`.
El frontend no tiene medición de cobertura de código: sus flujos se verifican con las 16 pruebas e2e.

### Pruebas por suite (ejecución final)

| Unitarias (114) | # | Integración (344) | # |
|---|---|---|---|
| `builders` | 12 | `auth` | 12 |
| `calculos` | 10 | `autorizacion` **(nueva)** | 74 |
| `contingencia` | 20 | `catalogos` | 41 |
| `middleware` | 20 | `consultaMh` | 22 |
| `numeroALetras` | 20 | `consultas` | 17 |
| `simuladores` | 11 | `contingencia` | 21 |
| `utilidades` | 21 | `dte01.factura` | 22 |
| | | `dte03.ccf` | 14 |
| | | `dte05.notaCredito` | 20 |
| | | `eventoContingencia` | 24 |
| | | `invalidacion` | 24 |
| | | `loteContingencia` | 19 |
| | | `pdf` | 6 |
| | | `resetDemo` **(nueva)** | 1 |
| | | `seguridad` | 27 |

### Pruebas e2e (Playwright, `backend/tests/e2e/`)

| Archivo | Pruebas | Qué recorre |
|---|---|---|
| `01-login.spec.js` | 3 | Credenciales demo visibles en local; contraseña incorrecta; login ADMIN, cookie HttpOnly sin JWT en el almacenamiento, recarga mantiene la sesión, logout |
| `02-roles.spec.js` | 4 | VENDEDOR sin menús de ADMIN, sin "Simular MH", sin edición de inventario, sin "Anular"; la API responde 403 a invalidar, crear producto y enviar contingencia; ADMIN sí los ve |
| `03-clientes.spec.js` | 2 | Alta de consumidor con DUI; alta de contribuyente con catálogo MH, edición, NRC inválido rechazado, consulta del cliente actualizado |
| `04-venta-dte.spec.js` | 3 | Factura 01 (total con IVA, sello, JSON, stock); CCF 03 a contribuyente (tributo 20, admite NC); CCF sin cliente → aviso |
| `05-invalidacion-pdf.spec.js` | 2 | ADMIN anula desde Transacciones (INVALIDADO, stock devuelto, bitácora); descarga del PDF real (`%PDF-`, nombre = número de control) |
| `06-contingencia.spec.js` | 2 | Emisión con MH caído → CONTINGENCIA → lote manual → PROCESADO con sello y evento; reintento desde Transacciones |

Capturas: `e2e/capturas/01…16-*.png` y el PDF descargado. Reporte navegable: `e2e/html/index.html`. Resultados: `e2e/resultados.json`.
La e2e completa se corrió 6 veces durante la fase: las 2 primeras con 15/16 por fallos en el código de la prueba (ver abajo) y las 4 últimas, incluida la registrada, con 16/16. La registrada se regeneró tras corregir D2.

## Entorno

| | |
|---|---|
| Sistema | Windows 11 Home 10.0.26200 |
| Node / npm | v24.13.1 / 11.8.0 |
| SQL Server | 17.0.1000.7 RTM, Standard Developer Edition (64-bit), local |
| BD de pruebas | `BatallonAtlacatl_Test`, creada y sembrada con `db/01`, `db/02` y reiniciada con `db/03` (según el README) |
| BD de la demo | `BatallonAtlacatl`: solo se leyó (huella antes/después) |
| Navegador e2e | Microsoft Edge 157.0.4341.60 (Playwright 1.58.0, `channel: msedge`) |

## La BD de la demo no se modificó

`backend/tests/tools/huellaBdDemo.js` (solo `SELECT`) calcula, por tabla, el número de filas y el SHA-256 de todo su contenido.
La huella **antes** se tomó al inicio de la fase, antes de `npm ci`; la **después**, al final, tras la última e2e. Entre ambas corrieron todas las ejecuciones de esta tabla, la prueba de mutación y las corridas e2e de ajuste. Resultado: las 12 tablas idénticas (`07-huella-bd-demo-comparacion.txt`, `huella-bd-demo-antes.json`, `huella-bd-demo-despues.json`).
Protecciones: `tests/setupEnv.js` fuerza `BatallonAtlacatl_Test` y aborta si el nombre es el de la demo; el `globalSetup` e2e repite esa comprobación; el servidor e2e arranca con `DB_NAME=BatallonAtlacatl_Test` en el puerto 3099.

## Defectos encontrados

| # | Defecto | Cómo se encontró | Corrección | Prueba |
|---|---|---|---|---|
| D2 | La configuración e2e pasaba todo `process.env` al servidor (`webServer.env`), y el reporter JSON/HTML de Playwright serializa ese objeto: el reporte incluía `DB_PASSWORD` y `JWT_SECRET` reales. | Revisión de secretos de esta carpeta antes de guardarla. **No llegó a Git.** | `webServer.env` solo con variables no secretas (Playwright ya hereda el entorno y el servidor lee `backend/.env`). Se borraron todos los reportes generados y se regeneró la e2e. | Búsqueda de los valores reales de `backend/.env` en los 106 archivos de `docs/qa/`, incluidos los zip embebidos del reporte HTML: `JWT_SECRET` no aparece; `DB_PASSWORD` solo coincide por azar con datos de prueba (`01234567-8`, `0123456789`). El JSON ya solo lleva `DB_NAME, PORT, NODE_ENV, DEMO_CREDENCIALES, CONTINGENCIA_LOTE_ACTIVO, CONSULTA_MH_ACTIVO` |
| D1 | `db/03_reset_demo.sql` no restauraba los datos de los clientes del seed (solo los reactivaba). Desde KAN-34 se editan en la UI: tras un reset, un cliente editado quedaba con los datos cambiados, y uno renombrado se borraba y no volvía. | Al agregar `autorizacion.test.js` (editaba el teléfono de Juan Pérez), `dte01.factura` falló en la ejecución completa: 456/457 (`03-npm-test-defecto-reset.txt`). | El reset reinserta los clientes del seed que falten y restaura todos sus campos. La prueba de autorización ahora usa un cliente propio. | `resetDemo.test.js`: falla con el script anterior y pasa con el corregido |

Fallos del código de las pruebas (no de la aplicación), corregidos durante el ajuste de la e2e: `selectOption` con una expresión regular (Playwright exige texto) y un texto esperado incorrecto ("Crédito" en lugar de "CCF 03"). No están en las ejecuciones registradas.

## Verificación de las pruebas de autorización

Para comprobar que la matriz de `autorizacion.test.js` detecta una regresión se quitó temporalmente `requireRol('ADMIN')` de `POST /api/productos`: 4 pruebas fallaron (70 aprobadas). Se restauró el archivo (`git checkout`) y volvió a 74/74.

## Pendiente o fuera de alcance

- Cobertura de código del frontend (`frontend/js/*.js`): no medida. Los flujos sí están cubiertos por la e2e.
- La e2e usa Edge instalado; en otra máquina sin Edge: `E2E_CHANNEL=chrome`, o `npx playwright install chromium` y `E2E_CHANNEL=chromium`. No se ejecutó con otros navegadores.
- Firmador y MH son simulados por diseño: las pruebas validan el contrato de la simulación, no una integración real con Hacienda.
- Observación (no corregida en esta fase): el JWT sigue siendo válido hasta que vence aunque el usuario se desactive o cierre sesión (sin revocación en el servidor; ver `docs/SEGURIDAD.md`).
