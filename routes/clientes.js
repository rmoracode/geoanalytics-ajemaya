const express = require('express');
const router  = express.Router();
const { getClientes, getStats, borrarClientes } = require('../controllers/clientesController');
const { soloAdmin } = require('../middleware/authMiddleware');

router.get('/',           getClientes);
router.get('/stats',      getStats);
router.delete('/borrar',  soloAdmin, borrarClientes);

module.exports = router;
