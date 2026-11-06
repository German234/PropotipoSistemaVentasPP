/**
 * Servicio de consulta de DTE del MH (simulado): "¿recibiste este codigoGeneracion?".
 * Lo usa la cola de consultas para saber si un DTE en CONTINGENCIA realmente llegó a Hacienda.
 *
 *   consultar(registro, codigoGeneracion, modo)
 *     modo contingencia | timeout → null (MH tampoco responde a la consulta)
 *     registro (fila de mh_simulado_dte) → la respuesta PROCESADO original, con su sello y fhProcesamiento
 *     sin registro → estado null, codigoMsg 004 "DOCUMENTO NO ENCONTRADO" (es una contingencia real)
 */
const { fhProcesamiento, sinRespuesta } = require('./mhRecepcion');

function consultar(registro, codigoGeneracion, modo = 'ok') {
  if (sinRespuesta(modo)) return null;
  if (registro) {
    return { ...registro.respuestaMh, descripcionMsg: 'DOCUMENTO ENCONTRADO: RECIBIDO Y PROCESADO' };
  }
  return {
    version: 2,
    ambiente: '00',
    versionApp: 2,
    estado: null,
    codigoGeneracion,
    selloRecibido: null,
    fhProcesamiento: fhProcesamiento(new Date()),
    clasificaMsg: '99',
    codigoMsg: '004',
    descripcionMsg: 'DOCUMENTO NO ENCONTRADO (SIMULADO)',
    observaciones: [],
  };
}

module.exports = { consultar };
