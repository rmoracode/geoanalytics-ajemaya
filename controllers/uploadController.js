const XLSX    = require('xlsx');
const Cliente = require('../models/Cliente');

const REQUIRED_COLS = {
    nom_cliente:      ['nom_cliente','nombre','cliente','name'],
    cod_cliente:      ['cod_cliente','codigo','id','code'],
    lat_num:          ['lat_num','latitud','lat','latitude'],
    lng_num:          ['lng_num','longitud','lng','longitude','long'],
    tipo_sucursal:    ['tipo_sucursal','tipo','sucursal'],
    cod_zona_actual:  ['cod_zona_actual','zona','zone'],
    cod_ruta_actual:  ['cod_ruta_actual','ruta','route'],
    desc_canal:       ['desc_canal','canal','channel']
};

function detectarColumnas(headers) {
    const matched = {};
    const missing = [];
    for (const [field, aliases] of Object.entries(REQUIRED_COLS)) {
        const found = headers.find(h => aliases.includes(String(h).toLowerCase().trim()));
        if (found) matched[field] = found;
        else if (field === 'lat_num' || field === 'lng_num') missing.push(field);
    }
    return { matched, missing };
}

async function subirExcel(req, res) {
    try {
        if (!req.file) {
            console.warn('[UPLOAD] No se recibió archivo');
            return res.status(400).json({ error: 'No se recibió archivo' });
        }

        console.log(`[UPLOAD] ========================================`);
        console.log(`[UPLOAD] Iniciando carga: ${req.file.originalname}`);
        console.log(`[UPLOAD] Tamaño: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`);
        console.log(`[UPLOAD] Buffer length: ${req.file.buffer.length}`);

        // Parse Excel
        console.log('[UPLOAD] 1. Leyendo Excel con XLSX...');
        if (!req.file.buffer || req.file.buffer.length === 0) {
            throw new Error('Buffer del archivo está vacío');
        }

        const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
        console.log(`[UPLOAD] Hojas encontradas: ${wb.SheetNames.join(', ')}`);

        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        if (!firstSheet) {
            throw new Error('No se encontró ninguna hoja en el Excel');
        }

        const json = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        console.log(`[UPLOAD] Excel parseado: ${json.length} filas leídas`);

        if (!json.length) {
            throw new Error('El archivo está vacío (no contiene filas)');
        }

        // Detectar columnas
        console.log('[UPLOAD] 2. Detectando columnas...');
        const headers = Object.keys(json[0]);
        console.log(`[UPLOAD] Headers encontrados: ${headers.join(', ')}`);

        const { matched, missing } = detectarColumnas(headers);
        console.log(`[UPLOAD] Matched: ${JSON.stringify(matched)}`);
        console.log(`[UPLOAD] Missing: ${missing.join(', ') || 'ninguna'}`);

        if (missing.length) {
            const msg = `Columnas de coordenadas no encontradas: ${missing.join(', ')}. Variantes aceptadas: lat_num, latitud, lat, lng_num, longitud, lng`;
            console.warn(`[UPLOAD] ✗ ${msg}`);
            return res.status(400).json({ error: msg });
        }

        // Parsear y filtrar
        console.log('[UPLOAD] 3. Filtrando filas con coordenadas válidas...');
        const parsed = json.map((r, idx) => {
            let lat = parseFloat(String(r[matched.lat_num] || '').replace(',', '.'));
            let lng = parseFloat(String(r[matched.lng_num] || '').replace(',', '.'));

            // Truncar a 7 decimales para DECIMAL(12,7) en PostgreSQL
            if (!isNaN(lat)) lat = Math.round(lat * 10000000) / 10000000;
            if (!isNaN(lng)) lng = Math.round(lng * 10000000) / 10000000;

            // Validar y convertir campos numéricos (zona y ruta son INTEGER en PostgreSQL)
            let cod_zona = null;
            let cod_ruta = null;

            const zonaVal = r[matched.cod_zona_actual];
            if (zonaVal !== null && zonaVal !== undefined && zonaVal !== '') {
                const z = parseInt(String(zonaVal).trim(), 10);
                if (!isNaN(z) && z >= -2147483648 && z <= 2147483647) {
                    cod_zona = z;
                }
            }

            const rutaVal = r[matched.cod_ruta_actual];
            if (rutaVal !== null && rutaVal !== undefined && rutaVal !== '') {
                const rt = parseInt(String(rutaVal).trim(), 10);
                if (!isNaN(rt) && rt >= -2147483648 && rt <= 2147483647) {
                    cod_ruta = rt;
                }
            }

            return {
                nom_cliente:     r[matched.nom_cliente]     || null,
                cod_cliente:     r[matched.cod_cliente]     || null,
                tipo_sucursal:   r[matched.tipo_sucursal]   || null,
                cod_zona_actual: cod_zona,
                cod_ruta_actual: cod_ruta,
                desc_canal:      r[matched.desc_canal]      || null,
                lat_num:         lat,
                lng_num:         lng,
                _valid:          !isNaN(lat) && !isNaN(lng) &&
                                 lat !== 0 && lng !== 0 &&
                                 lat >= -90 && lat <= 90 &&
                                 lng >= -180 && lng <= 180
            };
        }).filter(d => d._valid).map(({ _valid, ...d }) => d);

        const invalidas = json.length - parsed.length;
        console.log(`[UPLOAD] ✓ Filtrado: ${parsed.length} filas válidas, ${invalidas} inválidas`);

        if (!parsed.length) {
            const msg = `No hay filas con coordenadas válidas. Verificar que lat_num y lng_num tengan valores numéricos no nulos. Total: ${json.length}, Válidas: ${parsed.length}`;
            console.warn(`[UPLOAD] ✗ ${msg}`);
            return res.status(400).json({ error: msg });
        }

        // Insertar en BD con timeout
        console.log('[UPLOAD] 4. Insertando en base de datos...');
        console.log(`[UPLOAD] Primeras 3 filas a insertar:`);
        parsed.slice(0, 3).forEach((row, i) => {
            console.log(`[UPLOAD]   Fila ${i}: ${JSON.stringify(row)}`);
        });

        const importTimeoutMs = Math.max(600000, parsed.length * 5);
        console.log(`[UPLOAD] Timeout configurado: ${importTimeoutMs / 1000}s`);

        let insertados;
        try {
            insertados = await Promise.race([
                Cliente.insertarLote(parsed, req.file.originalname),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Timeout de importación (${importTimeoutMs / 1000}s) - la base de datos tardó demasiado. Verifique la conexión.`)), importTimeoutMs)
                )
            ]);
        } catch (dbErr) {
            console.error(`[UPLOAD] ✗ ERROR EN BASE DE DATOS:`);
            console.error(`[UPLOAD]   Código: ${dbErr.code}`);
            console.error(`[UPLOAD]   Detalle: ${dbErr.detail}`);
            console.error(`[UPLOAD]   Contexto: ${dbErr.context}`);
            console.error(`[UPLOAD]   Mensaje: ${dbErr.message}`);
            throw dbErr;
        }

        console.log(`[UPLOAD] ✓ Importación exitosa: ${insertados} clientes insertados`);
        console.log(`[UPLOAD] ========================================`);

        res.json({
            mensaje:    `${insertados} clientes importados correctamente`,
            total:      json.length,
            validas:    insertados,
            invalidas,
            archivo:    req.file.originalname
        });
    } catch (err) {
        console.error(`[UPLOAD] ✗ ERROR CRÍTICO:`);
        console.error(`[UPLOAD]   Mensaje: ${err.message}`);
        console.error(`[UPLOAD]   Stack: ${err.stack}`);
        console.error(`[UPLOAD] ========================================`);

        // Mensajes de error específicos
        let userMessage = `Error al procesar el archivo: ${err.message}`;
        if (err.message.includes('Timeout')) {
            userMessage = err.message;
        } else if (err.message.includes('TRUNCATE')) {
            userMessage = 'Error al vaciar la tabla. Verifique que la base de datos esté disponible.';
        } else if (err.message.includes('deadlock')) {
            userMessage = 'Conflicto de acceso a la base de datos. Intente de nuevo en unos momentos.';
        } else if (err.message.includes('Buffer')) {
            userMessage = 'El archivo no se envió correctamente. Intente de nuevo.';
        }

        res.status(500).json({ error: userMessage, debug: err.message });
    }
}

module.exports = { subirExcel };
