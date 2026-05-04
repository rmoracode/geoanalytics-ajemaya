const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    ssl:      false,
    connectionTimeoutMillis: 30000,      // 30s para conectar
    idleTimeoutMillis:       60000,      // 1m para idle
    statementTimeoutMillis:  600000,     // 10m para queries largas (imports)
    max:                     20           // Más conexiones para paralelismo
});

pool.on('error', (err) => {
    console.error('Error inesperado en pool PostgreSQL:', err.message);
});

module.exports = pool;
