/**
 * Lote automático de contingencia (cierre del día).
 *
 * Todos los días a la hora configurada (HH:mm, hora local del servidor) arma un lote con TODOS los DTE
 * que estén en CONTINGENCIA y lo envía: evento de contingencia (v4) → si MH lo acepta, recepción por
 * lote de los DTE (contingenciaService.enviar con origen AUTOMATICO, MH simulado en modo ok).
 *
 * Configuración en memoria (se pierde al reiniciar; el valor inicial sale de backend/.env):
 *   CONTINGENCIA_LOTE_HORA   (por defecto "23:55")
 *   CONTINGENCIA_LOTE_ACTIVO (por defecto 1; 0/false lo desactiva)
 *
 * El temporizador solo corre si server.js llamó a iniciar() (las pruebas usan ejecutar() directamente).
 */
const { query } = require('../config/db');
const { AppError } = require('../utils/respuesta');
const { registrar } = require('../utils/bitacora');
const contingenciaService = require('./contingenciaService');
const { marcaTiempo } = require('./dteService');

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MOTIVO_AUTO = 'Lote automático de cierre del día: DTE emitidos sin respuesta de MH';

const estado = {
  activo: !['0', 'false', 'no'].includes(String(process.env.CONTINGENCIA_LOTE_ACTIVO || '1').toLowerCase()),
  hora: HORA_RE.test(process.env.CONTINGENCIA_LOTE_HORA || '') ? process.env.CONTINGENCIA_LOTE_HORA : '23:55',
  iniciado: false,
  timer: null,
  ejecutando: false,
  ultimaEjecucion: null,
};

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

/**
 * Corre el lote del cierre del día ahora mismo. No lanza: el resultado queda en ultimaEjecucion
 * (y en bitácora si no hubo evento). resultado: PROCESADO | RECHAZADO | SIN_PENDIENTES | SIN_RESPUESTA | ERROR.
 * @param {'ok'|'rechazo'|'contingencia'} modo  simulación de MH (el temporizador siempre usa ok)
 */
async function ejecutar(modo = 'ok') {
  if (estado.ejecutando) return estado.ultimaEjecucion;
  estado.ejecutando = true;
  const fecha = marcaTiempo().fechaEmision;
  let res;
  try {
    const usuario = await usuarioSistema();
    try {
      const ev = await contingenciaService.enviar({ motivo: MOTIVO_AUTO }, usuario, modo, 'AUTOMATICO');
      res = {
        fecha, resultado: ev.estado, eventoId: ev.id, codigoLote: ev.codigoLote, cantidad: ev.cantidad,
        mensaje: ev.estado === 'PROCESADO'
          ? `Lote enviado: ${ev.lote.procesados} de ${ev.cantidad} DTE transmitidos y sellados`
          : 'MH rechazó el evento; los DTE siguen en contingencia',
      };
    } catch (e) {
      if (e.codigo === 'ESTADO_INVALIDO') {
        res = { fecha, resultado: 'SIN_PENDIENTES', eventoId: null, codigoLote: null, cantidad: 0, mensaje: 'No había DTE en contingencia' };
        await registrar(usuario.id, 'CONTINGENCIA', 'evento_contingencia', null, { origen: 'AUTOMATICO', ...res });
      } else if (e.codigo === 'MH_NO_DISPONIBLE') {
        // contingenciaService ya dejó la bitácora SIN_RESPUESTA
        res = { fecha, resultado: 'SIN_RESPUESTA', eventoId: null, codigoLote: null, cantidad: null, mensaje: e.message };
      } else throw e;
    }
  } catch (e) {
    res = { fecha, resultado: 'ERROR', eventoId: null, codigoLote: null, cantidad: null, mensaje: e.message };
    console.error('[lote automático de contingencia]', e);
  } finally {
    estado.ejecutando = false;
  }
  estado.ultimaEjecucion = res;
  return res;
}

function reprogramar() {
  clearTimeout(estado.timer);
  estado.timer = null;
  if (!estado.iniciado || !estado.activo) return;
  const espera = proximaEjecucion(estado.hora).getTime() - Date.now();
  estado.timer = setTimeout(async () => {
    await ejecutar('ok');
    reprogramar();
  }, espera);
  if (estado.timer.unref) estado.timer.unref();
}

/** server.js: arranca el temporizador. */
function iniciar() {
  estado.iniciado = true;
  reprogramar();
}

/** Detiene el temporizador (pruebas / apagado). */
function detener() {
  estado.iniciado = false;
  reprogramar();
}

/** GET /api/contingencia/programacion */
async function obtener() {
  return {
    activo: estado.activo,
    hora: estado.hora,
    proximaEjecucion: estado.activo ? marcaTiempo(proximaEjecucion(estado.hora)).fechaEmision : null,
    ultimaEjecucion: estado.ultimaEjecucion,
    pendientes: await contingenciaService.contarPendientes(),
  };
}

/** PUT /api/contingencia/programacion — { activo?: boolean, hora?: "HH:mm" } */
async function actualizar(body, usuario) {
  const b = body || {};
  if (b.activo === undefined && b.hora === undefined) throw new AppError('VALIDACION', 'Envíe activo y/o hora', 400);
  if (b.activo !== undefined && typeof b.activo !== 'boolean') throw new AppError('VALIDACION', 'activo debe ser true o false', 400);
  if (b.hora !== undefined && (typeof b.hora !== 'string' || !HORA_RE.test(b.hora))) {
    throw new AppError('VALIDACION', 'hora debe tener el formato HH:mm (00:00 a 23:59)', 400);
  }
  const antes = { activo: estado.activo, hora: estado.hora };
  if (b.activo !== undefined) estado.activo = b.activo;
  if (b.hora !== undefined) estado.hora = b.hora;
  reprogramar();
  await registrar(usuario.id, 'ACTUALIZAR', 'programacion_contingencia', null, { antes, cambios: { activo: estado.activo, hora: estado.hora } });
  return obtener();
}

module.exports = { proximaEjecucion, usuarioSistema, ejecutar, iniciar, detener, obtener, actualizar, _estado: estado };
