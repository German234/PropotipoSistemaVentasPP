const router = require('express').Router();
const c = require('../controllers/bitacoraController');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/respuesta');

router.use(auth);
router.get('/', asyncHandler(c.listar));

module.exports = router;
