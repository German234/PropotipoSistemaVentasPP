/**
 * Recepción de eventos de invalidación del MH (simulada). Modo de X-Simular:
 *   ok           → PROCESADO con sello propio del evento (40 caracteres)
 *   rechazo      → RECHAZADO, sin sello (el DTE sigue PROCESADO)
 *   contingencia → MH no responde: null (no existe contingencia para eventos; se reintenta la invalidación)
 */
const { generarSello, fhProcesamiento } = require('./mhRecepcion');

function anular({ codigoGeneracion }, modo = 'ok') {
  if (modo === 'contingencia') return null;
  const ahora = new Date();
  const rechazo = modo === 'rechazo';
  return {
    version: 2,
    ambiente: '00',
    versionApp: 2,
    estado: rechazo ? 'RECHAZADO' : 'PROCESADO',
    codigoGeneracion,
    selloRecibido: rechazo ? null : generarSello(ahora),
    fhProcesamiento: fhProcesamiento(ahora),
    clasificaMsg: rechazo ? '98' : '10',
    codigoMsg: rechazo ? '096' : '001',
    descripcionMsg: rechazo ? 'EVENTO DE INVALIDACIÓN RECHAZADO (SIMULADO)' : 'EVENTO DE INVALIDACIÓN RECIBIDO',
    observaciones: rechazo ? ['Rechazo forzado con X-Simular: rechazo'] : [],
  };
}

module.exports = { anular };
