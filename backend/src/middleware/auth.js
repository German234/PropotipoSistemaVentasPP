const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/respuesta');
const { COOKIE_TOKEN, leerCookies } = require('../utils/cookies');

const METODOS_SEGUROS = ['GET', 'HEAD', 'OPTIONS'];

const iguales = (a, b) => {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
};

/**
 * Autenticación. Acepta, en este orden:
 *   1. `Authorization: Bearer <token>` (clientes de API, Postman, pruebas). No necesita CSRF: el navegador nunca
 *      agrega este header por su cuenta.
 *   2. Cookie HttpOnly `pos_token` (frontend del navegador). Como el navegador la manda sola, toda petición que
 *      modifica datos (POST/PUT/PATCH/DELETE) exige `X-CSRF-Token` igual al claim `csrf` del JWT → 403 CSRF_INVALIDO.
 * Deja el usuario en req.usuario = {id, usuario, nombre, rol}.
 */
function auth(req, res, next) {
  const [esquema, bearer] = (req.headers.authorization || '').split(' ');
  const deCookie = !(esquema === 'Bearer' && bearer) ? leerCookies(req)[COOKIE_TOKEN] : null;
  const token = esquema === 'Bearer' && bearer ? bearer : deCookie;
  if (!token) {
    return next(new AppError('NO_AUTENTICADO', 'Falta el token de acceso', 401));
  }
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return next(new AppError('NO_AUTENTICADO', 'Token inválido o vencido', 401));
  }
  if (deCookie && !METODOS_SEGUROS.includes(req.method) && !iguales(req.headers['x-csrf-token'], payload.csrf)) {
    return next(new AppError('CSRF_INVALIDO', 'Falta o no coincide el token anti-CSRF (X-CSRF-Token)', 403));
  }
  const { id, usuario, nombre, rol } = payload;
  req.usuario = { id, usuario, nombre, rol };
  next();
}

/** requireRol('ADMIN') o requireRol('ADMIN','VENDEDOR'). Usar después de auth. */
const requireRol = (...roles) => (req, res, next) => {
  if (!req.usuario || !roles.includes(req.usuario.rol)) {
    return next(new AppError('SIN_PERMISO', `Requiere rol: ${roles.join(' o ')}`, 403));
  }
  next();
};

module.exports = { auth, requireRol };
