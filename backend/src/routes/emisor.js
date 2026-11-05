const router = require('express').Router();
const c = require('../controllers/emisorController');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/respuesta');

router.get('/', auth, asyncHandler(c.obtener));

module.exports = router;
