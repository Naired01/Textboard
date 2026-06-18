const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'textboard.db');
const MAX_CONTENT_SIZE = 5 * 1024 * 1024;
const MAX_TTL_SECONDS = 30 * 24 * 60 * 60;
const SALT_ROUNDS = 10;

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    board_id TEXT PRIMARY KEY,
    content TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    password_hash TEXT,
    ttl_seconds INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    hidden_access INTEGER NOT NULL DEFAULT 0
  )
`);

try {
  db.exec('ALTER TABLE notes ADD COLUMN hidden_access INTEGER NOT NULL DEFAULT 0');
} catch (e) {}

const stmts = {
  insert: db.prepare(`
    INSERT OR REPLACE INTO notes (board_id, content, note, password_hash, ttl_seconds, created_at, expires_at, hidden_access)
    VALUES (@board_id, @content, @note, @password_hash, @ttl_seconds, @created_at, @expires_at, @hidden_access)
  `),
  getById: db.prepare('SELECT * FROM notes WHERE board_id = ?'),
  deleteById: db.prepare('DELETE FROM notes WHERE board_id = ?'),
  deleteExpired: db.prepare('DELETE FROM notes WHERE expires_at < ?'),
  updateContent: db.prepare('UPDATE notes SET content = ? WHERE board_id = ?'),
};

function saveNote({ boardId, content, note, password, ttlSeconds, hiddenAccess }) {
  if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_SIZE) {
    throw new Error('CONTENT_TOO_LARGE');
  }
  if (ttlSeconds <= 0 || ttlSeconds > MAX_TTL_SECONDS) {
    throw new Error('INVALID_TTL');
  }

  const now = Math.floor(Date.now() / 1000);
  const passwordHash = password ? bcrypt.hashSync(password, SALT_ROUNDS) : null;

  stmts.insert.run({
    board_id: boardId,
    content,
    note: note || '',
    password_hash: passwordHash,
    ttl_seconds: ttlSeconds,
    created_at: now,
    expires_at: now + ttlSeconds,
    hidden_access: hiddenAccess ? 1 : 0,
  });

  return { expiresAt: now + ttlSeconds };
}

function loadNote(boardId, password) {
  const row = stmts.getById.get(boardId);
  if (!row) return { found: false };

  const now = Math.floor(Date.now() / 1000);
  if (row.expires_at < now) {
    stmts.deleteById.run(boardId);
    return { found: false, expired: true };
  }

  let locked = false;
  if (row.password_hash) {
    if (!password) {
      locked = true;
    } else {
      const valid = bcrypt.compareSync(password, row.password_hash);
      if (!valid) return { found: true, locked: true, badPassword: true };
    }
  }

  return {
    found: true,
    content: row.content,
    note: row.note,
    hasPassword: !!row.password_hash,
    locked,
    hiddenAccess: !!row.hidden_access,
    expiresAt: row.expires_at,
    ttlSeconds: row.ttl_seconds,
    createdAt: row.created_at,
  };
}

function deleteNote(boardId) {
  stmts.deleteById.run(boardId);
}

function updateNoteContent(boardId, content) {
  if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_SIZE) return false;
  const row = stmts.getById.get(boardId);
  if (!row) return false;
  const now = Math.floor(Date.now() / 1000);
  if (row.expires_at < now) {
    stmts.deleteById.run(boardId);
    return false;
  }
  stmts.updateContent.run(content, boardId);
  return true;
}

function cleanupExpired() {
  const now = Math.floor(Date.now() / 1000);
  const info = stmts.deleteExpired.run(now);
  return info.changes;
}

function getNoteMeta(boardId) {
  const row = stmts.getById.get(boardId);
  if (!row) return null;
  const now = Math.floor(Date.now() / 1000);
  if (row.expires_at < now) {
    stmts.deleteById.run(boardId);
    return null;
  }
  return {
    hasPassword: !!row.password_hash,
    note: row.note,
    expiresAt: row.expires_at,
    ttlSeconds: row.ttl_seconds,
    hiddenAccess: !!row.hidden_access,
  };
}

module.exports = {
  saveNote,
  loadNote,
  deleteNote,
  updateNoteContent,
  cleanupExpired,
  getNoteMeta,
  MAX_CONTENT_SIZE,
  MAX_TTL_SECONDS,
};
