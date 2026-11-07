const router = require('express').Router();
const c = require('../controllers/catalogosController');
const { auth } = require('../middleware/auth');

router.get('/', auth, c.obtener);

module.exports = router;
