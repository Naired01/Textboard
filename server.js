const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const boards = new Map();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/qr/:boardId', async (req, res) => {
  try {
    const { boardId } = req.params;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/${boardId}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
    res.json({ url, qr: qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

app.get('/api/generate-id', (req, res) => {
  const id = crypto.randomUUID();
  res.json({ id });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  let currentBoard = 'main';

  socket.on('join', (boardId) => {
    socket.leave(currentBoard);
    currentBoard = boardId || 'main';
    socket.join(currentBoard);

    const content = boards.get(currentBoard) || '';
    socket.emit('content', content);
  });

  socket.on('update', (text) => {
    boards.set(currentBoard, text);
    io.to(currentBoard).emit('content', text);
  });

  socket.on('clear', () => {
    boards.set(currentBoard, '');
    io.to(currentBoard).emit('content', '');
  });
});

server.listen(PORT, () => {
  console.log(`Textboard running on http://localhost:${PORT}`);
});
