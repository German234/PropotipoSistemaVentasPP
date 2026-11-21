/**
 * Lote automático de contingencia (cierre del día).
 *
 * Todos los días a la hora configurada (HH:mm, hora local del servidor) arma un lote con TODOS los DTE
 * que estén en CONTINGENCIA y lo envía: evento de contingencia (v4) → si MH lo acepta, recepción por
 * lote de los DTE (contingenciaService.enviar con origen AUTOMATICO, MH simulado en modo ok).
 *
 * Fase 5 — persistente (dbo.config_tarea, tarea LOTE_CONTINGENCIA; ver tareasProgramadas.js):
 *   - activo y hora se guardan en SQL Server y se recuperan al reiniciar. backend/.env solo da el valor de la
 *     primera vez: CONTINGENCIA_LOTE_HORA (por defecto "23:55"), CONTINGENCIA_LOTE_ACTIVO (por defecto 1).
 *   - Sin ejecuciones duplicadas: candado en BD (otro proceso o turno en curso → OMITIDA) y, para el temporizador,
 *     un lote por día como máximo (un reinicio u otro proceso no lo repiten).
 *   - Cada ejecución queda en dbo.ejecucion_tarea (resultado, duración, error).
 * El temporizador solo corre si server.js llamó a iniciar(); en cada disparo vuelve a leer la configuración.
 */
const { query } = require('../config/db');
const { AppError } = require('../utils/respuesta');
const { registrar } = require('../utils/bitacora');
const contingenciaService = require('./contingenciaService');
const { marcaTiempo } = require('./dteService');
const tareas = require('./tareasProgramadas');

const TAREA = 'LOTE_CONTINGENCIA';
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MOTIVO_AUTO = 'Lote automático de cierre del día: DTE emitidos sin respuesta de MH';
const TTL_CANDADO_SEG = 600;     // un lote tarda segundos; si el proceso muere a mitad, el candado vence a los 10 min
const REINTENTO_MS = 60000;      // si no se puede leer la configuración (BD caída), se reintenta al minuto

/** Valores de la primera vez (backend/.env). */
function porDefecto() {
  return {
    activo: !['0', 'false', 'no'].includes(String(process.env.CONTINGENCIA_LOTE_ACTIVO || '1').toLowerCase()),
    hora: HORA_RE.test(process.env.CONTINGENCIA_LOTE_HORA || '') ? process.env.CONTINGENCIA_LOTE_HORA : '23:55',
  };
}

/** Estado del proceso (no la configuración): temporizador y ejecución en curso en ESTE proceso. */
const estado = { iniciado: false, timer: null, generacion: 0, ejecutando: false };
/** Reloj inyectable (las pruebas capturan el callback programado y lo disparan). */
const reloj = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (t) => clearTimeout(t) };

const leerConfig = () => tareas.leerConfig(TAREA, porDefecto());

/** Próxima fecha (Date) en que toca la hora "HH:mm" a partir de `ahora` (si ya pasó hoy → mañana). */
function proximaEjecucion(hora, ahora = new Date()) {
  const [h, m] = hora.split(':').map(Number);
  const p = new Date(ahora);
  p.setHours(h, m, 0, 0);
  if (p <= ahora) p.setDate(p.getDate() + 1);
  return p;
}

/** Usuario con el que se firma el lote automático: el primer ADMIN activo. */
async function usuarioSistema() {
  const r = await query(
    `SELECT TOP 1 id, usuario, nombre, rol FROM dbo.usuarios WHERE rol = 'ADMIN' AND activo = 1 ORDER BY id`
  );
  if (!r.recordset[0]) throw new AppError('ESTADO_INVALIDO', 'No hay un usuario ADMIN activo para firmar el lote automático', 409);
  return r.recordset[0];
}

/** El lote propiamente dicho (sin cambios respecto de C2). */
async function correrLote(modo, fecha) {
  const usuario = await usuarioSistema();
  try {
    const ev = await contingenciaService.enviar({ motivo: MOTIVO_AUTO }, usuario, modo, 'AUTOMATICO');
    return {
      fecha, resultado: ev.estado, eventoId: ev.id, codigoLote: ev.codigoLote, cantidad: ev.cantidad,
      mensaje: ev.estado === 'PROCESADO'
        ? `Lote enviado: ${ev.lote.procesados} de ${ev.cantidad} DTE transmitidos y sellados`
        : 'MH rechazó el evento; los DTE siguen en contingencia',
    };
  } catch (e) {
    if (e.codigo === 'ESTADO_INVALIDO') {
      const res = { fecha, resultado: 'SIN_PENDIENTES', eventoId: null, codigoLote: null, cantidad: 0, mensaje: 'No había DTE en contingencia' };
      await registrar(usuario.id, 'CONTINGENCIA', 'evento_contingencia', null, { origen: 'AUTOMATICO', ...res });
      return res;
    }
    if (e.codigo === 'MH_NO_DISPONIBLE') {
      // contingenciaService ya dejó la bitácora SIN_RESPUESTA
      return { fecha, resultado: 'SIN_RESPUESTA', eventoId: null, codigoLote: null, cantidad: null, mensaje: e.message };
    }
    throw e;
  }
}

/**
 * Corre el lote del cierre del día. No lanza. resultado: PROCESADO | RECHAZADO | SIN_PENDIENTES | SIN_RESPUESTA |
 * OMITIDA (ya en curso / ya hecho hoy) | ERROR. Siempre queda en dbo.ejecucion_tarea.
 * @param {'ok'|'rechazo'|'contingencia'} modo  simulación de MH (el temporizador siempre usa ok)
 * @param {'TEMPORIZADOR'|'DIRECTO'} disparo     el temporizador además exige no haber corrido ya ese día
 */
async function ejecutar(modo = 'ok', disparo = 'DIRECTO') {
  const inicio = new Date();
  const fecha = marcaTiempo().fechaEmision;
  const dia = disparo === 'TEMPORIZADOR' ? tareas.hoy(inicio) : null;
  let res;
  let error = null;
  if (estado.ejecutando) {
    res = { fecha, resultado: 'OMITIDA', eventoId: null, codigoLote: null, cantidad: null, mensaje: 'Ya hay un lote en curso en este proceso' };
  } else {
    estado.ejecutando = true;
    try {
      await leerConfig(); // asegura la fila del candado
      const candado = await tareas.adquirir(TAREA, TTL_CANDADO_SEG, { dia });
      if (!candado.ok) {
        res = { fecha, resultado: 'OMITIDA', eventoId: null, codigoLote: null, cantidad: null, mensaje: candado.motivo };
      } else {
        try {
          res = await correrLote(modo, fecha);
        } finally {
          await tareas.liberar(TAREA, { dia });
        }
      }
    } catch (e) {
      error = e;
      res = { fecha, resultado: 'ERROR', eventoId: null, codigoLote: null, cantidad: null, mensaje: 'Error interno al ejecutar el lote automático (ver registro de ejecuciones)' };
      console.error('[lote automático de contingencia]', e);
    } finally {
      estado.ejecutando = false;
    }
  }
  await tareas.registrarEjecucion({ tarea: TAREA, disparo, inicio, resultado: res.resultado, mensaje: res.mensaje, detalle: res, error });
  return res;
}

/** Lee la configuración de la BD y programa el siguiente disparo (o nada si está desactivado / detenido). */
async function reprogramar() {
  reloj.clearTimeout(estado.timer);
  estado.timer = null;
  const gen = ++estado.generacion;
  if (!estado.iniciado) return null;
  let cfg;
  try {
    cfg = await leerConfig();
  } catch (e) {
    console.error('[lote automático] no se pudo leer la configuración; reintento en 60 s:', e.message);
    if (gen === estado.generacion && estado.iniciado) estado.timer = programar(reprogramar, REINTENTO_MS);
    return null;
  }
  if (gen !== estado.generacion || !estado.iniciado || !cfg.activo) return cfg; // otro reprogramar() más nuevo manda
  const espera = proximaEjecucion(cfg.hora).getTime() - Date.now();
  estado.timer = programar(disparar, espera);
  return cfg;
}

function programar(fn, ms) {
  const t = reloj.setTimeout(fn, ms);
  if (t && t.unref) t.unref();
  return t;
}

/** Callback del temporizador: vuelve a leer la configuración (pudo cambiar en otro proceso), ejecuta y reprograma. */
async function disparar() {
  estado.timer = null;
  try {
    const cfg = await leerConfig();
    if (cfg.activo) await ejecutar('ok', 'TEMPORIZADOR');
  } catch (e) {
    console.error('[lote automático] disparo fallido:', e.message);
  }
  await reprogramar();
}

/** server.js: arranca el temporizador con la configuración guardada. Devuelve la configuración leída. */
async function iniciar() {
  estado.iniciado = true;
  return reprogramar();
}

/** Detiene el temporizador (pruebas / apagado). */
function detener() {
  estado.iniciado = false;
  reloj.clearTimeout(estado.timer);
  estado.timer = null;
  estado.generacion += 1;
}

/** GET /api/contingencia/programacion */
async function obtener() {
  const cfg = await leerConfig();
  return {
    activo: cfg.activo,
    hora: cfg.hora,
    proximaEjecucion: cfg.activo ? marcaTiempo(proximaEjecucion(cfg.hora)).fechaEmision : null,
    ultimaEjecucion: await tareas.ultimaEjecucion(TAREA),
    pendientes: await contingenciaService.contarPendientes(),
  };
}

/** PUT /api/contingencia/programacion — { activo?: boolean, hora?: "HH:mm" } (ADMIN). Persiste y reprograma. */
async function actualizar(body, usuario) {
  const b = body || {};
  if (b.activo === undefined && b.hora === undefined) throw new AppError('VALIDACION', 'Envíe activo y/o hora', 400);
  if (b.activo !== undefined && typeof b.activo !== 'boolean') throw new AppError('VALIDACION', 'activo debe ser true o false', 400);
  if (b.hora !== undefined && (typeof b.hora !== 'string' || !HORA_RE.test(b.hora))) {
    throw new AppError('VALIDACION', 'hora debe tener el formato HH:mm (00:00 a 23:59)', 400);
  }
  const previa = await leerConfig();
  const nueva = await tareas.guardarConfig(TAREA, { activo: b.activo, hora: b.hora }, porDefecto(), usuario.id);
  await registrar(usuario.id, 'ACTUALIZAR', 'programacion_contingencia', null, {
    antes: { activo: previa.activo, hora: previa.hora }, cambios: { activo: nueva.activo, hora: nueva.hora },
  });
  await reprogramar();
  return obtener();
}

module.exports = {
  TAREA, proximaEjecucion, usuarioSistema, ejecutar, iniciar, detener, obtener, actualizar, leerConfig, _estado: estado, _reloj: reloj,
};
