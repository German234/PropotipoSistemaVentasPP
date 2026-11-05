const router = require('express').Router();
const { query } = require('../config/db');
const { ok, asyncHandler, AppError } = require('../utils/respuesta');

// GET /api/health — verifica API y conexión a SQL Server
router.get('/', asyncHandler(async (req, res) => {
  try {
    await query('SELECT 1 AS ok');
  } catch (err) {
    throw new AppError('DB_NO_DISPONIBLE', `No se pudo conectar a la base de datos: ${err.message}`, 503);
  }
  ok(res, { api: 'ok', db: 'ok', ambiente: '00', fecha: new Date().toISOString() });
}));

module.exports = router;
