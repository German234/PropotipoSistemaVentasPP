/**
 * Cola de consultas a MH (C3). Durante el día, cada `intervaloSeg` segundos se consulta UN solo DTE en
 * CONTINGENCIA (no todos a la vez, para no saturar el servicio de MH) con la consulta de DTE de Hacienda:
 *   - ENCONTRADO    → MH sí lo había recibido (la respuesta se perdió): queda PROCESADO con el sello original
 *                     y vuelve al JSON/firma que MH recibió (modelo previo). Ya no va en el lote del cierre.
 *   - NO_ENCONTRADO → es una contingencia real: sigue en la cola y lo reportará el lote de contingencia.
 *   - SIN_RESPUESTA → MH tampoco responde a la consulta: se vuelve a intentar en su próximo turno.
 * Orden de la cola (round-robin): primero los nunca consultados, luego el de consulta más antigua; a igualdad, por id.
 *
 * Config en memoria (valor inicial de backend/.env): CONSULTA_MH_ACTIVO (1), CONSULTA_MH_INTERVALO_SEG (60; 10–3600).
 * El temporizador solo corre si server.js llamó a iniciar(); las pruebas usan consultarSiguiente()/consultar().
 */
const { query, withTransaction } = require('../config/db');
const { AppError } = require('../utils/respuesta');
const { registrar } = require('../utils/bitacora');
const { marcaTiempo, fechaIso, cargarDteBloqueado, aplicarRegistroMh } = require('./dteService');
const { usuarioSistema } = require('./loteAutomaticoService');
const mhConsulta = require('../dte/simuladores/mhConsulta');
const mhRegistro = require('../dte/simuladores/mhRegistro');

const INTERVALO_MIN = 10;
const INTERVALO_MAX = 3600;
const intervaloEnv = Number(process.env.CONSULTA_MH_INTERVALO_SEG);

const estado = {
  activo: !['0', 'false', 'no'].includes(String(process.env.CONSULTA_MH_ACTIVO || '1').toLowerCase()),
  intervaloSeg: Number.isInteger(intervaloEnv) && intervaloEnv >= INTERVALO_MIN && intervaloEnv <= INTERVALO_MAX ? intervaloEnv : 60,
  iniciado: false,
  timer: null,
  proxima: null,
  ejecutando: false,
  ultimaConsulta: null,
};

const ORDEN_COLA = 'ORDER BY CASE WHEN d.ultima_consulta_mh IS NULL THEN 0 ELSE 1 END, d.ultima_consulta_mh, d.id';

/**
 * Consulta en MH un DTE en CONTINGENCIA (dentro de una transacción, con el DTE bloqueado).
 * @returns {{ dteId, numeroControl, codigoGeneracion, resultado, estado, selloRecibido, consultas, fecha, respuestaMh }}
 */
async function consultarEnTx(q, d, usuario, modo, origen) {
  if (d.estado !== 'CONTINGENCIA') {
    throw new AppError('ESTADO_INVALIDO', `Solo se consultan en MH los DTE en CONTINGENCIA; ${d.numeroControl} está en ${d.estado}`, 409);
  }
  const registro = await mhRegistro.buscar(q, d.codigoGeneracion);
  const respuestaMh = mhConsulta.consultar(registro, d.codigoGeneracion, modo);
  let resultado = 'SIN_RESPUESTA';
  let estadoDte = 'CONTINGENCIA';
  let selloRecibido = null;
  if (respuestaMh && respuestaMh.estado === 'PROCESADO') {
    resultado = 'ENCONTRADO';
    ({ estado: estadoDte, selloRecibido } = await aplicarRegistroMh(q, d, registro, respuestaMh));
  } else if (respuestaMh) {
    resultado = 'NO_ENCONTRADO';
  }
  const { fechaEmision: fecha } = marcaTiempo();
  const r = await q(
    `UPDATE dbo.dte SET consultas_mh = consultas_mh + 1, ultima_consulta_mh = SYSDATETIME(), resultado_consulta_mh = @resultado
     OUTPUT inserted.consultas_mh AS consultas WHERE id = @id`,
    { id: d.id, resultado }
  );
  // Bitácora solo cuando cambia algo (ENCONTRADO) o cuando la pide un usuario; los turnos automáticos sin
  // novedad solo actualizan las columnas del DTE para no llenar la bitácora.
  if (resultado === 'ENCONTRADO' || origen === 'MANUAL') {
    await registrar(usuario.id, 'CONSULTA_MH', 'dte', d.id, {
      tipoDte: d.tipoDte, numeroControl: d.numeroControl, codigoGeneracion: d.codigoGeneracion, origen,
      resultado: resultado === 'ENCONTRADO' ? 'PROCESADO' : resultado,
      mensaje: resultado === 'ENCONTRADO'
        ? `Consulta a MH (simulado): DTE-${d.tipoDte} sí estaba recibido; queda PROCESADO con su sello`
        : resultado === 'NO_ENCONTRADO'
          ? `Consulta a MH (simulado): DTE-${d.tipoDte} no está en MH; sigue en contingencia`
          : 'Consulta a MH (simulado): MH no respondió',
    }, q);
  }
  return {
    dteId: d.id, tipoDte: d.tipoDte, numeroControl: d.numeroControl, codigoGeneracion: d.codigoGeneracion,
    resultado, estado: estadoDte, selloRecibido, consultas: r.recordset[0].consultas, fecha, origen, respuestaMh,
  };
}

/** POST /api/dte/:id/consultar — consulta puntual (cualquier rol). X-Simular aplica a la consulta. */
async function consultar(id, usuario, modo = 'ok') {
  return withTransaction(async ({ query: q }) => consultarEnTx(q, await cargarDteBloqueado(q, id), usuario, modo, 'MANUAL'));
}

/**
 * Un turno de la cola: consulta el siguiente DTE en CONTINGENCIA (READPAST: salta los que otra operación
 * tiene bloqueados). Sin pendientes → null. No lanza: los errores quedan en ultimaConsulta.
 */
async function consultarSiguiente(modo = 'ok') {
  if (estado.ejecutando) return null;
  estado.ejecutando = true;
  try {
    const usuario = await usuarioSistema();
    const res = await withTransaction(async ({ query: q }) => {
      const sig = await q(
        `SELECT TOP 1 d.id FROM dbo.dte d WITH (UPDLOCK, ROWLOCK, READPAST) WHERE d.estado = 'CONTINGENCIA' ${ORDEN_COLA}`
      );
      if (!sig.recordset[0]) return null;
      return consultarEnTx(q, await cargarDteBloqueado(q, sig.recordset[0].id), usuario, modo, 'AUTOMATICO');
    });
    if (res) estado.ultimaConsulta = res;
    return res;
  } catch (e) {
    estado.ultimaConsulta = { fecha: marcaTiempo().fechaEmision, resultado: 'ERROR', mensaje: e.message };
    console.error('[cola de consultas a MH]', e);
    return estado.ultimaConsulta;
  } finally {
    estado.ejecutando = false;
  }
}

function reprogramar() {
  clearTimeout(estado.timer);
  estado.timer = null;
  estado.proxima = null;
  if (!estado.iniciado || !estado.activo) return;
  const ms = estado.intervaloSeg * 1000;
  estado.proxima = new Date(Date.now() + ms);
  estado.timer = setTimeout(async () => {
    await consultarSiguiente('ok');
    reprogramar();
  }, ms);
  if (estado.timer.unref) estado.timer.unref();
}

function iniciar() { estado.iniciado = true; reprogramar(); }
function detener() { estado.iniciado = false; reprogramar(); }

/** GET /api/contingencia/consultas — configuración, próxima/última consulta y la cola en orden. */
async function obtener() {
  const r = await query(
    `SELECT d.id, d.tipo_dte AS tipoDte, d.numero_control AS numeroControl, d.consultas_mh AS consultas,
            d.ultima_consulta_mh AS ultimaConsulta, d.resultado_consulta_mh AS resultado
     FROM dbo.dte d WHERE d.estado = 'CONTINGENCIA' ${ORDEN_COLA}`
  );
  const ultima = estado.ultimaConsulta;
  return {
    activo: estado.activo,
    intervaloSeg: estado.intervaloSeg,
    proximaConsulta: estado.proxima ? marcaTiempo(estado.proxima).fechaEmision : null,
    ultimaConsulta: ultima ? { ...ultima, respuestaMh: undefined } : null,
    cola: r.recordset.map((x, i) => ({
      posicion: i + 1, id: x.id, tipoDte: x.tipoDte, numeroControl: x.numeroControl,
      consultas: x.consultas, ultimaConsulta: fechaIso(x.ultimaConsulta), resultado: x.resultado,
    })),
  };
}

/** PUT /api/contingencia/consultas (ADMIN) — { activo?: boolean, intervaloSeg?: 10–3600 } */
async function actualizar(body, usuario) {
  const b = body || {};
  if (b.activo === undefined && b.intervaloSeg === undefined) throw new AppError('VALIDACION', 'Envíe activo y/o intervaloSeg', 400);
  if (b.activo !== undefined && typeof b.activo !== 'boolean') throw new AppError('VALIDACION', 'activo debe ser true o false', 400);
  if (b.intervaloSeg !== undefined
      && (!Number.isInteger(b.intervaloSeg) || b.intervaloSeg < INTERVALO_MIN || b.intervaloSeg > INTERVALO_MAX)) {
    throw new AppError('VALIDACION', `intervaloSeg debe ser un entero entre ${INTERVALO_MIN} y ${INTERVALO_MAX}`, 400);
  }
  const antes = { activo: estado.activo, intervaloSeg: estado.intervaloSeg };
  if (b.activo !== undefined) estado.activo = b.activo;
  if (b.intervaloSeg !== undefined) estado.intervaloSeg = b.intervaloSeg;
  reprogramar();
  await registrar(usuario.id, 'ACTUALIZAR', 'consultas_mh', null, { antes, cambios: { activo: estado.activo, intervaloSeg: estado.intervaloSeg } });
  return obtener();
}

module.exports = { consultar, consultarSiguiente, iniciar, detener, obtener, actualizar, _estado: estado };
