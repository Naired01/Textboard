const socket = io();

const editor = document.getElementById('editor');
const btnCopy = document.getElementById('btn-copy');
const btnClear = document.getElementById('btn-clear');
const btnGenerate = document.getElementById('btn-generate');
const btnShare = document.getElementById('btn-share');
const btnQr = document.getElementById('btn-qr');
const urlSection = document.getElementById('url-section');
const generatedUrl = document.getElementById('generated-url');
const btnCopyUrl = document.getElementById('btn-copy-url');
const qrSection = document.getElementById('qr-section');
const qrImage = document.getElementById('qr-image');
const boardLabel = document.getElementById('board-label');
const toast = document.getElementById('toast');

const path = window.location.pathname.replace('/', '');
const boardId = path || 'main';

if (boardId !== 'main') {
  boardLabel.textContent = `Tablero: ${boardId.substring(0, 8)}...`;
  btnGenerate.classList.add('hidden');
  urlSection.classList.remove('hidden');
  generatedUrl.value = window.location.href;
  btnShare.disabled = false;
  btnQr.disabled = false;
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
