const authService = require('../services/authService');
const { ok } = require('../utils/respuesta');
const v = require('../utils/validar');

async function login(req, res) {
  const usuario = v.texto(req.body?.usuario, 'usuario', 50);
  const password = v.texto(req.body?.password, 'password', 100);
  ok(res, await authService.login(usuario, password));
}

module.exports = { login };
