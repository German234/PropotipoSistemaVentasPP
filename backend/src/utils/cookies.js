/** Cookies de sesión del navegador (sin dependencias). */
const { cookieSegura } = require('../config/seguridad');

const COOKIE_TOKEN = 'pos_token';   // JWT · HttpOnly: el JavaScript de la página no puede leerlo
const COOKIE_CSRF = 'pos_csrf';     // token anti-CSRF · legible por el frontend, que lo reenvía en X-CSRF-Token
const DURACION_S = 8 * 3600;        // igual que el JWT

/** "a=1; b=2" → { a: '1', b: '2' } */
function leerCookies(req) {
  const out = {};
  for (const parte of String((req.headers && req.headers.cookie) || '').split(';')) {
    const i = parte.indexOf('=');
    if (i < 1) continue;
    const k = parte.slice(0, i).trim();
    try { out[k] = decodeURIComponent(parte.slice(i + 1).trim()); } catch { /* valor mal codificado: se ignora */ }
  }
  return out;
}

function opciones(req, httpOnly, maxAge) {
  return { httpOnly, sameSite: 'strict', secure: cookieSegura(req), path: '/', maxAge: maxAge * 1000 };
}

function ponerCookiesSesion(req, res, token, csrf) {
  res.cookie(COOKIE_TOKEN, token, opciones(req, true, DURACION_S));
  res.cookie(COOKIE_CSRF, csrf, opciones(req, false, DURACION_S));
}

function borrarCookiesSesion(req, res) {
  const { maxAge, ...o } = opciones(req, true, 0); // eslint-disable-line no-unused-vars
  res.clearCookie(COOKIE_TOKEN, o);
  res.clearCookie(COOKIE_CSRF, { ...o, httpOnly: false });
}

module.exports = { COOKIE_TOKEN, COOKIE_CSRF, leerCookies, ponerCookiesSesion, borrarCookiesSesion };
