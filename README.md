# GeoAnalítica Táctica

Sistema de gestión y visualización georreferenciada de clientes. Mapa interactivo con clustering, heatmap, filtros por zona/ruta/canal y panel de administración para importar datos desde Excel.

## Stack

- **Backend**: Node.js + Express
- **Base de datos**: PostgreSQL
- **Frontend**: HTML + Leaflet.js + Tailwind CSS
- **Auth**: JWT

## Despliegue en Railway

1. Conectar este repositorio en [Railway](https://railway.app)
2. Agregar un servicio PostgreSQL en Railway (o usar base de datos externa)
3. Configurar las variables de entorno (Settings → Variables):

```
DB_USER=
DB_PASS=
DB_HOST=
DB_PORT=5432
DB_NAME=
JWT_SECRET=
ADMIN_USER=admin
ADMIN_PASS=tu_contraseña
PORT=3000
```

4. Railway detecta Node.js automáticamente y ejecuta `npm install && npm start`

## Uso local

```bash
cp .env.example .env
# Editar .env con tus credenciales
npm install
npm start
```

## Páginas

| Ruta | Descripción |
|------|-------------|
| `/supervisor` | Mapa + tabla de clientes (público) |
| `/admin` | Importar Excel, gestionar DB (requiere login) |
| `/login` | Acceso administrador |

## Importar datos

1. Ir a `/admin` e iniciar sesión
2. Arrastrar archivo `.xlsx` con columnas: `lat_num`, `lng_num`, `nom_cliente`, `cod_cliente`, `tipo_sucursal`, `cod_zona_actual`, `cod_ruta_actual`, `desc_canal`
3. Confirmar importación
