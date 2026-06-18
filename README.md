# Textboard

Aplicación de mensajes en tiempo real con tableros compartidos por URL y sistema de notas con expiración.

## Características

- Edición en tiempo real con sincronización instantánea
- Tablero principal en `/`
- Tableros privados con URLs únicas `/{uuid}`
- Copiar y limpiar texto
- Generar URLs personalizadas
- Compartir URLs (Web Share API)
- Generar códigos QR
- Vista previa de Markdown
- Descargar contenido como archivo
- Sistema de notas con expiración temporal
- Protección de notas con contraseña
- Visualización de notas protegidas sin contraseña (controles deshabilitados)
- Opción de ocultar contenido al acceder (revelar con clic)
- Persistencia de datos con SQLite
- Dockerizado con volumen persistente

## Requisitos

- Node.js 20+
- Docker (opcional)

## Uso

### Local

```bash
npm install
npm start
```

Abre http://localhost:3000

### Docker

**Docker Compose (recomendado):**
```bash
docker-compose up -d
```

La base de datos se guarda en `./data/textboard.db` localmente.

**Linux/Mac:**
```bash
chmod +x build.sh
./build.sh
docker run -p 3000:3000 -v ./data:/app/data -e DB_PATH=/app/data/textboard.db textboard:latest
```

**Windows:**
```cmd
build.bat
docker run -p 3000:3000 -v .\data:/app/data -e DB_PATH=/app/data/textboard.db textboard:latest
```

## Estructura

```
├── server.js          # Servidor Express + Socket.IO
├── db.js              # Capa de datos SQLite
├── public/            # Frontend
│   ├── index.html
│   ├── style.css
│   └── app.js
├── data/              # Base de datos persistente (generado por Docker)
├── Dockerfile
├── docker-compose.yml
├── EXAMPLE.env        # Ejemplo de variables de entorno
├── build.sh           # Script build Linux/Mac
└── build.bat          # Script build Windows
```

## API

### Tableros
- `GET /api/generate-id` — Genera UUID para tablero privado
- `GET /api/qr/:boardId` — Genera QR para URL del tablero

### Notas
- `POST /api/notes` — Crear/actualizar nota
  - Body: `{ boardId, content, note, password?, ttlSeconds, hiddenAccess? }`
- `GET /api/notes/:boardId` — Obtener nota (retorna contenido, estado de bloqueo, metadatos)
- `GET /api/notes/:boardId/meta` — Obtener metadatos de nota
- `DELETE /api/notes/:boardId` — Eliminar nota

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `3000` |
| `NODE_ENV` | Entorno (production/development) | - |
| `DB_PATH` | Ruta del archivo de base de datos SQLite | `./textboard.db` |

Copia `EXAMPLE.env` a `.env` y ajusta los valores según necesites.
