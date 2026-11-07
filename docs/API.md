# Contrato de la API

Base: `http://localhost:3000/api` · JSON en camelCase · ambiente MH `"00"`.

## Generalidades

**Autenticación:** todas las rutas excepto `POST /api/auth/login` y `GET /api/health` requieren `Authorization: Bearer <token>`.

**Respuesta estándar**

```json
{ "ok": true, "data": { } }
```

```json
{ "ok": false, "error": { "codigo": "VALIDACION", "mensaje": "El cliente debe ser CONTRIBUYENTE" } }
```

| codigo | HTTP | Uso |
|---|---|---|
| `NO_AUTENTICADO` | 401 | Falta el token o no es válido |
| `CREDENCIALES` | 401 | Usuario o contraseña incorrectos |
| `VALIDACION` | 400 | Datos de entrada inválidos |
| `SIN_PERMISO` | 403 | El rol del usuario no permite la operación |
| `NO_ENCONTRADO` | 404 | El recurso no existe |
| `ESTADO_INVALIDO` | 409 | La operación no aplica al estado actual del DTE |
| `STOCK_INSUFICIENTE` | 409 | No hay existencias suficientes |
| `DB_NO_DISPONIBLE` | 503 | No hay conexión con SQL Server |
| `MH_NO_DISPONIBLE` | 503 | MH (simulado) no respondió a un evento de invalidación o de contingencia (`X-Simular: contingencia` o `timeout`) |
| `ERROR_INTERNO` | 500 | Error no controlado |

**Header `X-Simular`** (opcional, en emisión, reintento, consulta, invalidación y evento de contingencia): `ok` (por defecto) | `rechazo` | `contingencia` | `timeout`. Fuerza el resultado de MH para la demo. `timeout` (C3) = MH **sí recibió y selló** el documento pero la respuesta no llegó: para el POS es igual que `contingencia` (no hay respuesta), pero MH lo guarda y la cola de consultas lo descubre después. En eventos (invalidación, contingencia) `timeout` se trata como `contingencia`.

**Estados de DTE:** `PROCESADO`, `RECHAZADO`, `CONTINGENCIA`, `INVALIDADO` (y `BORRADOR`, solo interno mientras se arma el documento; la API no lo devuelve en una emisión terminada).

---

## Health

### GET /api/health (sin token)

Ejecuta `SELECT 1` contra SQL Server.

```json
{ "ok": true, "data": { "api": "ok", "db": "ok", "ambiente": "00", "fecha": "2026-11-04T21:30:00.000Z" } }
```

Sin conexión → 503 `{ "ok": false, "error": { "codigo": "DB_NO_DISPONIBLE", "mensaje": "No se pudo conectar a la base de datos: ..." } }`

---

## Auth

### POST /api/auth/login

```json
{ "usuario": "admin", "password": "admin123" }
```

```json
{
  "ok": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "usuario": { "id": 1, "nombre": "Administrador", "rol": "ADMIN" }
  }
}
```

El token dura 8 h. Su payload es `{ id, usuario, nombre, rol }`. Roles: `ADMIN`, `VENDEDOR`. Datos incorrectos → 401 `CREDENCIALES`; faltan campos → 400 `VALIDACION`.

---

## Productos

Campos: `id`, `codigo`, `descripcion`, `precio` (SIN IVA), `stock` (entero), `unidad` (código de unidad de medida MH, `59` = unidad, por defecto), `activo` (borrado lógico).

| Ruta | Rol |
|---|---|
| `GET /api/productos`, `GET /api/productos/:id` | cualquiera autenticado |
| `POST /api/productos`, `PUT /api/productos/:id` | `ADMIN` (otro rol → 403 `SIN_PERMISO`) |

### GET /api/productos?q=&incluirInactivos=1

`q` busca en código o descripción. Por defecto solo devuelve activos.

```json
{
  "ok": true,
  "data": [
    { "id": 1, "codigo": "P001", "descripcion": "Cuaderno universitario 100 hojas", "precio": 2.50, "stock": 100, "unidad": 59, "activo": true }
  ]
}
```

### POST /api/productos → 201

```json
{ "codigo": "P011", "descripcion": "Regla de 30 cm", "precio": 0.85, "stock": 80, "unidad": 59 }
```

→ `{ "ok": true, "data": { "id": 11, "codigo": "P011", "descripcion": "Regla de 30 cm", "precio": 0.85, "stock": 80, "unidad": 59, "activo": true } }`

Código repetido → 400 `VALIDACION`. `precio` se redondea a 2 decimales.

### PUT /api/productos/:id

Parcial: solo los campos a modificar (p. ej. `{ "precio": 2.75 }` o `{ "activo": false }`). Devuelve el producto completo.

---

## Clientes

Campos: `id`, `tipo` (`CONSUMIDOR` | `CONTRIBUYENTE`), `nombre`, `nombreComercial`, `tipoDocumento`, `numDocumento`, `nit`, `nrc`, `codActividad`, `descActividad`, `direccion`, `telefono`, `correo`, `activo`.

- `direccion`: `{ departamento, municipio, distrito, complemento }` con **códigos MH** (ver `GET /api/catalogos`) o `null`. Los tres códigos deben existir y estar anidados (el municipio pertenece al departamento y el distrito al municipio); `complemento` 1–200 caracteres. Se copia tal cual al receptor del DTE. Un cliente anterior a P2 puede devolver `{ departamento: null, municipio: null, distrito: null, complemento: "texto" }` (el DTE usa entonces los códigos del emisor).
- `CONTRIBUYENTE`: `nit` (9 o 14 dígitos), `nrc` (1–8 dígitos), `codActividad` (5–6 dígitos, CAT-019), `descActividad` y `direccion` completa obligatorios. Su documento es siempre NIT: `tipoDocumento` = `"36"`, `numDocumento` = `nit`.
- `CONSUMIDOR`: todo opcional salvo `nombre`. Documento con `tipoDocumento` (CAT-022: `36` NIT, `13` DUI, `03` pasaporte, `02` carnet de residente, `37` otro) + `numDocumento` (NIT 9/14 dígitos, DUI 9 dígitos; el resto texto ≤ 20). Compatibilidad: mandar solo `nit` equivale a `tipoDocumento "36"`. `nit` se devuelve solo si el documento es NIT.
- `telefono`: opcional, ≥ 8 dígitos (admite espacios, `+`, `-`, paréntesis). `nombreComercial` ≤ 150.
- `nit`, `nrc` y los números de NIT/DUI aceptan guiones/espacios y se guardan solo con dígitos (en el JSON del DTE el DUI va como `########-#`).
- Rutas: cualquier usuario autenticado (`GET`, `GET /:id`, `POST`, `PUT /:id`).

### GET /api/clientes?q=&tipo=&incluirInactivos=1

`q` busca en nombre, nombre comercial, documento, NIT o NRC; `tipo` filtra. Por defecto solo activos.

```json
{
  "ok": true,
  "data": [
    {
      "id": 3, "tipo": "CONTRIBUYENTE", "nombre": "Distribuidora El Roble, S.A. de C.V.", "nombreComercial": "El Roble",
      "tipoDocumento": "36", "numDocumento": "06142301001234", "nit": "06142301001234", "nrc": "1234567",
      "codActividad": "46900", "descActividad": "Venta al por mayor de otros productos",
      "direccion": { "departamento": "06", "municipio": "23", "distrito": "14", "complemento": "Colonia Escalón, Paseo General Escalón #3500" },
      "telefono": "22605000", "correo": "compras@elroble.com.sv", "activo": true
    }
  ]
}
```

### POST /api/clientes → 201

```json
{
  "tipo": "CONSUMIDOR", "nombre": "Juan Pérez", "tipoDocumento": "13", "numDocumento": "01234567-8",
  "telefono": "7777-8888", "correo": "juan@correo.com",
  "direccion": { "departamento": "05", "municipio": "26", "distrito": "01", "complemento": "Residencial Las Colinas, casa 4" }
}
```

→ `{ "ok": true, "data": { "id": 5, ... } }` · código inválido → 400 `VALIDACION` (p. ej. `direccion.municipio "23" no pertenece al departamento Santa Ana (CAT-013)`).

### PUT /api/clientes/:id

Parcial, igual que productos. Se revalida el registro completo (p. ej. quitar el `nrc` a un CONTRIBUYENTE → 400). `direccion` se reemplaza completa (objeto) o se borra con `null`. Devuelve el cliente completo.

---

## Catálogos

### GET /api/catalogos (P2)

Catálogos MH para el formulario de clientes (cualquier rol). Fuente única: `backend/src/dte/catalogosMh.js` (también servido como `/js/catalogos-mh.js` para los mocks).

- `departamentos` (CAT-012, 14) → `municipios` (CAT-013, los 44 de la reforma 2024) → `distritos` (262; código = el del antiguo municipio dentro del departamento).
- `tiposDocumento` (CAT-022 que admite el POS).

```json
{
  "ok": true,
  "data": {
    "departamentos": [
      { "codigo": "06", "nombre": "San Salvador", "municipios": [
        { "codigo": "23", "nombre": "San Salvador Centro", "distritos": [ { "codigo": "14", "nombre": "San Salvador" }, "..." ] }, "..." ] }, "..."
    ],
    "tiposDocumento": [ { "codigo": "36", "nombre": "NIT" }, { "codigo": "13", "nombre": "DUI" }, "..." ]
  }
}
```

---

## Emisor

### GET /api/emisor

```json
{
  "ok": true,
  "data": {
    "nit": "06140101001010", "nrc": "100001", "nombre": "Batallón Atlacatl, S.A. de C.V.",
    "codActividad": "47190", "descActividad": "Venta al por menor en comercios no especializados",
    "nombreComercial": "Tienda Atlacatl", "tipoEstablecimiento": "02",
    "direccion": { "departamento": "06", "municipio": "14", "complemento": "Calle Principal #1" },
    "telefono": "22220000", "correo": "facturas@atlacatl.com.sv",
    "codEstable": "M001", "codPuntoVenta": "P001"
  }
}
```

---

## DTE

### Respuesta de emisión (común a 01, 03, 05 y reintentar)

`POST /api/dte/01|03|05` responden **201**; `reintentar` responde 200. Cualquier rol autenticado puede emitir.

```json
{
  "ok": true,
  "data": {
    "id": 15,
    "tipoDte": "01",
    "numeroControl": "DTE-01-M001P001-000000000000015",
    "codigoGeneracion": "A1B2C3D4-E5F6-4789-AB12-34567890ABCD",
    "selloRecibido": "2026A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8",
    "estado": "PROCESADO",
    "fechaEmision": "2026-11-04T15:30:00",
    "total": 11.30,
    "firmador": { "status": "OK", "body": "eyJhbGciOiJSUzUxMiJ9.eyJpZGVudGlm....c2lnbmF0dXJh" },
    "respuestaMh": {
      "version": 2, "ambiente": "00", "versionApp": 2, "estado": "PROCESADO",
      "codigoGeneracion": "A1B2C3D4-E5F6-4789-AB12-34567890ABCD",
      "selloRecibido": "2026A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8",
      "fhProcesamiento": "04/11/2026 15:30:01",
      "clasificaMsg": "10", "codigoMsg": "001", "descripcionMsg": "RECIBIDO",
      "observaciones": []
    }
  }
}
```

Con `X-Simular: rechazo` → `estado: "RECHAZADO"`, `selloRecibido: null`, `respuestaMh.codigoMsg` de error y `observaciones` con el motivo (la respuesta HTTP sigue siendo `ok:true`; el DTE queda registrado). No descuenta stock.
Con `X-Simular: contingencia` → `estado: "CONTINGENCIA"`, `selloRecibido: null`, `respuestaMh: null`. **Sí descuenta stock** (la venta ocurrió). El DTE se emite en contingencia: `jsonDte.identificacion` pasa a `tipoModelo: 2` (diferido), `tipoOperacion: 2` (contingencia), `tipoContingencia: 1` (MH no disponible), `motivoContin: null`, y se firma ese JSON. Se reporta con un evento de contingencia (`POST /api/contingencia`) o se reintenta uno a uno.
Con `X-Simular: timeout` → la misma respuesta que `contingencia` (MH recibió el JSON de modelo previo y lo selló, pero el POS no lo sabe; ver *Cola de consultas a MH*).
Un valor de `X-Simular` distinto de `ok|rechazo|contingencia|timeout` → 400 `VALIDACION`.
El RECHAZADO también consume correlativo (el número de control queda usado por ese registro).

**JSON DTE (`jsonDte`)** — sigue `schemas-mh/fe-f-v2.json` (01, `version: 2`) y `fe-ccf-v4.json` (03, `version: 4`), validado con ajv. Los esquemas tienen `additionalProperties: false`, por eso **no hay nodo `extension`** y el `emisor` no lleva `tipoEstablecimiento`. Las direcciones llevan `distrito` (`"01"` por defecto); la del receptor usa departamento/municipio del emisor y el texto del cliente como `complemento` (la tabla `clientes` guarda la dirección como texto libre). `resumen.pagos` = `[{codigo:"01", montoPago: totalPagar, ...}]` en contado y `null` en crédito/otro.

**Errores de emisión:** cliente o producto inexistente → 404 `NO_ENCONTRADO`; cliente/producto inactivo, descuento mayor que la línea, CCF sin `clienteId` o con cliente que no es CONTRIBUYENTE → 400 `VALIDACION`; stock menor que la cantidad → 409 `STOCK_INSUFICIENTE` (se valida en cualquier modo de `X-Simular`). Un mismo `productoId` repetido en `items` se suma en una línea.

### POST /api/dte/01 — Factura

`clienteId` opcional (`null` = consumidor final sin receptor). Precios CON IVA.

```json
{
  "clienteId": null,
  "condicionOperacion": 1,
  "items": [
    { "productoId": 1, "cantidad": 2, "descuento": 0 },
    { "productoId": 2, "cantidad": 10, "descuento": 0.50 }
  ]
}
```

`condicionOperacion`: 1 contado (defecto), 2 crédito, 3 otro. `descuento` es monto por línea (opcional, defecto 0), en la misma base que el precio: CON IVA en 01.

Cálculo 01: `precioUni = precio × 1.13`, `ventaGravada = precioUni × cantidad − descuento`, `ivaItem = ventaGravada / 1.13 × 0.13`; `totalIva = totalGravada / 1.13 × 0.13`; `resumen.tributos = null`; `totalPagar = totalGravada`. Receptor: `null` sin cliente; con cliente, `tipoDocumento "36"` + NIT si lo tiene, si no `null`.

### POST /api/dte/03 — Comprobante de Crédito Fiscal

`clienteId` obligatorio y debe ser `CONTRIBUYENTE` con NIT, NRC y actividad. Precios SIN IVA; IVA en `resumen.tributos`.

```json
{
  "clienteId": 3,
  "condicionOperacion": 1,
  "items": [ { "productoId": 1, "cantidad": 40, "descuento": 0 } ]
}
```

Cálculo 03: `precioUni = precio`, `ventaGravada = precioUni × cantidad − descuento`, ítem `tributos: ["20"]` (sin `ivaItem`, el esquema no lo lleva); `resumen.tributos = [{ codigo: "20", descripcion: "Impuesto al Valor Agregado 13%", valor: totalGravada × 0.13 }]`; `montoTotalOperacion = totalPagar = subTotal + IVA`. Ej.: 40 × 2.50 → gravada 100.00, IVA 13.00, total 113.00, `"CIENTO TRECE 00/100 USD"`.

### POST /api/dte/05 — Nota de crédito

Solo sobre un 03 en `PROCESADO` (otro tipo → 400 `VALIDACION`; otro estado → 409 `ESTADO_INVALIDO`). El receptor se copia del JSON del CCF; si se envía `clienteId` debe ser el del CCF (si no, 400). Cantidades ≤ pendientes de acreditar (cantidad del CCF − NC vigentes en `PROCESADO`/`CONTINGENCIA`). Devuelve el stock (si queda `PROCESADO` o `CONTINGENCIA`). Responde 201 con la respuesta de emisión.

```json
{
  "dteRelacionadoId": 16,
  "items": [ { "productoId": 1, "cantidad": 5 } ]
}
```

Error típico: `{ "ok": false, "error": { "codigo": "VALIDACION", "mensaje": "Cantidad a acreditar (50) mayor a la pendiente (40) para el producto P001" } }`. Un producto que no está en el CCF → 400.

Cálculo: `precioUni` = precio unitario del CCF; `ventaGravada` proporcional a la del CCF (`ventaGravada_CCF × cantidad / cantidad_CCF`, así un descuento del CCF se acredita en proporción; la última acreditación toma el resto exacto); IVA 13 % en `resumen.tributos` y `resumen.totalIva`; `condicionOperacion` = la del CCF.

JSON según `schemas-mh/fe-nc-v4.json` (`version: 4`): `documentoRelacionado = [{ tipoDocumento: "03", tipoGeneracion: 2, numeroDocumento: <codigoGeneracion del CCF>, fechaEmision }]`; `identificacion.fusion: null`; **sin** `otrosDocumentos`; `emisor` sin `codEstable`/`codPuntoVenta`; `receptor` con `tipoDocumento: "36"` + `numDocumento` (NIT); cada ítem con `numeroDocumento` (= codigoGeneracion del CCF), `ivaPerci`, `totalIva`, `ivaRete`; `resumen` sin descuentos desglosados, `subTotal` ni `pagos`, con `codigoRetencionMH: null`.

### POST /api/dte/:id/invalidar

Solo sobre DTE `PROCESADO` (si no → 409 `ESTADO_INVALIDO`); un 03 con NC vigente (05 en `PROCESADO`/`CONTINGENCIA`) → 409 (hay que invalidar antes las NC). Responde 200.

```json
{ "tipoAnulacion": 2, "motivo": "Error en la información del documento" }
```

- `tipoAnulacion`: 1, 2 (defecto) o 3. Con 1 o 3 se exige `codigoGeneracionR` (UUID de otro DTE `PROCESADO` que lo reemplaza); con 2 debe ir vacío.
- `motivo` obligatorio (máx. 200). Responsable = usuario del token (`tipDocResponsable "13"`, `numDocResponsable "000000000"`). Opcionales: `nombreSolicita`, `tipDocSolicita`, `numDocSolicita` (por defecto, los del responsable).
- Evento `PROCESADO` → el DTE pasa a `INVALIDADO` y se revierte el stock (01/03 regresa; 05 vuelve a salir: si ya no hay existencias → 409 `STOCK_INSUFICIENTE`).
- `X-Simular: rechazo` → el evento se guarda con `estadoEvento: "RECHAZADO"`, sin sello; el DTE sigue `PROCESADO` (respuesta `ok:true`).
- `X-Simular: contingencia` → MH no responde; no existe contingencia para eventos: 503 `MH_NO_DISPONIBLE`, no se guarda el evento (sí queda en bitácora con resultado `SIN_RESPUESTA`).

```json
{
  "ok": true,
  "data": {
    "id": 15,
    "estado": "INVALIDADO",
    "estadoEvento": "PROCESADO",
    "codigoGeneracionEvento": "F0E1D2C3-B4A5-4697-8877-665544332211",
    "selloRecibido": "2026Z9Y8X7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2",
    "jsonEvento": {
      "identificacion": { "version": 3, "ambiente": "00", "codigoGeneracion": "F0E1D2C3-...", "fecEmi": "2026-11-04", "horEmi": "16:00:00", "fusion": null },
      "emisor": {
        "nit": "06140101001010", "nombre": "Batallón Atlacatl, S.A. de C.V.",
        "codEstableMH": "M001", "codEstable": "M001", "codPuntoVentaMH": "P001", "codPuntoVenta": "P001",
        "telefono": "22220000", "correo": "facturas@atlacatl.com.sv"
      },
      "documento": {
        "tipoDte": "01", "codigoGeneracion": "A1B2C3D4-...", "selloRecibido": "2026A1B2...",
        "numeroControl": "DTE-01-M001P001-000000000000015", "fecEmi": "2026-11-04", "codigoGeneracionR": null,
        "tipoDocumento": null, "numDocumento": null, "nombre": "Juan Pérez", "telefono": null, "correo": "juan.perez@correo.com"
      },
      "motivo": {
        "tipoAnulacion": 2, "motivoAnulacion": "Error en la información del documento",
        "nombreResponsable": "Administrador", "tipDocResponsable": "13", "numDocResponsable": "000000000",
        "nombreSolicita": "Administrador", "tipDocSolicita": "13", "numDocSolicita": "000000000"
      }
    },
    "firmador": { "status": "OK", "body": "..." },
    "respuestaMh": { "version": 2, "ambiente": "00", "versionApp": 2, "estado": "PROCESADO", "codigoGeneracion": "F0E1D2C3-...", "selloRecibido": "2026Z9Y8...", "fhProcesamiento": "04/11/2026 16:00:00", "clasificaMsg": "10", "codigoMsg": "001", "descripcionMsg": "EVENTO DE INVALIDACIÓN RECIBIDO", "observaciones": [] }
  }
}
```

El JSON del evento sigue `schemas-mh/invalidacion-schema-v3.json`: `documento` lleva los datos del receptor del DTE (`null` si la factura no tuvo receptor; en un 03 `tipoDocumento "36"` + NIT) y **no** lleva `montoIva` (el esquema no lo admite).

### POST /api/dte/:id/reintentar

Solo sobre DTE en `CONTINGENCIA` (si no → 409 `ESTADO_INVALIDO`). Sin cuerpo. Reenvía el mismo JSON (mismo `codigoGeneracion` y `numeroControl`; se conserva la firma) al MH simulado. Respeta `X-Simular`. Responde 200 con la respuesta de emisión.

- `ok` → `PROCESADO` con sello. `contingencia` → sigue en `CONTINGENCIA`. `rechazo` → `RECHAZADO` y se revierte el stock que se movió al quedar en contingencia.
- `timeout` → sigue en `CONTINGENCIA`, pero MH guarda el JSON enviado (en contingencia).
- Si MH **ya tenía** el documento (por un `timeout`), con `ok` o `rechazo` responde `PROCESADO` con el **sello original** (no lo duplica; `observaciones` lo indica) y el DTE vuelve al JSON y la firma que MH recibió. Igual en la transmisión de un lote de contingencia.

### POST /api/dte/:id/consultar → 200 (C3)

Cualquier rol. Consulta de DTE en MH ("¿recibiste este `codigoGeneracion`?"). Solo sobre DTE en `CONTINGENCIA` (si no → 409 `ESTADO_INVALIDO`; inexistente → 404). Sin cuerpo. `X-Simular` aplica a la consulta.

```json
{ "ok": true, "data": {
  "dteId": 21, "tipoDte": "01", "numeroControl": "DTE-01-M001P001-000000000000005", "codigoGeneracion": "F408...",
  "resultado": "ENCONTRADO", "estado": "PROCESADO", "selloRecibido": "2026HXPV...", "consultas": 1,
  "fecha": "2026-11-06T12:47:59", "origen": "MANUAL",
  "respuestaMh": { "version": 2, "ambiente": "00", "versionApp": 2, "estado": "PROCESADO", "codigoGeneracion": "F408...", "selloRecibido": "2026HXPV...", "fhProcesamiento": "06/11/2026 12:40:02", "clasificaMsg": "10", "codigoMsg": "001", "descripcionMsg": "DOCUMENTO ENCONTRADO: RECIBIDO Y PROCESADO", "observaciones": [] }
} }
```

- `ENCONTRADO` → MH sí lo había recibido: el DTE queda `PROCESADO` con el sello original y vuelve al JSON/firma que MH recibió (modelo previo, `tipoModelo 1`). El stock no cambia.
- `NO_ENCONTRADO` → `respuestaMh` con `estado: null`, `codigoMsg "004"` "DOCUMENTO NO ENCONTRADO": contingencia real; sigue en `CONTINGENCIA`.
- `SIN_RESPUESTA` (`X-Simular: contingencia|timeout`) → `respuestaMh: null`; sigue en `CONTINGENCIA`.
- Cada consulta suma `consultas` y actualiza la posición del DTE en la cola. Bitácora `CONSULTA_MH`.

### GET /api/dte?tipo=&estado=&desde=&hasta=&clienteId=

Filtros opcionales: `tipo` (`01|03|05`), `estado` (`PROCESADO|RECHAZADO|CONTINGENCIA|INVALIDADO`), `desde`/`hasta` (`YYYY-MM-DD`, inclusive), `clienteId`. Valor inválido → 400. Más reciente primero.

```json
{
  "ok": true,
  "data": [
    {
      "id": 15, "tipoDte": "01", "numeroControl": "DTE-01-M001P001-000000000000015",
      "codigoGeneracion": "A1B2C3D4-...", "selloRecibido": "2026A1B2...", "estado": "PROCESADO",
      "fechaEmision": "2026-11-04T15:30:00", "receptor": "Consumidor final", "clienteId": null, "total": 11.30,
      "dteRelacionadoId": null
    }
  ]
}
```

### GET /api/dte/:id

Respuesta de emisión (`firmador` y `respuestaMh` parseados) más:

| Campo | Contenido |
|---|---|
| `subtotal`, `iva`, `condicionOperacion`, `usuario` | Datos guardados del DTE (`usuario` = login de quien emitió) |
| `cliente` | `{ id, nombre, tipo }` o `null` |
| `jsonDte` | Documento completo |
| `items` | `[{ numItem, productoId, codigo, descripcion, cantidad, unidad, precioUni, descuento, ventaGravada, ivaItem }]`; en un 03 además `acreditada` y `pendiente` (para armar la NC). `ivaItem` siempre es número: en 01 el IVA incluido de la línea; en 03/05 el 13 % de `ventaGravada` (se guarda en `dte_detalle` aunque el JSON del CCF no lo lleve) |
| `dteRelacionadoId`, `dteRelacionado` | En una NC: `{ id, tipoDte, numeroControl, codigoGeneracion, estado }` del CCF; si no, `null` |
| `notasCredito` | En un 03: `[{ id, numeroControl, codigoGeneracion, estado, fechaEmision, total }]` (todas, cualquier estado); si no, `[]` |
| `invalidacion` | Último evento (procesado o rechazado): `{ id, codigoGeneracion, estado, tipoAnulacion, motivo, fecha, usuario, selloRecibido, jsonEvento, firmador, respuestaMh }` o `null` |
| `eventoContingencia` | Último evento de contingencia que incluyó al DTE: `{ id, codigoGeneracion, estado, selloRecibido, fecha }` o `null` (detalle en `GET /api/contingencia/:id`) |
| `consultaMh` | C3: `{ consultas, ultimaConsulta, resultado }` (`ENCONTRADO`/`NO_ENCONTRADO`/`SIN_RESPUESTA`) o `null` si nunca se consultó en MH |

```json
{
  "ok": true,
  "data": {
    "id": 15, "tipoDte": "01", "numeroControl": "...", "codigoGeneracion": "...", "selloRecibido": "...",
    "estado": "PROCESADO", "fechaEmision": "2026-11-04T15:30:00", "total": 9.16,
    "firmador": { "status": "OK", "body": "..." },
    "respuestaMh": { "...": "..." },
    "subtotal": 8.11, "iva": 1.05, "condicionOperacion": 1, "usuario": "admin", "cliente": null,
    "jsonDte": {
      "identificacion": { "version": 2, "ambiente": "00", "tipoDte": "01", "numeroControl": "...", "codigoGeneracion": "...", "tipoModelo": 1, "tipoOperacion": 1, "tipoContingencia": null, "motivoContin": null, "fecEmi": "2026-11-04", "horEmi": "15:30:00", "tipoMoneda": "USD" },
      "documentoRelacionado": null,
      "emisor": { "...": "..." },
      "receptor": null,
      "otrosDocumentos": null,
      "ventaTercero": null,
      "cuerpoDocumento": [ { "numItem": 1, "tipoItem": 1, "numeroDocumento": null, "cantidad": 2, "codigo": "P001", "codTributo": null, "uniMedida": 59, "descripcion": "Cuaderno universitario", "precioUni": 2.83, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 5.66, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 0.65 } ],
      "resumen": { "totalNoSuj": 0, "totalExenta": 0, "totalGravada": 9.16, "subTotalVentas": 9.16, "descuNoSuj": 0, "descuExenta": 0, "descuGravada": 0, "porcentajeDescuento": 0, "totalDescu": 0.50, "tributos": null, "subTotal": 9.16, "ivaRete": 0, "montoTotalOperacion": 9.16, "totalNoGravado": 0, "totalPagar": 9.16, "totalLetras": "NUEVE 16/100 USD", "totalIva": 1.05, "saldoFavor": 0, "condicionOperacion": 1, "pagos": [ { "codigo": "01", "montoPago": 9.16, "referencia": null, "plazo": null, "periodo": null } ], "numPagoElectronico": null, "observaciones": null },
      "apendice": null
    },
    "items": [ { "numItem": 1, "productoId": 1, "codigo": "P001", "descripcion": "Cuaderno universitario", "cantidad": 2, "unidad": 59, "precioUni": 2.83, "descuento": 0, "ventaGravada": 5.66, "ivaItem": 0.65 } ],
    "dteRelacionadoId": null, "dteRelacionado": null, "notasCredito": [],
    "invalidacion": null,
    "eventoContingencia": null
  }
}
```

### GET /api/dte/:id/pdf → 200 `application/pdf`

Representación gráfica del DTE (cualquier rol, cualquier estado). **No responde JSON**: el cuerpo es el PDF, con `Content-Disposition: attachment; filename="<numeroControl>.pdf"`. Se arma con el `jsonDte` guardado: encabezado y título por tipo (FACTURA / COMPROBANTE DE CRÉDITO FISCAL / NOTA DE CRÉDITO), código de generación, número de control, sello (o `Sin sello (<estado>)`), QR a la consulta pública de MH, modelo/tipo de transmisión, EMISOR/RECEPTOR (`CONSUMIDOR FINAL` si no hay receptor), ítems, totales (01: IVA incluido; 03/05: IVA 13 %), valor en letras, condición y observaciones (documento relacionado en la NC). Si el DTE no está `PROCESADO` lleva un sello de agua con el estado. Errores con el formato JSON estándar (401, 404 `NO_ENCONTRADO`).

---

## Contingencia

Evento de contingencia según `schemas-mh/contingencia-schema-v4.json`. Cuando MH vuelve a estar disponible se le reporta qué DTE se emitieron en contingencia; si acepta el evento, se transmiten esos DTE en un **lote** (recepción por lote simulada).

**Lote** = evento de contingencia + recepción por lote de sus DTE. Se crea de dos formas:
- **Manual**: `POST /api/contingencia` (sin `dteIds` toma todos los DTE en `CONTINGENCIA` en ese momento) → `origen: "MANUAL"`.
- **Automático (cierre del día)**: el servidor lo corre todos los días a la hora configurada (`GET/PUT /api/contingencia/programacion`) con todos los DTE en `CONTINGENCIA`, firmado por el primer ADMIN activo, motivo fijo y MH simulado en `ok` → `origen: "AUTOMATICO"`. Si no hay pendientes no crea evento.

### POST /api/contingencia → 201 (solo ADMIN)

```json
{ "dteIds": [21, 22], "motivo": "El servicio de recepción de MH no respondió" }
```

- `dteIds` opcional (1–1000 ids, sin repetir): todos deben estar en `CONTINGENCIA` (otro estado → 409 `ESTADO_INVALIDO`; inexistente → 404). Sin `dteIds` → todos los DTE en `CONTINGENCIA` (los 1000 más antiguos); si no hay ninguno → 409 `ESTADO_INVALIDO`.
- `motivo` opcional (máx. 500) → `motivo.motivoContingencia` (o `null`). `tipoContingencia` siempre 1 (MH no disponible: la única que produce el simulador).
- Responsable = usuario del token (`tipoDocResponsable "13"`, `numeroDocResponsable "000000000"`). `fInicio/hInicio` = emisión del DTE más antiguo del evento; `fFin/hFin` y `fTransmision/hTransmision` = envío del evento.
- `X-Simular` aplica al evento:
  - `ok` → evento `PROCESADO` con sello propio; los DTE se envían en un lote (`lote.jsonLote = { ambiente, idEnvio, version: 2, nitEmisor, documentos: [JWS de cada DTE] }`, MH responde `RECIBIDO` con `codigoLote`) y cada DTE (mismo JSON y firma) queda `PROCESADO` con su sello (en bitácora, un `REINTENTO` por DTE con `codigoGeneracionEvento`).
  - `rechazo` → evento `RECHAZADO` sin sello (se guarda, respuesta `ok:true`); no se envía lote (`codigoLote: null`, `lote: null`); los DTE siguen en `CONTINGENCIA`.
  - `contingencia` → MH sigue sin responder: 503 `MH_NO_DISPONIBLE`; no se guarda el evento (sí queda en bitácora con resultado `SIN_RESPUESTA`).
- `POST /api/dte/:id/reintentar` sigue disponible para transmitir un DTE suelto.

```json
{
  "ok": true,
  "data": {
    "id": 3, "codigoGeneracion": "9C1D...", "estado": "PROCESADO", "selloRecibido": "2026K3J4...",
    "fecha": "2026-11-05T10:41:31", "fInicio": "2026-11-05T10:12:08", "fFin": "2026-11-05T10:41:31",
    "tipoContingencia": 1, "motivo": "El servicio de recepción de MH no respondió", "usuario": "admin",
    "origen": "MANUAL", "codigoLote": "5E0A...", "cantidad": 2,
    "dtes": [
      { "id": 21, "tipoDte": "01", "numeroControl": "DTE-01-M001P001-000000000000005", "codigoGeneracion": "F408...", "estado": "PROCESADO", "selloRecibido": "2026HXPV...", "fechaEmision": "2026-11-05T10:12:08", "total": 0.51 },
      { "id": 22, "tipoDte": "03", "numeroControl": "DTE-03-M001P001-000000000000003", "codigoGeneracion": "7B2A...", "estado": "PROCESADO", "selloRecibido": "2026Q9W1...", "fechaEmision": "2026-11-05T10:15:40", "total": 2.49 }
    ],
    "jsonEvento": {
      "identificacion": { "version": 4, "ambiente": "00", "codigoGeneracion": "9C1D...", "fTransmision": "2026-11-05", "hTransmision": "10:41:31" },
      "emisor": {
        "nit": "06140101001010", "nombre": "Batallón Atlacatl, S.A. de C.V.", "nombreResponsable": "Administrador",
        "tipoDocResponsable": "13", "numeroDocResponsable": "000000000", "tipoEstablecimiento": "02",
        "codEstableMH": "M001", "codPuntoVentaMH": "P001", "telefono": "22220000", "correo": "facturas@atlacatl.com.sv"
      },
      "detalleDTE": [
        { "noItem": 1, "tipoDoc": "01", "codigoGeneracion": "F408..." },
        { "noItem": 2, "tipoDoc": "03", "codigoGeneracion": "7B2A..." }
      ],
      "motivo": { "fInicio": "2026-11-05", "fFin": "2026-11-05", "hInicio": "10:12:08", "hFin": "10:41:31", "tipoContingencia": 1, "motivoContingencia": "El servicio de recepción de MH no respondió" }
    },
    "firmador": { "status": "OK", "body": "..." },
    "respuestaMh": { "version": 2, "ambiente": "00", "versionApp": 2, "estado": "PROCESADO", "codigoGeneracion": "9C1D...", "selloRecibido": "2026K3J4...", "fhProcesamiento": "05/11/2026 10:41:31", "clasificaMsg": "10", "codigoMsg": "001", "descripcionMsg": "EVENTO DE CONTINGENCIA RECIBIDO", "observaciones": [] },
    "lote": {
      "codigoLote": "5E0A...", "idEnvio": "C77D...", "procesados": 2, "rechazados": 0,
      "jsonLote": { "ambiente": "00", "idEnvio": "C77D...", "version": 2, "nitEmisor": "06140101001010", "documentos": ["eyJhbGci...", "eyJhbGci..."] },
      "respuestaMh": { "version": 2, "ambiente": "00", "versionApp": 2, "estado": "RECIBIDO", "idEnvio": "C77D...", "fhProcesamiento": "05/11/2026 10:41:31", "codigoLote": "5E0A...", "codigoMsg": "001", "descripcionMsg": "LOTE RECIBIDO, VALIDADO PROCESAMIENTO EN COLA (SIMULADO)" }
    }
  }
}
```

En `dtes`, `estado`/`selloRecibido` son los que quedaron tras la transmisión (en un evento rechazado: `CONTINGENCIA`, `null`).

### GET /api/contingencia

Cualquier rol. Eventos guardados (procesados y rechazados), más reciente primero: `[{ id, codigoGeneracion, estado, selloRecibido, fecha, fInicio, fFin, tipoContingencia, motivo, usuario, origen, codigoLote, cantidad }]`.

### GET /api/contingencia/:id

Cualquier rol. Lo mismo que la respuesta de `POST` (`dtes` con el estado **actual** de cada DTE, `jsonEvento`, `firmador`, `respuestaMh`, `lote`). Inexistente → 404.

### GET /api/contingencia/programacion

Cualquier rol. Lote automático del cierre del día:

```json
{ "ok": true, "data": {
  "activo": true, "hora": "23:55", "proximaEjecucion": "2026-11-06T23:55:00", "pendientes": 3,
  "ultimaEjecucion": { "fecha": "2026-11-05T23:55:00", "resultado": "PROCESADO", "eventoId": 7, "codigoLote": "5E0A...", "cantidad": 4, "mensaje": "Lote enviado: 4 de 4 DTE transmitidos y sellados" }
} }
```

- `proximaEjecucion` = `null` si está desactivado. `pendientes` = DTE en `CONTINGENCIA` ahora.
- `ultimaEjecucion` (solo del automático; `null` si no ha corrido desde que arrancó el servidor). `resultado`: `PROCESADO` | `RECHAZADO` | `SIN_PENDIENTES` (no había DTE; no crea evento) | `SIN_RESPUESTA` | `ERROR`.
- Valor inicial desde `backend/.env`: `CONTINGENCIA_LOTE_HORA` (defecto `23:55`), `CONTINGENCIA_LOTE_ACTIVO` (defecto `1`). Los cambios por `PUT` viven en memoria (se pierden al reiniciar el servidor). Hora local del servidor.

### PUT /api/contingencia/programacion → 200 (solo ADMIN)

`{ "activo": true, "hora": "21:30" }` (al menos uno). `activo` booleano; `hora` `HH:mm` 00:00–23:59; si no → 400 `VALIDACION`. Reprograma el temporizador y responde igual que el `GET`. Bitácora `ACTUALIZAR` (`entidad: "programacion_contingencia"`, `datos: { antes, cambios }`).

### GET /api/contingencia/consultas (C3)

Cualquier rol. Cola de consultas a MH: durante el día, cada `intervaloSeg` segundos se consulta **un solo** DTE en `CONTINGENCIA` (como `POST /api/dte/:id/consultar`, con MH en `ok` y firmado por el primer ADMIN activo) para no saturar el servicio. Orden round-robin: primero los nunca consultados, luego el de consulta más antigua; a igualdad, por id. Los que MH tenía salen de la cola (`PROCESADO`); los demás los reporta el lote de contingencia.

```json
{ "ok": true, "data": {
  "activo": true, "intervaloSeg": 60, "proximaConsulta": "2026-11-06T12:48:59",
  "ultimaConsulta": { "dteId": 22, "tipoDte": "01", "numeroControl": "...", "codigoGeneracion": "...", "resultado": "NO_ENCONTRADO", "estado": "CONTINGENCIA", "selloRecibido": null, "consultas": 2, "fecha": "2026-11-06T12:47:59", "origen": "AUTOMATICO" },
  "cola": [ { "posicion": 1, "id": 23, "tipoDte": "03", "numeroControl": "...", "consultas": 0, "ultimaConsulta": null, "resultado": null } ]
} }
```

- `proximaConsulta` = `null` si está desactivada o el temporizador no corre. `ultimaConsulta` = último turno automático (`null` si aún no hubo; `resultado: "ERROR"` con `mensaje` si falló).
- Valor inicial desde `backend/.env`: `CONSULTA_MH_ACTIVO` (defecto `1`), `CONSULTA_MH_INTERVALO_SEG` (defecto `60`). Los cambios por `PUT` viven en memoria.

### PUT /api/contingencia/consultas → 200 (solo ADMIN)

`{ "activo": true, "intervaloSeg": 30 }` (al menos uno). `activo` booleano; `intervaloSeg` entero 10–3600; si no → 400 `VALIDACION`. Reprograma el temporizador y responde igual que el `GET`. Bitácora `ACTUALIZAR` (`entidad: "consultas_mh"`).

---

## Bitácora

### GET /api/bitacora?accion=&entidad=&dteId=&usuario=&desde=&hasta=&limite=

Cualquier rol autenticado. Más reciente primero; `limite` 1–1000 (defecto 200). `desde`/`hasta` `YYYY-MM-DD` inclusive; `usuario` = login.

```json
{
  "ok": true,
  "data": [
    {
      "id": 40, "fecha": "2026-11-04T15:30:01", "usuario": "admin", "accion": "EMISION",
      "entidad": "dte", "entidadId": 15, "dteId": 15, "codigoGeneracion": "A1B2C3D4-...", "resultado": "PROCESADO",
      "detalle": "DTE-01 enviado a MH (simulado): RECIBIDO",
      "datos": { "tipoDte": "01", "numeroControl": "...", "codigoGeneracion": "...", "resultado": "PROCESADO", "firmador": "OK", "mensaje": "..." }
    }
  ]
}
```

`detalle` = mensaje legible; `datos` = detalle completo registrado (objeto, o texto si no era JSON). `dteId`/`codigoGeneracion` solo en entradas de `entidad: "dte"`. `resultado`: estado devuelto por MH (`PROCESADO`, `RECHAZADO`, `CONTINGENCIA`) o `SIN_RESPUESTA` (invalidación o evento de contingencia sin respuesta de MH).

Forma de `datos` según la acción: `EMISION` → `{ tipoDte, numeroControl, codigoGeneracion, resultado, firmador, mensaje }`; `REINTENTO` → igual sin `firmador` (más `codigoGeneracionEvento` si lo transmitió un evento de contingencia); `INVALIDACION` → `{ tipoDte, numeroControl, codigoGeneracion, codigoGeneracionEvento, resultado, mensaje }`; `CONTINGENCIA` (`entidad: "evento_contingencia"`, `entidadId` = id del evento o `null` si MH no respondió) → `{ codigoGeneracionEvento, origen, cantidad, dteIds, resultado, mensaje }` (el lote automático sin pendientes registra `{ origen: "AUTOMATICO", resultado: "SIN_PENDIENTES", ... }`); `CREAR` → el registro creado; `ACTUALIZAR` → `{ antes, cambios }`; `LOGIN_FALLIDO` → `{ usuario }`; `LOGIN` → `null`.

`accion`: `LOGIN`, `LOGIN_FALLIDO`, `CREAR`, `ACTUALIZAR`, `EMISION`, `REINTENTO`, `INVALIDACION`, `CONTINGENCIA`, `CONSULTA_MH`. `entidad`: `usuario`, `producto`, `cliente`, `dte`, `evento_contingencia`, `programacion_contingencia`, `consultas_mh`.

`CONSULTA_MH` (`entidad: "dte"`) → `{ tipoDte, numeroControl, codigoGeneracion, origen, resultado, mensaje }`; `resultado` = `PROCESADO` (MH lo tenía), `NO_ENCONTRADO` o `SIN_RESPUESTA`. Las consultas manuales siempre se registran; las automáticas solo cuando encuentran el DTE (los turnos sin novedad solo actualizan `consultaMh` del DTE).
