const pool = require('./db');

const Cliente = {
    async crearTabla() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS clientes (
                id              SERIAL PRIMARY KEY,
                nom_cliente     VARCHAR(255),
                cod_cliente     VARCHAR(50),
                tipo_sucursal   VARCHAR(100),
                cod_zona_actual INTEGER,
                cod_ruta_actual INTEGER,
                desc_canal      VARCHAR(100),
                lat_num         DECIMAL(12, 7),
                lng_num         DECIMAL(12, 7),
                importado_en    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS importaciones (
                id              SERIAL PRIMARY KEY,
                nombre_archivo  VARCHAR(255),
                total_filas     INTEGER,
                filas_validas   INTEGER,
                filas_invalidas INTEGER,
                creado_en       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    },

    async crearIndices() {
        try {
            console.log('[DB] Creando índices para optimizar filtros...');
            await Promise.all([
                pool.query(`CREATE INDEX IF NOT EXISTS idx_zona ON clientes(cod_zona_actual)`),
                pool.query(`CREATE INDEX IF NOT EXISTS idx_ruta ON clientes(cod_ruta_actual)`),
                pool.query(`CREATE INDEX IF NOT EXISTS idx_canal ON clientes(desc_canal)`),
                pool.query(`CREATE INDEX IF NOT EXISTS idx_tipo ON clientes(tipo_sucursal)`),
                pool.query(`CREATE INDEX IF NOT EXISTS idx_nom ON clientes(nom_cliente)`)
            ]);
            console.log('[DB] Índices creados exitosamente');
        } catch (error) {
            console.error('[DB] Error creando índices:', error.message);
        }
    },

    async getAll({ zona, ruta, canal, tipo, search } = {}) {
        const conditions = [];
        const values = [];
        let i = 1;

        if (zona)   { conditions.push(`cod_zona_actual = $${i++}`); values.push(zona); }
        if (ruta)   { conditions.push(`cod_ruta_actual = $${i++}`); values.push(ruta); }
        if (canal)  { conditions.push(`desc_canal = $${i++}`);      values.push(canal); }
        if (tipo)   { conditions.push(`tipo_sucursal = $${i++}`);   values.push(tipo); }
        if (search) {
            conditions.push(`(LOWER(nom_cliente) LIKE $${i} OR CAST(cod_cliente AS TEXT) LIKE $${i})`);
            values.push(`%${search.toLowerCase()}%`);
            i++;
        }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
        const result = await pool.query(
            `SELECT * FROM clientes ${where} ORDER BY nom_cliente LIMIT 200000`,
            values
        );
        return result.rows;
    },

    async getStats() {
        const result = await pool.query(`
            SELECT
                COUNT(*)                                        AS total,
                COUNT(DISTINCT cod_zona_actual)                 AS zonas,
                COUNT(DISTINCT cod_ruta_actual)                 AS rutas,
                COUNT(DISTINCT desc_canal)                      AS canales,
                COUNT(DISTINCT tipo_sucursal)                   AS tipos
            FROM clientes
        `);
        return result.rows[0];
    },

    async getUniqueValues() {
        const [zonas, rutas, canales, tipos] = await Promise.all([
            pool.query(`SELECT DISTINCT cod_zona_actual AS val FROM clientes WHERE cod_zona_actual IS NOT NULL ORDER BY 1`),
            pool.query(`SELECT DISTINCT cod_ruta_actual AS val FROM clientes WHERE cod_ruta_actual IS NOT NULL ORDER BY 1`),
            pool.query(`SELECT DISTINCT desc_canal      AS val FROM clientes WHERE desc_canal IS NOT NULL      ORDER BY 1`),
            pool.query(`SELECT DISTINCT tipo_sucursal   AS val FROM clientes WHERE tipo_sucursal IS NOT NULL   ORDER BY 1`)
        ]);
        return {
            zonas:   zonas.rows.map(r => r.val),
            rutas:   rutas.rows.map(r => r.val),
            canales: canales.rows.map(r => r.val),
            tipos:   tipos.rows.map(r => r.val)
        };
    },

    async insertarLote(rows, nombreArchivo) {
        const client = await pool.connect();
        const BATCH_SIZE = 5000; // Insertar 5000 filas por query

        try {
            console.log(`[IMPORT] Iniciando inserción de ${rows.length} filas en lotes de ${BATCH_SIZE}...`);
            const startTime = Date.now();

            await client.query('BEGIN');
            console.log('[IMPORT] Transacción iniciada');

            await client.query('TRUNCATE TABLE clientes RESTART IDENTITY');
            console.log('[IMPORT] Tabla clientes vaciada');

            // Insertar en lotes (batches) para evitar timeouts
            let insertados = 0;
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                const batch = rows.slice(i, Math.min(i + BATCH_SIZE, rows.length));

                // Construir query con múltiples VALUES
                const placeholders = batch.map((_, idx) => {
                    const base = idx * 8;
                    return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8})`;
                }).join(',');

                const values = [];
                batch.forEach(r => {
                    values.push(
                        r.nom_cliente     || null,
                        r.cod_cliente     || null,
                        r.tipo_sucursal   || null,
                        r.cod_zona_actual || null,
                        r.cod_ruta_actual || null,
                        r.desc_canal      || null,
                        r.lat_num,
                        r.lng_num
                    );
                });

                const query = `INSERT INTO clientes (nom_cliente, cod_cliente, tipo_sucursal, cod_zona_actual, cod_ruta_actual, desc_canal, lat_num, lng_num) VALUES ${placeholders}`;

                try {
                    await client.query(query, values);
                    insertados += batch.length;
                    const pct = Math.round((insertados / rows.length) * 100);
                    console.log(`[IMPORT] ${insertados}/${rows.length} filas (${pct}%) - lote ${Math.ceil(i / BATCH_SIZE) + 1} completado`);
                } catch (batchErr) {
                    console.error(`[IMPORT] Error en lote ${Math.ceil(i / BATCH_SIZE)}:`, batchErr.message);
                    throw batchErr;
                }
            }

            // Registrar importación
            await client.query(
                `INSERT INTO importaciones (nombre_archivo, total_filas, filas_validas, filas_invalidas)
                 VALUES ($1, $2, $3, $4)`,
                [nombreArchivo, rows.length, rows.length, 0]
            );
            console.log('[IMPORT] Metadata de importación registrada');

            await client.query('COMMIT');
            const elapsed = Date.now() - startTime;
            console.log(`[IMPORT] ✓ Importación completada: ${rows.length} filas en ${elapsed}ms (${(rows.length / (elapsed / 1000)).toFixed(0)} filas/s)`);

            return rows.length;
        } catch (err) {
            console.error('[IMPORT] ERROR - Rollback:', err.message);
            try {
                await client.query('ROLLBACK');
            } catch (rollbackErr) {
                console.error('[IMPORT] Error durante ROLLBACK:', rollbackErr.message);
            }
            throw err;
        } finally {
            client.release();
            console.log('[IMPORT] Conexión liberada');
        }
    },

    async getUltimaImportacion() {
        const result = await pool.query(
            `SELECT * FROM importaciones ORDER BY creado_en DESC LIMIT 1`
        );
        return result.rows[0] || null;
    }
};

module.exports = Cliente;
