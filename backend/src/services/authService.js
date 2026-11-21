const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { AppError } = require('../utils/respuesta');
const { registrar } = require('../utils/bitacora');

// Hash de relleno: si el usuario no existe se compara igual, así el tiempo de respuesta no revela qué usuarios existen.
const HASH_RELLENO = bcrypt.hashSync('relleno-no-es-una-clave', 10);

/**
 * Valida credenciales. Devuelve { token, csrf, usuario }. El JWT lleva el claim `csrf` (token anti-CSRF de la
 * sesión del navegador; ver middleware/auth.js). Los intentos fallidos se limitan en middleware/limiteLogin.js.
 */
async function login(usuario, password) {
  const r = await query(
    `SELECT id, usuario, nombre, password_hash, rol FROM dbo.usuarios WHERE usuario = @usuario AND activo = 1`,
    { usuario }
  );
  const u = r.recordset[0];
  const valida = await bcrypt.compare(password, u ? u.password_hash : HASH_RELLENO);
  if (!u || !valida) {
    await registrar(u ? u.id : null, 'LOGIN_FALLIDO', 'usuario', u ? u.id : null, { usuario });
    throw new AppError('CREDENCIALES', 'Usuario o contraseña incorrectos', 401);
  }
  const csrf = crypto.randomBytes(24).toString('base64url');
  const datos = { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol };
  const token = jwt.sign({ ...datos, csrf }, process.env.JWT_SECRET, { expiresIn: '8h', algorithm: 'HS256' });
  await registrar(u.id, 'LOGIN', 'usuario', u.id, null);
  return { token, csrf, usuario: { id: u.id, nombre: u.nombre, rol: u.rol } };
}

module.exports = { login };
