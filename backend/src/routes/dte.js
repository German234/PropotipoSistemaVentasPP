const router = require('express').Router();
const c = require('../controllers/dteController');
const { auth, requireRol } = require('../middleware/auth');
const { ROLES_INVALIDAR } = require('../config/politicas');
const { asyncHandler } = require('../utils/respuesta');

router.use(auth);
router.get('/', asyncHandler(c.listar));
router.post('/01', asyncHandler(c.emitir01));
router.post('/03', asyncHandler(c.emitir03));
router.post('/05', asyncHandler(c.emitir05));
router.get('/:id', asyncHandler(c.obtener));
router.get('/:id/pdf', asyncHandler(c.pdf));
router.post('/:id/invalidar', requireRol(...ROLES_INVALIDAR), asyncHandler(c.invalidar));
router.post('/:id/reintentar', asyncHandler(c.reintentar));
router.post('/:id/consultar', asyncHandler(c.consultar));

module.exports = router;
