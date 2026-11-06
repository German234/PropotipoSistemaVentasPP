const router = require('express').Router();
const c = require('../controllers/clientesController');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/respuesta');

// Clientes: cualquier usuario autenticado (el vendedor registra clientes en caja)
router.use(auth);
router.get('/', asyncHandler(c.listar));
router.get('/:id', asyncHandler(c.obtener));
router.post('/', asyncHandler(c.crear));
router.put('/:id', asyncHandler(c.actualizar));

module.exports = router;
