# Casos de prueba y resultados

> Generado por `backend/tests/tools/reporteKan23.js` el 2026-11-21 04:04:43 UTC desde `docs/kan-23/evidencia/`. No editar a mano.

**560/560 casos aprobados** (Jest 539/539 en 24 suites; Playwright 21/21).

| Archivo | Tipo | Casos | Aprobados |
|---|---|---|---|
| `tests/e2e/01-login.spec.js` | E2E (navegador) | 3 | 3 |
| `tests/e2e/02-roles.spec.js` | E2E (navegador) | 4 | 4 |
| `tests/e2e/03-clientes.spec.js` | E2E (navegador) | 2 | 2 |
| `tests/e2e/04-venta-dte.spec.js` | E2E (navegador) | 3 | 3 |
| `tests/e2e/05-invalidacion-pdf.spec.js` | E2E (navegador) | 2 | 2 |
| `tests/e2e/06-contingencia.spec.js` | E2E (navegador) | 2 | 2 |
| `tests/e2e/07-fase6.spec.js` | E2E (navegador) | 5 | 5 |
| `tests/integration/auth.test.js` | Integración (API + BD) | 12 | 12 |
| `tests/integration/autorizacion.test.js` | Integración (API + BD) | 108 | 108 |
| `tests/integration/catalogos.test.js` | Integración (API + BD) | 41 | 41 |
| `tests/integration/consultaMh.test.js` | Integración (API + BD) | 22 | 22 |
| `tests/integration/consultas.test.js` | Integración (API + BD) | 17 | 17 |
| `tests/integration/contingencia.test.js` | Integración (API + BD) | 21 | 21 |
| `tests/integration/dte01.factura.test.js` | Integración (API + BD) | 22 | 22 |
| `tests/integration/dte03.ccf.test.js` | Integración (API + BD) | 14 | 14 |
| `tests/integration/dte05.notaCredito.test.js` | Integración (API + BD) | 20 | 20 |
| `tests/integration/eventoContingencia.test.js` | Integración (API + BD) | 24 | 24 |
| `tests/integration/fase6.test.js` | Integración (API + BD) | 36 | 36 |
| `tests/integration/invalidacion.test.js` | Integración (API + BD) | 24 | 24 |
| `tests/integration/loteContingencia.test.js` | Integración (API + BD) | 19 | 19 |
| `tests/integration/pdf.test.js` | Integración (API + BD) | 6 | 6 |
| `tests/integration/resetDemo.test.js` | Integración (API + BD) | 1 | 1 |
| `tests/integration/seguridad.test.js` | Integración (API + BD) | 27 | 27 |
| `tests/integration/tareasProgramadas.test.js` | Integración (API + BD) | 15 | 15 |
| `tests/unit/builders.test.js` | Unitaria | 12 | 12 |
| `tests/unit/calculos.test.js` | Unitaria | 10 | 10 |
| `tests/unit/contingencia.test.js` | Unitaria | 16 | 16 |
| `tests/unit/middleware.test.js` | Unitaria | 20 | 20 |
| `tests/unit/numeroALetras.test.js` | Unitaria | 20 | 20 |
| `tests/unit/simuladores.test.js` | Unitaria | 11 | 11 |
| `tests/unit/utilidades.test.js` | Unitaria | 21 | 21 |

## Detalle

### `tests/e2e/01-login.spec.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | Inicio de sesión › muestra las credenciales de prueba en el entorno local | ✅ |
| 2 | Inicio de sesión › contraseña incorrecta → mensaje claro y sigue en el login | ✅ |
| 3 | Inicio de sesión › login correcto, la sesión sobrevive a la recarga y logout la cierra | ✅ |

### `tests/e2e/02-roles.spec.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | Restricciones por rol › VENDEDOR: no ve opciones de ADMIN en el menú, la venta ni el inventario | ✅ |
| 2 | Restricciones por rol › VENDEDOR: emite una factura pero no ve "Anular" en Transacciones | ✅ |
| 3 | Restricciones por rol › VENDEDOR: la API rechaza con 403 lo que la UI oculta (invalidar, crear producto, enviar contingencia) | ✅ |
| 4 | Restricciones por rol › ADMIN: ve Contingencia, Administración, Simular MH y "Anular" | ✅ |

### `tests/e2e/03-clientes.spec.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | Clientes › registro de consumidor final con DUI | ✅ |
| 2 | Clientes › registro de contribuyente con dirección del catálogo MH, edición y rechazo de datos inválidos | ✅ |

### `tests/e2e/04-venta-dte.spec.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | Venta y emisión de DTE › Factura 01 a consumidor final: PROCESADO con sello, JSON y descuento de stock | ✅ |
| 2 | Venta y emisión de DTE › CCF 03 a un contribuyente: IVA desglosado y tributo 20 | ✅ |
| 3 | Venta y emisión de DTE › CCF 03 sin cliente contribuyente → aviso y no emite | ✅ |

### `tests/e2e/05-invalidacion-pdf.spec.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | Invalidación y PDF › ADMIN anula una factura desde Transacciones: INVALIDADO, stock devuelto y bitácora | ✅ |
| 2 | Invalidación y PDF › Descargar el PDF real del DTE desde Transacciones | ✅ |

### `tests/e2e/06-contingencia.spec.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | Contingencia › MH no responde → DTE en CONTINGENCIA → lote manual → PROCESADO con sello | ✅ |
| 2 | Contingencia › VENDEDOR: el DTE en contingencia se puede reintentar desde Transacciones | ✅ |

### `tests/e2e/07-fase6.spec.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | Fase 6 › Borradores: guardar, listar, continuar y se eliminan al emitir | ✅ |
| 2 | Fase 6 › Correo: el modal dice que es simulado y la bitácora lo registra; nunca "enviado" | ✅ |
| 3 | Fase 6 › Panel gerencial con los totales reales de la API | ✅ |
| 4 | Fase 6 › Usuarios: crear un vendedor real que puede iniciar sesión y desactivarlo | ✅ |
| 5 | Fase 6 › Configuración: emisor real de solo lectura y firmador identificado como simulado | ✅ |

### `tests/integration/auth.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | GET /api/health › sin token responde api/db ok y ambiente 00 | ✅ |
| 2 | POST /api/auth/login › credenciales correctas → token JWT y usuario con rol | ✅ |
| 3 | POST /api/auth/login › contraseña incorrecta → 401 CREDENCIALES y bitácora LOGIN_FALLIDO | ✅ |
| 4 | POST /api/auth/login › faltan campos → 400 VALIDACION | ✅ |
| 5 | POST /api/auth/login › JSON mal formado → 400 VALIDACION | ✅ |
| 6 | Rutas protegidas › GET /api/productos sin token → 401 NO_AUTENTICADO | ✅ |
| 7 | Rutas protegidas › GET /api/clientes sin token → 401 NO_AUTENTICADO | ✅ |
| 8 | Rutas protegidas › GET /api/emisor sin token → 401 NO_AUTENTICADO | ✅ |
| 9 | Rutas protegidas › GET /api/dte sin token → 401 NO_AUTENTICADO | ✅ |
| 10 | Rutas protegidas › GET /api/bitacora sin token → 401 NO_AUTENTICADO | ✅ |
| 11 | Rutas protegidas › token inválido → 401 | ✅ |
| 12 | Rutas protegidas › ruta /api inexistente → 404 NO_ENCONTRADO con formato estándar | ✅ |

### `tests/integration/autorizacion.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | Sin sesión → 401 en todas las rutas protegidas › POST /api/productos | ✅ |
| 2 | Sin sesión → 401 en todas las rutas protegidas › PUT /api/productos/${t.prod.P001.id} | ✅ |
| 3 | Sin sesión → 401 en todas las rutas protegidas › POST /api/dte/${ID()}/invalidar | ✅ |
| 4 | Sin sesión → 401 en todas las rutas protegidas › POST /api/contingencia | ✅ |
| 5 | Sin sesión → 401 en todas las rutas protegidas › PUT /api/contingencia/programacion | ✅ |
| 6 | Sin sesión → 401 en todas las rutas protegidas › PUT /api/contingencia/consultas | ✅ |
| 7 | Sin sesión → 401 en todas las rutas protegidas › GET /api/usuarios | ✅ |
| 8 | Sin sesión → 401 en todas las rutas protegidas › GET /api/usuarios/${usuarioId} | ✅ |
| 9 | Sin sesión → 401 en todas las rutas protegidas › POST /api/usuarios | ✅ |
| 10 | Sin sesión → 401 en todas las rutas protegidas › PUT /api/usuarios/${usuarioId} | ✅ |
| 11 | Sin sesión → 401 en todas las rutas protegidas › GET /api/reportes/resumen | ✅ |
| 12 | Sin sesión → 401 en todas las rutas protegidas › GET /api/auth/sesion | ✅ |
| 13 | Sin sesión → 401 en todas las rutas protegidas › GET /api/productos | ✅ |
| 14 | Sin sesión → 401 en todas las rutas protegidas › GET /api/productos/${t.prod.P001.id} | ✅ |
| 15 | Sin sesión → 401 en todas las rutas protegidas › GET /api/clientes | ✅ |
| 16 | Sin sesión → 401 en todas las rutas protegidas › GET /api/clientes/${clienteId} | ✅ |
| 17 | Sin sesión → 401 en todas las rutas protegidas › POST /api/clientes | ✅ |
| 18 | Sin sesión → 401 en todas las rutas protegidas › PUT /api/clientes/${clienteId} | ✅ |
| 19 | Sin sesión → 401 en todas las rutas protegidas › GET /api/emisor | ✅ |
| 20 | Sin sesión → 401 en todas las rutas protegidas › GET /api/catalogos | ✅ |
| 21 | Sin sesión → 401 en todas las rutas protegidas › GET /api/dte | ✅ |
| 22 | Sin sesión → 401 en todas las rutas protegidas › POST /api/dte/01 | ✅ |
| 23 | Sin sesión → 401 en todas las rutas protegidas › POST /api/dte/03 | ✅ |
| 24 | Sin sesión → 401 en todas las rutas protegidas › POST /api/dte/05 | ✅ |
| 25 | Sin sesión → 401 en todas las rutas protegidas › GET /api/dte/${ID()} | ✅ |
| 26 | Sin sesión → 401 en todas las rutas protegidas › GET /api/dte/${ID()}/pdf | ✅ |
| 27 | Sin sesión → 401 en todas las rutas protegidas › POST /api/dte/${ID()}/reintentar | ✅ |
| 28 | Sin sesión → 401 en todas las rutas protegidas › POST /api/dte/${ID()}/consultar | ✅ |
| 29 | Sin sesión → 401 en todas las rutas protegidas › GET /api/contingencia | ✅ |
| 30 | Sin sesión → 401 en todas las rutas protegidas › GET /api/contingencia/programacion | ✅ |
| 31 | Sin sesión → 401 en todas las rutas protegidas › GET /api/contingencia/consultas | ✅ |
| 32 | Sin sesión → 401 en todas las rutas protegidas › GET /api/contingencia/ejecuciones | ✅ |
| 33 | Sin sesión → 401 en todas las rutas protegidas › GET /api/contingencia/999999 | ✅ |
| 34 | Sin sesión → 401 en todas las rutas protegidas › GET /api/bitacora | ✅ |
| 35 | Sin sesión → 401 en todas las rutas protegidas › GET /api/borradores | ✅ |
| 36 | Sin sesión → 401 en todas las rutas protegidas › POST /api/borradores | ✅ |
| 37 | Sin sesión → 401 en todas las rutas protegidas › GET /api/borradores/${borradorId} | ✅ |
| 38 | Sin sesión → 401 en todas las rutas protegidas › PUT /api/borradores/${borradorId} | ✅ |
| 39 | Sin sesión → 401 en todas las rutas protegidas › DELETE /api/borradores/${borradorId} | ✅ |
| 40 | Sin sesión → 401 en todas las rutas protegidas › POST /api/dte/${ID()}/correo | ✅ |
| 41 | Sin sesión → 401 en todas las rutas protegidas › las únicas rutas públicas son health, login y logout | ✅ |
| 42 | Token manipulado → 401 › VENDEDOR que cambia su rol a ADMIN en el payload (firma inválida) no pasa | ✅ |
| 43 | Token manipulado → 401 › token sin firma (alg none) con rol ADMIN → 401 | ✅ |
| 44 | Token manipulado → 401 › token firmado con otro secreto → 401 | ✅ |
| 45 | Token manipulado → 401 › el rol enviado en el cuerpo se ignora: solo cuenta el del token | ✅ |
| 46 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › Bearer · POST /api/productos | ✅ |
| 47 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › Bearer · PUT /api/productos/${t.prod.P001.id} | ✅ |
| 48 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › Bearer · POST /api/dte/${ID()}/invalidar | ✅ |
| 49 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › Bearer · POST /api/contingencia | ✅ |
| 50 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › Bearer · PUT /api/contingencia/programacion | ✅ |
| 51 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › Bearer · PUT /api/contingencia/consultas | ✅ |
| 52 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › Bearer · GET /api/usuarios | ✅ |
| 53 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › Bearer · GET /api/usuarios/${usuarioId} | ✅ |
| 54 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › Bearer · POST /api/usuarios | ✅ |
| 55 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › Bearer · PUT /api/usuarios/${usuarioId} | ✅ |
| 56 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › Bearer · GET /api/reportes/resumen | ✅ |
| 57 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › cookie + CSRF válido · POST /api/productos | ✅ |
| 58 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › cookie + CSRF válido · PUT /api/productos/${t.prod.P001.id} | ✅ |
| 59 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › cookie + CSRF válido · POST /api/dte/${ID()}/invalidar | ✅ |
| 60 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › cookie + CSRF válido · POST /api/contingencia | ✅ |
| 61 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › cookie + CSRF válido · PUT /api/contingencia/programacion | ✅ |
| 62 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › cookie + CSRF válido · PUT /api/contingencia/consultas | ✅ |
| 63 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › cookie + CSRF válido · GET /api/usuarios | ✅ |
| 64 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › cookie + CSRF válido · GET /api/usuarios/${usuarioId} | ✅ |
| 65 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › cookie + CSRF válido · POST /api/usuarios | ✅ |
| 66 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › cookie + CSRF válido · PUT /api/usuarios/${usuarioId} | ✅ |
| 67 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › cookie + CSRF válido · GET /api/reportes/resumen | ✅ |
| 68 | VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos › ningún intento denegado cambió productos, DTE, contingencia, configuración ni bitácora | ✅ |
| 69 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/auth/sesion | ✅ |
| 70 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/productos | ✅ |
| 71 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/productos/${t.prod.P001.id} | ✅ |
| 72 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/clientes | ✅ |
| 73 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/clientes/${clienteId} | ✅ |
| 74 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · POST /api/clientes | ✅ |
| 75 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · PUT /api/clientes/${clienteId} | ✅ |
| 76 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/emisor | ✅ |
| 77 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/catalogos | ✅ |
| 78 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/dte | ✅ |
| 79 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · POST /api/dte/01 | ✅ |
| 80 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · POST /api/dte/03 | ✅ |
| 81 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · POST /api/dte/05 | ✅ |
| 82 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/dte/${ID()} | ✅ |
| 83 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/dte/${ID()}/pdf | ✅ |
| 84 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · POST /api/dte/${ID()}/reintentar | ✅ |
| 85 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · POST /api/dte/${ID()}/consultar | ✅ |
| 86 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/contingencia | ✅ |
| 87 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/contingencia/programacion | ✅ |
| 88 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/contingencia/consultas | ✅ |
| 89 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/contingencia/ejecuciones | ✅ |
| 90 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/contingencia/999999 | ✅ |
| 91 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/bitacora | ✅ |
| 92 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/borradores | ✅ |
| 93 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · POST /api/borradores | ✅ |
| 94 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · GET /api/borradores/${borradorId} | ✅ |
| 95 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · PUT /api/borradores/${borradorId} | ✅ |
| 96 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · DELETE /api/borradores/${borradorId} | ✅ |
| 97 | Rutas de cualquier rol: ningún usuario autenticado recibe 403 › VENDEDOR · POST /api/dte/${ID()}/correo | ✅ |
| 98 | ADMIN en rutas de solo ADMIN: autorizado (la operación se ejecuta) › POST /api/productos | ✅ |
| 99 | ADMIN en rutas de solo ADMIN: autorizado (la operación se ejecuta) › PUT /api/productos/${t.prod.P001.id} | ✅ |
| 100 | ADMIN en rutas de solo ADMIN: autorizado (la operación se ejecuta) › POST /api/dte/${ID()}/invalidar | ✅ |
| 101 | ADMIN en rutas de solo ADMIN: autorizado (la operación se ejecuta) › POST /api/contingencia | ✅ |
| 102 | ADMIN en rutas de solo ADMIN: autorizado (la operación se ejecuta) › PUT /api/contingencia/programacion | ✅ |
| 103 | ADMIN en rutas de solo ADMIN: autorizado (la operación se ejecuta) › PUT /api/contingencia/consultas | ✅ |
| 104 | ADMIN en rutas de solo ADMIN: autorizado (la operación se ejecuta) › GET /api/usuarios | ✅ |
| 105 | ADMIN en rutas de solo ADMIN: autorizado (la operación se ejecuta) › GET /api/usuarios/${usuarioId} | ✅ |
| 106 | ADMIN en rutas de solo ADMIN: autorizado (la operación se ejecuta) › POST /api/usuarios | ✅ |
| 107 | ADMIN en rutas de solo ADMIN: autorizado (la operación se ejecuta) › PUT /api/usuarios/${usuarioId} | ✅ |
| 108 | ADMIN en rutas de solo ADMIN: autorizado (la operación se ejecuta) › GET /api/reportes/resumen | ✅ |

### `tests/integration/catalogos.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | Productos › GET lista los 10 productos del seed con la forma del contrato | ✅ |
| 2 | Productos › ?q busca por código o descripción | ✅ |
| 3 | Productos › ADMIN crea (201) y el precio se redondea a 2 decimales | ✅ |
| 4 | Productos › código repetido → 400 VALIDACION | ✅ |
| 5 | Productos › precio negativo → 400 VALIDACION | ✅ |
| 6 | Productos › VENDEDOR no puede crear ni editar → 403 SIN_PERMISO | ✅ |
| 7 | Productos › PUT parcial y borrado lógico: inactivo no aparece por defecto | ✅ |
| 8 | Productos › GET /:id inexistente → 404 | ✅ |
| 9 | Clientes › CONTRIBUYENTE exige NIT, NRC y actividad → 400 | ✅ |
| 10 | Clientes › NIT con formato inválido → 400 | ✅ |
| 11 | Clientes › NIT/NRC con guiones se guardan solo con dígitos (201) | ✅ |
| 12 | Clientes › CONSUMIDOR solo requiere nombre | ✅ |
| 13 | Clientes › P2: guarda todos los datos del receptor con códigos MH | ✅ |
| 14 | Clientes › P2: CONSUMIDOR con DUI (tipoDocumento 13) y dirección opcional | ✅ |
| 15 | Clientes › P2: dirección inválida {"complemento": "Col. Escalón #1", "departamento": "99", "distrito": "14", "municipio": "23"} → 400 | ✅ |
| 16 | Clientes › P2: dirección inválida {"complemento": "Col. Escalón #1", "departamento": "06", "distrito": "14", "municipio": "05"} → 400 | ✅ |
| 17 | Clientes › P2: dirección inválida {"complemento": "Col. Escalón #1", "departamento": "06", "distrito": "01", "municipio": "23"} → 400 | ✅ |
| 18 | Clientes › P2: dirección inválida {"complemento": "", "departamento": "06", "distrito": "14", "municipio": "23"} → 400 | ✅ |
| 19 | Clientes › P2: dirección inválida "Col. Escalón" → 400 | ✅ |
| 20 | Clientes › P2: CONTRIBUYENTE sin dirección → 400; tipoDocumento fuera del CAT-022 → 400 | ✅ |
| 21 | Clientes › P2: GET /api/catalogos → departamentos/municipios/distritos y tipos de documento | ✅ |
| 22 | Clientes › ?tipo filtra por tipo | ✅ |
| 23 | Clientes › PUT revalida el registro completo: quitar el NRC a un CONTRIBUYENTE → 400 | ✅ |
| 24 | Clientes · edición (KAN-34) › registro de consumidor final y de contribuyente (201) | ✅ |
| 25 | Clientes · edición (KAN-34) › VENDEDOR edita un contribuyente: datos fiscales, contacto y dirección (200) y queda en bitácora | ✅ |
| 26 | Clientes · edición (KAN-34) › consulta del cliente actualizado: GET /:id y búsqueda por el nuevo NIT | ✅ |
| 27 | Clientes · edición (KAN-34) › consumidor: agregar DUI y dirección; luego quitarlos (null) | ✅ |
| 28 | Clientes · edición (KAN-34) › consumidor → contribuyente: exige los datos fiscales; con ellos pasa a documento NIT | ✅ |
| 29 | Clientes · edición (KAN-34) › rechaza datos inválidos al editar (NIT con 10 dígitos) → 400 VALIDACION y no cambia nada | ✅ |
| 30 | Clientes · edición (KAN-34) › rechaza datos inválidos al editar (NRC con letras) → 400 VALIDACION y no cambia nada | ✅ |
| 31 | Clientes · edición (KAN-34) › rechaza datos inválidos al editar (NRC de 9 dígitos) → 400 VALIDACION y no cambia nada | ✅ |
| 32 | Clientes · edición (KAN-34) › rechaza datos inválidos al editar (actividad de 3 dígitos) → 400 VALIDACION y no cambia nada | ✅ |
| 33 | Clientes · edición (KAN-34) › rechaza datos inválidos al editar (sin descripción de actividad) → 400 VALIDACION y no cambia nada | ✅ |
| 34 | Clientes · edición (KAN-34) › rechaza datos inválidos al editar (sin dirección) → 400 VALIDACION y no cambia nada | ✅ |
| 35 | Clientes · edición (KAN-34) › rechaza datos inválidos al editar (municipio de otro departamento) → 400 VALIDACION y no cambia nada | ✅ |
| 36 | Clientes · edición (KAN-34) › rechaza datos inválidos al editar (correo inválido) → 400 VALIDACION y no cambia nada | ✅ |
| 37 | Clientes · edición (KAN-34) › consumidor: tipo de documento fuera del CAT-022 o DUI mal formado → 400 | ✅ |
| 38 | Clientes · edición (KAN-34) › PUT a un cliente inexistente → 404 | ✅ |
| 39 | Clientes · edición (KAN-34) › el cliente editado se asocia a una venta: el CCF lleva los datos nuevos en el receptor | ✅ |
| 40 | Clientes · edición (KAN-34) › un consumidor editado (DUI) aparece como receptor de la Factura 01 | ✅ |
| 41 | Emisor › GET /api/emisor devuelve los datos del seed con M001/P001 | ✅ |

### `tests/integration/consultaMh.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | X-Simular: timeout (MH recibió, pero la respuesta no llegó) › para el POS es una contingencia: CONTINGENCIA, sin sello, JSON en modelo diferido, stock descontado | ✅ |
| 2 | X-Simular: timeout (MH recibió, pero la respuesta no llegó) › invalidar con timeout → 503 MH_NO_DISPONIBLE (como contingencia) | ✅ |
| 3 | POST /api/dte/:id/consultar › DTE que MH sí recibió → ENCONTRADO: PROCESADO con sello, JSON y firma de modelo previo, stock igual | ✅ |
| 4 | POST /api/dte/:id/consultar › contingencia real → NO_ENCONTRADO: sigue en CONTINGENCIA y cuenta la consulta | ✅ |
| 5 | POST /api/dte/:id/consultar › MH tampoco responde a la consulta (X-Simular contingencia/timeout) → SIN_RESPUESTA, aunque MH lo tenga | ✅ |
| 6 | POST /api/dte/:id/consultar › DTE que no está en CONTINGENCIA → 409; inexistente → 404; X-Simular inválido → 400; sin token → 401 | ✅ |
| 7 | Reenvío de un DTE que MH ya tenía › reintentar → PROCESADO con el sello ORIGINAL (MH no lo duplica) y JSON de modelo previo | ✅ |
| 8 | Reenvío de un DTE que MH ya tenía › reintentar con timeout otra vez → sigue en CONTINGENCIA; luego la consulta lo encuentra | ✅ |
| 9 | Reenvío de un DTE que MH ya tenía › lote de contingencia con un DTE que MH ya tenía → PROCESADO con su sello original | ✅ |
| 10 | Cola: un DTE por turno (consultarSiguiente) › GET /api/contingencia/consultas: cola en orden (nunca consultados primero, por id) | ✅ |
| 11 | Cola: un DTE por turno (consultarSiguiente) › cada turno consulta solo UN documento, en orden round-robin | ✅ |
| 12 | Cola: un DTE por turno (consultarSiguiente) › los turnos automáticos sin novedad no llenan la bitácora; el ENCONTRADO sí queda | ✅ |
| 13 | Cola: un DTE por turno (consultarSiguiente) › MH sin respuesta en un turno → SIN_RESPUESTA y el DTE pasa al final de la cola | ✅ |
| 14 | Cola: un DTE por turno (consultarSiguiente) › sin DTE en contingencia → el turno no hace nada (null) | ✅ |
| 15 | PUT /api/contingencia/consultas › VENDEDOR → 403; GET cualquier rol | ✅ |
| 16 | PUT /api/contingencia/consultas › {} → 400 VALIDACION | ✅ |
| 17 | PUT /api/contingencia/consultas › {"intervaloSeg":5} → 400 VALIDACION | ✅ |
| 18 | PUT /api/contingencia/consultas › {"intervaloSeg":3601} → 400 VALIDACION | ✅ |
| 19 | PUT /api/contingencia/consultas › {"intervaloSeg":12.5} → 400 VALIDACION | ✅ |
| 20 | PUT /api/contingencia/consultas › {"intervaloSeg":"30"} → 400 VALIDACION | ✅ |
| 21 | PUT /api/contingencia/consultas › {"activo":1} → 400 VALIDACION | ✅ |
| 22 | PUT /api/contingencia/consultas › cambia intervalo y activo; queda en bitácora | ✅ |

### `tests/integration/consultas.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | GET /api/dte › lista todos, el más reciente primero, con la forma del contrato | ✅ |
| 2 | GET /api/dte › filtro {"tipo": "01"} | ✅ |
| 3 | GET /api/dte › filtro {"tipo": "05"} | ✅ |
| 4 | GET /api/dte › filtro {"estado": "INVALIDADO"} | ✅ |
| 5 | GET /api/dte › filtro {"estado": "RECHAZADO"} | ✅ |
| 6 | GET /api/dte › filtro {"estado": "CONTINGENCIA"} | ✅ |
| 7 | GET /api/dte › filtro {"estado": "PROCESADO", "tipo": "03"} | ✅ |
| 8 | GET /api/dte › filtro clienteId | ✅ |
| 9 | GET /api/dte › filtro de fechas inclusivo (hoy) y fuera de rango | ✅ |
| 10 | GET /api/dte › filtro inválido {"tipo": "99"} → 400 | ✅ |
| 11 | GET /api/dte › filtro inválido {"estado": "BORRADO"} → 400 | ✅ |
| 12 | GET /api/dte › filtro inválido {"desde": "04/11/2026"} → 400 | ✅ |
| 13 | GET /api/dte/:id › detalle con jsonDte, items, firmador/respuestaMh parseados y usuario | ✅ |
| 14 | GET /api/dte/:id › inexistente → 404; id inválido → 400 | ✅ |
| 15 | GET /api/bitacora › registra cada operación con la acción y el resultado | ✅ |
| 16 | GET /api/bitacora › filtros accion, usuario, dteId y limite | ✅ |
| 17 | GET /api/bitacora › limite fuera de 1–1000 → 400 | ✅ |

### `tests/integration/contingencia.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | X-Simular › valor inválido → 400 VALIDACION y no se emite nada | ✅ |
| 2 | X-Simular › acepta mayúsculas (OK) | ✅ |
| 3 | Rechazo de MH en la emisión › ok:true (201) con estado RECHAZADO, sin sello y con observaciones | ✅ |
| 4 | Rechazo de MH en la emisión › no descuenta stock | ✅ |
| 5 | Rechazo de MH en la emisión › queda registrado y consume correlativo | ✅ |
| 6 | Rechazo de MH en la emisión › bitácora EMISION con resultado RECHAZADO | ✅ |
| 7 | Rechazo de MH en la emisión › un DTE RECHAZADO no se puede reintentar ni invalidar (409) | ✅ |
| 8 | Contingencia (MH no responde) y reintento exitoso › estado CONTINGENCIA, sin sello, respuestaMh null, firmado OK | ✅ |
| 9 | Contingencia (MH no responde) y reintento exitoso › descuenta stock (la venta ocurrió) | ✅ |
| 10 | Contingencia (MH no responde) y reintento exitoso › el JSON del DTE en contingencia cumple el esquema | ✅ |
| 11 | Contingencia (MH no responde) y reintento exitoso › no se puede invalidar mientras está en CONTINGENCIA (409) | ✅ |
| 12 | Contingencia (MH no responde) y reintento exitoso › reintento con MH aún caído → sigue en CONTINGENCIA, stock sin cambios | ✅ |
| 13 | Contingencia (MH no responde) y reintento exitoso › reintento ok → PROCESADO con sello; conserva codigoGeneracion, numeroControl y firma | ✅ |
| 14 | Contingencia (MH no responde) y reintento exitoso › reintentar un DTE PROCESADO → 409 ESTADO_INVALIDO | ✅ |
| 15 | Contingencia (MH no responde) y reintento exitoso › bitácora: EMISION CONTINGENCIA y dos REINTENTO (CONTINGENCIA, PROCESADO) | ✅ |
| 16 | Contingencia (MH no responde) y reintento exitoso › una vez PROCESADO ya se puede invalidar | ✅ |
| 17 | Contingencia → reintento rechazado › pasa a RECHAZADO y revierte el stock descontado en contingencia | ✅ |
| 18 | Contingencia en CCF (03) y NC (05) › 03 en contingencia → reintento ok → admite NC | ✅ |
| 19 | Contingencia en CCF (03) y NC (05) › 05 en contingencia → reintento rechazado → vuelve a sacar el stock devuelto | ✅ |
| 20 | Reintento · errores › DTE inexistente → 404 | ✅ |
| 21 | Reintento · errores › id inválido → 400 | ✅ |

### `tests/integration/dte01.factura.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | 01 Factura · emisión exitosa (X-Simular: ok) › responde 201 con la respuesta de emisión del contrato | ✅ |
| 2 | 01 Factura · emisión exitosa (X-Simular: ok) › numeroControl DTE-01-M001P001-{15 dígitos} empezando en 1 y codigoGeneracion UUID v4 en MAYÚSCULAS | ✅ |
| 3 | 01 Factura · emisión exitosa (X-Simular: ok) › firmador OK y respuesta MH PROCESADO con sello de 40 caracteres | ✅ |
| 4 | 01 Factura · emisión exitosa (X-Simular: ok) › el payload firmado es el JSON DTE guardado | ✅ |
| 5 | 01 Factura · emisión exitosa (X-Simular: ok) › jsonDte cumple fe-f-v2.json, sin receptor y con IVA incluido | ✅ |
| 6 | 01 Factura · emisión exitosa (X-Simular: ok) › descuenta el stock | ✅ |
| 7 | 01 Factura · emisión exitosa (X-Simular: ok) › registra EMISION en la bitácora | ✅ |
| 8 | 01 Factura · variantes › con receptor, varias líneas y descuento CON IVA: 9.16 → "NUEVE 16/100 USD" | ✅ |
| 9 | 01 Factura · variantes › a crédito (condicionOperacion 2): pagos = null | ✅ |
| 10 | 01 Factura · variantes › un mismo producto repetido se suma en una línea | ✅ |
| 11 | 01 Factura · variantes › los números de control son consecutivos por tipo | ✅ |
| 12 | 01 Factura · variantes › concurrencia: 8 emisiones en paralelo obtienen 8 números de control distintos | ✅ |
| 13 | 01 Factura · errores › sin items → 400 VALIDACION | ✅ |
| 14 | 01 Factura · errores › cantidad 0 o decimal → 400 | ✅ |
| 15 | 01 Factura · errores › condicionOperacion fuera de 1/2/3 → 400 | ✅ |
| 16 | 01 Factura · errores › producto inexistente → 404 NO_ENCONTRADO | ✅ |
| 17 | 01 Factura · errores › cliente inexistente → 404 | ✅ |
| 18 | 01 Factura · errores › descuento mayor que la línea → 400 | ✅ |
| 19 | 01 Factura · errores › stock insuficiente → 409 STOCK_INSUFICIENTE y no consume correlativo ni stock | ✅ |
| 20 | 01 Factura · errores › stock insuficiente se valida también en contingencia y rechazo | ✅ |
| 21 | 01 Factura · errores › producto inactivo → 400 | ✅ |
| 22 | 01 Factura · errores › sin token → 401 | ✅ |

### `tests/integration/dte03.ccf.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | 03 CCF · emisión exitosa › 201 PROCESADO, total 113.00, número de control del tipo 03 | ✅ |
| 2 | 03 CCF · emisión exitosa › jsonDte cumple fe-ccf-v4.json (version 4, sin extension) | ✅ |
| 3 | 03 CCF · emisión exitosa › precios SIN IVA y tributo 20 de 13 % en el resumen | ✅ |
| 4 | 03 CCF · emisión exitosa › receptor con NIT, NRC y actividad del contribuyente | ✅ |
| 5 | 03 CCF · emisión exitosa › P2: nombre comercial, teléfono y dirección con los códigos MH del cliente | ✅ |
| 6 | 03 CCF · emisión exitosa › items con acreditada 0 y pendiente = cantidad (para la NC) | ✅ |
| 7 | 03 CCF · emisión exitosa › descuenta stock (100 − 40) | ✅ |
| 8 | 03 CCF · validaciones del receptor › sin clienteId → 400 VALIDACION | ✅ |
| 9 | 03 CCF · validaciones del receptor › cliente CONSUMIDOR → 400 "debe ser CONTRIBUYENTE" | ✅ |
| 10 | 03 CCF · validaciones del receptor › cliente inexistente → 404 | ✅ |
| 11 | 03 CCF · validaciones del receptor › cliente inactivo → 400 | ✅ |
| 12 | 03 CCF · variantes › descuento SIN IVA: 2 × 18.50 − 7 = 30 + 3.90 = 33.90 | ✅ |
| 13 | 03 CCF · variantes › a crédito: pagos = null y sigue cumpliendo el esquema | ✅ |
| 14 | 03 CCF · variantes › el correlativo del 03 es independiente del 01 | ✅ |

### `tests/integration/dte05.notaCredito.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | 05 NC · emisión exitosa sobre un CCF › 201 PROCESADO con número de control del tipo 05 | ✅ |
| 2 | 05 NC · emisión exitosa sobre un CCF › jsonDte cumple fe-nc-v4.json | ✅ |
| 3 | 05 NC · emisión exitosa sobre un CCF › documentoRelacionado = [{03, generación 2, codigoGeneracion del CCF, fecha}] | ✅ |
| 4 | 05 NC · emisión exitosa sobre un CCF › mismo receptor que el CCF | ✅ |
| 5 | 05 NC · emisión exitosa sobre un CCF › montos: 5 × 2.50 = 12.50 + IVA 1.63 = 14.13 | ✅ |
| 6 | 05 NC · emisión exitosa sobre un CCF › devuelve el stock | ✅ |
| 7 | 05 NC · emisión exitosa sobre un CCF › el CCF muestra acreditada/pendiente y la NC en notasCredito | ✅ |
| 8 | 05 NC · límites de cantidad y descuento proporcional › cantidad mayor a la pendiente → 400 VALIDACION | ✅ |
| 9 | 05 NC · límites de cantidad y descuento proporcional › descuento del CCF se acredita en proporción y la última acreditación toma el resto exacto | ✅ |
| 10 | 05 NC · límites de cantidad y descuento proporcional › sin pendiente → 400 | ✅ |
| 11 | 05 NC · límites de cantidad y descuento proporcional › una NC RECHAZADA no cuenta como acreditada ni devuelve stock | ✅ |
| 12 | 05 NC · límites de cantidad y descuento proporcional › una NC en CONTINGENCIA sí cuenta como acreditada (reserva lo pendiente) y devuelve stock | ✅ |
| 13 | 05 NC · reglas del documento relacionado › producto que no está en el CCF → 400 | ✅ |
| 14 | 05 NC · reglas del documento relacionado › clienteId distinto del receptor del CCF → 400 | ✅ |
| 15 | 05 NC · reglas del documento relacionado › clienteId igual al del CCF → 201 | ✅ |
| 16 | 05 NC · reglas del documento relacionado › sobre una Factura 01 → 400 VALIDACION | ✅ |
| 17 | 05 NC · reglas del documento relacionado › sobre un CCF RECHAZADO → 409 ESTADO_INVALIDO | ✅ |
| 18 | 05 NC · reglas del documento relacionado › sobre un CCF en CONTINGENCIA → 409 ESTADO_INVALIDO | ✅ |
| 19 | 05 NC · reglas del documento relacionado › CCF inexistente → 404 | ✅ |
| 20 | 05 NC · reglas del documento relacionado › sin dteRelacionadoId → 400 | ✅ |

### `tests/integration/eventoContingencia.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | DTE emitido en contingencia › 01: JSON con tipoModelo 2, tipoOperacion 2, tipoContingencia 1, firmado así y válido contra el esquema | ✅ |
| 2 | DTE emitido en contingencia › 03: JSON con tipoModelo 2, tipoOperacion 2, tipoContingencia 1, firmado así y válido contra el esquema | ✅ |
| 3 | DTE emitido en contingencia › 05: NC en contingencia también pasa a modelo diferido y cumple el esquema | ✅ |
| 4 | DTE emitido en contingencia › un DTE procesado normalmente sigue con tipoModelo 1 y tipoOperacion 1 | ✅ |
| 5 | POST /api/contingencia · validaciones › VENDEDOR → 403 SIN_PERMISO | ✅ |
| 6 | POST /api/contingencia · validaciones › DTE que no está en CONTINGENCIA → 409 ESTADO_INVALIDO | ✅ |
| 7 | POST /api/contingencia · validaciones › DTE inexistente → 404 | ✅ |
| 8 | POST /api/contingencia · validaciones › dteIds vacío o no numérico → 400 | ✅ |
| 9 | POST /api/contingencia · validaciones › motivo de más de 500 caracteres → 400 | ✅ |
| 10 | POST /api/contingencia · validaciones › X-Simular inválido → 400 | ✅ |
| 11 | Evento sin respuesta de MH y evento rechazado › MH no responde → 503 MH_NO_DISPONIBLE, no se guarda el evento, DTE sigue en CONTINGENCIA, bitácora SIN_RESPUESTA | ✅ |
| 12 | Evento sin respuesta de MH y evento rechazado › evento rechazado → 201 ok:true, estado RECHAZADO sin sello; los DTE siguen en CONTINGENCIA | ✅ |
| 13 | Evento aceptado: transmite todos los DTE en contingencia › sin dteIds incluye todos los DTE en CONTINGENCIA (01, 03 y 05) | ✅ |
| 14 | Evento aceptado: transmite todos los DTE en contingencia › evento PROCESADO con sello propio y código de generación UUID en mayúsculas | ✅ |
| 15 | Evento aceptado: transmite todos los DTE en contingencia › jsonEvento cumple contingencia-schema-v4.json y lista cada DTE en detalleDTE | ✅ |
| 16 | Evento aceptado: transmite todos los DTE en contingencia › cada DTE quedó PROCESADO con su sello, conservando codigoGeneracion y numeroControl | ✅ |
| 17 | Evento aceptado: transmite todos los DTE en contingencia › bitácora: CONTINGENCIA PROCESADO y un REINTENTO por DTE con el código del evento | ✅ |
| 18 | Evento aceptado: transmite todos los DTE en contingencia › sin DTE en contingencia → 409 ESTADO_INVALIDO | ✅ |
| 19 | Evento aceptado: transmite todos los DTE en contingencia › los DTE transmitidos ya se pueden invalidar | ✅ |
| 20 | Evento con dteIds seleccionados › solo transmite los indicados (ids repetidos se cuentan una vez) | ✅ |
| 21 | GET /api/contingencia › lista los eventos guardados (procesados y rechazados), más reciente primero | ✅ |
| 22 | GET /api/contingencia › GET /:id devuelve el evento con jsonEvento, firmador, respuestaMh y el estado actual de sus DTE | ✅ |
| 23 | GET /api/contingencia › evento inexistente → 404; id inválido → 400 | ✅ |
| 24 | GET /api/contingencia › sin token → 401 | ✅ |

### `tests/integration/fase6.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | Usuarios (solo ADMIN) › lista los usuarios del seed sin exponer el hash | ✅ |
| 2 | Usuarios (solo ADMIN) › crea un usuario que puede iniciar sesión; bitácora sin la contraseña | ✅ |
| 3 | Usuarios (solo ADMIN) › crear inválido 0 → 400 | ✅ |
| 4 | Usuarios (solo ADMIN) › crear inválido 1 → 400 | ✅ |
| 5 | Usuarios (solo ADMIN) › crear inválido 2 → 400 | ✅ |
| 6 | Usuarios (solo ADMIN) › crear inválido 3 → 400 | ✅ |
| 7 | Usuarios (solo ADMIN) › crear inválido 4 → 400 | ✅ |
| 8 | Usuarios (solo ADMIN) › crear inválido 5 → 400 | ✅ |
| 9 | Usuarios (solo ADMIN) › edita nombre y rol; el login no se puede cambiar | ✅ |
| 10 | Usuarios (solo ADMIN) › cambio de contraseña: la vieja deja de servir | ✅ |
| 11 | Usuarios (solo ADMIN) › desactivado: no inicia sesión ni aparece en la lista por defecto | ✅ |
| 12 | Usuarios (solo ADMIN) › nadie se desactiva ni se quita el rol ADMIN a sí mismo | ✅ |
| 13 | Usuarios (solo ADMIN) › no se puede dejar el sistema sin ADMIN activo (409) | ✅ |
| 14 | Usuarios (solo ADMIN) › 404 y VENDEDOR 403 | ✅ |
| 15 | Borradores (por usuario) › crea con total estimado (01: precio con IVA) y suma líneas repetidas | ✅ |
| 16 | Borradores (por usuario) › actualiza a CCF con cliente: total sin IVA + 13 % | ✅ |
| 17 | Borradores (por usuario) › cada usuario ve solo los suyos (el de otro → 404) | ✅ |
| 18 | Borradores (por usuario) › inválido 0 → NaN | ✅ |
| 19 | Borradores (por usuario) › inválido 1 → NaN | ✅ |
| 20 | Borradores (por usuario) › inválido 2 → NaN | ✅ |
| 21 | Borradores (por usuario) › inválido 3 → NaN | ✅ |
| 22 | Borradores (por usuario) › inválido 4 → NaN | ✅ |
| 23 | Borradores (por usuario) › un producto desactivado después queda no disponible y fuera del estimado | ✅ |
| 24 | Borradores (por usuario) › eliminar; bitácora CREAR/ACTUALIZAR/ELIMINAR | ✅ |
| 25 | Correo (envío SIMULADO) › responde enviado:false / simulado:true y deja constancia en bitácora | ✅ |
| 26 | Correo (envío SIMULADO) › correo inválido 400, DTE inexistente 404, rechazado 409 | ✅ |
| 27 | Reportes gerenciales (solo ADMIN) › GET /api/dte incluye el usuario que emitió | ✅ |
| 28 | Reportes gerenciales (solo ADMIN) › totales coherentes con los DTE del período | ✅ |
| 29 | Reportes gerenciales (solo ADMIN) › CCF + NC: ventas netas descuentan la nota de crédito; filtro por tipo | ✅ |
| 30 | Reportes gerenciales (solo ADMIN) › período sin datos: días en cero | ✅ |
| 31 | Reportes gerenciales (solo ADMIN) › desde=2026-13-01 → 400 | ✅ |
| 32 | Reportes gerenciales (solo ADMIN) › desde=2026-02-30 → 400 | ✅ |
| 33 | Reportes gerenciales (solo ADMIN) › desde=2026-03-02&hasta=2026-03-01 → 400 | ✅ |
| 34 | Reportes gerenciales (solo ADMIN) › desde=2020-01-01&hasta=2026-01-01 → 400 | ✅ |
| 35 | Reportes gerenciales (solo ADMIN) › tipo=07 → 400 | ✅ |
| 36 | Reportes gerenciales (solo ADMIN) › VENDEDOR → 403 | ✅ |

### `tests/integration/invalidacion.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | Invalidar una Factura 01 › 200 con DTE INVALIDADO, evento PROCESADO y sello propio | ✅ |
| 2 | Invalidar una Factura 01 › jsonEvento cumple invalidacion-schema-v3.json y referencia al DTE | ✅ |
| 3 | Invalidar una Factura 01 › devuelve el stock | ✅ |
| 4 | Invalidar una Factura 01 › GET /api/dte/:id muestra el evento de invalidación | ✅ |
| 5 | Invalidar una Factura 01 › bitácora INVALIDACION PROCESADO | ✅ |
| 6 | Invalidar una Factura 01 › invalidar otra vez → 409 ESTADO_INVALIDO | ✅ |
| 7 | Invalidación con MH rechazando o sin responder › evento rechazado → ok:true, estadoEvento RECHAZADO, DTE sigue PROCESADO y stock sin cambios | ✅ |
| 8 | Invalidación con MH rechazando o sin responder › MH no responde → 503 MH_NO_DISPONIBLE; DTE sigue PROCESADO; bitácora SIN_RESPUESTA | ✅ |
| 9 | Invalidación con MH rechazando o sin responder › luego se puede reintentar la invalidación con éxito | ✅ |
| 10 | Invalidar un CCF con Nota de crédito › CCF con NC vigente → 409 ESTADO_INVALIDO | ✅ |
| 11 | Invalidar un CCF con Nota de crédito › invalidar la NC: el evento cumple el esquema (tipoDte 05) y vuelve a sacar el stock | ✅ |
| 12 | Invalidar un CCF con Nota de crédito › sin NC vigente el CCF se invalida y devuelve su stock | ✅ |
| 13 | Invalidar un CCF con Nota de crédito › no se puede emitir una NC sobre un CCF INVALIDADO (409) | ✅ |
| 14 | Invalidación · tipos de anulación y validaciones › sin motivo → 400 | ✅ |
| 15 | Invalidación · tipos de anulación y validaciones › motivo de más de 200 caracteres → 400 | ✅ |
| 16 | Invalidación · tipos de anulación y validaciones › tipoAnulacion fuera de 1/2/3 → 400 | ✅ |
| 17 | Invalidación · tipos de anulación y validaciones › tipoAnulacion 1 sin codigoGeneracionR → 400 | ✅ |
| 18 | Invalidación · tipos de anulación y validaciones › tipoAnulacion 2 con codigoGeneracionR → 400 | ✅ |
| 19 | Invalidación · tipos de anulación y validaciones › tipoAnulacion 1 con codigoGeneracionR de otro DTE PROCESADO → 200 y lo refleja en el evento | ✅ |
| 20 | Invalidación · tipos de anulación y validaciones › DTE inexistente → 404 | ✅ |
| 21 | Invalidación · autorización (política ROLES_INVALIDAR = ADMIN) › sin token → 401 NO_AUTENTICADO | ✅ |
| 22 | Invalidación · autorización (política ROLES_INVALIDAR = ADMIN) › VENDEDOR → 403 SIN_PERMISO con el formato estándar de error | ✅ |
| 23 | Invalidación · autorización (política ROLES_INVALIDAR = ADMIN) › VENDEDOR sobre un DTE inexistente también → 403 (la autorización va antes que la búsqueda) | ✅ |
| 24 | Invalidación · autorización (política ROLES_INVALIDAR = ADMIN) › ADMIN sobre el mismo DTE → 200, INVALIDADO, stock devuelto y bitácora | ✅ |

### `tests/integration/loteContingencia.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | GET/PUT /api/contingencia/programacion › GET (cualquier rol): activo, hora HH:mm, próxima ejecución y pendientes | ✅ |
| 2 | GET/PUT /api/contingencia/programacion › sin token → 401 | ✅ |
| 3 | GET/PUT /api/contingencia/programacion › PUT VENDEDOR → 403 SIN_PERMISO | ✅ |
| 4 | GET/PUT /api/contingencia/programacion › PUT {} → 400 VALIDACION (sin campos) | ✅ |
| 5 | GET/PUT /api/contingencia/programacion › PUT {"hora":"24:00"} → 400 VALIDACION (hora fuera de rango) | ✅ |
| 6 | GET/PUT /api/contingencia/programacion › PUT {"hora":"7:5"} → 400 VALIDACION (hora sin formato HH:mm) | ✅ |
| 7 | GET/PUT /api/contingencia/programacion › PUT {"activo":"si"} → 400 VALIDACION (activo no booleano) | ✅ |
| 8 | GET/PUT /api/contingencia/programacion › PUT cambia la hora y recalcula la próxima ejecución; queda en bitácora | ✅ |
| 9 | GET/PUT /api/contingencia/programacion › PUT activo:false → sin próxima ejecución | ✅ |
| 10 | Lote manual (POST /api/contingencia sin dteIds) › toma todos los DTE en contingencia del momento, con origen MANUAL | ✅ |
| 11 | Lote manual (POST /api/contingencia sin dteIds) › recepción por lote: jsonLote con los DTE firmados y respuesta MH RECIBIDO con codigoLote | ✅ |
| 12 | Lote manual (POST /api/contingencia sin dteIds) › cada DTE del lote queda PROCESADO con sello y la cola queda vacía | ✅ |
| 13 | Lote manual (POST /api/contingencia sin dteIds) › GET /:id y GET / exponen origen, codigoLote y el lote | ✅ |
| 14 | Lote manual (POST /api/contingencia sin dteIds) › evento rechazado → sin lote (codigoLote null) y los DTE siguen en contingencia | ✅ |
| 15 | Lote automático (cierre del día) › sin DTE en contingencia → SIN_PENDIENTES (no crea evento) y queda en bitácora | ✅ |
| 16 | Lote automático (cierre del día) › con DTE pendientes → evento AUTOMATICO firmado por un ADMIN y lote enviado | ✅ |
| 17 | Lote automático (cierre del día) › MH rechaza el evento → RECHAZADO, sin lote; los DTE quedan para el siguiente lote | ✅ |
| 18 | Lote automático (cierre del día) › MH no responde → SIN_RESPUESTA (no lanza error) y los DTE siguen pendientes | ✅ |
| 19 | Lote automático (cierre del día) › el siguiente lote automático recoge lo que quedó pendiente | ✅ |

### `tests/integration/pdf.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | GET /api/dte/:id/pdf › f1 → application/pdf descargable | ✅ |
| 2 | GET /api/dte/:id/pdf › f2 → application/pdf descargable | ✅ |
| 3 | GET /api/dte/:id/pdf › c1 → application/pdf descargable | ✅ |
| 4 | GET /api/dte/:id/pdf › n1 → application/pdf descargable | ✅ |
| 5 | GET /api/dte/:id/pdf › sin token → 401 | ✅ |
| 6 | GET /api/dte/:id/pdf › inexistente → 404 JSON estándar | ✅ |

### `tests/integration/resetDemo.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | restaura los datos de los clientes del seed editados, renombrados o desactivados, y borra los nuevos | ✅ |

### `tests/integration/seguridad.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | CORS con orígenes permitidos › origen local por defecto → Access-Control-Allow-Origin y credenciales | ✅ |
| 2 | CORS con orígenes permitidos › origen no permitido → sin cabeceras CORS (el navegador bloquea la respuesta) | ✅ |
| 3 | CORS con orígenes permitidos › preflight de un origen configurado en CORS_ORIGENES permite X-CSRF-Token | ✅ |
| 4 | CORS con orígenes permitidos › peticiones sin Origin (mismo origen, curl) siguen funcionando | ✅ |
| 5 | Cabeceras HTTP de seguridad › la página y la API llevan CSP, nosniff, anti-framing y referrer; sin X-Powered-By | ✅ |
| 6 | Cabeceras HTTP de seguridad › la API responde Cache-Control: no-store | ✅ |
| 7 | Sesión del navegador: cookie HttpOnly + CSRF › login pone pos_token HttpOnly + SameSite=Strict y pos_csrf legible | ✅ |
| 8 | Sesión del navegador: cookie HttpOnly + CSRF › COOKIE_SECURE=1 → cookies con atributo Secure | ✅ |
| 9 | Sesión del navegador: cookie HttpOnly + CSRF › GET /api/auth/sesion con la cookie devuelve el usuario; sin cookie → 401 | ✅ |
| 10 | Sesión del navegador: cookie HttpOnly + CSRF › cookie + POST sin X-CSRF-Token → 403 CSRF_INVALIDO y no crea nada | ✅ |
| 11 | Sesión del navegador: cookie HttpOnly + CSRF › cookie + POST con un X-CSRF-Token ajeno → 403 | ✅ |
| 12 | Sesión del navegador: cookie HttpOnly + CSRF › cookie + POST con el X-CSRF-Token correcto → 201 | ✅ |
| 13 | Sesión del navegador: cookie HttpOnly + CSRF › Bearer sigue funcionando sin CSRF (clientes de API y pruebas) | ✅ |
| 14 | Sesión del navegador: cookie HttpOnly + CSRF › POST /api/auth/logout borra ambas cookies | ✅ |
| 15 | Límite de intentos de inicio de sesión › 5 fallos → el 6.º intento responde 429 DEMASIADOS_INTENTOS con Retry-After, aunque la clave sea correcta | ✅ |
| 16 | Límite de intentos de inicio de sesión › el bloqueo es por usuario: otro usuario desde la misma IP puede entrar | ✅ |
| 17 | Límite de intentos de inicio de sesión › un login correcto reinicia el contador del usuario | ✅ |
| 18 | Límite de intentos de inicio de sesión › límite por IP: probar muchos usuarios distintos desde la misma IP también se bloquea | ✅ |
| 19 | Límite de intentos de inicio de sesión › la validación (400) no cuenta como intento fallido | ✅ |
| 20 | Límite de intentos de inicio de sesión › LOGIN_MAX_INTENTOS configurable | ✅ |
| 21 | Errores sin detalles internos › excepción no controlada (p. ej. SQL) → 500 genérico, sin el mensaje original | ✅ |
| 22 | Errores sin detalles internos › health con la BD caída → 503 DB_NO_DISPONIBLE sin el error del driver | ✅ |
| 23 | Errores sin detalles internos › cuerpo de más de 1 MB → 413 con formato estándar | ✅ |
| 24 | Credenciales de demostración › entorno local (localhost, no producción) → /api/health las devuelve y se sirven los mocks | ✅ |
| 25 | Credenciales de demostración › DEMO_CREDENCIALES=0 → demo null, mocks vacíos y la página no trae credenciales | ✅ |
| 26 | Credenciales de demostración › NODE_ENV=production → demo null, mocks vacíos y la página no trae credenciales | ✅ |
| 27 | Credenciales de demostración › dominio distinto de localhost → demo null, mocks vacíos y la página no trae credenciales | ✅ |

### `tests/integration/tareasProgramadas.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | Persistencia de la configuración tras un reinicio real del servidor › la primera vez usa el .env; lo que se guarda por la API sobrevive al reinicio aunque el .env diga otra cosa | ✅ |
| 2 | Persistencia de la configuración tras un reinicio real del servidor › la última ejecución también se recupera tras el reinicio (dbo.ejecucion_tarea) | ✅ |
| 3 | Persistencia de la configuración tras un reinicio real del servidor › db/03_reset_demo.sql devuelve la configuración a los valores de backend/.env | ✅ |
| 4 | Temporizador real de la cola de consultas (servidor hijo, intervalo 10 s) › dispara solo, consulta en MH el DTE que se quedó sin respuesta y lo deja PROCESADO con su sello | ✅ |
| 5 | Temporizador del lote automático (callback programado) › programa a la hora guardada; al dispararse ejecuta el lote, marca el día y se reprograma; el 2.º disparo del día se omite | ✅ |
| 6 | Temporizador del lote automático (callback programado) › si se desactiva, no se programa y un disparo pendiente no ejecuta nada | ✅ |
| 7 | Temporizador de la cola de consultas (callback programado, en este proceso) › programa al intervalo guardado; al vencer consulta un DTE, lo registra como TEMPORIZADOR y se reprograma | ✅ |
| 8 | Temporizador de la cola de consultas (callback programado, en este proceso) › desactivada: no se programa, sin próxima consulta, y un disparo pendiente no consulta | ✅ |
| 9 | Temporizador de la cola de consultas (callback programado, en este proceso) › un fallo en el turno queda como ERROR (detalle solo en la BD) y suelta el candado | ✅ |
| 10 | Temporizador de la cola de consultas (callback programado, en este proceso) › otro proceso con el candado de la cola → OMITIDA | ✅ |
| 11 | Sin ejecuciones duplicadas › otro proceso con el candado → OMITIDA; al soltarlo, corre; un candado vencido se recupera | ✅ |
| 12 | Sin ejecuciones duplicadas › dos instancias del lote a la vez: un solo evento con el DTE | ✅ |
| 13 | Sin ejecuciones duplicadas › dentro de un proceso, un turno que se solapa con otro se omite (lote y cola) | ✅ |
| 14 | Registro de ejecuciones y errores › un error queda registrado con su detalle; la API solo muestra un mensaje genérico; el candado se suelta | ✅ |
| 15 | Registro de ejecuciones y errores › GET /api/contingencia/ejecuciones: cualquier rol, filtros validados, sin token 401 | ✅ |

### `tests/unit/builders.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | 01 Factura · builder › sin receptor: cumple fe-f-v2.json y tiene los nodos del DTE (sin extension) | ✅ |
| 2 | 01 Factura · builder › con receptor consumidor con DUI y a crédito: cumple el esquema y pagos = null | ✅ |
| 3 | 01 Factura · builder › cliente anterior a P2 (dirección solo texto): códigos del emisor + texto como complemento | ✅ |
| 4 | 01 Factura · builder › control negativo: el validador rechaza un nodo `extension` o un numeroControl mal formado | ✅ |
| 5 | 01 Factura · builder › con receptor contribuyente: tipoDocumento 36 + NIT | ✅ |
| 6 | 03 CCF · builder › cumple fe-ccf-v4.json con receptor CONTRIBUYENTE y tributo 20 | ✅ |
| 7 | 03 CCF · builder › montos: 40 × 2.50 + (2 × 18.50 − 1) = 136 + IVA 17.68 = 153.68 | ✅ |
| 8 | 05 Nota de crédito · builder › cumple fe-nc-v4.json | ✅ |
| 9 | 05 Nota de crédito · builder › documentoRelacionado apunta al CCF (tipo 03, generación 2, codigoGeneracion y fecha) | ✅ |
| 10 | 05 Nota de crédito · builder › mismo receptor que el CCF y cada ítem referencia al CCF | ✅ |
| 11 | Evento de invalidación · builder › de una factura sin receptor: cumple invalidacion-schema-v3.json, receptor en null y sin montoIva | ✅ |
| 12 | Evento de invalidación · builder › de un CCF: documento con tipoDocumento 36 + NIT del receptor | ✅ |

### `tests/unit/calculos.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | dte/calculos · porcentaje › calcula en centavos: 2.50 × 113 % = 2.83 (no 2.82) | ✅ |
| 2 | 01 Factura · calcularFactura › precio CON IVA (precio × 1.13) e IVA incluido | ✅ |
| 3 | 01 Factura · calcularFactura › descuento por línea en base CON IVA y varias líneas | ✅ |
| 4 | 01 Factura · calcularFactura › IVA = gravado / 1.13 × 0.13 con redondeo a 2 decimales | ✅ |
| 5 | 01 Factura · calcularFactura › descuento mayor que la línea → VALIDACION | ✅ |
| 6 | 03 CCF · calcularCcf › precio SIN IVA y tributo 20 = 13 %: 40 × 2.50 → 100 + 13 = 113 | ✅ |
| 7 | 03 CCF · calcularCcf › descuento en base SIN IVA | ✅ |
| 8 | 05 Nota de crédito · calcularNotaCredito › usa precio y venta gravada del CCF; IVA 13 % en tributos y totalIva | ✅ |
| 9 | 05 Nota de crédito · calcularNotaCredito › regresión: 3 de 10 × 1.10 (11 × 3 / 10 = 3.3000000000000003) → montoDescu 0, no NaN | ✅ |
| 10 | 05 Nota de crédito · calcularNotaCredito › un descuento proporcional del CCF aparece como montoDescu | ✅ |

### `tests/unit/contingencia.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | enContingencia (DTE emitido sin respuesta de MH) › cambia solo la identificación: modelo diferido 2, operación 2, tipoContingencia 1, motivoContin null | ✅ |
| 2 | enContingencia (DTE emitido sin respuesta de MH) › conserva codigoGeneracion y numeroControl | ✅ |
| 3 | enContingencia (DTE emitido sin respuesta de MH) › 01, 03 y 05 en contingencia siguen cumpliendo sus esquemas MH | ✅ |
| 4 | Evento de contingencia · builder › cumple contingencia-schema-v4.json | ✅ |
| 5 | Evento de contingencia · builder › estructura: identificacion v4, emisor con responsable, detalleDTE numerado y motivo | ✅ |
| 6 | MH simulado · recepción del evento de contingencia › ok → PROCESADO con sello de 40 caracteres | ✅ |
| 7 | MH simulado · recepción del evento de contingencia › rechazo → RECHAZADO sin sello | ✅ |
| 8 | MH simulado · recepción del evento de contingencia › contingencia → MH sigue sin responder (null) | ✅ |
| 9 | MH simulado · recepción por lote › RECIBIDO con el idEnvio del lote y un codigoLote UUID en mayúsculas | ✅ |
| 10 | Lote automático · próxima ejecución › si la hora aún no pasa hoy → hoy a esa hora | ✅ |
| 11 | Lote automático · próxima ejecución › si ya pasó (o es exactamente esa hora) → mañana | ✅ |
| 12 | Lote automático · próxima ejecución › cruza fin de mes | ✅ |
| 13 | MH simulado · modo timeout y consulta de DTE › timeout es un modo válido y, para el POS, no hay respuesta (recepción, anulación y evento) | ✅ |
| 14 | MH simulado · modo timeout y consulta de DTE › consulta: MH tiene el documento → su respuesta PROCESADO original (mismo sello) | ✅ |
| 15 | MH simulado · modo timeout y consulta de DTE › consulta: MH no lo tiene → estado null, código 004 NO ENCONTRADO | ✅ |
| 16 | MH simulado · modo timeout y consulta de DTE › consulta con MH caído (contingencia o timeout) → null | ✅ |

### `tests/unit/middleware.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | middleware/auth › token válido deja req.usuario | ✅ |
| 2 | middleware/auth › sin header → 401 NO_AUTENTICADO | ✅ |
| 3 | middleware/auth › esquema distinto de Bearer → 401 NO_AUTENTICADO | ✅ |
| 4 | middleware/auth › token con otra firma → 401 NO_AUTENTICADO | ✅ |
| 5 | middleware/auth › token vencido → 401 NO_AUTENTICADO | ✅ |
| 6 | middleware/auth › requireRol permite el rol indicado y bloquea otro con 403 SIN_PERMISO | ✅ |
| 7 | middleware/errores › noEncontrado → 404 NO_ENCONTRADO | ✅ |
| 8 | middleware/errores › AppError → { ok:false, error:{codigo,mensaje} } con su status | ✅ |
| 9 | middleware/errores › JSON mal formado → 400 VALIDACION | ✅ |
| 10 | middleware/errores › error no controlado → 500 ERROR_INTERNO con mensaje genérico (sin detalles internos) y referencia en el log | ✅ |
| 11 | middleware/errores › cuerpo demasiado grande → 413 VALIDACION; otros 4xx del parser → status propio sin detalles | ✅ |
| 12 | middleware/auth · cookie de sesión y CSRF › cookie válida en GET → autenticado sin CSRF | ✅ |
| 13 | middleware/auth · cookie de sesión y CSRF › cookie + POST sin X-CSRF-Token → 403 CSRF_INVALIDO | ✅ |
| 14 | middleware/auth · cookie de sesión y CSRF › cookie + PUT con X-CSRF-Token distinto → 403 CSRF_INVALIDO | ✅ |
| 15 | middleware/auth · cookie de sesión y CSRF › cookie + POST con X-CSRF-Token correcto → autenticado | ✅ |
| 16 | middleware/auth · cookie de sesión y CSRF › Bearer no necesita CSRF; un Bearer inválido no cae a la cookie | ✅ |
| 17 | middleware/auth · cookie de sesión y CSRF › token firmado con otro algoritmo (none) → 401 | ✅ |
| 18 | config/seguridad › CORS por defecto: solo el servidor local; CORS_ORIGENES lo reemplaza | ✅ |
| 19 | config/seguridad › credenciales demo: explícitas con DEMO_CREDENCIALES; por defecto solo localhost fuera de producción | ✅ |
| 20 | config/seguridad › JWT_SECRET débil: vacío, corto o el de ejemplo | ✅ |

### `tests/unit/numeroALetras.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | dte/numeroALetras › 113 → CIENTO TRECE 00/100 USD | ✅ |
| 2 | dte/numeroALetras › 0 → CERO 00/100 USD | ✅ |
| 3 | dte/numeroALetras › 1 → UNO 00/100 USD | ✅ |
| 4 | dte/numeroALetras › 5.66 → CINCO 66/100 USD | ✅ |
| 5 | dte/numeroALetras › 9.16 → NUEVE 16/100 USD | ✅ |
| 6 | dte/numeroALetras › 16 → DIECISÉIS 00/100 USD | ✅ |
| 7 | dte/numeroALetras › 21 → VEINTIUNO 00/100 USD | ✅ |
| 8 | dte/numeroALetras › 45 → CUARENTA Y CINCO 00/100 USD | ✅ |
| 9 | dte/numeroALetras › 100 → CIEN 00/100 USD | ✅ |
| 10 | dte/numeroALetras › 101 → CIENTO UNO 00/100 USD | ✅ |
| 11 | dte/numeroALetras › 500 → QUINIENTOS 00/100 USD | ✅ |
| 12 | dte/numeroALetras › 1000 → MIL 00/100 USD | ✅ |
| 13 | dte/numeroALetras › 1250.5 → MIL DOSCIENTOS CINCUENTA 50/100 USD | ✅ |
| 14 | dte/numeroALetras › 21000 → VEINTIÚN MIL 00/100 USD | ✅ |
| 15 | dte/numeroALetras › 31000 → TREINTA Y UN MIL 00/100 USD | ✅ |
| 16 | dte/numeroALetras › 100000 → CIEN MIL 00/100 USD | ✅ |
| 17 | dte/numeroALetras › 1000000 → UN MILLÓN 00/100 USD | ✅ |
| 18 | dte/numeroALetras › 2500000.99 → DOS MILLONES QUINIENTOS MIL 99/100 USD | ✅ |
| 19 | dte/numeroALetras › 1.005 → UNO 01/100 USD | ✅ |
| 20 | dte/numeroALetras › valores no numéricos se tratan como cero | ✅ |

### `tests/unit/simuladores.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | firmador simulado › devuelve status OK y un JWS falso de 3 partes base64url con el JSON en el payload | ✅ |
| 2 | firmador simulado › la firma es aleatoria y el firmador responde OK aun en contingencia (MH es el que falla) | ✅ |
| 3 | MH recepción simulada › leerModo: por defecto ok; acepta mayúsculas/espacios; valor desconocido → 400 VALIDACION | ✅ |
| 4 | MH recepción simulada › generarSello: año + 36 alfanuméricos = 40 caracteres | ✅ |
| 5 | MH recepción simulada › fhProcesamiento con formato dd/MM/yyyy HH:mm:ss | ✅ |
| 6 | MH recepción simulada › ok → PROCESADO con sello y la forma completa del contrato | ✅ |
| 7 | MH recepción simulada › rechazo → RECHAZADO sin sello y con observaciones | ✅ |
| 8 | MH recepción simulada › contingencia → MH no responde (null) | ✅ |
| 9 | MH anulación simulada (evento de invalidación) › ok → PROCESADO con sello propio de 40 caracteres | ✅ |
| 10 | MH anulación simulada (evento de invalidación) › rechazo → RECHAZADO sin sello | ✅ |
| 11 | MH anulación simulada (evento de invalidación) › contingencia → null (no existe contingencia para eventos) | ✅ |

### `tests/unit/utilidades.test.js`

| # | Caso | Resultado |
|---|---|---|
| 1 | utils/dinero · redondear2 › redondear2(1.005) = 1.01 (half-up, sin error de coma flotante) | ✅ |
| 2 | utils/dinero · redondear2 › redondear2(2.825) = 2.83 (half-up, sin error de coma flotante) | ✅ |
| 3 | utils/dinero · redondear2 › redondear2(1.004) = 1 (half-up, sin error de coma flotante) | ✅ |
| 4 | utils/dinero · redondear2 › redondear2(0.30000000000000004) = 0.3 (half-up, sin error de coma flotante) | ✅ |
| 5 | utils/dinero · redondear2 › redondear2(113) = 113 (half-up, sin error de coma flotante) | ✅ |
| 6 | utils/dinero · redondear2 › redondear2(-1.005) = -1.01 (half-up, sin error de coma flotante) | ✅ |
| 7 | utils/dinero · redondear2 › redondear2(0) = 0 (half-up, sin error de coma flotante) | ✅ |
| 8 | utils/dinero · redondear2 › redondear2(0.005) = 0.01 (half-up, sin error de coma flotante) | ✅ |
| 9 | utils/dinero · redondear2 › redondear2(0.004) = 0 (half-up, sin error de coma flotante) | ✅ |
| 10 | utils/dinero · redondear2 › redondear2(4.440892098500626e-16) = 0 (half-up, sin error de coma flotante) | ✅ |
| 11 | utils/dinero · redondear2 › redondear2(1e-7) = 0 (half-up, sin error de coma flotante) | ✅ |
| 12 | utils/dinero · redondear2 › redondear2(-4.4e-16) = 0 (half-up, sin error de coma flotante) | ✅ |
| 13 | utils/validar › texto recorta y exige contenido y longitud máxima | ✅ |
| 14 | utils/validar › textoOpc convierte vacío en null | ✅ |
| 15 | utils/validar › dinero redondea a 2 decimales y respeta el mínimo | ✅ |
| 16 | utils/validar › entero exige enteros >= min | ✅ |
| 17 | utils/validar › digitos quita guiones/espacios y valida longitudes (NIT 9 o 14, NRC 1–8) | ✅ |
| 18 | utils/validar › id acepta solo enteros positivos | ✅ |
| 19 | utils/respuesta › ok() responde { ok: true, data } con el status indicado | ✅ |
| 20 | utils/respuesta › AppError guarda código y status | ✅ |
| 21 | utils/respuesta › asyncHandler envía al next los errores de un handler async | ✅ |
