const router = require('express').Router();
const c = require('../controllers/bitacoraController');
const { auth, requireRol } = require('../middleware/auth');
const { ROLES_LEER_BITACORA } = require('../config/politicas');
const { asyncHandler } = require('../utils/respuesta');

// KAN-36: la bitácora de auditoría solo la lee ADMIN (otro rol → 403 SIN_PERMISO). El registro no cambia.
router.use(auth, requireRol(...ROLES_LEER_BITACORA));
router.get('/', asyncHandler(c.listar));

module.exports = router;
