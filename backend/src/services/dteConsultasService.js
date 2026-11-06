/** Consultas de DTE (solo lectura): GET /api/dte y GET /api/dte/:id. */
const { query } = require('../config/db');
const { AppError } = require('../utils/respuesta');
const v = require('../utils/validar');
const { respuestaEmision, fechaIso, parse, pendientesAcreditar } = require('./dteService');
const { ultimoDeDte } = require('./contingenciaService');

const TIPOS = ['01', '03', '05'];
const ESTADOS = ['PROCESADO', 'RECHAZADO', 'CONTINGENCIA', 'INVALIDADO'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function fechaFiltro(valor, campo) {
  if (valor == null || valor === '') return null;
  if (!FECHA.test(valor) || Number.isNaN(Date.parse(valor))) v.falla(`${campo} debe tener formato YYYY-MM-DD`);
  return valor;
}

/** Filtros opcionales: tipo, estado, desde/hasta (YYYY-MM-DD, inclusive), clienteId. Más reciente primero. */
async function listar({ tipo, estado, desde, hasta, clienteId } = {}) {
  if (tipo && !TIPOS.includes(tipo)) v.falla(`tipo debe ser ${TIPOS.join(', ')}`);
  if (estado && !ESTADOS.includes(estado)) v.falla(`estado debe ser ${ESTADOS.join(', ')}`);
  const params = {
    tipo: tipo || null,
    estado: estado || null,
    desde: fechaFiltro(desde, 'desde'),
    hasta: fechaFiltro(hasta, 'hasta'),
    clienteId: clienteId ? v.entero(clienteId, 'clienteId', 1) : null,
  };
  const r = await query(
    `SELECT d.id, d.tipo_dte AS tipoDte, d.numero_control AS numeroControl, d.codigo_generacion AS codigoGeneracion,
            d.sello_recibido AS selloRecibido, d.estado, d.fecha_emision AS fechaEmision,
            ISNULL(c.nombre, 'Consumidor final') AS receptor, d.cliente_id AS clienteId, d.total,
            d.dte_relacionado_id AS dteRelacionadoId
     FROM dbo.dte d
     LEFT JOIN dbo.clientes c ON c.id = d.cliente_id
     WHERE d.estado <> 'BORRADOR'
       AND (@tipo IS NULL OR d.tipo_dte = @tipo)
       AND (@estado IS NULL OR d.estado = @estado)
       AND (@desde IS NULL OR d.fecha_emision >= CAST(@desde AS DATE))
       AND (@hasta IS NULL OR d.fecha_emision < DATEADD(DAY, 1, CAST(@hasta AS DATE)))
       AND (@clienteId IS NULL OR d.cliente_id = @clienteId)
     ORDER BY d.id DESC`,
    params
  );
  return r.recordset.map((d) => ({ ...d, fechaEmision: fechaIso(d.fechaEmision), total: Number(d.total) }));
}

/** Evento de invalidación más reciente del DTE (procesado o rechazado), o null. */
async function ultimoEvento(dteId) {
  const r = await query(
    `SELECT TOP 1 e.id, e.codigo_generacion AS codigoGeneracion, e.tipo_anulacion AS tipoAnulacion, e.motivo,
            e.fecha, e.sello_recibido AS selloRecibido, e.json_evento AS jsonEvento, e.firma, e.respuesta_mh AS respuestaMh,
            u.usuario
     FROM dbo.evento_invalidacion e JOIN dbo.usuarios u ON u.id = e.usuario_id
     WHERE e.dte_id = @id ORDER BY e.id DESC`,
    { id: dteId }
  );
  const e = r.recordset[0];
  if (!e) return null;
  const respuestaMh = parse(e.respuestaMh);
  return {
    id: e.id,
    codigoGeneracion: e.codigoGeneracion,
    estado: respuestaMh ? respuestaMh.estado : null,
    tipoAnulacion: e.tipoAnulacion,
    motivo: e.motivo,
    fecha: fechaIso(e.fecha),
    usuario: e.usuario,
    selloRecibido: e.selloRecibido,
    jsonEvento: parse(e.jsonEvento),
    firmador: parse(e.firma),
    respuestaMh,
  };
}

/**
 * Detalle: respuesta de emisión + jsonDte, cliente, items, invalidacion, eventoContingencia, dteRelacionado y notasCredito.
 * En un 03 cada ítem trae `acreditada` y `pendiente` (para armar la NC).
 */
async function obtener(id) {
  const r = await query(
    `SELECT d.id, d.tipo_dte AS tipoDte, d.numero_control AS numeroControl, d.codigo_generacion AS codigoGeneracion,
            d.sello_recibido AS selloRecibido, d.estado, d.fecha_emision AS fechaEmision, d.condicion_operacion AS condicionOperacion,
            d.subtotal, d.iva, d.total, d.json_dte AS jsonDte, d.firma, d.respuesta_mh AS respuestaMh,
            d.dte_relacionado_id AS dteRelacionadoId, d.cliente_id AS clienteId, c.nombre AS clienteNombre, c.tipo AS clienteTipo,
            u.usuario, rel.numero_control AS relNumeroControl, rel.codigo_generacion AS relCodigoGeneracion,
            rel.tipo_dte AS relTipoDte, rel.estado AS relEstado,
            d.consultas_mh AS consultasMh, d.ultima_consulta_mh AS ultimaConsultaMh, d.resultado_consulta_mh AS resultadoConsultaMh
     FROM dbo.dte d
     JOIN dbo.usuarios u ON u.id = d.usuario_id
     LEFT JOIN dbo.clientes c ON c.id = d.cliente_id
     LEFT JOIN dbo.dte rel ON rel.id = d.dte_relacionado_id
     WHERE d.id = @id`,
    { id }
  );
  const d = r.recordset[0];
  if (!d) throw new AppError('NO_ENCONTRADO', `DTE ${id} no existe`, 404);

  const det = await query(
    `SELECT num_item AS numItem, producto_id AS productoId, codigo, descripcion, cantidad, unidad,
            precio_unitario AS precioUni, descuento, venta_gravada AS ventaGravada, iva_item AS ivaItem
     FROM dbo.dte_detalle WHERE dte_id = @id ORDER BY num_item`,
    { id }
  );
  let items = det.recordset.map((i) => ({
    ...i, precioUni: Number(i.precioUni), descuento: Number(i.descuento),
    ventaGravada: Number(i.ventaGravada), ivaItem: Number(i.ivaItem),
  }));
  if (d.tipoDte === '03') {
    const pend = new Map((await pendientesAcreditar(query, id)).map((l) => [l.productoId, l]));
    items = items.map((i) => ({ ...i, acreditada: pend.get(i.productoId)?.acreditada ?? 0, pendiente: pend.get(i.productoId)?.pendiente ?? i.cantidad }));
  }

  const nc = d.tipoDte === '03'
    ? (await query(
        `SELECT id, numero_control AS numeroControl, codigo_generacion AS codigoGeneracion, estado,
                fecha_emision AS fechaEmision, total
         FROM dbo.dte WHERE dte_relacionado_id = @id AND tipo_dte = '05' ORDER BY id`,
        { id }
      )).recordset.map((n) => ({ ...n, fechaEmision: fechaIso(n.fechaEmision), total: Number(n.total) }))
    : [];

  return {
    ...respuestaEmision({
      id: d.id, tipoDte: d.tipoDte, numeroControl: d.numeroControl, codigoGeneracion: d.codigoGeneracion,
      selloRecibido: d.selloRecibido, estado: d.estado, fechaEmision: fechaIso(d.fechaEmision), total: Number(d.total),
      firmador: parse(d.firma), respuestaMh: parse(d.respuestaMh),
    }),
    subtotal: Number(d.subtotal),
    iva: Number(d.iva),
    condicionOperacion: d.condicionOperacion,
    usuario: d.usuario,
    cliente: d.clienteId ? { id: d.clienteId, nombre: d.clienteNombre, tipo: d.clienteTipo } : null,
    jsonDte: parse(d.jsonDte),
    items,
    dteRelacionadoId: d.dteRelacionadoId,
    dteRelacionado: d.dteRelacionadoId
      ? { id: d.dteRelacionadoId, tipoDte: d.relTipoDte, numeroControl: d.relNumeroControl, codigoGeneracion: d.relCodigoGeneracion, estado: d.relEstado }
      : null,
    notasCredito: nc,
    invalidacion: await ultimoEvento(id),
    eventoContingencia: await ultimoDeDte(id),
    // C3: cola de consultas a MH (null si nunca se consultó)
    consultaMh: d.consultasMh
      ? { consultas: d.consultasMh, ultimaConsulta: fechaIso(d.ultimaConsultaMh), resultado: d.resultadoConsultaMh }
      : null,
  };
}

module.exports = { listar, obtener };
