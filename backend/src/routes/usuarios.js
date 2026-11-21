const router = require('express').Router();
const c = require('../controllers/usuariosController');
const { auth, requireRol } = require('../middleware/auth');
const { asyncHandler } = require('../utils/respuesta');

// Fase 6: administración de usuarios, solo ADMIN
router.use(auth, requireRol('ADMIN'));
router.get('/', asyncHandler(c.listar));
router.get('/:id', asyncHandler(c.obtener));
router.post('/', asyncHandler(c.crear));
router.put('/:id', asyncHandler(c.actualizar));

module.exports = router;
