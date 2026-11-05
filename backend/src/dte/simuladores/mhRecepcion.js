/**
 * Recepción de MH simulada. El modo sale del header X-Simular: ok (defecto) | rechazo | contingencia.
 *   ok           → estado PROCESADO con selloRecibido (año + 36 alfanuméricos = 40 caracteres)
 *   rechazo      → estado RECHAZADO, selloRecibido null, observaciones con el motivo
 *   contingencia → MH no responde: devuelve null (el DTE queda en CONTINGENCIA y se puede reintentar)
 */
const crypto = require('crypto');
const { AppError } = require('../../utils/respuesta');

const MODOS = ['ok', 'rechazo', 'contingencia'];
const ALFANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Modo de X-Simular (minúsculas). Valor desconocido → 400 VALIDACION. */
function leerModo(req) {
  const modo = String(req.get('X-Simular') || 'ok').trim().toLowerCase();
  if (!MODOS.includes(modo)) {
    throw new AppError('VALIDACION', `X-Simular debe ser ${MODOS.join(' | ')}`, 400);
  }
  return modo;
}

/** Año + 36 caracteres alfanuméricos en mayúsculas = 40. */
function generarSello(fecha = new Date()) {
  const bytes = crypto.randomBytes(36);
  let s = String(fecha.getFullYear());
  for (const b of bytes) s += ALFANUM[b % ALFANUM.length];
  return s;
}

const dos = (n) => String(n).padStart(2, '0');
/** dd/MM/yyyy HH:mm:ss (hora local) */
const fhProcesamiento = (d = new Date()) =>
  `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;

/**
 * Envía el DTE firmado al MH simulado.
 * @returns {object|null} respuesta MH, o null si el modo es contingencia (MH no respondió)
 */
function recibir({ codigoGeneracion, versionApp = 2 }, modo = 'ok') {
  if (modo === 'contingencia') return null;
  const ahora = new Date();
  const rechazo = modo === 'rechazo';
  return {
    version: 2,
    ambiente: '00',
    versionApp,
    estado: rechazo ? 'RECHAZADO' : 'PROCESADO',
    codigoGeneracion,
    selloRecibido: rechazo ? null : generarSello(ahora),
    fhProcesamiento: fhProcesamiento(ahora),
    clasificaMsg: rechazo ? '98' : '10',
    codigoMsg: rechazo ? '096' : '001',
    descripcionMsg: rechazo ? 'DOCUMENTO RECHAZADO (SIMULADO)' : 'RECIBIDO',
    observaciones: rechazo ? ['Rechazo forzado con X-Simular: rechazo'] : [],
  };
}

module.exports = { MODOS, leerModo, generarSello, fhProcesamiento, recibir };
