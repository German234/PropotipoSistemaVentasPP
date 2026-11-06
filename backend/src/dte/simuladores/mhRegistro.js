/**
 * "Base de datos de Hacienda" del simulador (tabla mh_simulado_dte): documentos que MH recibió y selló
 * aunque su respuesta no llegara al POS (X-Simular: timeout). La consultan:
 *   - la cola de consultas (consultaMhService) → descubre que el DTE no era una contingencia real;
 *   - un reenvío (reintento o lote de contingencia) → MH responde con el sello original en vez de duplicarlo.
 * `q` es el query de una transacción (o db.query).
 */
const { recibir } = require('./mhRecepcion');

/** MH recibe el JSON firmado y lo sella, pero la respuesta se pierde. Devuelve la respuesta que no llegó. */
async function guardarSinRespuesta(q, { codigoGeneracion, tipoDte, jsonDte, firma }) {
  const existente = await buscar(q, codigoGeneracion);
  if (existente) return existente.respuestaMh; // MH ya lo tenía: no se duplica
  const respuestaMh = recibir({ codigoGeneracion }, 'ok');
  await q(
    `INSERT INTO dbo.mh_simulado_dte (codigo_generacion, tipo_dte, json_dte, firma, respuesta_mh, sello_recibido)
     VALUES (@codigo, @tipo, @json, @firma, @respuesta, @sello)`,
    {
      codigo: codigoGeneracion, tipo: tipoDte, json: JSON.stringify(jsonDte), firma: JSON.stringify(firma),
      respuesta: JSON.stringify(respuestaMh), sello: respuestaMh.selloRecibido,
    }
  );
  return respuestaMh;
}

/** { jsonDte, firma, respuestaMh, selloRecibido } o null si MH no tiene el documento. */
async function buscar(q, codigoGeneracion) {
  const r = await q(
    `SELECT json_dte AS jsonDte, firma, respuesta_mh AS respuestaMh, sello_recibido AS selloRecibido
     FROM dbo.mh_simulado_dte WHERE codigo_generacion = @codigo`,
    { codigo: codigoGeneracion }
  );
  const x = r.recordset[0];
  if (!x) return null;
  return { jsonDte: JSON.parse(x.jsonDte), firma: JSON.parse(x.firma), respuestaMh: JSON.parse(x.respuestaMh), selloRecibido: x.selloRecibido };
}

module.exports = { guardarSinRespuesta, buscar };
