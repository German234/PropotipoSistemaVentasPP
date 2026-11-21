const crypto = require('crypto');
const { AppError } = require('../utils/respuesta');

/** 404 para rutas /api inexistentes. */
function noEncontrado(req, res, next) {
  next(new AppError('NO_ENCONTRADO', `Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404));
}

/**
 * Middleware final: todo error sale como {ok:false,error:{codigo,mensaje}}.
 * - AppError: mensaje pensado para el cliente (validaciones, reglas de negocio).
 * - Errores del parser de JSON (body-parser): 400/413 con texto fijo.
 * - Cualquier otro (SQL, bug, librería): 500 con mensaje GENÉRICO y una referencia. El detalle (mensaje, stack,
 *   consulta) solo va al log del servidor, nunca a la respuesta HTTP.
 */
// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ ok: false, error: { codigo: err.codigo, mensaje: err.message } });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: { codigo: 'VALIDACION', mensaje: 'JSON mal formado' } });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, error: { codigo: 'VALIDACION', mensaje: 'El cuerpo de la petición es demasiado grande' } });
  }
  if (err && err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ ok: false, error: { codigo: 'VALIDACION', mensaje: 'Petición inválida' } });
  }
  const ref = crypto.randomBytes(4).toString('hex').toUpperCase();
  console.error(`[ERROR_INTERNO ref=${ref}] ${req && req.method} ${req && req.originalUrl}`, err);
  return res.status(500).json({
    ok: false, error: { codigo: 'ERROR_INTERNO', mensaje: `Error interno del servidor (referencia ${ref})` },
  });
}

module.exports = { noEncontrado, manejadorErrores };
