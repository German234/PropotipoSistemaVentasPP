# KAN-23 · Gestión de riesgos

Matriz de riesgos del POS académico con DTE simulado, actualizada al 2026-11-20 con lo implementado hasta la Fase 7. Cada medida de mitigación enlaza a su evidencia en esta ejecución.

## Escalas

| Valor | Probabilidad (P) | Impacto (I) |
|---|---|---|
| 1 | Baja: improbable en el uso académico previsto | Bajo: molestia, se corrige sin pérdida |
| 2 | Media: puede ocurrir en la demo o al extender el sistema | Medio: datos o funcionalidad afectados, recuperable |
| 3 | Alta: ocurrirá si no se actúa | Alto: documentos fiscales inválidos, acceso indebido o pérdida de datos |

**Nivel = P × I:** 1–2 **Bajo** · 3–4 **Medio** · 6–9 **Alto**. Se califica el riesgo **inherente** (sin las medidas) y el **residual** (con lo implementado y verificado hoy).

**Tratamiento:** *Mitigar* (reducir P o I), *Aceptar* (se asume, con justificación), *Evitar* (se elimina la causa), *Transferir* (a un tercero).

**Responsables** (por rol; el nombre de cada persona se asigna en el tablero KAN): **PO** = Product Owner · **BE** = Backend/API · **FE** = Frontend · **QA** · **DBA** = Base de datos/infraestructura.

## Resumen

| Categoría | Riesgos | Residual Alto | Residual Medio | Residual Bajo |
|---|---|---|---|---|
| Integración fiscal (RF) | 6 | 1 | 3 | 2 |
| Acceso (RA) | 7 | 0 | 4 | 3 |
| Datos (RD) | 8 | 0 | 2 | 6 |
| Contingencia (RC) | 5 | 1 | 1 | 3 |
| Técnico y de proyecto (RT) | 4 | 0 | 0 | 4 |
| **Total** | **30** | **2** | **10** | **18** |

Los dos riesgos residuales altos son **RF-1**, la integración con el MH real, que queda fuera de alcance por diseño y se acepta, y **RC-5**, la BD de la demo sin el esquema actual. RC-5 baja a Bajo en cuanto se ejecute `db/01_schema.sql`.

## Matriz de riesgos

### Integración fiscal

| ID | Riesgo | Inherente P×I | Medidas implementadas | Evidencia | Residual P×I | Tratamiento | Resp. |
|---|---|---|---|---|---|---|---|
| RF-1 | El MH real difiere de la simulación (contratos, rechazos, tiempos, autenticación) y el sistema falla al integrarse | 3×3 = 9 **Alto** | JSON 01/03/05 y eventos validados con ajv contra `schemas-mh/` en todas las pruebas; respuestas simuladas con el formato documentado; rechazo, contingencia y timeout cubiertos con `X-Simular` | RQ-DTE-03, RQ-DTE-07, RQ-CON-01 ([trazabilidad](generado/trazabilidad.md)) | 2×3 = 6 **Alto** | **Aceptar** (fuera de alcance). Plan: ambiente de pruebas del MH, firmador oficial y pruebas de contrato contra él | PO, BE |
| RF-2 | Un documento simulado se confunde con uno con validez fiscal (firma falsa) | 2×3 = 6 **Alto** | Firmador que devuelve un JWS evidentemente falso; ambiente `00`; la UI rotula "MH simulado", "Firmador simulado — sin certificado" y el correo "Simulado" | C-27, C-28; e2e `07-fase6` › *Configuración*, *Correo* | 1×3 = 3 **Medio** | **Evitar** (rotulado) / Aceptar | PO, FE |
| RF-3 | Error de cálculo (IVA incluido/desglosado, descuentos, NC proporcional, total en letras) que produce montos incorrectos | 2×3 = 6 **Alto** | Cálculos en centavos (`porcentaje`), `redondear2` corregido (D0), una sola implementación de cálculo para emisión y borradores | RQ-DTE-04/05, RQ-01-01, RQ-03-01, RQ-05-02: 100 % aprobadas | 1×3 = 3 **Medio** | Mitigar | BE, QA |
| RF-4 | Números de control duplicados o fuera de secuencia | 2×3 = 6 **Alto** | Correlativo por tipo con `UPDLOCK` dentro de la transacción; un error de validación no consume número | `dte01` › *concurrencia: 8 emisiones en paralelo*, *no consume correlativo* (RQ-DTE-02) | 1×2 = 2 **Bajo** | Mitigar. Un RECHAZADO sí consume número (decisión documentada) | BE |
| RF-5 | Catálogos MH desactualizados (distritos de la reforma 2024, actividad económica en texto libre) que provocan rechazos | 2×2 = 4 **Medio** | Un único catálogo (`catalogosMh.js`) validado en backend y UI; códigos anidados depto → municipio → distrito | `catalogos` › *Clientes* (RQ-CAT-01) | 2×2 = 4 **Medio** | Mitigar. **Pendiente:** validar contra el CAT oficial vigente | PO, BE |
| RF-6 | El MH publica nuevas versiones de esquema | 2×2 = 4 **Medio** | Esquemas versionados en el repositorio; las pruebas fallan si un JSON deja de cumplirlos | `builders.test.js` (12/12) | 1×2 = 2 **Bajo** | Mitigar | BE |

### Acceso

| ID | Riesgo | Inherente P×I | Medidas implementadas | Evidencia | Residual P×I | Tratamiento | Resp. |
|---|---|---|---|---|---|---|---|
| RA-1 | Un VENDEDOR ejecuta operaciones de ADMIN (invalidar, usuarios, reportes, productos, contingencia) | 3×3 = 9 **Alto** | `requireRol` en 11 rutas; política `ROLES_INVALIDAR`; la UI oculta lo no permitido; borradores aislados por usuario | [autorizacion.md](generado/autorizacion.md) 108/108; mutaciones M1–M5 detectadas; e2e `02-roles` | 1×3 = 3 **Medio** | Mitigar | BE, QA |
| RA-2 | La sesión sigue válida tras logout, desactivación o cambio de rol (H-A1); un ADMIN degradado conserva permisos hasta 8 h | 2×3 = 6 **Alto** | Un usuario desactivado ya no inicia sesión; el token vence a las 8 h; la UI advierte al desactivar | `fase6` › *desactivado: no inicia sesión*; el caso *no se puede dejar el sistema sin ADMIN* demuestra la ventana | 1×3 = 3 **Medio** | Mitigar. **Pendiente P-01:** revisar `activo`/`rol` en cada petición | BE |
| RA-3 | La app usa `sa` con una contraseña local débil (H-A2, H-A3): una fuga del `.env` o una inyección daría control total del servidor SQL | 2×3 = 6 **Alto** | SQL siempre parametrizado (revisado: 0 interpolaciones con datos de entrada); `.env` fuera de Git; servidor solo en `localhost` | C-15, C-23; `07-barrido-secretos.txt` | 1×3 = 3 **Medio** | Mitigar. **Pendiente P-02:** usuario con mínimo privilegio y contraseña fuerte | DBA |
| RA-4 | Fuerza bruta o contraseñas débiles | 3×2 = 6 **Alto** | Límite por usuario+IP e IP (429); bcrypt; contraseña de 8 caracteres como mínimo; hash de relleno | `seguridad` › *Límite de intentos* (6/6); `fase6` › *crear inválido* | 1×2 = 2 **Bajo** | Mitigar (H-A5, H-A11 abiertos, baja) | BE |
| RA-5 | XSS que roba o usa la sesión | 2×3 = 6 **Alto** | JWT en cookie `HttpOnly`; CSP con `script-src 'self'`; escape `_h()` de todo dato de la API | `seguridad` › *Cabeceras*, *cookie HttpOnly*; e2e `01-login`; revisión C-17 | 1×2 = 2 **Bajo** | Mitigar (H-A4 abierto) | FE |
| RA-6 | CSRF o captura de tráfico sin HTTPS | 2×3 = 6 **Alto** | `SameSite=Strict` + token CSRF; uso en `localhost`; `COOKIE_SECURE`/`TRUST_PROXY` listos para HTTPS | `seguridad` › *cookie HttpOnly + CSRF* (8/8) | 1×2 = 2 **Bajo** | Mitigar. HTTPS obligatorio si se despliega (H-A7) | BE, DBA |
| RA-7 | Las contraseñas públicas del seed (`admin123`, `vendedor123`) se usan en un despliegue real | 3×3 = 9 **Alto** | Las credenciales solo se muestran en local; ahora los usuarios se administran desde la UI (crear, cambiar contraseña, desactivar) | `seguridad` › *Credenciales de demostración*; `fase6` › *cambio de contraseña* | 1×3 = 3 **Medio** | Mitigar. Cambiarlas antes de desplegar (H-A6) | PO, DBA |

### Datos

| ID | Riesgo | Inherente P×I | Medidas implementadas | Evidencia | Residual P×I | Tratamiento | Resp. |
|---|---|---|---|---|---|---|---|
| RD-1 | Fuga de secretos (`.env`, reportes de prueba, logs) | 2×3 = 6 **Alto** | `.env` ignorado; reportes sin `process.env` (D2); errores 500 sin detalles; barrido de secretos de la evidencia | `07-barrido-secretos.txt` (122 archivos y el zip embebido, sin fugas) | 1×2 = 2 **Bajo** | Mitigar | QA, BE |
| RD-2 | Pérdida de datos sin respaldos | 2×3 = 6 **Alto** | Esquema y seed reproducibles (`db/01`, `db/02`); los datos de la demo se regeneran | — | 2×2 = 4 **Medio** | **Aceptar** para el uso académico. Respaldos programados de SQL Server si se despliega (P-09) | DBA |
| RD-3 | Las pruebas modifican la BD de la demo | 2×2 = 4 **Medio** | BD aislada `BatallonAtlacatl_Test`; `setupEnv` y el `globalSetup` de e2e se niegan a usar la de la demo | `06-huella-bd-demo-comparacion.txt`: 12 tablas idénticas | 1×1 = 1 **Bajo** | Mitigar | QA |
| RD-4 | El reset de la demo borra datos creados después, incluidos usuarios (desde la Fase 6) | 2×2 = 4 **Medio** | Comportamiento documentado en el `README` y en el encabezado del script; restaura el seed completo | `resetDemo.test.js`; D1, D4 | 1×2 = 2 **Bajo** | Aceptar (es su propósito) | DBA |
| RD-5 | Bitácora alterable con acceso directo a la BD, o llenada con operaciones repetidas (H-A8) | 2×2 = 4 **Medio** | Las escrituras de negocio registran dentro de la misma transacción; cada entrada guarda quién la hizo; la contraseña nunca va a la bitácora | `consultas` › *GET /api/bitacora*; `fase6` › *bitácora sin la contraseña* | 2×2 = 4 **Medio** | Aceptar (P-07, P-09 pendientes) | BE, DBA |
| RD-6 | Errores que exponen SQL, rutas o usuarios internos | 2×2 = 4 **Medio** | 500 genérico con referencia; health sin el error del driver | `seguridad` › *Errores sin detalles internos* | 1×1 = 1 **Bajo** | Mitigar | BE |
| RD-7 | Datos personales de clientes (NIT, DUI, teléfono, correo) visibles para todo usuario autenticado y sin cifrado en reposo | 2×2 = 4 **Medio** | Sesión obligatoria; `Cache-Control: no-store` en la API; datos del seed ficticios | RQ-SEG-01; `seguridad` › *Cabeceras* | 1×2 = 2 **Bajo** | Aceptar (el vendedor los necesita para facturar) | PO |
| RD-8 | Reportes gerenciales con cifras incorrectas o fijas que llevan a malas decisiones | 2×2 = 4 **Medio** | Reportes calculados con los DTE reales (vigentes, NC restadas, en centavos); se eliminaron las cifras fijas (D3) | `fase6` › *totales coherentes con los DTE del período*, *CCF + NC*; e2e *Panel gerencial* | 1×2 = 2 **Bajo** | Mitigar | BE, FE |

### Contingencia

| ID | Riesgo | Inherente P×I | Medidas implementadas | Evidencia | Residual P×I | Tratamiento | Resp. |
|---|---|---|---|---|---|---|---|
| RC-1 | MH no responde y las ventas quedan sin sello | 3×3 = 9 **Alto** | Estado CONTINGENCIA con JSON `tipoModelo/tipoOperacion 2`; evento de contingencia v4; lote manual y automático; reintento individual | RQ-CON-03/04/05 (todas aprobadas); e2e `06-contingencia` | 1×2 = 2 **Bajo** | Mitigar | BE |
| RC-2 | Se vence el plazo para reportar la contingencia, o el lote del cierre se pierde con el servidor apagado | 2×3 = 6 **Alto** | Lote automático diario con configuración persistente en BD; DTE con más de 24 h en rojo; lote manual siempre disponible | `tareasProgramadas` (15/15), `loteContingencia` (19/19) | 2×2 = 4 **Medio** | Mitigar. Pendiente: recuperar un lote perdido al arrancar | BE, PO |
| RC-3 | La respuesta de MH se pierde (timeout): el DTE queda en contingencia aunque MH lo selló, y se reenvía duplicado | 2×3 = 6 **Alto** | Cola de consultas a MH (un DTE por turno); el reenvío devuelve el sello original sin duplicar | `consultaMh` (22/22) · RQ-CON-06 | 1×1 = 1 **Bajo** | Mitigar | BE |
| RC-4 | Lote o consultas ejecutados dos veces (dos procesos, turnos solapados) | 2×2 = 4 **Medio** | Candado en BD con vencimiento; un lote por día como máximo; registro de cada ejecución | `tareasProgramadas` › *Sin ejecuciones duplicadas* | 1×1 = 1 **Bajo** | Mitigar | BE |
| RC-5 | **La BD de la demo no tiene el esquema actual** (faltan `config_tarea`, `ejecucion_tarea` y `borrador`): la configuración de tareas no persiste y Borradores responde 500 durante la demo (H-A9) | 3×2 = 6 **Alto** | Script idempotente listo (`db/01_schema.sql`); el servidor arranca aunque falten tablas y reintenta leer la configuración cada 60 s; pendiente documentado en `PROGRESO.md` | `huella-bd-demo-antes.json` (12 tablas) | 3×2 = 6 **Alto** | Mitigar. **Acción:** ejecutar `db/01_schema.sql` en `BatallonAtlacatl` antes de la demo → residual 1×1 **Bajo** | DBA |

### Técnico y de proyecto

| ID | Riesgo | Inherente P×I | Medidas implementadas | Evidencia | Residual P×I | Tratamiento | Resp. |
|---|---|---|---|---|---|---|---|
| RT-1 | Dependencias vulnerables u obsoletas | 2×2 = 4 **Medio** | `npm audit` en cada fase; sin dependencias nuevas de seguridad; `uuid` eliminada | `02-npm-audit.txt`: 0 (H-A10: avisos transitivos de desarrollo) | 1×1 = 1 **Bajo** | Mitigar | BE |
| RT-2 | Regresiones no detectadas al cambiar el código | 2×3 = 6 **Alto** | 560 casos automatizados; matriz de autorización completa (40/40 rutas); pruebas de mutación; trazabilidad generada que falla si un requisito pierde sus pruebas | `03`, `04`, `05`; [trazabilidad](generado/trazabilidad.md) 46/46 | 1×2 = 2 **Bajo** | Mitigar. El frontend no tiene cobertura medida | QA |
| RT-3 | Sin decisión de negocio sobre quién puede invalidar (hoy solo ADMIN) | 2×2 = 4 **Medio** | Política centralizada (`config/politicas.js` + `app.js`), cambiable sin tocar la lógica | `invalidacion` › *autorización*; mutación M5 | 2×1 = 2 **Bajo** | Aceptar hasta que el PO decida | PO |
| RT-4 | Incompatibilidad con otros navegadores (e2e solo en Edge) | 2×1 = 2 **Bajo** | Frontend en JS estándar sin frameworks; la e2e admite `E2E_CHANNEL=chrome/chromium` | `04-npm-test-e2e.txt` | 2×1 = 2 **Bajo** | Aceptar | QA |

## Evidencia de las medidas de mitigación

| Medida | Riesgos | Cómo se verificó en esta ejecución |
|---|---|---|
| JSON validado contra los esquemas oficiales del MH | RF-1, RF-6 | `builders.test.js` y `toCumplirEsquemaMh` en las suites de integración: 539/539 |
| Cálculos en centavos y redondeo corregido | RF-3 | 13 casos de redondeo y porcentaje; flujos 01/03/05 con montos exactos (5.66, 113.00, 11.30) |
| Correlativo bajo `UPDLOCK` | RF-4 | 8 emisiones en paralelo sin números repetidos |
| Rotulado de lo simulado | RF-2, RD-8 | e2e `07-fase6` (5/5); mutación M7 detectada |
| Autorización por rol y por dueño | RA-1 | 108/108 casos de la matriz; mutaciones M1–M5 detectadas |
| Cookie HttpOnly + CSRF, CSP, CORS | RA-5, RA-6 | `seguridad.test.js` 27/27; e2e `01-login` |
| Límite de intentos de login | RA-4 | 6 casos: bloqueo, `Retry-After`, otro usuario entra, reinicio tras éxito |
| SQL parametrizado | RA-3 | Revisión de las 20 interpolaciones en SQL de `src/`: solo constantes y marcadores `@p0…` |
| Secretos fuera de Git y de los reportes | RD-1, RA-3 | `07-barrido-secretos.txt` |
| Aislamiento de la BD de pruebas | RD-3 | Huella SHA-256 de 12 tablas, 0 cambios |
| Contingencia: eventos, lotes, cola y tareas persistentes | RC-1 a RC-4 | 101 casos (`contingencia`, `eventoContingencia`, `loteContingencia`, `consultaMh`, `tareasProgramadas`) + e2e `06-contingencia` |
| Suite de regresión y trazabilidad | RT-2 | 560/560; 46/46 requisitos |

## Riesgos residuales por área

**Integración fiscal.** El riesgo dominante es el **RF-1**: todo lo fiscal está validado contra los esquemas oficiales, pero nunca se habló con el MH real ni se firmó con un certificado válido. Es una limitación aceptada del alcance académico, no un defecto. El paso siguiente sería el ambiente de pruebas de Hacienda con su firmador. También queda validar los catálogos contra el CAT vigente (**RF-5**). El riesgo de confundir un documento simulado con uno real (**RF-2**) queda en Medio solo por su impacto: la UI lo rotula en todas partes.

**Acceso.** La autorización por rol está cubierta y probada contra regresiones (**RA-1**). Lo que queda es de **sesión e infraestructura**. Un token sigue valiendo hasta 8 h tras una desactivación o un cambio de rol (**RA-2**). La conexión a SQL Server usa `sa` con una contraseña débil (**RA-3**). Las contraseñas del seed son públicas (**RA-7**). En uso local los tres son Medio; **antes de cualquier despliegue son bloqueantes** junto con HTTPS (RA-6).

**Datos.** No hay fugas de secretos y las pruebas no tocan la BD de la demo. Se aceptan para el ámbito académico la falta de respaldos (**RD-2**) y una bitácora que puede alterar quien tenga acceso directo a la BD (**RD-5**).

**Contingencia.** El ciclo completo (contingencia → evento → lote → sello, más la cola de consultas) está implementado y probado (**RC-1, RC-3, RC-4** en Bajo). Quedan dos residuales. Un lote del cierre se pierde si el servidor está apagado a esa hora (**RC-2**; el siguiente lote lo recoge, pero puede vencer el plazo de 24 h). Y la BD de la demo está desactualizada (**RC-5**), lo que se resuelve con una acción concreta antes de la demo.

## Acciones recomendadas (por prioridad)

1. **Antes de la demo:** ejecutar `db/01_schema.sql` en `BatallonAtlacatl` (RC-5) y luego `db/03_reset_demo.sql`.
2. Crear un usuario de SQL Server con permisos solo sobre la BD del POS y una contraseña fuerte; dejar de usar `sa` (RA-3).
3. Revisar `activo` y `rol` del usuario en cada petición autenticada (RA-2).
4. Decidir con el PO qué roles pueden invalidar (RT-3) y validar los catálogos MH contra el CAT vigente (RF-5).
5. Para un despliegue: HTTPS + `COOKIE_SECURE=1`, contraseñas nuevas, respaldos, CSP estricta (RA-6, RA-7, RD-2, RA-5).
