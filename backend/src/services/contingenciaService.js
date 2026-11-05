/**
 * Evento de contingencia (schemas-mh/contingencia-schema-v4.json): POST/GET /api/contingencia.
 *
 * enviar (una transacción): DTE en CONTINGENCIA (los indicados o todos, máx. 1000, bloqueados con UPDLOCK)
 *   → JSON del evento → firmador → MH simulado (X-Simular):
 *   PROCESADO     → se guarda el evento y se transmiten sus DTE (MH ok) → PROCESADO con sello.
 *   RECHAZADO     → se guarda el evento; los DTE siguen en CONTINGENCIA.
 *   sin respuesta → 503 MH_NO_DISPONIBLE; no se guarda (solo bitácora SIN_RESPUESTA).
 */
const { query, withTransaction } = require('../config/db');
const { AppError } = require('../utils/respuesta');
const { registrar } = require('../utils/bitacora');
const v = require('../utils/validar');
const emisorService = require('./emisorService');
const { marcaTiempo, fechaIso, parse, transmitir, nuevoCodigo } = require('./dteService');
const contingencia = require('../dte/builders/contingencia');
const { TIPO_CONTINGENCIA_MH } = require('../dte/builders/comun');
const firmador = require('../dte/simuladores/firmador');
const mhContingencia = require('../dte/simuladores/mhContingencia');

const MAX_DTE = 1000; // maxItems de detalleDTE
const COLS_DTE = `d.id, d.tipo_dte AS tipoDte, d.codigo_generacion AS codigoGeneracion, d.numero_control AS numeroControl,
                  d.estado, d.sello_recibido AS selloRecibido, d.fecha_emision AS fechaEmision, d.total`;

/** { dteIds?: int[], motivo?: string ≤ 500 } */
function validarBody(body) {
  const b = body || {};
  let dteIds = null;
  if (b.dteIds != null) {
    if (!Array.isArray(b.dteIds) || b.dteIds.length === 0) v.falla('dteIds debe ser una lista con al menos un id');
    dteIds = [...new Set(b.dteIds.map((id, i) => v.entero(id, `dteIds[${i}]`, 1)))];
    if (dteIds.length > MAX_DTE) v.falla(`Un evento de contingencia admite máximo ${MAX_DTE} DTE`);
  }
  return { dteIds, motivo: v.textoOpc(b.motivo, 'motivo', 500) };
}

/** DTE del evento, bloqueados hasta el commit. Sin dteIds = todos los que están en CONTINGENCIA. */
async function cargarDtes(q, dteIds) {
  if (!dteIds) {
    const r = await q(
      `SELECT TOP (${MAX_DTE}) ${COLS_DTE} FROM dbo.dte d WITH (UPDLOCK, ROWLOCK)
       WHERE d.estado = 'CONTINGENCIA' ORDER BY d.id`,
      {}
    );
    if (!r.recordset.length) throw new AppError('ESTADO_INVALIDO', 'No hay DTE en CONTINGENCIA para reportar', 409);
    return r.recordset;
  }
  const params = {};
  const marcas = dteIds.map((id, i) => { params[`d${i}`] = id; return `@d${i}`; });
  const r = await q(
    `SELECT ${COLS_DTE} FROM dbo.dte d WITH (UPDLOCK, ROWLOCK) WHERE d.id IN (${marcas.join(', ')}) ORDER BY d.id`,
    params
  );
  const porId = new Map(r.recordset.map((d) => [d.id, d]));
  for (const id of dteIds) {
    const d = porId.get(id);
    if (!d) throw new AppError('NO_ENCONTRADO', `DTE ${id} no existe`, 404);
    if (d.estado !== 'CONTINGENCIA') {
      throw new AppError('ESTADO_INVALIDO', `Solo se reportan DTE en CONTINGENCIA; ${d.numeroControl} está en ${d.estado}`, 409);
    }
  }
  return r.recordset;
}

const dteOut = (d) => ({
  id: d.id, tipoDte: d.tipoDte, numeroControl: d.numeroControl, codigoGeneracion: d.codigoGeneracion,
  estado: d.estado, selloRecibido: d.selloRecibido || null, fechaEmision: fechaIso(d.fechaEmision), total: Number(d.total),
});

/**
 * Envía el evento de contingencia y, si MH lo acepta, transmite sus DTE.
 * @param {object} body   { dteIds?, motivo? }
 * @param {object} usuario req.usuario
 * @param {'ok'|'rechazo'|'contingencia'} modo  X-Simular (aplica al evento; los DTE se transmiten con ok)
 */
async function enviar(body, usuario, modo = 'ok') {
  const datos = validarBody(body);
  const emisor = await emisorService.obtener();

  return withTransaction(async ({ query: q }) => {
    const dtes = await cargarDtes(q, datos.dteIds);
    const inicio = dtes.map((d) => fechaIso(d.fechaEmision)).sort()[0]; // emisión del primer DTE en contingencia
    const { fecEmi, horEmi, fechaEmision } = marcaTiempo();
    const codigoGeneracion = nuevoCodigo();
    const jsonEvento = contingencia.construir({
      codigoGeneracion, fTransmision: fecEmi, hTransmision: horEmi, emisor,
      responsable: { nombre: v.texto(usuario.nombre || usuario.usuario, 'nombreResponsable', 100), tipoDoc: '13', numeroDoc: '000000000' },
      dtes,
      motivo: {
        fInicio: inicio.slice(0, 10), hInicio: inicio.slice(11, 19), fFin: fecEmi, hFin: horEmi,
        tipoContingencia: TIPO_CONTINGENCIA_MH, motivoContingencia: datos.motivo,
      },
    });
    const firma = firmador.firmar(jsonEvento, modo);
    const respuestaMh = mhContingencia.recibirEvento({ codigoGeneracion }, modo);
    const resumen = { codigoGeneracionEvento: codigoGeneracion, cantidad: dtes.length, dteIds: dtes.map((d) => d.id) };

    if (!respuestaMh) {
      // Fuera de la transacción (que se revierte): el intento fallido queda en bitácora.
      await registrar(usuario.id, 'CONTINGENCIA', 'evento_contingencia', null, {
        ...resumen, resultado: 'SIN_RESPUESTA', mensaje: 'MH no respondió al evento de contingencia (simulado)',
      });
      throw new AppError('MH_NO_DISPONIBLE', 'MH no respondió al evento de contingencia (simulado). Los DTE siguen en contingencia; intente de nuevo.', 503);
    }

    const ins = await q(
      `INSERT INTO dbo.evento_contingencia (usuario_id, codigo_generacion, tipo_contingencia, motivo, f_inicio, f_fin, fecha,
                                            estado, json_evento, firma, respuesta_mh, sello_recibido)
       OUTPUT inserted.id
       VALUES (@usuarioId, @codigo, @tipo, @motivo, @fInicio, @fFin, @fecha, @estado, @jsonEvento, @firma, @respuestaMh, @sello)`,
      {
        usuarioId: usuario.id, codigo: codigoGeneracion, tipo: TIPO_CONTINGENCIA_MH, motivo: datos.motivo,
        fInicio: inicio, fFin: fechaEmision, fecha: fechaEmision, estado: respuestaMh.estado,
        jsonEvento: JSON.stringify(jsonEvento), firma: JSON.stringify(firma),
        respuestaMh: JSON.stringify(respuestaMh), sello: respuestaMh.selloRecibido,
      }
    );
    const eventoId = ins.recordset[0].id;
    for (const [i, d] of dtes.entries()) {
      await q(`INSERT INTO dbo.evento_contingencia_dte (evento_id, dte_id, no_item) VALUES (@e, @d, @n)`, { e: eventoId, d: d.id, n: i + 1 });
    }

    await registrar(usuario.id, 'CONTINGENCIA', 'evento_contingencia', eventoId, {
      ...resumen, resultado: respuestaMh.estado,
      mensaje: `Evento de contingencia con ${dtes.length} DTE (simulado): ${respuestaMh.descripcionMsg}`,
    }, q);

    // Evento aceptado → transmisión de los DTE (MH ya disponible: modo ok).
    if (respuestaMh.estado === 'PROCESADO') {
      for (const d of dtes) {
        const t = await transmitir(q, d, usuario, 'ok', codigoGeneracion);
        d.estado = t.estado;
        d.selloRecibido = t.selloRecibido;
      }
    }

    return {
      id: eventoId,
      codigoGeneracion,
      estado: respuestaMh.estado,
      selloRecibido: respuestaMh.selloRecibido,
      fecha: fechaEmision,
      fInicio: inicio,
      fFin: fechaEmision,
      tipoContingencia: TIPO_CONTINGENCIA_MH,
      motivo: datos.motivo,
      usuario: usuario.usuario,
      cantidad: dtes.length,
      dtes: dtes.map(dteOut),
      jsonEvento,
      firmador: firma,
      respuestaMh,
    };
  });
}

const SELECT_EVENTO = `
  SELECT e.id, e.codigo_generacion AS codigoGeneracion, e.estado, e.sello_recibido AS selloRecibido, e.fecha,
         e.f_inicio AS fInicio, e.f_fin AS fFin, e.tipo_contingencia AS tipoContingencia, e.motivo, u.usuario,
         (SELECT COUNT(*) FROM dbo.evento_contingencia_dte x WHERE x.evento_id = e.id) AS cantidad`;

const eventoOut = (e) => ({
  id: e.id, codigoGeneracion: e.codigoGeneracion, estado: e.estado, selloRecibido: e.selloRecibido,
  fecha: fechaIso(e.fecha), fInicio: fechaIso(e.fInicio), fFin: fechaIso(e.fFin),
  tipoContingencia: e.tipoContingencia, motivo: e.motivo, usuario: e.usuario, cantidad: e.cantidad,
});

/** GET /api/contingencia — eventos, más reciente primero. */
async function listar() {
  const r = await query(`${SELECT_EVENTO} FROM dbo.evento_contingencia e JOIN dbo.usuarios u ON u.id = e.usuario_id ORDER BY e.id DESC`);
  return r.recordset.map(eventoOut);
}

/** GET /api/contingencia/:id — evento con sus DTE (estado actual), JSON, firma y respuesta MH. */
async function obtener(id) {
  const r = await query(
    `${SELECT_EVENTO}, e.json_evento AS jsonEvento, e.firma, e.respuesta_mh AS respuestaMh
     FROM dbo.evento_contingencia e JOIN dbo.usuarios u ON u.id = e.usuario_id WHERE e.id = @id`,
    { id }
  );
  const e = r.recordset[0];
  if (!e) throw new AppError('NO_ENCONTRADO', `Evento de contingencia ${id} no existe`, 404);
  const det = await query(
    `SELECT ${COLS_DTE} FROM dbo.evento_contingencia_dte x JOIN dbo.dte d ON d.id = x.dte_id
     WHERE x.evento_id = @id ORDER BY x.no_item`,
    { id }
  );
  return {
    ...eventoOut(e),
    dtes: det.recordset.map(dteOut),
    jsonEvento: parse(e.jsonEvento),
    firmador: parse(e.firma),
    respuestaMh: parse(e.respuestaMh),
  };
}

/** Último evento de contingencia que incluyó al DTE (resumen) o null. Lo usa GET /api/dte/:id. */
async function ultimoDeDte(dteId) {
  const r = await query(
    `SELECT TOP 1 e.id, e.codigo_generacion AS codigoGeneracion, e.estado, e.sello_recibido AS selloRecibido, e.fecha
     FROM dbo.evento_contingencia_dte x JOIN dbo.evento_contingencia e ON e.id = x.evento_id
     WHERE x.dte_id = @id ORDER BY e.id DESC`,
    { id: dteId }
  );
  const e = r.recordset[0];
  return e ? { ...e, fecha: fechaIso(e.fecha) } : null;
}

module.exports = { enviar, listar, obtener, ultimoDeDte };
