const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/respuesta');

/** Exige `Authorization: Bearer <token>` válido. Deja el usuario en req.usuario = {id, usuario, nombre, rol}. */
function auth(req, res, next) {
  const [esquema, token] = (req.headers.authorization || '').split(' ');
  if (esquema !== 'Bearer' || !token) {
    return next(new AppError('NO_AUTENTICADO', 'Falta el token de acceso', 401));
  }
  try {
    const { id, usuario, nombre, rol } = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = { id, usuario, nombre, rol };
    next();
  } catch (err) {
    next(new AppError('NO_AUTENTICADO', 'Token inválido o vencido', 401));
  }
}

/** requireRol('ADMIN') o requireRol('ADMIN','VENDEDOR'). Usar después de auth. */
const requireRol = (...roles) => (req, res, next) => {
  if (!req.usuario || !roles.includes(req.usuario.rol)) {
    return next(new AppError('SIN_PERMISO', `Requiere rol: ${roles.join(' o ')}`, 403));
  }
  next();
};

module.exports = { auth, requireRol };
