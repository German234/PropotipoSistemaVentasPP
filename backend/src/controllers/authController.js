const authService = require('../services/authService');
const { ok } = require('../utils/respuesta');
const v = require('../utils/validar');
const { ponerCookiesSesion, borrarCookiesSesion } = require('../utils/cookies');

/**
 * Devuelve { token, usuario } (clientes de API) y además deja la sesión del navegador en cookies:
 * `pos_token` (HttpOnly, SameSite=Strict) y `pos_csrf` (legible, para el header X-CSRF-Token).
 */
async function login(req, res) {
  const usuario = v.texto(req.body?.usuario, 'usuario', 50);
  const password = v.texto(req.body?.password, 'password', 100);
  const r = await authService.login(usuario, password);
  ponerCookiesSesion(req, res, r.token, r.csrf);
  ok(res, { token: r.token, usuario: r.usuario });
}

async function logout(req, res) {
  borrarCookiesSesion(req, res);
  ok(res, { sesion: 'cerrada' });
}

async function sesion(req, res) {
  const { id, nombre, rol } = req.usuario;
  ok(res, { usuario: { id, nombre, rol } });
}

module.exports = { login, logout, sesion };
