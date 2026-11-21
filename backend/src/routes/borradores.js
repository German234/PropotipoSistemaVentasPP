const router = require('express').Router();
const c = require('../controllers/borradoresController');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/respuesta');

// Fase 6: borradores de venta. Cualquier rol; cada usuario solo ve los suyos.
router.use(auth);
router.get('/', asyncHandler(c.listar));
router.get('/:id', asyncHandler(c.obtener));
router.post('/', asyncHandler(c.crear));
router.put('/:id', asyncHandler(c.actualizar));
router.delete('/:id', asyncHandler(c.eliminar));

module.exports = router;
