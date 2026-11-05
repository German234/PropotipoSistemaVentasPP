/**
 * Ciclo de vida de los DTE (escrituras). Cada operación es UNA transacción.
 *
 * emitir (01/03) y emitirNotaCredito (05) comparten enviarYGuardar():
 *   correlativo (UPDLOCK) → JSON → firmador → MH simulado → INSERT dte + dte_detalle
 *   → stock (01/03 descuenta, 05 devuelve) solo si PROCESADO / CONTINGENCIA → bitácora EMISION.
 * Un RECHAZADO también se guarda (y consume correlativo) pero no toca el stock.
 *
 * reintentar: CONTINGENCIA → reenvía el mismo JSON; si ahora es RECHAZADO revierte el stock.
 * invalidar:  PROCESADO (y 03 sin NC vigente) → evento firmado → MH; si PROCESADO, DTE INVALIDADO y revierte el stock.
 */
const crypto = require('crypto');
const { withTransaction } = require('../config/db');
const { AppError } = require('../utils/respuesta');
const { registrar } = require('../utils/bitacora');
const { redondear2 } = require('../utils/dinero');
const v = require('../utils/validar');
const emisorService = require('./emisorService');
const calculos = require('../dte/calculos');
const { siguienteNumeroControl } = require('../dte/correlativo');
const factura01 = require('../dte/builders/factura01');
const ccf03 = require('../dte/builders/ccf03');
const notaCredito05 = require('../dte/builders/notaCredito05');
const invalidacion = require('../dte/builders/invalidacion');
const firmador = require('../dte/simuladores/firmador');
const mh = require('../dte/simuladores/mhRecepcion');
const mhAnulacion = require('../dte/simuladores/mhAnulacion');

const TIPOS = {
  '01': { calcular: calculos.calcularFactura, builder: factura01 },
  '03': { calcular: calculos.calcularCcf, builder: ccf03 },
};
const UUID = /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/;
const nuevoCodigo = () => crypto.randomUUID().toUpperCase();
const estadoConStock = (estado) => estado === 'PROCESADO' || estado === 'CONTINGENCIA';
/** Signo del movimiento de stock al emitir: 01/03 salen (-1), 05 regresa (+1). Revertir = el contrario. */
const signoEmision = (tipo) => (tipo === '05' ? 1 : -1);

const dos = (n) => String(n).padStart(2, '0');
/** Fecha/hora local → { fecEmi: 'YYYY-MM-DD', horEmi: 'HH:mm:ss', fechaEmision: 'YYYY-MM-DDTHH:mm:ss' } */
function marcaTiempo(d = new Date()) {
  const fecEmi = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  const horEmi = `${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
  return { fecEmi, horEmi, fechaEmision: `${fecEmi}T${horEmi}` };
}

/** DATETIME2 leído por mssql (llega como UTC) → 'YYYY-MM-DDTHH:mm:ss' tal como se guardó. */
const fechaIso = (d) => (d ? new Date(d).toISOString().slice(0, 19) : null);
const parse = (txt) => (txt ? JSON.parse(txt) : null);

/** Forma de la "respuesta de emisión" del contrato (docs/API.md). */
function respuestaEmision({ id, tipoDte, numeroControl, codigoGeneracion, selloRecibido, estado, fechaEmision, total, firmador: f, respuestaMh }) {
  return { id, tipoDte, numeroControl, codigoGeneracion, selloRecibido, estado, fechaEmision, total, firmador: f, respuestaMh };
}

/** items[] → [{ productoId, cantidad, descuento }] sumando productos repetidos. */
function validarItems(items, conDescuento) {
  if (!Array.isArray(items) || items.length === 0) v.falla('items debe ser una lista con al menos un producto');
  if (items.length > 2000) v.falla('items admite máximo 2000 líneas');
  const porProducto = new Map();
  items.forEach((it, i) => {
    const productoId = v.entero(it?.productoId, `items[${i}].productoId`, 1);
    const cantidad = v.entero(it?.cantidad, `items[${i}].cantidad`, 1);
    const descuento = conDescuento && it?.descuento != null ? v.dinero(it.descuento, `items[${i}].descuento`, 0) : 0;
    const previo = porProducto.get(productoId);
    if (previo) {
      previo.cantidad += cantidad;
      previo.descuento = redondear2(previo.descuento + descuento);
    } else porProducto.set(productoId, { productoId, cantidad, descuento });
  });
  return [...porProducto.values()];
}

/** Cuerpo de 01/03: { clienteId, condicionOperacion, items[] }. */
function validarPayload(tipo, body) {
  const b = body || {};
  const condicionOperacion = b.condicionOperacion == null ? 1 : v.entero(b.condicionOperacion, 'condicionOperacion', 1);
  if (![1, 2, 3].includes(condicionOperacion)) v.falla('condicionOperacion debe ser 1 (contado), 2 (crédito) o 3 (otro)');
  let clienteId = null;
  if (b.clienteId != null && b.clienteId !== '') clienteId = v.entero(b.clienteId, 'clienteId', 1);
  if (tipo === '03' && !clienteId) v.falla('clienteId es obligatorio para el CCF (03)');
  return { clienteId, condicionOperacion, items: validarItems(b.items, true) };
}

/** Cliente dentro de la transacción. 03: CONTRIBUYENTE con NIT, NRC y actividad. */
async function cargarCliente(q, tipo, clienteId) {
  if (!clienteId) return null;
  const r = await q(
    `SELECT id, tipo, nombre, nit, nrc, cod_actividad AS codActividad, desc_actividad AS descActividad,
            direccion, correo, activo
     FROM dbo.clientes WHERE id = @id`,
    { id: clienteId }
  );
  const c = r.recordset[0];
  if (!c) throw new AppError('NO_ENCONTRADO', `Cliente ${clienteId} no existe`, 404);
  if (!c.activo) v.falla(`El cliente ${c.nombre} está inactivo`);
  if (tipo === '03') {
    if (c.tipo !== 'CONTRIBUYENTE') v.falla('El cliente debe ser CONTRIBUYENTE para emitir un CCF (03)');
    if (!c.nit || !c.nrc || !c.codActividad || !c.descActividad) {
      v.falla('El cliente CONTRIBUYENTE debe tener NIT, NRC y actividad económica');
    }
  }
  return c;
}

/** Productos bloqueados (UPDLOCK) hasta el commit; valida existencia, activo y stock. */
async function cargarProductos(q, items) {
  const params = {};
  const marcas = items.map((it, i) => { params[`p${i}`] = it.productoId; return `@p${i}`; });
  const r = await q(
    `SELECT id, codigo, descripcion, precio, stock, unidad, activo
     FROM dbo.productos WITH (UPDLOCK, ROWLOCK)
     WHERE id IN (${marcas.join(', ')})`,
    params
  );
  const porId = new Map(r.recordset.map((p) => [p.id, p]));
  return items.map((it) => {
    const p = porId.get(it.productoId);
    if (!p) throw new AppError('NO_ENCONTRADO', `Producto ${it.productoId} no existe`, 404);
    if (!p.activo) v.falla(`El producto ${p.codigo} está inactivo`);
    if (p.stock < it.cantidad) {
      throw new AppError('STOCK_INSUFICIENTE', `Stock insuficiente para ${p.codigo}: disponible ${p.stock}, solicitado ${it.cantidad}`, 409);
    }
    return { producto: { ...p, precio: Number(p.precio) }, cantidad: it.cantidad, descuento: it.descuento };
  });
}

/**
 * Mueve stock: signo -1 saca, +1 devuelve. items = [{ productoId, cantidad, codigo? }].
 * Si una salida dejaría el stock negativo → 409 STOCK_INSUFICIENTE (y rollback).
 */
async function ajustarStock(q, items, signo) {
  for (const it of items) {
    const r = await q(
      `UPDATE dbo.productos SET stock = stock + @delta WHERE id = @id AND stock + @delta >= 0`,
      { id: it.productoId, delta: signo * it.cantidad }
    );
    if (r.rowsAffected[0] === 0) {
      throw new AppError('STOCK_INSUFICIENTE', `No hay stock suficiente de ${it.codigo || 'producto ' + it.productoId} para revertir el movimiento (${it.cantidad})`, 409);
    }
  }
}

/** Líneas de un DTE como movimientos de stock. */
async function lineasStock(q, dteId) {
  const r = await q(`SELECT producto_id AS productoId, codigo, cantidad FROM dbo.dte_detalle WHERE dte_id = @id`, { id: dteId });
  return r.recordset;
}

/** DTE bloqueado (UPDLOCK) para cambiar su estado sin carreras. 404 si no existe. */
async function cargarDteBloqueado(q, id) {
  const r = await q(
    `SELECT id, tipo_dte AS tipoDte, codigo_generacion AS codigoGeneracion, numero_control AS numeroControl,
            cliente_id AS clienteId, estado, sello_recibido AS selloRecibido, condicion_operacion AS condicionOperacion,
            fecha_emision AS fechaEmision, total, json_dte AS jsonDte, firma
     FROM dbo.dte WITH (UPDLOCK, ROWLOCK) WHERE id = @id`,
    { id }
  );
  const d = r.recordset[0];
  if (!d) throw new AppError('NO_ENCONTRADO', `DTE ${id} no existe`, 404);
  return d;
}

/**
 * Por producto del CCF: cantidad y venta gravada originales y lo ya acreditado por NC vigentes
 * (05 en PROCESADO o CONTINGENCIA). `q` puede ser el de una transacción o db.query.
 */
async function pendientesAcreditar(q, ccfId) {
  const r = await q(
    `SELECT d.producto_id AS productoId, d.codigo, d.descripcion, d.unidad, d.cantidad,
            d.precio_unitario AS precioUnitario, d.venta_gravada AS ventaGravada,
            ISNULL(nc.cantidad, 0) AS acreditada, ISNULL(nc.gravada, 0) AS gravadaAcreditada
     FROM dbo.dte_detalle d
     LEFT JOIN (
        SELECT nd.producto_id, SUM(nd.cantidad) AS cantidad, SUM(nd.venta_gravada) AS gravada
        FROM dbo.dte_detalle nd
        JOIN dbo.dte n ON n.id = nd.dte_id
        WHERE n.dte_relacionado_id = @id AND n.tipo_dte = '05' AND n.estado IN ('PROCESADO', 'CONTINGENCIA')
        GROUP BY nd.producto_id
     ) nc ON nc.producto_id = d.producto_id
     WHERE d.dte_id = @id
     ORDER BY d.num_item`,
    { id: ccfId }
  );
  return r.recordset.map((l) => ({
    ...l,
    precioUnitario: Number(l.precioUnitario),
    ventaGravada: Number(l.ventaGravada),
    gravadaAcreditada: Number(l.gravadaAcreditada),
    pendiente: l.cantidad - l.acreditada,
  }));
}

/**
 * Parte común de la emisión: número de control, JSON, firma, MH, persistencia, stock y bitácora.
 * @param {object} p { tipo, tx, q, emisor, usuario, modo, clienteId, condicionOperacion, calculo,
 *                     dteRelacionadoId, construir(ctx) → jsonDte }
 */
async function enviarYGuardar({ tipo, tx, q, emisor, usuario, modo, clienteId, condicionOperacion, calculo, dteRelacionadoId = null, construir }) {
  const codigoGeneracion = nuevoCodigo();
  const numeroControl = await siguienteNumeroControl(tipo, tx, emisor);
  const { fecEmi, horEmi, fechaEmision } = marcaTiempo();
  const jsonDte = construir({ numeroControl, codigoGeneracion, fecEmi, horEmi });

  const firma = firmador.firmar(jsonDte, modo);
  const respuestaMh = mh.recibir({ codigoGeneracion }, modo);
  const estado = respuestaMh ? respuestaMh.estado : 'CONTINGENCIA';
  const selloRecibido = respuestaMh ? respuestaMh.selloRecibido : null;

  const ins = await q(
    `INSERT INTO dbo.dte (tipo_dte, codigo_generacion, numero_control, cliente_id, usuario_id, dte_relacionado_id,
                          condicion_operacion, fecha_emision, subtotal, iva, total, estado, sello_recibido,
                          json_dte, firma, respuesta_mh)
     OUTPUT inserted.id
     VALUES (@tipo, @codigoGeneracion, @numeroControl, @clienteId, @usuarioId, @dteRelacionadoId,
             @condicion, @fechaEmision, @subtotal, @iva, @total, @estado, @sello, @jsonDte, @firma, @respuestaMh)`,
    {
      tipo, codigoGeneracion, numeroControl, clienteId, usuarioId: usuario.id, dteRelacionadoId,
      condicion: condicionOperacion, fechaEmision,
      subtotal: calculo.totales.subtotal, iva: calculo.totales.iva, total: calculo.totales.total,
      estado, sello: selloRecibido,
      jsonDte: JSON.stringify(jsonDte), firma: JSON.stringify(firma),
      respuestaMh: respuestaMh ? JSON.stringify(respuestaMh) : null,
    }
  );
  const dteId = ins.recordset[0].id;

  for (const it of calculo.items) {
    await q(
      `INSERT INTO dbo.dte_detalle (dte_id, num_item, producto_id, codigo, descripcion, cantidad, unidad,
                                    precio_unitario, descuento, venta_gravada, iva_item)
       VALUES (@dteId, @numItem, @productoId, @codigo, @descripcion, @cantidad, @unidad,
               @precio, @descuento, @ventaGravada, @ivaItem)`,
      {
        dteId, numItem: it.numItem, productoId: it.producto.id, codigo: it.producto.codigo,
        descripcion: it.producto.descripcion, cantidad: it.cantidad, unidad: it.producto.unidad,
        precio: it.precioUni, descuento: it.montoDescu, ventaGravada: it.ventaGravada, ivaItem: it.ivaItem,
      }
    );
  }

  if (estadoConStock(estado)) {
    const movs = calculo.items.map((it) => ({ productoId: it.producto.id, codigo: it.producto.codigo, cantidad: it.cantidad }));
    await ajustarStock(q, movs, signoEmision(tipo));
  }

  await registrar(usuario.id, 'EMISION', 'dte', dteId, {
    tipoDte: tipo, numeroControl, codigoGeneracion, resultado: estado, firmador: firma.status,
    mensaje: respuestaMh
      ? `DTE-${tipo} enviado a MH (simulado): ${respuestaMh.descripcionMsg}`
      : `DTE-${tipo} en contingencia: MH no respondió (simulado)`,
  }, q);

  return respuestaEmision({
    id: dteId, tipoDte: tipo, numeroControl, codigoGeneracion, selloRecibido, estado, fechaEmision,
    total: calculo.totales.total, firmador: firma, respuestaMh,
  });
}

/**
 * Emite un DTE 01 o 03.
 * @param {'01'|'03'} tipo
 * @param {object} payload  { clienteId, condicionOperacion, items: [{ productoId, cantidad, descuento }] }
 * @param {{id:number}} usuario  req.usuario
 * @param {'ok'|'rechazo'|'contingencia'} modo  de X-Simular
 */
async function emitir(tipo, payload, usuario, modo = 'ok') {
  const conf = TIPOS[tipo];
  if (!conf) throw new AppError('VALIDACION', `Tipo de DTE no soportado: ${tipo}`, 400);
  const datos = validarPayload(tipo, payload);
  const emisor = await emisorService.obtener();

  return withTransaction(async ({ tx, query: q }) => {
    const cliente = await cargarCliente(q, tipo, datos.clienteId);
    const lineas = await cargarProductos(q, datos.items);
    const calculo = conf.calcular(lineas);
    return enviarYGuardar({
      tipo, tx, q, emisor, usuario, modo, calculo,
      clienteId: cliente ? cliente.id : null,
      condicionOperacion: datos.condicionOperacion,
      construir: (ctx) => conf.builder.construir({ ...ctx, emisor, cliente, condicionOperacion: datos.condicionOperacion, calculo }),
    });
  });
}

/**
 * 05 Nota de crédito sobre un 03 PROCESADO. payload: { dteRelacionadoId, clienteId?, items: [{ productoId, cantidad }] }
 * Receptor = el del CCF (si se manda clienteId debe coincidir). Cantidades ≤ pendientes de acreditar.
 * Precio y venta gravada salen del CCF (proporcionales; la última unidad toma el resto). Devuelve stock.
 */
async function emitirNotaCredito(payload, usuario, modo = 'ok') {
  const b = payload || {};
  const ccfId = v.entero(b.dteRelacionadoId, 'dteRelacionadoId', 1);
  const items = validarItems(b.items, false);
  const emisor = await emisorService.obtener();

  return withTransaction(async ({ tx, query: q }) => {
    const ccf = await cargarDteBloqueado(q, ccfId); // bloquea el CCF: dos NC simultáneas no exceden lo pendiente
    if (ccf.tipoDte !== '03') v.falla(`La nota de crédito solo aplica a un CCF (03); el DTE ${ccfId} es tipo ${ccf.tipoDte}`);
    if (ccf.estado !== 'PROCESADO') {
      throw new AppError('ESTADO_INVALIDO', `El CCF ${ccf.numeroControl} está en ${ccf.estado}; debe estar PROCESADO`, 409);
    }
    if (b.clienteId != null && b.clienteId !== '' && Number(b.clienteId) !== ccf.clienteId) {
      v.falla('La nota de crédito debe tener el mismo receptor que el CCF');
    }

    const pendientes = new Map((await pendientesAcreditar(q, ccfId)).map((l) => [l.productoId, l]));
    const lineas = items.map((it) => {
      const l = pendientes.get(it.productoId);
      if (!l) v.falla(`El producto ${it.productoId} no está en el CCF ${ccf.numeroControl}`);
      if (it.cantidad > l.pendiente) {
        v.falla(`Cantidad a acreditar (${it.cantidad}) mayor a la pendiente (${l.pendiente}) para el producto ${l.codigo}`);
      }
      const ventaGravada = it.cantidad === l.pendiente
        ? redondear2(l.ventaGravada - l.gravadaAcreditada)
        : redondear2((l.ventaGravada * it.cantidad) / l.cantidad);
      return {
        producto: { id: l.productoId, codigo: l.codigo, descripcion: l.descripcion, unidad: l.unidad },
        cantidad: it.cantidad,
        precioUni: l.precioUnitario,
        ventaGravada,
      };
    });
    const calculo = calculos.calcularNotaCredito(lineas);
    const jsonCcf = JSON.parse(ccf.jsonDte);

    return enviarYGuardar({
      tipo: '05', tx, q, emisor, usuario, modo, calculo,
      clienteId: ccf.clienteId,
      condicionOperacion: ccf.condicionOperacion,
      dteRelacionadoId: ccf.id,
      construir: (ctx) => notaCredito05.construir({
        ...ctx, emisor, condicionOperacion: ccf.condicionOperacion, calculo,
        ccf: { codigoGeneracion: ccf.codigoGeneracion, fecEmi: jsonCcf.identificacion.fecEmi, receptor: jsonCcf.receptor },
      }),
    });
  });
}

/**
 * Reintenta el envío de un DTE en CONTINGENCIA con el mismo JSON (mismo codigoGeneracion y numeroControl).
 * PROCESADO → guarda sello. RECHAZADO → revierte el stock que se movió al quedar en contingencia.
 * contingencia otra vez → sigue igual.
 */
async function reintentar(id, usuario, modo = 'ok') {
  return withTransaction(async ({ query: q }) => {
    const d = await cargarDteBloqueado(q, id);
    if (d.estado !== 'CONTINGENCIA') {
      throw new AppError('ESTADO_INVALIDO', `Solo se reintenta un DTE en CONTINGENCIA; ${d.numeroControl} está en ${d.estado}`, 409);
    }
    const respuestaMh = mh.recibir({ codigoGeneracion: d.codigoGeneracion }, modo);
    const estado = respuestaMh ? respuestaMh.estado : 'CONTINGENCIA';
    const selloRecibido = respuestaMh ? respuestaMh.selloRecibido : null;

    if (estado === 'RECHAZADO') await ajustarStock(q, await lineasStock(q, d.id), -signoEmision(d.tipoDte));

    await q(
      `UPDATE dbo.dte SET estado = @estado, sello_recibido = @sello, respuesta_mh = @respuestaMh WHERE id = @id`,
      { id: d.id, estado, sello: selloRecibido, respuestaMh: respuestaMh ? JSON.stringify(respuestaMh) : null }
    );
    await registrar(usuario.id, 'REINTENTO', 'dte', d.id, {
      tipoDte: d.tipoDte, numeroControl: d.numeroControl, codigoGeneracion: d.codigoGeneracion, resultado: estado,
      mensaje: respuestaMh
        ? `Reintento DTE-${d.tipoDte} a MH (simulado): ${respuestaMh.descripcionMsg}`
        : `Reintento DTE-${d.tipoDte}: MH sigue sin responder (simulado)`,
    }, q);

    return respuestaEmision({
      id: d.id, tipoDte: d.tipoDte, numeroControl: d.numeroControl, codigoGeneracion: d.codigoGeneracion,
      selloRecibido, estado, fechaEmision: fechaIso(d.fechaEmision), total: Number(d.total),
      firmador: parse(d.firma), respuestaMh,
    });
  });
}

/** Cuerpo de invalidación → motivo del evento (responsable = usuario; solicitante opcional). */
function validarMotivo(body, usuario) {
  const b = body || {};
  const tipoAnulacion = b.tipoAnulacion == null ? 2 : v.entero(b.tipoAnulacion, 'tipoAnulacion', 1);
  if (![1, 2, 3].includes(tipoAnulacion)) v.falla('tipoAnulacion debe ser 1, 2 o 3');
  const motivoAnulacion = v.texto(b.motivo ?? b.motivoAnulacion, 'motivo', 200);
  let codigoGeneracionR = null;
  if (tipoAnulacion === 2) {
    if (b.codigoGeneracionR) v.falla('codigoGeneracionR debe ir vacío con tipoAnulacion 2');
  } else {
    codigoGeneracionR = String(b.codigoGeneracionR || '').trim().toUpperCase();
    if (!UUID.test(codigoGeneracionR)) v.falla(`tipoAnulacion ${tipoAnulacion} requiere codigoGeneracionR (UUID del DTE que reemplaza)`);
  }
  const responsable = v.texto(usuario.nombre || usuario.usuario, 'nombreResponsable', 100);
  return {
    tipoAnulacion,
    motivoAnulacion,
    codigoGeneracionR,
    nombreResponsable: responsable,
    tipDocResponsable: '13',
    numDocResponsable: '000000000',
    nombreSolicita: v.textoOpc(b.nombreSolicita, 'nombreSolicita', 100) || responsable,
    tipDocSolicita: v.textoOpc(b.tipDocSolicita, 'tipDocSolicita', 2) || '13',
    numDocSolicita: v.textoOpc(b.numDocSolicita, 'numDocSolicita', 20) || '000000000',
  };
}

/**
 * Invalida un DTE PROCESADO (un 03 no puede tener NC vigente). Guarda el evento (también si MH lo rechaza).
 * Evento PROCESADO → DTE INVALIDADO y se revierte el stock (01/03 regresa, 05 vuelve a salir).
 * Evento RECHAZADO → el DTE sigue PROCESADO. MH sin respuesta (contingencia) → 503 MH_NO_DISPONIBLE.
 */
async function invalidar(id, body, usuario, modo = 'ok') {
  const motivo = validarMotivo(body, usuario);
  const emisor = await emisorService.obtener();

  return withTransaction(async ({ query: q }) => {
    const d = await cargarDteBloqueado(q, id);
    if (d.estado !== 'PROCESADO') {
      throw new AppError('ESTADO_INVALIDO', `Solo se invalida un DTE PROCESADO; ${d.numeroControl} está en ${d.estado}`, 409);
    }
    if (d.tipoDte === '03') {
      const nc = await q(
        `SELECT numero_control AS numeroControl FROM dbo.dte
         WHERE dte_relacionado_id = @id AND tipo_dte = '05' AND estado IN ('PROCESADO', 'CONTINGENCIA')`,
        { id: d.id }
      );
      if (nc.recordset.length) {
        throw new AppError('ESTADO_INVALIDO', `El CCF tiene notas de crédito vigentes (${nc.recordset.map((n) => n.numeroControl).join(', ')}); invalídelas primero`, 409);
      }
    }
    if (motivo.codigoGeneracionR) {
      const r = await q(`SELECT estado FROM dbo.dte WHERE codigo_generacion = @c AND id <> @id`, { c: motivo.codigoGeneracionR, id: d.id });
      if (r.recordset[0]?.estado !== 'PROCESADO') v.falla('codigoGeneracionR debe ser de otro DTE en estado PROCESADO');
    }

    const jsonDte = JSON.parse(d.jsonDte);
    const { fecEmi, horEmi, fechaEmision } = marcaTiempo();
    const codigoGeneracionEvento = nuevoCodigo();
    const jsonEvento = invalidacion.construir({
      codigoGeneracion: codigoGeneracionEvento, fecEmi, horEmi, emisor, motivo,
      dte: {
        tipoDte: d.tipoDte, codigoGeneracion: d.codigoGeneracion, selloRecibido: d.selloRecibido,
        numeroControl: d.numeroControl, fecEmi: jsonDte.identificacion.fecEmi, json: jsonDte,
      },
    });
    const firma = firmador.firmar(jsonEvento, modo);
    const respuestaMh = mhAnulacion.anular({ codigoGeneracion: codigoGeneracionEvento }, modo);
    const detalleBitacora = { tipoDte: d.tipoDte, numeroControl: d.numeroControl, codigoGeneracion: d.codigoGeneracion, codigoGeneracionEvento };

    if (!respuestaMh) {
      // Fuera de la transacción (que se revierte): la interacción fallida queda en bitácora.
      await registrar(usuario.id, 'INVALIDACION', 'dte', d.id, { ...detalleBitacora, resultado: 'SIN_RESPUESTA', mensaje: 'MH no respondió al evento de invalidación (simulado)' });
      throw new AppError('MH_NO_DISPONIBLE', 'MH no respondió al evento de invalidación (simulado). Intente de nuevo.', 503);
    }

    await q(
      `INSERT INTO dbo.evento_invalidacion (dte_id, usuario_id, codigo_generacion, tipo_anulacion, motivo, fecha,
                                            json_evento, firma, respuesta_mh, sello_recibido)
       VALUES (@dteId, @usuarioId, @codigo, @tipoAnulacion, @motivo, @fecha, @jsonEvento, @firma, @respuestaMh, @sello)`,
      {
        dteId: d.id, usuarioId: usuario.id, codigo: codigoGeneracionEvento, tipoAnulacion: motivo.tipoAnulacion,
        motivo: motivo.motivoAnulacion, fecha: fechaEmision, jsonEvento: JSON.stringify(jsonEvento),
        firma: JSON.stringify(firma), respuestaMh: JSON.stringify(respuestaMh), sello: respuestaMh.selloRecibido,
      }
    );

    let estado = d.estado;
    if (respuestaMh.estado === 'PROCESADO') {
      estado = 'INVALIDADO';
      await q(`UPDATE dbo.dte SET estado = 'INVALIDADO' WHERE id = @id`, { id: d.id });
      await ajustarStock(q, await lineasStock(q, d.id), -signoEmision(d.tipoDte));
    }

    await registrar(usuario.id, 'INVALIDACION', 'dte', d.id, {
      ...detalleBitacora, resultado: respuestaMh.estado,
      mensaje: `Evento de invalidación de DTE-${d.tipoDte} (simulado): ${respuestaMh.descripcionMsg}`,
    }, q);

    return {
      id: d.id,
      estado,
      estadoEvento: respuestaMh.estado,
      codigoGeneracionEvento,
      selloRecibido: respuestaMh.selloRecibido,
      jsonEvento,
      firmador: firma,
      respuestaMh,
    };
  });
}

module.exports = {
  emitir, emitirNotaCredito, reintentar, invalidar,
  respuestaEmision, marcaTiempo, fechaIso, parse, pendientesAcreditar,
};
