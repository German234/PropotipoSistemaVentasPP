/**
 * Recepción del evento de contingencia del MH (simulada). Modo de X-Simular:
 *   ok           → PROCESADO con sello propio del evento (40 caracteres)
 *   rechazo      → RECHAZADO, sin sello (los DTE siguen en CONTINGENCIA)
 *   contingencia → MH sigue sin responder: null (no se guarda el evento; se vuelve a enviar después)
 */
const { generarSello, fhProcesamiento } = require('./mhRecepcion');

function recibirEvento({ codigoGeneracion }, modo = 'ok') {
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
    descripcionMsg: rechazo ? 'EVENTO DE CONTINGENCIA RECHAZADO (SIMULADO)' : 'EVENTO DE CONTINGENCIA RECIBIDO',
    observaciones: rechazo ? ['Rechazo forzado con X-Simular: rechazo'] : [],
  };
}

module.exports = { recibirEvento };
