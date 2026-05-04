const express = require('express');
const router  = express.Router();
const { login, verificarSesion } = require('../controllers/authController');
const { verificarToken }         = require('../middleware/authMiddleware');

router.post('/login',    login);
router.get('/verificar', verificarToken, verificarSesion);

module.exports = router;
