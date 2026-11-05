const { AppError } = require('../utils/respuesta');

/** 404 para rutas /api inexistentes. */
function noEncontrado(req, res, next) {
  next(new AppError('NO_ENCONTRADO', `Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404));
}

/** Middleware final: todo error sale como {ok:false,error:{codigo,mensaje}}. */
// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ ok: false, error: { codigo: err.codigo, mensaje: err.message } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: { codigo: 'VALIDACION', mensaje: 'JSON mal formado' } });
  }
  console.error(err);
  return res.status(500).json({ ok: false, error: { codigo: 'ERROR_INTERNO', mensaje: err.message || 'Error interno' } });
}

module.exports = { noEncontrado, manejadorErrores };
