# Matriz de trazabilidad: requisito → prueba → resultado

> Generado por `backend/tests/tools/reporteKan23.js` el 2026-11-21 04:04:43 UTC desde `docs/kan-23/evidencia/`. No editar a mano.

| ID | Requisito | Fuente | Pruebas (archivo: casos) | Resultado |
|---|---|---|---|---|
| RQ-DTE-01 | codigoGeneracion UUID v4 en MAYÚSCULAS | CLAUDE.md | `integration/dte01.factura.test.js`: 7/7<br>`integration/dte03.ccf.test.js`: 7/7 | ✅ 14/14 |
| RQ-DTE-02 | numeroControl DTE-{tipo}-{M001P001}-{15 dígitos}, un correlativo por tipo, sin repetidos en concurrencia | CLAUDE.md | `integration/dte01.factura.test.js`: 4/4<br>`integration/dte03.ccf.test.js`: 2/2 | ✅ 6/6 |
| RQ-DTE-03 | JSON con identificacion…apendice (sin extension) y válido contra schemas-mh | CLAUDE.md | `unit/builders.test.js`: 12/12 | ✅ 12/12 |
| RQ-DTE-04 | Dinero a 2 decimales (redondeo half-up sin error de coma flotante) | CLAUDE.md | `unit/calculos.test.js`: 1/1<br>`unit/utilidades.test.js`: 12/12 | ✅ 13/13 |
| RQ-DTE-05 | resumen.totalLetras ("CIENTO TRECE 00/100 USD") | CLAUDE.md | `unit/numeroALetras.test.js`: 20/20 | ✅ 20/20 |
| RQ-DTE-06 | Firmador simulado {status:"OK", body: JWS falso} | CLAUDE.md | `unit/simuladores.test.js`: 2/2 | ✅ 2/2 |
| RQ-DTE-07 | Respuesta MH simulada (sello de 40, fhProcesamiento, observaciones) | CLAUDE.md | `unit/simuladores.test.js`: 6/6 | ✅ 6/6 |
| RQ-DTE-08 | Respuesta estándar {ok,data} / {ok:false,error} y códigos del contrato | API.md | `integration/auth.test.js`: 12/12<br>`unit/middleware.test.js`: 5/5 | ✅ 17/17 |
| RQ-01-01 | 01 Factura: precio con IVA, IVA incluido, receptor opcional, descuento y stock | CLAUDE.md | `integration/dte01.factura.test.js`: 12/12<br>`unit/calculos.test.js`: 4/4 | ✅ 16/16 |
| RQ-01-02 | 01 Factura: errores de validación y stock no consumen correlativo | API.md | `integration/dte01.factura.test.js`: 10/10 | ✅ 10/10 |
| RQ-03-01 | 03 CCF: precios sin IVA, tributo 20, 40 × P001 = 113.00 | CLAUDE.md | `integration/dte03.ccf.test.js`: 10/10<br>`unit/calculos.test.js`: 2/2 | ✅ 12/12 |
| RQ-03-02 | 03 CCF: receptor CONTRIBUYENTE con NIT, NRC y actividad | CLAUDE.md | `integration/dte03.ccf.test.js`: 4/4 | ✅ 4/4 |
| RQ-05-01 | 05 NC: solo sobre 03 PROCESADO, mismo receptor, documentoRelacionado | CLAUDE.md | `integration/dte05.notaCredito.test.js`: 15/15 | ✅ 15/15 |
| RQ-05-02 | 05 NC: cantidades ≤ pendientes, descuento proporcional, devuelve stock | CLAUDE.md | `integration/dte05.notaCredito.test.js`: 5/5<br>`unit/calculos.test.js`: 3/3 | ✅ 8/8 |
| RQ-CON-01 | X-Simular ok \| rechazo \| contingencia \| timeout (inválido → 400) | CLAUDE.md | `integration/consultaMh.test.js`: 4/4<br>`integration/contingencia.test.js`: 2/2 | ✅ 6/6 |
| RQ-CON-02 | Rechazo: RECHAZADO sin sello, no descuenta stock | API.md | `integration/contingencia.test.js`: 5/5 | ✅ 5/5 |
| RQ-CON-03 | Contingencia: tipoModelo/tipoOperacion 2, firmado así; reintento conserva códigos | CLAUDE.md | `integration/eventoContingencia.test.js`: 4/4<br>`integration/contingencia.test.js`: 12/12<br>`unit/contingencia.test.js`: 3/3 | ✅ 19/19 |
| RQ-CON-04 | Evento de contingencia v4: aceptado transmite los DTE; rechazado/sin respuesta los deja pendientes | CLAUDE.md | `integration/eventoContingencia.test.js`: 20/20 | ✅ 20/20 |
| RQ-CON-05 | Lote manual y automático (cierre del día) con recepción por lote | Fase C2 | `integration/loteContingencia.test.js`: 19/19 | ✅ 19/19 |
| RQ-CON-06 | Cola de consultas a MH: un DTE por turno, descubre los sellados por timeout | Fase C3 | `integration/consultaMh.test.js`: 20/20 | ✅ 20/20 |
| RQ-CON-07 | Tareas programadas persistentes tras reinicio, sin duplicados, con registro | Fase 5 | `integration/tareasProgramadas.test.js`: 15/15 | ✅ 15/15 |
| RQ-CON-08 | UI: emisión en contingencia → lote → PROCESADO; reintento desde Transacciones | Fase C1/C2 | `e2e/06-contingencia.spec.js`: 2/2 | ✅ 2/2 |
| RQ-INV-01 | Invalidación solo de PROCESADO; 03 con NC vigente no se invalida; evento v3 con sello; devuelve stock | CLAUDE.md | `integration/invalidacion.test.js`: 20/20 | ✅ 20/20 |
| RQ-INV-02 | Invalidar solo ADMIN (S1) | Fase S1 | `integration/autorizacion.test.js`: 4/4<br>`integration/invalidacion.test.js`: 4/4 | ✅ 8/8 |
| RQ-INV-03 | UI: anular desde Transacciones y descargar el PDF real | Fase F4/P1 | `integration/pdf.test.js`: 6/6<br>`e2e/05-invalidacion-pdf.spec.js`: 2/2 | ✅ 8/8 |
| RQ-CAT-01 | Productos: CRUD solo ADMIN; clientes con catálogos MH y edición | API.md / P2 / KAN-34 | `integration/catalogos.test.js`: 40/40 | ✅ 40/40 |
| RQ-CAT-02 | UI: alta y edición de clientes con validación fiscal | KAN-34 | `e2e/03-clientes.spec.js`: 2/2 | ✅ 2/2 |
| RQ-UI-01 | UI: venta y emisión de 01 y 03 desde Nueva venta | Fase F3 | `e2e/04-venta-dte.spec.js`: 3/3 | ✅ 3/3 |
| RQ-UI-02 | Listados, detalle de DTE y bitácora | API.md | `integration/consultas.test.js`: 17/17 | ✅ 17/17 |
| RQ-SEG-01 | Toda ruta salvo health/login/logout exige sesión (40 rutas protegidas) | CLAUDE.md / SEGURIDAD.md | `integration/autorizacion.test.js`: 41/41 | ✅ 41/41 |
| RQ-SEG-02 | Token manipulado, sin firma (alg none) o de otro secreto → 401; el rol sale solo del token | SEGURIDAD.md | `integration/autorizacion.test.js`: 4/4<br>`unit/middleware.test.js`: 6/6 | ✅ 10/10 |
| RQ-SEG-03 | Rutas de solo ADMIN → 403 a VENDEDOR sin efectos (Bearer y cookie+CSRF) | SEGURIDAD.md | `integration/autorizacion.test.js`: 23/23 | ✅ 23/23 |
| RQ-SEG-04 | Rutas de cualquier rol sin 403 para VENDEDOR; ADMIN autorizado en las suyas | SEGURIDAD.md | `integration/autorizacion.test.js`: 40/40 | ✅ 40/40 |
| RQ-SEG-05 | Sesión en cookie HttpOnly + CSRF | SEGURIDAD.md §4 | `integration/seguridad.test.js`: 8/8<br>`unit/middleware.test.js`: 6/6 | ✅ 14/14 |
| RQ-SEG-06 | Límite de intentos de login (429) | SEGURIDAD.md §3 | `integration/seguridad.test.js`: 6/6 | ✅ 6/6 |
| RQ-SEG-07 | CORS por lista y cabeceras/CSP | SEGURIDAD.md §1, §6 | `integration/seguridad.test.js`: 6/6 | ✅ 6/6 |
| RQ-SEG-08 | Errores 500 sin detalles internos; 413 | SEGURIDAD.md §2 | `integration/seguridad.test.js`: 3/3<br>`unit/middleware.test.js`: 5/5 | ✅ 8/8 |
| RQ-SEG-09 | Credenciales demo solo en local; JWT_SECRET débil detectado | SEGURIDAD.md §5, §8 | `integration/seguridad.test.js`: 4/4<br>`unit/middleware.test.js`: 3/3 | ✅ 7/7 |
| RQ-SEG-10 | UI oculta lo de ADMIN al VENDEDOR y la API lo rechaza | Fase F2/S1 | `e2e/02-roles.spec.js`: 4/4 | ✅ 4/4 |
| RQ-SEG-11 | Login, cookie HttpOnly sin JWT en almacenamiento, recarga y logout (UI) | SEGURIDAD.md §4 | `e2e/01-login.spec.js`: 3/3 | ✅ 3/3 |
| RQ-SEG-12 | Reset de la demo restaura datos del seed (D1) | Fase 4 | `integration/resetDemo.test.js`: 1/1 | ✅ 1/1 |
| RQ-F6-01 | Usuarios: CRUD solo ADMIN, sin hash, no auto-desactivarse, siempre un ADMIN activo | Fase 6 | `integration/fase6.test.js`: 14/14<br>`e2e/07-fase6.spec.js`: 1/1 | ✅ 15/15 |
| RQ-F6-02 | Borradores por usuario (ajeno → 404), total estimado, se eliminan al emitir | Fase 6 | `integration/fase6.test.js`: 10/10<br>`e2e/07-fase6.spec.js`: 1/1 | ✅ 11/11 |
| RQ-F6-03 | Correo SIMULADO: enviado:false, bitácora; la UI nunca dice "enviado" | Fase 6 | `integration/fase6.test.js`: 2/2<br>`e2e/07-fase6.spec.js`: 1/1 | ✅ 3/3 |
| RQ-F6-04 | Reportes gerenciales con DTE reales (solo ADMIN) | Fase 6 | `integration/fase6.test.js`: 10/10<br>`e2e/07-fase6.spec.js`: 1/1 | ✅ 11/11 |
| RQ-F6-05 | Configuración: emisor real de solo lectura; firmador identificado como simulado | Fase 6 | `integration/catalogos.test.js`: 1/1<br>`e2e/07-fase6.spec.js`: 1/1 | ✅ 2/2 |

**46 de 46 requisitos con todas sus pruebas aprobadas.** Un caso puede respaldar más de un requisito.
