const router = require('express').Router();
const c = require('../controllers/dteController');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/respuesta');

router.use(auth);
router.get('/', asyncHandler(c.listar));
router.post('/01', asyncHandler(c.emitir01));
router.post('/03', asyncHandler(c.emitir03));
router.post('/05', asyncHandler(c.emitir05));
router.get('/:id', asyncHandler(c.obtener));
router.post('/:id/invalidar', asyncHandler(c.invalidar));
router.post('/:id/reintentar', asyncHandler(c.reintentar));
router.post('/:id/consultar', asyncHandler(c.consultar));

module.exports = router;
