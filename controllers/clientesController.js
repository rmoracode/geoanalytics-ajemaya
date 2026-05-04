const pool    = require('../models/db');
const Cliente = require('../models/Cliente');

async function borrarClientes(req, res) {
    try {
        await pool.query('TRUNCATE TABLE clientes RESTART IDENTITY');
        await pool.query('TRUNCATE TABLE importaciones RESTART IDENTITY');
        res.json({ mensaje: 'Base de datos borrada correctamente' });
    } catch (err) {
        console.error('Error borrarClientes:', err.message);
        res.status(500).json({ error: 'Error al borrar la base de datos' });
    }
}

async function getClientes(req, res) {
    try {
        const { zona, ruta, canal, tipo, search } = req.query;
        const data = await Cliente.getAll({ zona, ruta, canal, tipo, search });
        res.json(data);
    } catch (err) {
        console.error('Error getClientes:', err.message);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
}

async function getStats(req, res) {
    try {
        const [stats, filtros, ultimaImport] = await Promise.all([
            Cliente.getStats(),
            Cliente.getUniqueValues(),
            Cliente.getUltimaImportacion()
        ]);
        res.json({ stats, filtros, ultimaImport });
    } catch (err) {
        console.error('Error getStats:', err.message);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
}

module.exports = { getClientes, getStats, borrarClientes };
