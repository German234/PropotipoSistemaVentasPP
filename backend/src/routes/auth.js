const router = require('express').Router();
const c = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { limiteIntentosLogin } = require('../middleware/limiteLogin');
const { asyncHandler } = require('../utils/respuesta');

router.post('/login', limiteIntentosLogin, asyncHandler(c.login));
router.post('/logout', asyncHandler(c.logout));          // sin auth: borrar cookies siempre es seguro
router.get('/sesion', auth, asyncHandler(c.sesion));     // el frontend restaura la sesión desde la cookie

module.exports = router;
