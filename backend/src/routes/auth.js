const router = require('express').Router();
const c = require('../controllers/authController');
const { asyncHandler } = require('../utils/respuesta');

router.post('/login', asyncHandler(c.login));

module.exports = router;
