# Pruebas de autorización por rol (ruta × rol)

> Generado por `backend/tests/tools/reporteKan23.js` el 2026-11-21 04:38:01 UTC desde `docs/kan-23/evidencia/`. No editar a mano.

Fuente: `tests/integration/autorizacion.test.js`. "403 sin efectos" = la prueba compara productos, DTE, contingencia, configuración, usuarios y bitácora antes y después de los intentos denegados; se prueba por `Authorization: Bearer` y por cookie de sesión + `X-CSRF-Token` válido.

| Ruta | Política | Sin sesión | VENDEDOR | ADMIN |
|---|---|---|---|---|
| `GET /api/bitacora` | **Solo ADMIN** | ✅ 401 | ✅ 403 sin efectos (2 vías) | ✅ permitido |
| `GET /api/reportes/resumen` | **Solo ADMIN** | ✅ 401 | ✅ 403 sin efectos (2 vías) | ✅ permitido |
| `GET /api/usuarios` | **Solo ADMIN** | ✅ 401 | ✅ 403 sin efectos (2 vías) | ✅ permitido |
| `GET /api/usuarios/:id` | **Solo ADMIN** | ✅ 401 | ✅ 403 sin efectos (2 vías) | ✅ permitido |
| `POST /api/contingencia` | **Solo ADMIN** | ✅ 401 | ✅ 403 sin efectos (2 vías) | ✅ permitido |
| `POST /api/dte/:id/invalidar` | **Solo ADMIN** | ✅ 401 | ✅ 403 sin efectos (2 vías) | ✅ permitido |
| `POST /api/productos` | **Solo ADMIN** | ✅ 401 | ✅ 403 sin efectos (2 vías) | ✅ permitido |
| `POST /api/usuarios` | **Solo ADMIN** | ✅ 401 | ✅ 403 sin efectos (2 vías) | ✅ permitido |
| `PUT /api/contingencia/consultas` | **Solo ADMIN** | ✅ 401 | ✅ 403 sin efectos (2 vías) | ✅ permitido |
| `PUT /api/contingencia/programacion` | **Solo ADMIN** | ✅ 401 | ✅ 403 sin efectos (2 vías) | ✅ permitido |
| `PUT /api/productos/:id` | **Solo ADMIN** | ✅ 401 | ✅ 403 sin efectos (2 vías) | ✅ permitido |
| `PUT /api/usuarios/:id` | **Solo ADMIN** | ✅ 401 | ✅ 403 sin efectos (2 vías) | ✅ permitido |
| `DELETE /api/borradores/:id` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/auth/sesion` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/borradores` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/borradores/:id` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/catalogos` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/clientes` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/clientes/:id` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/contingencia` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/contingencia/:id` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/contingencia/consultas` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/contingencia/ejecuciones` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/contingencia/programacion` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/dte` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/dte/:id` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/dte/:id/pdf` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/emisor` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/productos` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `GET /api/productos/:id` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `POST /api/borradores` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `POST /api/clientes` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `POST /api/dte/:id/consultar` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `POST /api/dte/:id/correo` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `POST /api/dte/:id/reintentar` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `POST /api/dte/01` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `POST /api/dte/03` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `POST /api/dte/05` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `PUT /api/borradores/:id` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |
| `PUT /api/clientes/:id` | Cualquier rol | ✅ 401 | ✅ permitido | ✅ permitido (resto de suites) |

Controles transversales:

- ✅ Sin sesión → 401 en todas las rutas protegidas › las únicas rutas públicas son health, login y logout
- ✅ Token manipulado → 401 › VENDEDOR que cambia su rol a ADMIN en el payload (firma inválida) no pasa
- ✅ Token manipulado → 401 › token sin firma (alg none) con rol ADMIN → 401
- ✅ Token manipulado → 401 › token firmado con otro secreto → 401
- ✅ Token manipulado → 401 › el rol enviado en el cuerpo se ignora: solo cuenta el del token
- ✅ VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › ningún intento denegado cambió productos, DTE, contingencia, configuración ni bitácora

**40 rutas protegidas en la matriz; 110/110 casos aprobados.**
