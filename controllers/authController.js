const jwt  = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Para la demo: credenciales del admin desde .env
// En producción: consultar tabla de usuarios en DB
async function login(req, res) {
    const { usuario, clave } = req.body;

    if (!usuario || !clave) {
        return res.status(400).json({ error: 'Usuario y clave requeridos' });
    }

    const adminUser = process.env.ADMIN_USER;
    const adminPass = process.env.ADMIN_PASS;

    if (usuario !== adminUser || clave !== adminPass) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
        { usuario, rol: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '12h' }
    );

    res.json({ token, rol: 'admin', usuario });
}

function verificarSesion(req, res) {
    res.json({ valido: true, usuario: req.user.usuario, rol: req.user.rol });
}

module.exports = { login, verificarSesion };
