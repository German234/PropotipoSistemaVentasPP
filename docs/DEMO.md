# Guion de demo (5 minutos)

Recorrido completo del ciclo de vida de un DTE en el POS: Factura 01 → CCF 03 → Nota de crédito 05 → anulación bloqueada → anulación → contingencia → reintento → bitácora.

Los números de control y montos de abajo salen **con la BD recién reiniciada**. Si ya hubo ventas, el correlativo final de cada número de control será otro; los montos no cambian.

## Antes de empezar (no cuenta en los 5 minutos)

1. Reiniciar los datos: `sqlcmd -S localhost -E -C -f 65001 -i db/03_reset_demo.sql`
2. Levantar la API: `cd backend && npm start`
3. Abrir **http://localhost:3000** en el navegador (zoom ~110 % si se proyecta).
4. Tener a mano: usuario `admin` / `admin123`.

---

## 1. Login — 0:00 a 0:30

1. Ingresar `admin` / `admin123` → **Ingresar**.
2. Señalar el menú: *Nueva venta, Inventario, Clientes, Transacciones* y, por ser ADMIN, *Panel gerencial* y *Administración*.

> **Decir:** "La API usa JWT con dos roles. Un VENDEDOR no ve Administración ni el simulador de MH, y la API le niega crear productos (403)."

## 2. Factura 01 (consumidor final) — 0:30 a 1:15

1. **Nueva venta** → tipo **Factura 01**. Cliente: dejar *Consumidor final (sin receptor)*.
2. En *Buscar en catálogo* escribir `lapicero` → elegir **Lapicero azul** y con **+** dejar la cantidad en **3**.
3. Señalar los totales: precio unitario **con IVA $0.40**, total **$1.20**, *IVA incluido* **$0.14**.
4. Comprobar que **Simular MH** esté en **OK** → **✓ Confirmar venta**.

**Resultado:** modal **PROCESADO**.
- Número de control `DTE-01-M001P001-000000000000001`
- Código de generación (UUID en mayúsculas) y **sello recibido** de 40 caracteres
- Total en letras **UNO 20/100 USD**
- Pestaña **JSON DTE**: `identificacion`, `emisor`, `receptor: null`, `cuerpoDocumento`, `resumen`
- Pestaña **Respuesta firmador / MH**: JWS simulado y respuesta de recepción

Cerrar con **Listo**.

## 3. CCF 03 a un contribuyente — 1:15 a 2:00

1. Tipo **CCF 03**. La lista de clientes ahora solo muestra contribuyentes: elegir **Distribuidora El Roble, S.A. de C.V.** (se ven su NIT, NRC y actividad).
2. Agregar **Mochila escolar** × **2**.
3. Totales desglosados: subtotal **$44.00** + IVA 13 % **$5.72** = **$49.72**.
4. **✓ Confirmar venta**.

**Resultado:** **PROCESADO**, `DTE-03-M001P001-000000000000001`, **CUARENTA Y NUEVE 72/100 USD**.
En el JSON, `resumen.tributos = [{ codigo: "20", descripcion: "Impuesto al Valor Agregado 13%", valor: 5.72 }]` y precios **sin IVA**.

> **Decir:** "La 01 lleva el IVA incluido en el precio; el CCF lo desglosa en `tributos`. Hay un correlativo por tipo de DTE, por eso los dos son el 001."

## 4. Nota de crédito 05 sobre ese CCF — 2:00 a 2:45

1. **Transacciones**. Las filas muestran el estado: *Aceptado* = PROCESADO.
2. En la fila del CCF → **Nota de crédito**.
3. El formulario trae las líneas del CCF: Mochila, cantidad 2, pendiente 2. En **A acreditar** poner **1** → estimado $22.00 + $2.86 = **$24.86**.
4. **Emitir nota de crédito**.

**Resultado:** **PROCESADO**, `DTE-05-M001P001-000000000000001`, **VEINTICUATRO 86/100 USD**. En el detalle aparece *CCF relacionado*, y en el JSON:
`documentoRelacionado = [{ tipoDocumento: "03", tipoGeneracion: 2, numeroDocumento: <codigoGeneracion del CCF>, … }]`.

> **Decir:** "Solo se acredita un 03 PROCESADO, con el mismo receptor y hasta lo pendiente. La mochila regresa al inventario."

## 5. Intentar anular el CCF → bloqueado — 2:45 a 3:05

1. Cerrar el modal. En la fila del CCF → **Anular**.
2. Motivo: `Error en la información del documento` → **Anular documento**.

**Resultado:** alerta de error *"El CCF tiene notas de crédito vigentes (DTE-05-M001P001-000000000000001); invalídelas primero"*. El CCF sigue *Aceptado*.

## 6. Anular la factura — 3:05 a 3:35

1. Cancelar. En la fila de la **Factura 01** → **Anular**.
2. Motivo: `Error en la información del documento` → **Anular documento**.

**Resultado:** el modal pasa a **INVALIDADO**. El detalle muestra *Invalidación* con el sello del evento. La pestaña *Respuesta firmador / MH* incluye `eventoInvalidacion` (JSON del evento v3, firma y respuesta de MH). La fila queda **Anulado** y los 3 lapiceros regresan al stock.

## 7. Emitir en contingencia — 3:35 a 4:05

1. **Nueva venta** → **Factura 01**, consumidor final, **Marcador permanente negro** × **2** (total **$2.48**).
2. **Simular MH → Contingencia** → **✓ Confirmar venta**.

**Resultado:** **CONTINGENCIA**, *sin sello*, `respuestaMh: null`. El modal ofrece **Reintentar envío**.

> **Decir:** "MH no respondió: el documento queda emitido y con número de control, y el stock se descuenta porque la venta sí ocurrió. Queda pendiente de transmitir."

3. Volver a poner **Simular MH → OK**.

## 8. Reintentar — 4:05 a 4:30

1. **Transacciones** → filtro de estado **Contingencia** (aparece solo esa factura).
2. Revisar que el *Simular MH* de esta pantalla esté en **OK** → **Reintentar envío**.

**Resultado:** **PROCESADO** con sello, y el **mismo** código de generación y número de control (`DTE-01-M001P001-000000000000002`). Quitar el filtro: la fila aparece *Aceptado*.

## 9. Bitácora — 4:30 a 5:00

1. Menú **Administración** → **Bitácora**.
2. Recorrer los eventos: `LOGIN`, `EMISION` (con resultado PROCESADO o CONTINGENCIA), `INVALIDACION`, `REINTENTO`.
3. Filtrar *Acción → Invalidación*. Opcional: **⬇ CSV** descarga lo filtrado.

> **Cierre:** "Cada emisión, reintento, invalidación y cambio de catálogo queda auditado con el usuario, el resultado de MH y el detalle."

---

## Si sobra tiempo o hay preguntas

- **Rechazo de MH:** Simular MH → *Rechazo* en una venta → estado **RECHAZADO**, sin sello, con observaciones; el stock **no** se descuenta.
- **Validaciones:** un CCF sin cliente no se envía; un cliente CONTRIBUYENTE sin NIT/NRC/actividad lo rechaza la API; el carrito no deja pasar del stock.
- **Rol VENDEDOR:** cerrar sesión y entrar con `vendedor` / `vendedor123`: no aparecen Administración, el simulador ni la edición de productos.
- **MH caído al anular:** Simular MH → *Contingencia* en Transacciones y Anular → error 503 (no existe contingencia para eventos de invalidación).
- **Evento de contingencia (en vez del paso 8):** emitir 2 ventas con *Simular MH → Contingencia* (el JSON del DTE muestra `tipoModelo: 2`, `tipoOperacion: 2`, `tipoContingencia: 1`). **Contingencia** (menú lateral): aparecen los 2 DTE en la cola; escribir un motivo y **📦 Enviar lote ahora (2 DTE)**. Resultado: lote **Manual**, evento **PROCESADO** con sello propio (JSON v4 con `detalleDTE`), código de lote (la pestaña *Respuesta firmador / MH* muestra `lote.jsonLote` y la respuesta `RECIBIDO`) y los 2 DTE **Aceptado** con su sello. **Cola de consultas a MH:** emitir una venta con *Simular MH → Timeout* (MH la recibió pero la respuesta se perdió) y otra con *Contingencia*. En **Contingencia** ambas aparecen en la cola; en su turno (o con **Consultar**) la de *Timeout* queda **Aceptado** con su sello original y el JSON vuelve a `tipoModelo: 1`, y la de *Contingencia* muestra *No está en MH* y sigue esperando el lote (para verlo rápido, poner la cola en 10 s). **Lote automático:** en la misma pantalla poner la *Hora del cierre* 1–2 minutos adelante → **Guardar**, emitir otra venta en contingencia y esperar: a esa hora aparece un lote **⏰ Automático** (pulsar ↻ Actualizar). Con *Simular MH → Rechazo* el evento queda RECHAZADO y los DTE siguen pendientes; con *Contingencia*, error 503 y no se guarda nada.

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| "No se pudo conectar con la API" | La API no está corriendo: `cd backend && npm start` |
| Los números de control no empiezan en 001 | No se reinició la BD; seguir igual (solo cambia el correlativo) o correr `db/03_reset_demo.sql` |
| "Stock insuficiente" | Correr `db/03_reset_demo.sql` antes de la demo |
| La sesión expira | Volver a iniciar sesión (el token dura 8 h) |
