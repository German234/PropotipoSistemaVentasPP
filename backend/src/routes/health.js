const router = require('express').Router();
const db = require('../config/db');
const { ok, asyncHandler, AppError } = require('../utils/respuesta');
const { mostrarCredencialesDemo, CREDENCIALES_DEMO } = require('../config/seguridad');

/**
 * GET /api/health — verifica API y conexión a SQL Server.
 * `demo`: credenciales de prueba para el login, solo en el entorno académico local (config/seguridad.js); si no, null.
 */
router.get('/', asyncHandler(async (req, res) => {
  try {
    await db.query('SELECT 1 AS ok');
  } catch (err) {
    console.error('[health] BD no disponible:', err.message);
    throw new AppError('DB_NO_DISPONIBLE', 'No se pudo conectar a la base de datos', 503);
  }
  ok(res, {
    api: 'ok', db: 'ok', ambiente: '00', fecha: new Date().toISOString(),
    demo: mostrarCredencialesDemo(req) ? { credenciales: CREDENCIALES_DEMO } : null,
  });
}));

module.exports = router;
