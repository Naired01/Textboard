const socket = io();

const editor = document.getElementById('editor');
const btnCopy = document.getElementById('btn-copy');
const btnClear = document.getElementById('btn-clear');
const btnGenerate = document.getElementById('btn-generate');
const btnShare = document.getElementById('btn-share');
const btnQr = document.getElementById('btn-qr');
const btnDownload = document.getElementById('btn-download');
const btnMarkdown = document.getElementById('btn-markdown');
const btnSave = document.getElementById('btn-save');
const btnDeleteNote = document.getElementById('btn-delete-note');
const urlSection = document.getElementById('url-section');
const generatedUrl = document.getElementById('generated-url');
const btnCopyUrl = document.getElementById('btn-copy-url');
const qrSection = document.getElementById('qr-section');
const qrImage = document.getElementById('qr-image');
const boardLabel = document.getElementById('board-label');
const toast = document.getElementById('toast');
const markdownPreview = document.getElementById('markdown-preview');
const noteInfo = document.getElementById('note-info');
const noteText = document.getElementById('note-text');
const noteExpiry = document.getElementById('note-expiry');
const noteLockIcon = document.getElementById('note-lock-icon');
const modalOverlay = document.getElementById('modal-overlay');
const modalSave = document.getElementById('modal-save');
const modalPassword = document.getElementById('modal-password');

const path = window.location.pathname.replace('/', '');
const boardId = path || 'main';
let isMarkdownView = false;
let currentNoteMeta = null;
let isLocked = false;
let expiryTimer = null;

if (boardId !== 'main') {
  boardLabel.textContent = `Tablero: ${boardId.substring(0, 8)}...`;
  btnGenerate.classList.add('hidden');
  urlSection.classList.remove('hidden');
  generatedUrl.value = window.location.href;
  btnShare.disabled = false;
  btnQr.disabled = false;
  btnSave.disabled = false;
}

socket.emit('join', boardId);

socket.on('content', (text) => {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const hadFocus = document.activeElement === editor;

  if (text !== editor.value) {
    editor.value = text;
    if (hadFocus) {
      editor.setSelectionRange(start, end);
    }
  }
  if (isMarkdownView) {
    renderMarkdown(text);
  }
});

socket.on('note-meta', (meta) => {
  currentNoteMeta = meta;
  showNoteInfo(meta);
  btnDeleteNote.classList.remove('hidden');
});

socket.on('note-locked', () => {
  isLocked = true;
  editor.disabled = true;
  editor.placeholder = 'Esta nota está protegida con contraseña';
  showPasswordModal();
});

socket.on('error', (msg) => {
  showToast(msg);
});

editor.addEventListener('input', () => {
  socket.emit('update', editor.value);
});

btnClear.addEventListener('click', () => {
  socket.emit('clear');
  showToast('Texto limpiado');
});

btnCopy.addEventListener('click', async () => {
  await copyText(editor.value);
  showToast('Texto copiado');
});

btnGenerate.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/generate-id');
    const data = await res.json();
    const url = `${window.location.origin}/${data.id}`;
    generatedUrl.value = url;
    urlSection.classList.remove('hidden');
    btnShare.disabled = false;
    btnQr.disabled = false;
    btnSave.disabled = false;
    window.history.replaceState(null, '', `/${data.id}`);
    showToast('URL generada');
  } catch {
    showToast('Error al generar URL');
  }
});

btnCopyUrl.addEventListener('click', async () => {
  await copyText(generatedUrl.value);
  showToast('URL copiada');
});

btnShare.addEventListener('click', async () => {
  const url = generatedUrl.value || window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Textboard', url });
    } catch {}
  } else {
    await copyText(url);
    showToast('URL copiada al portapapeles');
  }
});

btnQr.addEventListener('click', async () => {
  const url = generatedUrl.value || window.location.href;
  const match = url.match(/\/([^/]+)\/?$/);
  if (!match) return;
  const id = match[1];
  try {
    const res = await fetch(`/api/qr/${id}`);
    const data = await res.json();
    qrImage.src = data.qr;
    qrSection.classList.toggle('hidden');
  } catch {
    showToast('Error al generar QR');
  }
});

btnDownload.addEventListener('click', () => {
  const text = editor.value;
  if (!text) {
    showToast('No hay contenido para descargar');
    return;
  }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `textboard-${boardId.substring(0, 8)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Archivo descargado');
});

btnMarkdown.addEventListener('click', () => {
  isMarkdownView = !isMarkdownView;
  if (isMarkdownView) {
    renderMarkdown(editor.value);
    markdownPreview.classList.remove('hidden');
    editor.classList.add('hidden');
    btnMarkdown.textContent = 'Editor';
  } else {
    markdownPreview.classList.add('hidden');
    editor.classList.remove('hidden');
    btnMarkdown.textContent = 'Markdown';
  }
});

btnSave.addEventListener('click', () => {
  if (boardId === 'main') return;
  showSaveModal();
});

btnDeleteNote.addEventListener('click', async () => {
  if (boardId === 'main') return;
  if (!confirm('¿Eliminar esta nota guardada?')) return;
  try {
    await fetch(`/api/notes/${boardId}`, { method: 'DELETE' });
    btnDeleteNote.classList.add('hidden');
    noteInfo.classList.add('hidden');
    currentNoteMeta = null;
    showToast('Nota eliminada');
  } catch {
    showToast('Error al eliminar');
  }
});

document.getElementById('modal-save-confirm').addEventListener('click', async () => {
  const note = document.getElementById('save-note').value;
  const password = document.getElementById('save-password').value;
  const passwordConfirm = document.getElementById('save-password-confirm').value;
  const ttlSeconds = parseInt(document.getElementById('save-ttl').value);

  if (password && password !== passwordConfirm) {
    showToast('Las contraseñas no coinciden');
    return;
  }

  try {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        boardId,
        content: editor.value,
        note,
        password: password || null,
        ttlSeconds,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      showToast(data.error || 'Error al guardar');
      return;
    }

    const data = await res.json();
    closeModal();
    currentNoteMeta = { note, hasPassword: !!password, expiresAt: data.expiresAt, ttlSeconds };
    showNoteInfo(currentNoteMeta);
    btnDeleteNote.classList.remove('hidden');
    showToast('Nota guardada');
  } catch {
    showToast('Error al guardar');
  }
});

document.getElementById('modal-save-cancel').addEventListener('click', closeModal);

document.getElementById('modal-unlock-confirm').addEventListener('click', () => {
  const password = document.getElementById('unlock-password').value;
  socket.emit('unlock-note', { boardId, password }, (response) => {
    if (response.error) {
      showToast(response.error);
      document.getElementById('unlock-password').value = '';
      return;
    }
    isLocked = false;
    editor.disabled = false;
    editor.placeholder = 'Escribe algo...';
    closeModal();
  });
});

document.getElementById('modal-unlock-cancel').addEventListener('click', closeModal);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

function showSaveModal() {
  document.getElementById('save-note').value = currentNoteMeta?.note || '';
  document.getElementById('save-password').value = '';
  document.getElementById('save-password-confirm').value = '';
  modalSave.classList.remove('hidden');
  modalPassword.classList.add('hidden');
  modalOverlay.classList.remove('hidden');
}

function showPasswordModal() {
  document.getElementById('unlock-password').value = '';
  modalPassword.classList.remove('hidden');
  modalSave.classList.add('hidden');
  modalOverlay.classList.remove('hidden');
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  modalSave.classList.add('hidden');
  modalPassword.classList.add('hidden');
}

function showNoteInfo(meta) {
  noteInfo.classList.remove('hidden');
  noteText.textContent = meta.note || '';
  noteLockIcon.classList.toggle('hidden', !meta.hasPassword);
  updateExpiry(meta.expiresAt);
  if (expiryTimer) clearInterval(expiryTimer);
  expiryTimer = setInterval(() => updateExpiry(meta.expiresAt), 1000);
}

function updateExpiry(expiresAt) {
  const now = Math.floor(Date.now() / 1000);
  const remaining = expiresAt - now;
  if (remaining <= 0) {
    noteExpiry.textContent = 'Expirada';
    if (expiryTimer) clearInterval(expiryTimer);
    return;
  }
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  let text = '';
  if (days > 0) text += `${days}d `;
  if (hours > 0 || days > 0) text += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0) text += `${minutes}m `;
  text += `${seconds}s`;
  noteExpiry.textContent = `Expira en: ${text}`;
}

function renderMarkdown(text) {
  if (typeof marked !== 'undefined') {
    markdownPreview.innerHTML = marked.parse(text || '');
  } else {
    markdownPreview.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.style.animation = 'none';
  void toast.offsetWidth;
  toast.style.animation = '';
  setTimeout(() => toast.classList.add('hidden'), 2000);
}
