# KAN-23 · Evidencias de Seguridad, QA y Gestión de Riesgos

Mini POS académico con DTE simulado (MH El Salvador). Fase 7 · ejecución del **2026-11-20**, regenerada tras corregir **KAN-36** (hora local; las marcas de los archivos están en UTC, 2026-11-21 04:33–04:38).

Todas las cifras de esta carpeta salen de ejecuciones guardadas en [`evidencia/`](evidencia/). Las tablas de [`generado/`](generado/) las calcula un script a partir de esos resultados; nadie las editó a mano.

## Resumen

| Área | Resultado |
|---|---|
| Pruebas automatizadas | **567/567 aprobadas**: Jest 546/546 (24 suites: 110 unitarias, 436 de integración) + Playwright 21/21 (7 archivos) |
| Cobertura del backend | **96.73 % sentencias · 84.86 % ramas · 98.34 % funciones · 98.45 % líneas** |
| Autorización | **40/40 rutas protegidas** en la matriz por rol (110 casos); 12 rutas solo para ADMIN (incluida `GET /api/bitacora` desde KAN-36), probadas por Bearer y por cookie + CSRF |
| Pruebas de mutación de los controles de acceso | **7 de 8 detectadas**, incluida la que revierte KAN-36. La que sobrevive es equivalente: la librería ya bloquea `alg: none` ([QA §6](QA.md#6-pruebas-de-mutación-de-los-controles-de-acceso)) |
| Trazabilidad | **47/47 requisitos** con todas sus pruebas aprobadas |
| Dependencias | `npm audit`: **0 vulnerabilidades** (472 paquetes) |
| Secretos | Ningún valor de `backend/.env` en la evidencia ni en Git |
| BD de la demo | **Sin cambios** durante toda la ejecución (huella SHA-256 de 12 tablas antes y después) |
| Hallazgos de seguridad | **12 corregidos** con evidencia (el último, KAN-36: la bitácora la leía cualquier rol) · **11 abiertos**: 0 críticos, 3 de severidad media (sesión no revocable, conexión a la BD como `sa` y BD de la demo con un esquema anterior) |
| Riesgos | **30 en la matriz** (fiscal 6, acceso 7, datos 8, contingencia 5, técnicos 4). Residual: **Alto 2**: la integración con el MH real (aceptado, fuera de alcance) y la BD de la demo sin el esquema actual (se resuelve ejecutando un script). Medio 10, Bajo 18 |

## Documentos

| Documento | Contenido |
|---|---|
| [SEGURIDAD.md](SEGURIDAD.md) | Matriz de controles (implementado / verificado / pendiente), pruebas de autorización por rol, hallazgos corregidos con evidencia, hallazgos abiertos y riesgo residual |
| [QA.md](QA.md) | Casos de prueba y resultados, cobertura real, pruebas funcionales del frontend, defectos detectados y corregidos, trazabilidad y pruebas de mutación |
| [RIESGOS.md](RIESGOS.md) | Matriz de riesgos (probabilidad, impacto, responsable, tratamiento), evidencia de las mitigaciones y riesgo residual: integración fiscal, acceso, datos y contingencia |
| [generado/trazabilidad.md](generado/trazabilidad.md) | Requisito → prueba(s) → resultado (47 requisitos) |
| [generado/autorizacion.md](generado/autorizacion.md) | Ruta × rol (sin sesión / VENDEDOR / ADMIN) con el resultado de cada caso |
| [generado/casos-prueba.md](generado/casos-prueba.md) | Los 567 casos, uno por fila, con su resultado |
| [generado/cobertura.md](generado/cobertura.md) | Cobertura por archivo |
| [`../SEGURIDAD.md`](../SEGURIDAD.md) | Detalle técnico de los controles de la Fase 3 (no se repite aquí) |

## Evidencia (`evidencia/`)

| Archivo | Qué es |
|---|---|
| `00-entorno.txt` | Versiones de Node y npm |
| `01-npm-ci.txt` | Instalación limpia (`npm ci`) |
| `02-npm-audit.txt` | Auditoría de dependencias |
| `03-npm-test-coverage.txt` | Salida de Jest con cobertura (`--runInBand --coverage`) |
| `jest-resultados.json` | Resultado de cada caso de Jest (`--json`) |
| `cobertura/` | `coverage-summary.json` y reporte HTML navegable (`html/index.html`) |
| `04-npm-test-e2e.txt`, `e2e/` | Playwright: salida, `resultados.json`, reporte `html/`, 21 capturas y el PDF descargado |
| `05-mutacion-autorizacion.txt` | 8 mutaciones de controles de acceso y su resultado |
| `huella-bd-demo-antes.json`, `huella-bd-demo-despues.json`, `06-huella-bd-demo-comparacion.txt` | La BD de la demo no se modificó |
| `07-barrido-secretos.txt` | Búsqueda de los secretos reales en la evidencia (también dentro de los zip) y en Git |
| `08-kan36-antes.txt`, `09-kan36-despues.txt` | KAN-36: las pruebas nuevas contra la ruta original (6 fallan: VENDEDOR recibía 200) y después de la corrección (todas aprueban) |

## Cómo reproducir

Desde `backend/`, con SQL Server local y `backend/.env` configurado (ver `README.md` del repositorio):

```bash
E=../docs/kan-23/evidencia
node tests/tools/huellaBdDemo.js > $E/huella-bd-demo-antes.json
npm ci && npm audit
npx jest --runInBand --coverage --json --outputFile=$E/jest-resultados.json
E2E_OUT=$E/e2e npm run test:e2e
node tests/tools/huellaBdDemo.js --comparar $E/huella-bd-demo-antes.json
node tests/tools/reporteKan23.js          # regenera docs/kan-23/generado/
```

Entorno de la ejecución: Windows 11 Home 10.0.26200 · Node v24.13.1 · npm 11.8.0 · SQL Server 17 Developer (local) · Microsoft Edge (Playwright 1.58.0, `channel: msedge`). Las pruebas usan la BD aislada `BatallonAtlacatl_Test`; `tests/setupEnv.js` y el `globalSetup` de e2e se niegan a correr contra la BD de la demo.

## Límites de esta evidencia

- **Firmador y Hacienda son simulados por diseño.** Las pruebas demuestran que los JSON cumplen los esquemas oficiales de `schemas-mh/` y que el sistema sigue el contrato de la simulación. **No** demuestran una integración con el MH real ni una firma con validez legal.
- El frontend no se instrumenta para medir cobertura; sus flujos se verifican con las 21 pruebas e2e.
- La e2e se ejecutó solo con Edge.
