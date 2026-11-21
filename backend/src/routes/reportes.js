const router = require('express').Router();
const { auth, requireRol } = require('../middleware/auth');
const { ok, asyncHandler } = require('../utils/respuesta');
const service = require('../services/reportesService');

// Fase 6: reportes gerenciales con datos reales (solo ADMIN, que es quien ve el panel gerencial)
router.use(auth, requireRol('ADMIN'));
router.get('/resumen', asyncHandler(async (req, res) => {
  const { desde, hasta, tipo } = req.query;
  ok(res, await service.resumen({ desde, hasta, tipo }));
}));

module.exports = router;
