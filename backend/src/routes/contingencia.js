const router = require('express').Router();
const c = require('../controllers/contingenciaController');
const { auth, requireRol } = require('../middleware/auth');
const { asyncHandler } = require('../utils/respuesta');

router.use(auth);
router.get('/', asyncHandler(c.listar));
router.get('/programacion', asyncHandler(c.obtenerProgramacion));
router.put('/programacion', requireRol('ADMIN'), asyncHandler(c.actualizarProgramacion));
router.get('/consultas', asyncHandler(c.obtenerConsultas));
router.put('/consultas', requireRol('ADMIN'), asyncHandler(c.actualizarConsultas));
router.get('/:id', asyncHandler(c.obtener));
router.post('/', requireRol('ADMIN'), asyncHandler(c.enviar));

module.exports = router;
