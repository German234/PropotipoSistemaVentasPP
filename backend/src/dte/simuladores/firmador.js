/**
 * Firmador simulado. Devuelve { status: "OK", body: "<JWS falso>" } con
 * body = base64url(header).base64url(json).base64url(random).
 * Recibe el modo de X-Simular (ver mhRecepcion.leerModo) pero responde OK en cualquier modo:
 * el firmador corre en local; la contingencia es que MH no responda, no el firmador.
 */
const crypto = require('crypto');
const { leerModo } = require('./mhRecepcion');

const b64url = (texto) => Buffer.from(texto).toString('base64url');

// eslint-disable-next-line no-unused-vars
function firmar(jsonDte, modo = 'ok') {
  const header = b64url(JSON.stringify({ alg: 'RS512', typ: 'JWS' }));
  const payload = b64url(JSON.stringify(jsonDte));
  const firma = crypto.randomBytes(64).toString('base64url');
  return { status: 'OK', body: `${header}.${payload}.${firma}` };
}

module.exports = { firmar, leerModo };
