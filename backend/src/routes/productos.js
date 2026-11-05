const router = require('express').Router();
const c = require('../controllers/productosController');
const { auth, requireRol } = require('../middleware/auth');
const { asyncHandler } = require('../utils/respuesta');

router.use(auth);
router.get('/', asyncHandler(c.listar));
router.get('/:id', asyncHandler(c.obtener));
router.post('/', requireRol('ADMIN'), asyncHandler(c.crear));
router.put('/:id', requireRol('ADMIN'), asyncHandler(c.actualizar));

module.exports = router;
