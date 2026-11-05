# CLAUDE.md — Mini POS académico con DTE simulado (MH El Salvador)

Punto de venta académico que **simula** la facturación electrónica del Ministerio de Hacienda (MH). No hay firmador ni MH reales: el backend simula sus respuestas. Prioridad: la API. Proyecto rápido y funcional, no robusto.

**Stack:** SQL Server (BD `BatallonAtlacatl`, ya creada) · Node + Express + mssql · frontend vanilla JS (`frontend/index.html`, sin frameworks).

## Flujo de trabajo por bloques

- **Al iniciar cada bloque**, lee SOLO `CLAUDE.md`, `PROGRESO.md` y `docs/API.md`. No releas todo el repo; abre únicamente los archivos que el bloque necesita según el *Mapa de archivos* de `PROGRESO.md`.
- **Al terminar cada bloque**, actualiza OBLIGATORIAMENTE `PROGRESO.md` en la sección de tu track (Backend o Frontend): marca el bloque como hecho, lista los archivos creados/modificados con una línea de propósito, los endpoints o pantallas listas, las decisiones tomadas y los pendientes. Sé breve: es un índice, no documentación. Agrega al *Mapa de archivos* los archivos nuevos.
- **Si cambias el contrato de la API**, edita `docs/API.md` y anótalo en la sección *Cambios de contrato* de `PROGRESO.md`.
- Los esquemas oficiales del MH están en `schemas-mh/` (solo referencia; ábrelos únicamente si el bloque lo requiere).

## Convenciones

- JSON de la API en **camelCase**; columnas SQL en **snake_case**.
- Dinero: `DECIMAL(12,2)`; redondeo a 2 decimales en cada cálculo que se persista o devuelva.
- Respuesta estándar: éxito `{ "ok": true, "data": ... }` · error `{ "ok": false, "error": { "codigo": "...", "mensaje": "..." } }`.
- Ambiente MH: `"00"` (pruebas).
- Autenticación: JWT en `Authorization: Bearer <token>` (todas las rutas excepto `POST /api/auth/login` y `GET /api/health`). Estructura: routes → controllers → services (SQL parametrizado vía `config/db.js`).
- Header opcional `X-Simular: ok | rechazo | contingencia` (por defecto `ok`) fuerza el resultado de MH en la demo.

## Reglas DTE

- **codigoGeneracion:** UUID v4 en MAYÚSCULAS.
- **numeroControl:** `DTE-{tipo 2 dígitos}-{codEstable 4}{codPuntoVenta 4}-{correlativo 15 dígitos}`, p. ej. `DTE-01-M001P001-000000000000001`. Hay un correlativo por tipo, y se obtiene dentro de una transacción.
- **Estructura del JSON:** `identificacion`, `documentoRelacionado`, `emisor`, `receptor`, `otrosDocumentos`, `ventaTercero`, `cuerpoDocumento`, `resumen`, `apendice` (los campos que no se usen van en `null`). Sin `extension`: los esquemas 01 v2 y 03 v4 de `schemas-mh/` no la admiten (`additionalProperties: false`).
- **01 Factura:** consumidor final; precios CON IVA (`precio * 1.13`); el IVA va incluido (`totalIva = gravado / 1.13 * 0.13`); receptor opcional.
- **03 CCF:** requiere un cliente `CONTRIBUYENTE` con NIT, NRC y actividad; precios SIN IVA; `resumen.tributos = [{ codigo: "20", descripcion: "Impuesto al Valor Agregado 13%", valor }]`.
- **05 Nota de crédito:** solo sobre un 03 en estado `PROCESADO`, con el mismo receptor; `documentoRelacionado = [{ tipoDocumento: "03", tipoGeneracion: 2, numeroDocumento: <codigoGeneracion del CCF>, fechaEmision }]`; cantidades ≤ las pendientes de acreditar; devuelve el stock.
- **Firmador simulado:** devuelve `{ status: "OK", body: "<JWS falso: base64url(header).base64url(json).base64url(random)>" }`.
- **MH recepción simulada:** `{ version: 2, ambiente: "00", versionApp: 2, estado: "PROCESADO" | "RECHAZADO", codigoGeneracion, selloRecibido (año + 36 alfanuméricos = 40 caracteres; null si se rechaza), fhProcesamiento: "dd/MM/yyyy HH:mm:ss", clasificaMsg, codigoMsg, descripcionMsg, observaciones: [] }`.
  - `contingencia` = MH no responde → estado `CONTINGENCIA`, sin sello; se puede reintentar.
- **Invalidación:** solo sobre DTE `PROCESADO`; no se puede invalidar un 03 que tenga una NC vigente. JSON del evento: `identificacion`, `emisor`, `documento` (`tipoDte`, `codigoGeneracion`, `selloRecibido`, `numeroControl`, `fecEmi`, `codigoGeneracionR = null` y los datos del receptor; sin `montoIva`, que el esquema v3 no admite), `motivo` (`tipoAnulacion` 2 por defecto, `motivoAnulacion`, responsable y solicitante). Respuesta simulada con sello propio; el DTE pasa a `INVALIDADO` y se devuelve el stock.
- **resumen.totalLetras:** monto en letras, p. ej. `"CIENTO TRECE 00/100 USD"`.
