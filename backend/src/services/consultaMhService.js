/**
 * Cola de consultas a MH (C3). Durante el día, cada `intervaloSeg` segundos se consulta UN solo DTE en
 * CONTINGENCIA (no todos a la vez, para no saturar el servicio de MH) con la consulta de DTE de Hacienda (simulada):
 *   - ENCONTRADO    → MH sí lo había recibido (la respuesta se perdió): queda PROCESADO con el sello original
 *                     y vuelve al JSON/firma que MH recibió (modelo previo). Ya no va en el lote del cierre.
 *   - NO_ENCONTRADO → es una contingencia real: sigue en la cola y lo reportará el lote de contingencia.
 *   - SIN_RESPUESTA → MH tampoco responde a la consulta: se vuelve a intentar en su próximo turno.
 * Orden de la cola (round-robin): primero los nunca consultados, luego el de consulta más antigua; a igualdad, por id.
 *
 * Fase 5 — persistente (dbo.config_tarea, tarea CONSULTA_MH; ver tareasProgramadas.js):
 *   - activo e intervaloSeg (10–3600) se guardan en SQL Server y se recuperan al reiniciar. backend/.env solo da el
 *     valor de la primera vez: CONSULTA_MH_ACTIVO (1), CONSULTA_MH_INTERVALO_SEG (60).
 *   - Sin turnos duplicados: candado en BD (otro proceso o un turno anterior aún en curso → OMITIDA), además del
 *     READPAST por DTE.
 *   - Cada turno que consulta un DTE (o falla) queda en dbo.ejecucion_tarea; los turnos con la cola vacía no se
 *     registran para no llenar la tabla (1 cada intervalo).
 * El temporizador solo corre si server.js llamó a iniciar(); en cada turno vuelve a leer la configuración.
 */
const { query, withTransaction } = require('../config/db');
const { AppError } = require('../utils/respuesta');
const { registrar } = require('../utils/bitacora');
const { marcaTiempo, fechaIso, cargarDteBloqueado, aplicarRegistroMh } = require('./dteService');
const { usuarioSistema } = require('./loteAutomaticoService');
const tareas = require('./tareasProgramadas');
const mhConsulta = require('../dte/simuladores/mhConsulta');
const mhRegistro = require('../dte/simuladores/mhRegistro');

const TAREA = 'CONSULTA_MH';
const INTERVALO_MIN = 10;
const INTERVALO_MAX = 3600;
const TTL_CANDADO_SEG = 120;   // un turno tarda milisegundos; si el proceso muere a mitad, el candado vence a los 2 min
const REINTENTO_MS = 60000;

/** Valores de la primera vez (backend/.env). */
function porDefecto() {
  const n = Number(process.env.CONSULTA_MH_INTERVALO_SEG);
  return {
    activo: !['0', 'false', 'no'].includes(String(process.env.CONSULTA_MH_ACTIVO || '1').toLowerCase()),
    intervaloSeg: Number.isInteger(n) && n >= INTERVALO_MIN && n <= INTERVALO_MAX ? n : 60,
  };
}

/** Estado del proceso (no la configuración). */
const estado = { iniciado: false, timer: null, proxima: null, generacion: 0, ejecutando: false };
const reloj = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (t) => clearTimeout(t) };

const leerConfig = () => tareas.leerConfig(TAREA, porDefecto());

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
 * tiene bloqueados). Cola vacía → null (no se registra). No lanza: ERROR y OMITIDA se devuelven y se registran.
 * @param {'TEMPORIZADOR'|'DIRECTO'} disparo
 */
async function consultarSiguiente(modo = 'ok', disparo = 'DIRECTO') {
  const inicio = new Date();
  const base = () => ({ fecha: marcaTiempo().fechaEmision, origen: 'AUTOMATICO' });
  if (estado.ejecutando) {
    const res = { ...base(), resultado: 'OMITIDA', mensaje: 'El turno anterior sigue en curso en este proceso' };
    await tareas.registrarEjecucion({ tarea: TAREA, disparo, inicio, resultado: res.resultado, mensaje: res.mensaje, detalle: res });
    return res;
  }
  estado.ejecutando = true;
  let res = null;
  let error = null;
  try {
    await leerConfig(); // asegura la fila del candado
    const candado = await tareas.adquirir(TAREA, TTL_CANDADO_SEG);
    if (!candado.ok) {
      res = { ...base(), resultado: 'OMITIDA', mensaje: candado.motivo };
    } else {
      try {
        const usuario = await usuarioSistema();
        res = await withTransaction(async ({ query: q }) => {
          const sig = await q(
            `SELECT TOP 1 d.id FROM dbo.dte d WITH (UPDLOCK, ROWLOCK, READPAST) WHERE d.estado = 'CONTINGENCIA' ${ORDEN_COLA}`
          );
          if (!sig.recordset[0]) return null;
          return consultarEnTx(q, await cargarDteBloqueado(q, sig.recordset[0].id), usuario, modo, 'AUTOMATICO');
        });
      } finally {
        await tareas.liberar(TAREA);
      }
    }
  } catch (e) {
    error = e;
    res = { ...base(), resultado: 'ERROR', mensaje: 'Error interno en la cola de consultas a MH (ver registro de ejecuciones)' };
    console.error('[cola de consultas a MH]', e);
  } finally {
    estado.ejecutando = false;
  }
  if (res) {
    const { respuestaMh, ...detalle } = res; // eslint-disable-line no-unused-vars
    const mensaje = res.mensaje || `${res.numeroControl}: ${res.resultado}`;
    await tareas.registrarEjecucion({ tarea: TAREA, disparo, inicio, resultado: res.resultado, mensaje, detalle, error });
  }
  return res;
}

function programar(fn, ms) {
  const t = reloj.setTimeout(fn, ms);
  if (t && t.unref) t.unref();
  return t;
}

/** Lee la configuración de la BD y programa el siguiente turno (o nada si está desactivada / detenida). */
async function reprogramar() {
  reloj.clearTimeout(estado.timer);
  estado.timer = null;
  estado.proxima = null;
  const gen = ++estado.generacion;
  if (!estado.iniciado) return null;
  let cfg;
  try {
    cfg = await leerConfig();
  } catch (e) {
    console.error('[cola de consultas a MH] no se pudo leer la configuración; reintento en 60 s:', e.message);
    if (gen === estado.generacion && estado.iniciado) estado.timer = programar(reprogramar, REINTENTO_MS);
    return null;
  }
  if (gen !== estado.generacion || !estado.iniciado || !cfg.activo) return cfg;
  const ms = cfg.intervaloSeg * 1000;
  estado.proxima = new Date(Date.now() + ms);
  estado.timer = programar(disparar, ms);
  return cfg;
}

/** Callback del temporizador: relee la configuración, consulta un DTE y reprograma. */
async function disparar() {
  estado.timer = null;
  try {
    const cfg = await leerConfig();
    if (cfg.activo) await consultarSiguiente('ok', 'TEMPORIZADOR');
  } catch (e) {
    console.error('[cola de consultas a MH] turno fallido:', e.message);
  }
  await reprogramar();
}

async function iniciar() { estado.iniciado = true; return reprogramar(); }
function detener() {
  estado.iniciado = false;
  reloj.clearTimeout(estado.timer);
  estado.timer = null;
  estado.proxima = null;
  estado.generacion += 1;
}

/** GET /api/contingencia/consultas — configuración, próxima/última consulta y la cola en orden. */
async function obtener() {
  const cfg = await leerConfig();
  const r = await query(
    `SELECT d.id, d.tipo_dte AS tipoDte, d.numero_control AS numeroControl, d.consultas_mh AS consultas,
            d.ultima_consulta_mh AS ultimaConsulta, d.resultado_consulta_mh AS resultado
     FROM dbo.dte d WHERE d.estado = 'CONTINGENCIA' ${ORDEN_COLA}`
  );
  return {
    activo: cfg.activo,
    intervaloSeg: cfg.intervaloSeg,
    // la próxima consulta solo existe si el temporizador corre en este proceso
    proximaConsulta: cfg.activo && estado.proxima ? marcaTiempo(estado.proxima).fechaEmision : null,
    ultimaConsulta: await tareas.ultimaEjecucion(TAREA),
    cola: r.recordset.map((x, i) => ({
      posicion: i + 1, id: x.id, tipoDte: x.tipoDte, numeroControl: x.numeroControl,
      consultas: x.consultas, ultimaConsulta: fechaIso(x.ultimaConsulta), resultado: x.resultado,
    })),
  };
}

/** PUT /api/contingencia/consultas (ADMIN) — { activo?: boolean, intervaloSeg?: 10–3600 }. Persiste y reprograma. */
async function actualizar(body, usuario) {
  const b = body || {};
  if (b.activo === undefined && b.intervaloSeg === undefined) throw new AppError('VALIDACION', 'Envíe activo y/o intervaloSeg', 400);
  if (b.activo !== undefined && typeof b.activo !== 'boolean') throw new AppError('VALIDACION', 'activo debe ser true o false', 400);
  if (b.intervaloSeg !== undefined
      && (!Number.isInteger(b.intervaloSeg) || b.intervaloSeg < INTERVALO_MIN || b.intervaloSeg > INTERVALO_MAX)) {
    throw new AppError('VALIDACION', `intervaloSeg debe ser un entero entre ${INTERVALO_MIN} y ${INTERVALO_MAX}`, 400);
  }
  const previa = await leerConfig();
  const nueva = await tareas.guardarConfig(TAREA, { activo: b.activo, intervaloSeg: b.intervaloSeg }, porDefecto(), usuario.id);
  await registrar(usuario.id, 'ACTUALIZAR', 'consultas_mh', null, {
    antes: { activo: previa.activo, intervaloSeg: previa.intervaloSeg }, cambios: { activo: nueva.activo, intervaloSeg: nueva.intervaloSeg },
  });
  await reprogramar();
  return obtener();
}

module.exports = {
  TAREA, consultar, consultarSiguiente, iniciar, detener, obtener, actualizar, leerConfig, _estado: estado, _reloj: reloj,
};
