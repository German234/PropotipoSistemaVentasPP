const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { AppError } = require('../utils/respuesta');
const { registrar } = require('../utils/bitacora');

async function login(usuario, password) {
  const r = await query(
    `SELECT id, usuario, nombre, password_hash, rol FROM dbo.usuarios WHERE usuario = @usuario AND activo = 1`,
    { usuario }
  );
  const u = r.recordset[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    await registrar(u ? u.id : null, 'LOGIN_FALLIDO', 'usuario', u ? u.id : null, { usuario });
    throw new AppError('CREDENCIALES', 'Usuario o contraseña incorrectos', 401);
  }
  const datos = { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol };
  const token = jwt.sign(datos, process.env.JWT_SECRET, { expiresIn: '8h' });
  await registrar(u.id, 'LOGIN', 'usuario', u.id, null);
  return { token, usuario: { id: u.id, nombre: u.nombre, rol: u.rol } };
}

module.exports = { login };
