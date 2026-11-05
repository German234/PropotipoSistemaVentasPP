/** Error de negocio con el formato estándar {ok:false,error:{codigo,mensaje}}. */
class AppError extends Error {
  constructor(codigo, mensaje, status = 400) {
    super(mensaje);
    this.codigo = codigo;
    this.status = status;
  }
}

/** Respuesta de éxito estándar. */
function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

/** Envuelve handlers async para que los errores lleguen al middleware de errores (Express 4). */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { AppError, ok, asyncHandler };
