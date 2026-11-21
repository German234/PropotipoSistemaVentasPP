# KAN-23 · Seguridad

Estado de los controles de seguridad del POS académico al 2026-11-20, con la evidencia de cada uno. El detalle técnico de los controles de la Fase 3 (CORS, cookies, CSRF, CSP, límite de login) está en [`docs/SEGURIDAD.md`](../SEGURIDAD.md); aquí se resume y se agrega lo de las fases S1, 4, 6 y 7.

**Estados:** ✅ **Verificado** = implementado y respaldado por una prueba automatizada que pasó en esta ejecución · 🟡 **Implementado** = en el código, verificado solo por revisión o por un recorrido manual · ⏳ **Pendiente** = no implementado (ver hallazgos abiertos).

## 1. Matriz de controles

### Autenticación y sesión

| ID | Control | Estado | Evidencia |
|---|---|---|---|
| C-01 | JWT `HS256` (8 h) obligatorio en todas las rutas salvo `GET /api/health`, `POST /api/auth/login` y `POST /api/auth/logout` | ✅ | [autorizacion.md](generado/autorizacion.md): 40/40 rutas → 401 sin sesión · RQ-SEG-01 |
| C-02 | Rechazo de token manipulado, sin firma (`alg: none`) o firmado con otro secreto; el rol sale solo del token, nunca del cuerpo | ✅ | `autorizacion.test.js` › *Token manipulado → 401* (4/4); `middleware.test.js` › *middleware/auth* · RQ-SEG-02 |
| C-03 | Sesión del navegador en cookie `HttpOnly` + `SameSite=Strict`; CSRF por `X-CSRF-Token` en escrituras | ✅ | `seguridad.test.js` › *cookie HttpOnly + CSRF* (8/8); e2e `01-login` (no hay JWT en `localStorage`) · RQ-SEG-05, RQ-SEG-11 |
| C-04 | Límite de intentos fallidos de login por usuario+IP y por IP → 429 con `Retry-After` | ✅ | `seguridad.test.js` › *Límite de intentos* (6/6) · RQ-SEG-06 |
| C-05 | Contraseñas con bcrypt (coste 10); nunca se devuelven ni van a la bitácora (`"(cambiada)"`) | ✅ | `fase6.test.js` › *lista … sin exponer el hash*, *bitácora sin la contraseña*, *cambio de contraseña* |
| C-06 | Comparación contra un hash de relleno si el usuario no existe (no revela usuarios por tiempo de respuesta) | 🟡 | `services/authService.js` (revisión de código; sin prueba de tiempos) |
| C-07 | Un usuario desactivado no puede iniciar sesión | ✅ | `fase6.test.js` › *desactivado: no inicia sesión*; e2e `07-fase6` › *Usuarios* |
| C-08 | `JWT_SECRET` débil: el servidor no arranca en producción y avisa en local | ✅ | `middleware.test.js` › *config/seguridad* · RQ-SEG-09 |

### Autorización

| ID | Control | Estado | Evidencia |
|---|---|---|---|
| C-09 | `requireRol('ADMIN')` en las 11 rutas de administración (productos POST/PUT, invalidar, contingencia POST y configuración, usuarios ×4, reportes) | ✅ | [autorizacion.md](generado/autorizacion.md): VENDEDOR → 403 sin efectos por 2 vías en las 11; ADMIN autorizado · mutaciones **M1, M2, M5 detectadas** |
| C-10 | Rutas de uso general no bloquean a ningún rol autenticado | ✅ | [autorizacion.md](generado/autorizacion.md): 29 rutas, VENDEDOR permitido |
| C-11 | Invalidación solo ADMIN (política `ROLES_INVALIDAR`, S1) | ✅ | `invalidacion.test.js` › *autorización* (4/4); e2e `02-roles`; mutación M5 · RQ-INV-02 |
| C-12 | Aislamiento de borradores por usuario (el de otro → 404) | ✅ | `fase6.test.js` › *cada usuario ve solo los suyos*; mutación **M3 detectada** |
| C-13 | Siempre queda al menos un ADMIN activo; nadie se desactiva ni se quita ADMIN a sí mismo (comprobado con `UPDLOCK`) | ✅ | `fase6.test.js` › *no se puede dejar el sistema sin ADMIN* (409), *nadie se desactiva…*; mutación **M4 detectada** |
| C-14 | La UI oculta las acciones que el rol no puede hacer (y la API igual las rechaza) | ✅ | e2e `02-roles` (4/4) · RQ-SEG-10 |

### Entrada, salida y navegador

| ID | Control | Estado | Evidencia |
|---|---|---|---|
| C-15 | SQL siempre parametrizado (`config/db.js`); las listas `IN (...)` se arman con marcadores `@p0…` | 🟡 | Revisión de código en esta fase: las 20 interpolaciones dentro de SQL en `src/` son constantes de columnas o marcadores de parámetros; ninguna lleva datos de entrada |
| C-16 | Validación de entrada en el backend (`utils/validar.js`, catálogos MH, formatos) | ✅ | Casos 400 de `dte01/03/05`, `catalogos`, `fase6` |
| C-17 | Escape de todo dato pintado como HTML (`_h()`) | 🟡 | Revisión de código en esta fase (ningún dato de la API llega a `innerHTML` sin `_h()`); prueba de CSP en navegador (Fase 3). Sin prueba automatizada de XSS |
| C-18 | CSP, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `no-store` en `/api`, sin `X-Powered-By` | ✅ | `seguridad.test.js` › *Cabeceras HTTP de seguridad* · RQ-SEG-07 (la CSP aún permite `onclick` en línea: H-A4) |
| C-19 | CORS solo para los orígenes de `CORS_ORIGENES` | ✅ | `seguridad.test.js` › *CORS* (4/4) |
| C-20 | Errores 500 genéricos con referencia (sin SQL, rutas ni usuarios de BD); 413 por cuerpo > 1 MB | ✅ | `seguridad.test.js` › *Errores sin detalles internos*; `middleware.test.js` › *errores* · RQ-SEG-08 |
| C-21 | Credenciales de demo y `mocks.js` solo en el entorno local | ✅ | `seguridad.test.js` › *Credenciales de demostración* (4/4) |

### Datos, auditoría e integridad de la información

| ID | Control | Estado | Evidencia |
|---|---|---|---|
| C-22 | Bitácora de logins (correctos y fallidos), escrituras, emisiones, eventos y correo simulado | ✅ | `consultas.test.js` › *GET /api/bitacora*; aserciones de bitácora en `contingencia`, `invalidacion`, `fase6` |
| C-23 | Secretos fuera del repositorio (`backend/.env` ignorado; sin claves ni certificados versionados) | ✅ | `evidencia/07-barrido-secretos.txt` |
| C-24 | Reportes de prueba sin secretos (`webServer.env` sin `process.env`, corrección de D2) | ✅ | `evidencia/07-barrido-secretos.txt`: 122 archivos y el zip embebido del reporte, sin `JWT_SECRET` ni `DB_PASSWORD` como dato |
| C-25 | Dependencias sin vulnerabilidades conocidas | ✅ | `evidencia/02-npm-audit.txt`: 0 |
| C-26 | Pruebas aisladas de la BD de la demo | ✅ | `evidencia/06-huella-bd-demo-comparacion.txt`: 12 tablas, 0 cambios |
| C-27 | La UI no aparenta operaciones que no ocurren: correo `enviado: false` y rotulado "Simulado"; firmador "Simulado — sin certificado"; sin botones de guardar/exportar falsos | ✅ | `fase6.test.js` › *Correo*; e2e `07-fase6` › *Correo*, *Configuración*; mutación **M7 detectada** |
| C-28 | Firmador simulado claramente falso (JWS sin validez) y ambiente `00` | ✅ | `simuladores.test.js` › *firmador*; tarjeta de Configuración (e2e) |

### Controles pendientes

| ID | Control | Estado | Ver |
|---|---|---|---|
| P-01 | Revocar la sesión al hacer logout, desactivar o cambiar el rol de un usuario | ⏳ | H-A1 |
| P-02 | Usuario de SQL Server propio con mínimo privilegio y contraseña fuerte (hoy `sa`) | ⏳ | H-A2, H-A3 |
| P-03 | CSP estricta sin `script-src-attr 'unsafe-inline'` | ⏳ | H-A4 |
| P-04 | Límite de login compartido entre instancias | ⏳ | H-A5 |
| P-05 | Contraseñas del seed cambiadas antes de cualquier despliegue | ⏳ | H-A6 |
| P-06 | HTTPS y `COOKIE_SECURE=1` (configurable, no activo en local) | ⏳ | H-A7 |
| P-07 | Límite de frecuencia en operaciones que escriben en la bitácora sin cambiar datos | ⏳ | H-A8 |
| P-08 | Política de contraseñas más allá de 8 caracteres | ⏳ | H-A11 |
| P-09 | Bitácora a prueba de alteraciones; respaldos de la BD | ⏳ | [RIESGOS](RIESGOS.md) RD-2, RD-5 |
| P-10 | Firma electrónica real con certificado del MH | ⏳ fuera de alcance | [RIESGOS](RIESGOS.md) RF-2 |

**Totales:** 28 controles implementados (25 ✅ verificados con prueba automatizada, 3 🟡 verificados por revisión) y 10 pendientes.

## 2. Pruebas de autorización por rol

Matriz completa, generada desde los resultados: **[generado/autorizacion.md](generado/autorizacion.md)**.

| Grupo | Rutas | Qué se prueba | Casos | Resultado |
|---|---|---|---|---|
| Sin sesión | 40 (todas las protegidas) | 401 `NO_AUTENTICADO`; solo health, login y logout son públicas | 41 | ✅ 41/41 |
| Token manipulado | — | Rol cambiado en el payload, `alg: none`, otro secreto, rol enviado en el cuerpo | 4 | ✅ 4/4 |
| VENDEDOR en rutas de solo ADMIN | 11 | 403 `SIN_PERMISO` por **Bearer** y por **cookie + CSRF válido**, y una prueba que compara productos, DTE, contingencia, configuración, usuarios y bitácora antes y después (sin efectos) | 23 | ✅ 23/23 |
| VENDEDOR en rutas de cualquier rol | 29 | Ningún 401/403 | 29 | ✅ 29/29 |
| ADMIN en rutas de solo ADMIN | 11 | La operación se ejecuta | 11 | ✅ 11/11 |
| **Total** `autorizacion.test.js` | **40** | | **108** | **✅ 108/108** |

Complementan la matriz: `invalidacion.test.js` › *autorización* (VENDEDOR 403 sin cambiar estado, stock ni bitácora), `fase6.test.js` (usuarios y reportes 403 para VENDEDOR; borradores ajenos 404) y la e2e `02-roles.spec.js` (la UI oculta y la API rechaza).

**Completitud de la matriz (corregido en esta fase).** Se comparó la lista de rutas registradas en `src/routes/` (43; 40 protegidas) con las de la matriz: faltaba `GET /api/contingencia/ejecuciones` (Fase 5). Se agregó y ahora están las 40 (H-C11).

**¿La matriz detecta regresiones?** Se rompió a propósito cada control y se corrió la suite ([`evidencia/05-mutacion-autorizacion.txt`](evidencia/05-mutacion-autorizacion.txt), detalle en [QA §6](QA.md#6-pruebas-de-mutación-de-los-controles-de-acceso)):

| # | Mutación | Detectada |
|---|---|---|
| M1 | Quitar `requireRol('ADMIN')` de `/api/usuarios` | ✅ 10 pruebas fallan |
| M2 | Quitar `requireRol('ADMIN')` de `/api/reportes` | ✅ 3 fallan |
| M3 | Borradores sin el filtro por dueño | ✅ 1 falla |
| M4 | Permitir dejar el sistema sin ADMIN activo | ✅ 1 falla |
| M5 | Permitir invalidar al VENDEDOR | ✅ 6 fallan |
| M6 | `jwt.verify` acepta `alg: none` | ➖ no detectada: mutante equivalente (ver abajo) |
| M7 | El correo responde `enviado: true` | ✅ 1 falla |

M6: `jsonwebtoken` 9 rechaza por sí misma un token sin firma cuando se le pasa un secreto, así que agregar `'none'` a la lista no abre el acceso. Las pruebas de token `alg: none` siguen dando 401 con la mutación. Fijar `algorithms: ['HS256']` es defensa en profundidad, no la única barrera.

## 3. Hallazgos corregidos

| ID | Hallazgo | Severidad | Corrección | Fase | Evidencia (todas en verde en esta ejecución) |
|---|---|---|---|---|---|
| H-C01 | CORS abierto (`Access-Control-Allow-Origin: *`) | Media | Lista de orígenes (`CORS_ORIGENES`) | 3 | `seguridad.test.js` › *CORS* |
| H-C02 | Errores 500 con el texto de SQL Server (tablas, usuario `sa`, host) | Media | Mensaje genérico con referencia; detalle solo en el log | 3 | `seguridad.test.js` › *Errores sin detalles internos*; `middleware.test.js` |
| H-C03 | Sin límite de intentos de login (fuerza bruta) | Media | 5 fallos por usuario+IP / 20 por IP → 429 | 3 | `seguridad.test.js` › *Límite de intentos* |
| H-C04 | JWT en `localStorage` (robable con un XSS) | Alta | Cookie `HttpOnly` + `SameSite=Strict` + CSRF | 3 | `seguridad.test.js` › *cookie HttpOnly + CSRF*; e2e `01-login` |
| H-C05 | Credenciales de prueba visibles siempre en el login | Media | Solo en local (`DEMO_CREDENCIALES` / `NODE_ENV`) | 3 | `seguridad.test.js` › *Credenciales de demostración* |
| H-C06 | Sin cabeceras de seguridad ni CSP (XSS, clickjacking, caché de datos fiscales) | Media | `middleware/seguridad.js` | 3 | `seguridad.test.js` › *Cabeceras HTTP* |
| H-C07 | Dependencia innecesaria (`uuid`) | Baja | Eliminada; `crypto.randomUUID` | 3 | `evidencia/02-npm-audit.txt` |
| H-C08 | Cualquier rol podía invalidar DTE | Alta | Solo ADMIN (`ROLES_INVALIDAR`) | S1 | `invalidacion.test.js` › *autorización*; mutación M5 |
| H-C09 | El reporte e2e serializaba `DB_PASSWORD` y `JWT_SECRET` reales (D2) | Alta | `webServer.env` solo con variables no secretas; reportes regenerados. **No llegó a Git** | 4 | `evidencia/07-barrido-secretos.txt` (repetido en esta fase sobre 122 archivos) |
| H-C10 | La UI afirmaba operaciones que no ocurrían (correo "enviado", "Configuración guardada", certificado "Habilitado" inventado, usuarios ficticios) | Media (integridad de la información) | Correo simulado y rotulado (`enviado: false`), emisor real en solo lectura, firmador rotulado "Simulado", CRUD real de usuarios | 6 | e2e `07-fase6` (5/5); `fase6.test.js`; mutación M7 |
| H-C11 | La matriz de autorización no cubría `GET /api/contingencia/ejecuciones` | Baja (brecha de prueba) | Ruta agregada a la matriz (+2 casos) | 7 | [autorizacion.md](generado/autorizacion.md): 40/40 |

## 4. Hallazgos abiertos y riesgo residual

Severidad para el uso **académico local**; entre paréntesis, si cambia en un despliegue real.

| ID | Hallazgo | Severidad | Riesgo residual / por qué sigue abierto | Recomendación | Riesgo |
|---|---|---|---|---|---|
| H-A1 | **La sesión no se revoca.** Tras un logout, una desactivación o un cambio de rol, el JWT sigue valiendo hasta 8 h. Desde la Fase 6 un ADMIN degradado a VENDEDOR **conserva permisos de ADMIN** con su token vigente: `fase6.test.js` › *no se puede dejar el sistema sin ADMIN* lo usa a propósito (el token viejo de `admin` pasa `requireRol` después de degradarlo) | **Media** (Alta) | La ventana es de hasta 8 h, solo para un usuario que ya tenía sesión. Se informa en la UI al desactivar | Comprobar `activo` y `rol` en la BD en cada petición (o versionar el token por usuario) | RA-2 |
| H-A2 | **La aplicación se conecta a SQL Server como `sa`** (máximo privilegio) | **Media** (Alta) | Una inyección SQL o la fuga del `.env` daría control total del servidor de BD. Atenuado por C-15 (SQL parametrizado) y C-23 | Usuario propio con permisos solo sobre `BatallonAtlacatl` (DML + EXEC) | RA-3 |
| H-A3 | Contraseña local de SQL Server débil (no se reproduce aquí) | Baja (Alta) | Solo en la máquina de desarrollo; no está en el repositorio | Cambiarla junto con H-A2 | RA-3 |
| H-A4 | La CSP permite manejadores en línea (`script-src-attr 'unsafe-inline'`) por ~100 `onclick` | Baja | Un `<script>` inyectado sigue bloqueado; un atributo inyectado no. Atenuado por C-17 (`_h()`) | Migrar a `addEventListener` | RA-5 |
| H-A5 | Límite de login en memoria: se pierde al reiniciar y no se comparte entre instancias | Baja | Suficiente con una instancia | Almacén compartido (p. ej. Redis) si hay varias | RA-4 |
| H-A6 | Contraseñas del seed públicas en el repositorio (`admin123`, `vendedor123`) | Baja (Crítica) | Solo para la demo local; el login no las muestra fuera de local | Cambiarlas antes de desplegar; forzar el cambio en el primer ingreso | RA-7 |
| H-A7 | Sin HTTPS en local (`COOKIE_SECURE` desactivado) | Baja (Alta) | Tráfico solo en `localhost` | Proxy con TLS y `COOKIE_SECURE=1`, `TRUST_PROXY` | RA-6 |
| H-A8 | `POST /api/dte/:id/correo` (simulado) no tiene límite: un usuario autenticado puede llenar la bitácora | Baja | Requiere sesión; queda registrado quién lo hizo | Límite por usuario | RD-5 |
| H-A9 | **La BD de la demo tiene un esquema anterior:** le faltan `config_tarea` y `ejecucion_tarea` (Fase 5) y `borrador` (Fase 6) (`evidencia/huella-bd-demo-antes.json`: 12 tablas) | **Media** (operativa) | En la demo, Borradores responde 500 y la configuración de tareas no persiste hasta aplicar el esquema | Ejecutar `db/01_schema.sql` en `BatallonAtlacatl` antes de la demo (idempotente) | RC-5 |
| H-A10 | Avisos de paquetes obsoletos transitivos de desarrollo (`glob@7`, `inflight`) | Baja | Solo en herramientas de prueba; `npm audit` 0 | Actualizar Jest cuando lo permita | RT-1 |
| H-A11 | Política de contraseñas mínima (8 caracteres, sin complejidad, sin caducidad) | Baja (Media) | El límite de intentos (C-04) frena la fuerza bruta | Reglas de complejidad o lista de contraseñas comunes | RA-4 |

No hay hallazgos críticos abiertos para el uso académico local. Antes de cualquier despliegue fuera de `localhost`, **H-A1, H-A2/H-A3, H-A6 y H-A7 pasan a ser bloqueantes.**
