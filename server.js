const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const boards = new Map();

app.use(express.json({ limit: '6mb' }));
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

app.post('/api/notes', (req, res) => {
  try {
    const { boardId, content, note, password, ttlSeconds, hiddenAccess } = req.body;
    if (!boardId || typeof content !== 'string' || !ttlSeconds) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const result = db.saveNote({ boardId, content, note, password, ttlSeconds, hiddenAccess });
    boards.set(boardId, content);
    io.to(boardId).emit('content', content);
    res.json({ ok: true, expiresAt: result.expiresAt });
  } catch (err) {
    if (err.message === 'CONTENT_TOO_LARGE') {
      return res.status(413).json({ error: 'Content exceeds 5MB limit' });
    }
    if (err.message === 'INVALID_TTL') {
      return res.status(400).json({ error: 'Invalid TTL value' });
    }
    res.status(500).json({ error: 'Failed to save note' });
  }
});

app.get('/api/notes/:boardId', (req, res) => {
  const { boardId } = req.params;
  const { password } = req.query;
  const result = db.loadNote(boardId, password || null);

  if (!result.found) {
    return res.status(404).json({ error: 'Note not found or expired' });
  }

  res.json({
    content: result.content,
    note: result.note,
    hasPassword: result.hasPassword,
    locked: result.locked || false,
    hiddenAccess: result.hiddenAccess || false,
    expiresAt: result.expiresAt,
    ttlSeconds: result.ttlSeconds,
    createdAt: result.createdAt,
  });
});

app.get('/api/notes/:boardId/meta', (req, res) => {
  const { boardId } = req.params;
  const meta = db.getNoteMeta(boardId);
  if (!meta) return res.status(404).json({ error: 'Note not found' });
  res.json(meta);
});

app.delete('/api/notes/:boardId', (req, res) => {
  const { boardId } = req.params;
  db.deleteNote(boardId);
  boards.delete(boardId);
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

setInterval(() => {
  const removed = db.cleanupExpired();
  if (removed > 0) {
    console.log(`Cleaned up ${removed} expired notes`);
  }
}, 60 * 1000);

io.on('connection', (socket) => {
  let currentBoard = 'main';

  socket.on('join', (boardId) => {
    socket.leave(currentBoard);
    currentBoard = boardId || 'main';
    socket.join(currentBoard);

    if (currentBoard !== 'main') {
      const result = db.loadNote(currentBoard, null);
      if (result.found) {
        boards.set(currentBoard, result.content);
        socket.emit('content', result.content);
        socket.emit('note-meta', {
          note: result.note,
          hasPassword: result.hasPassword,
          expiresAt: result.expiresAt,
          ttlSeconds: result.ttlSeconds,
          locked: result.locked || false,
          hiddenAccess: result.hiddenAccess || false,
        });
        return;
      }
    }

    const content = boards.get(currentBoard) || '';
    socket.emit('content', content);
  });

  socket.on('update', (text) => {
    if (Buffer.byteLength(text, 'utf8') > db.MAX_CONTENT_SIZE) {
      socket.emit('error', 'Content exceeds 5MB limit');
      return;
    }
    boards.set(currentBoard, text);
    if (currentBoard !== 'main') {
      db.updateNoteContent(currentBoard, text);
    }
    io.to(currentBoard).emit('content', text);
  });

  socket.on('clear', () => {
    boards.set(currentBoard, '');
    if (currentBoard !== 'main') {
      db.updateNoteContent(currentBoard, '');
    }
    io.to(currentBoard).emit('content', '');
  });

  socket.on('unlock-note', ({ boardId, password }, callback) => {
    const result = db.loadNote(boardId, password);
    if (!result.found) {
      if (typeof callback === 'function') callback({ error: 'Note not found' });
      return;
    }
    if (result.locked) {
      if (typeof callback === 'function') callback({ error: 'Invalid password' });
      return;
    }
    boards.set(boardId, result.content);
    socket.emit('content', result.content);
    socket.emit('note-meta', {
      note: result.note,
      hasPassword: result.hasPassword,
      expiresAt: result.expiresAt,
      ttlSeconds: result.ttlSeconds,
      locked: false,
      hiddenAccess: result.hiddenAccess || false,
    });
    if (typeof callback === 'function') callback({ ok: true });
  });
});

server.listen(PORT, () => {
  console.log(`Textboard running on http://localhost:${PORT}`);
});
