# Textboard

Aplicación de mensajes en tiempo real con tableros compartidos por URL.

## Características

- Edición en tiempo real con sincronización instantánea
- Tablero principal en `/`
- Tableros privados con URLs únicas `/{uuid}`
- Copiar y limpiar texto
- Generar URLs personalizadas
- Compartir URLs (Web Share API)
- Generar códigos QR
- Dockerizado

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

**Linux/Mac:**
```bash
chmod +x build.sh
./build.sh
docker run -p 3000:3000 textboard:latest
```

**Windows:**
```cmd
build.bat
docker run -p 3000:3000 textboard:latest
```

**Docker Compose:**
```bash
docker-compose up -d
```

## Estructura

```
├── server.js          # Servidor Express + Socket.IO
├── public/            # Frontend
│   ├── index.html
│   ├── style.css
│   └── app.js
├── Dockerfile
├── docker-compose.yml
├── build.sh           # Script build Linux/Mac
└── build.bat          # Script build Windows
```

## API

- `GET /api/generate-id` — Genera UUID para tablero privado
- `GET /api/qr/:boardId` — Genera QR para URL del tablero

## Variables de entorno

- `PORT` — Puerto del servidor (default: 3000)
- `NODE_ENV` — Entorno (production/development)

## Licencia

MIT
