const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Token requerido' });

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        res.status(403).json({ error: 'Token inválido o expirado' });
    }
}

function soloAdmin(req, res, next) {
    verificarToken(req, res, () => {
        if (req.user.rol !== 'admin') {
            return res.status(403).json({ error: 'Solo administradores' });
        }
        next();
    });
}

module.exports = { verificarToken, soloAdmin };
