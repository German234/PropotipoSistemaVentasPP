/**
 * Recepción del evento de contingencia del MH (simulada). Modo de X-Simular:
 *   ok           → PROCESADO con sello propio del evento (40 caracteres)
 *   rechazo      → RECHAZADO, sin sello (los DTE siguen en CONTINGENCIA)
 *   contingencia → MH sigue sin responder: null (no se guarda el evento; se vuelve a enviar después)
 */
const crypto = require('crypto');
const { generarSello, fhProcesamiento, sinRespuesta } = require('./mhRecepcion');

function recibirEvento({ codigoGeneracion }, modo = 'ok') {
  if (sinRespuesta(modo)) return null;
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

/**
 * Recepción por lote (simulada): tras aceptar el evento, MH recibe los DTE firmados en un solo envío
 * ({ ambiente, idEnvio, version, nitEmisor, documentos[] }) y responde con el código del lote.
 * Siempre RECIBIDO: el lote solo se envía cuando MH ya aceptó el evento (MH disponible).
 */
function recibirLote({ idEnvio }) {
  return {
    version: 2,
    ambiente: '00',
    versionApp: 2,
    estado: 'RECIBIDO',
    idEnvio,
    fhProcesamiento: fhProcesamiento(new Date()),
    codigoLote: crypto.randomUUID().toUpperCase(),
    codigoMsg: '001',
    descripcionMsg: 'LOTE RECIBIDO, VALIDADO PROCESAMIENTO EN COLA (SIMULADO)',
  };
}

module.exports = { recibirEvento, recibirLote };
