require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const Cliente  = require('./models/Cliente');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────
app.use(cors());
// Nota: multer.single() debe estar ANTES de express.json/urlencoded para routes con file uploads
app.use(express.static(path.join(__dirname, 'public')));

// ── Rutas API ──────────────────────────────────────────────────
// Upload route must be before json/urlencoded middleware
app.use('/api/upload',   require('./routes/upload'));

// Ahora sí los body parsers para el resto
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/clientes', require('./routes/clientes'));

// ── Rutas de páginas ───────────────────────────────────────────
app.get('/',            (req, res) => res.sendFile(path.join(__dirname, 'public', 'supervisor.html')));
app.get('/supervisor',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'supervisor.html')));
app.get('/admin',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/login',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

// ── Inicializar DB y arrancar servidor ─────────────────────────
async function iniciar() {
    try {
        console.log('Conectando a PostgreSQL...');
        await Cliente.crearTabla();
        console.log('Tablas verificadas/creadas correctamente');
        await Cliente.crearIndices();

        app.listen(PORT, () => {
            console.log(`\n✓ GeoAnalítica Táctica corriendo en http://localhost:${PORT}`);
            console.log(`  → Supervisores: http://localhost:${PORT}/supervisor`);
            console.log(`  → Admin:        http://localhost:${PORT}/admin`);
            console.log(`  → Login:        http://localhost:${PORT}/login`);
            console.log(`\n  Admin: ${process.env.ADMIN_USER} / ${process.env.ADMIN_PASS}\n`);
        });
    } catch (err) {
        console.error('Error al iniciar:', err.message);
        process.exit(1);
    }
}

iniciar();
