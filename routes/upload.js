const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const { subirExcel }  = require('../controllers/uploadController');
const { soloAdmin }   = require('../middleware/authMiddleware');

// Almacenar en memoria (no en disco) para procesar directo
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 50 * 1024 * 1024 }, // 50 MB máx
    fileFilter: (req, file, cb) => {
        const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname);
        cb(ok ? null : new Error('Solo archivos .xlsx, .xls o .csv'), ok);
    }
});

router.post('/', soloAdmin, upload.single('archivo'), subirExcel);

module.exports = router;
