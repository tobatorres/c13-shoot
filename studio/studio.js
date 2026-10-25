const canvas = document.getElementById('editor-canvas');
const ctx = canvas.getContext('2d');

let currentTool = 'arrow';
let isDrawing = false;
let startX = 0;
let startY = 0;
let stepCounter = 1;

let baseImageDataUrl = null;
let historyStack = [];
let snapshotBeforeDrag = null;

document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get(['latestCaptureDataUrl', 'latestCaptureTitle']);
  if (data.latestCaptureTitle) {
    document.getElementById('doc-title').value = `c13-shoot-${data.latestCaptureTitle}`;
  }

  if (data.latestCaptureDataUrl) {
    baseImageDataUrl = data.latestCaptureDataUrl;
    await loadToCanvas(baseImageDataUrl, true);
  } else {
    createBlankCanvas();
  }

  setupToolbar();
  setupCanvasEvents();
  setupKeyboardShortcuts();
});

function createBlankCanvas() {
  canvas.width = 1280;
  canvas.height = 720;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#64748b';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Pega una imagen aquí (Ctrl+V / Cmd+V) o haz una captura desde el icono de la extensión', canvas.width / 2, canvas.height / 2);
  baseImageDataUrl = canvas.toDataURL('image/png');
  saveHistory();
  updateDimensionsBadge();
}

function loadToCanvas(dataUrl, resetHistory = false) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      if (resetHistory) {
        historyStack = [];
        stepCounter = 1;
      }
      saveHistory();
      updateDimensionsBadge();
      resolve();
    };
    img.src = dataUrl;
  });
}

function saveHistory() {
  if (historyStack.length >= 25) historyStack.shift();
  historyStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
}

function undoLast() {
  if (historyStack.length <= 1) {
    showToast('No hay más cambios para deshacer');
    return;
  }
  historyStack.pop();
  const prev = historyStack[historyStack.length - 1];
  canvas.width = prev.width;
  canvas.height = prev.height;
  ctx.putImageData(prev, 0, 0);
  updateDimensionsBadge();
}

function updateDimensionsBadge() {
  document.getElementById('img-dimensions').textContent = `${canvas.width} × ${canvas.height} px`;
}

function setupToolbar() {
  document.querySelectorAll('.tool-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
    });
  });

  document.getElementById('btn-undo').addEventListener('click', undoLast);

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (baseImageDataUrl) {
      loadToCanvas(baseImageDataUrl, true);
      showToast('Captura restaurada al original');
    }
  });

  document.getElementById('btn-beautify').addEventListener('click', applyBeautifyFrame);
  document.getElementById('btn-copy').addEventListener('click', copyCanvasToClipboard);
  document.getElementById('btn-download-png').addEventListener('click', downloadPNG);
  document.getElementById('btn-download-pdf').addEventListener('click', downloadPDF);
}

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
    scale: scaleX
  };
}

function setupCanvasEvents() {
  canvas.addEventListener('mousedown', (e) => {
    const { x, y, scale } = getCanvasCoords(e);
    const color = document.getElementById('stroke-color').value;
    const size = parseInt(document.getElementById('stroke-size').value, 10) * scale;

    if (currentTool === 'text') {
      const userText = prompt('Escribe el texto a insertar:');
      if (userText && userText.trim()) {
        ctx.save();
        ctx.font = `700 ${Math.max(18, size * 5)}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(userText, x, y);
        ctx.restore();
        saveHistory();
      }
      return;
    }

    if (currentTool === 'step') {
      const radius = Math.max(16, size * 3.2);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = Math.max(2, 2.5 * scale);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `800 ${Math.round(radius * 1.1)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(stepCounter++), x, y);
      ctx.restore();
      saveHistory();
      return;
    }

    isDrawing = true;
    startX = x;
    startY = y;
    snapshotBeforeDrag = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (currentTool === 'pen' || currentTool === 'highlighter') {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(startX, startY);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const { x, y, scale } = getCanvasCoords(e);
    const color = document.getElementById('stroke-color').value;
    const size = parseInt(document.getElementById('stroke-size').value, 10) * scale;

    if (currentTool === 'pen') {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineTo(x, y);
      ctx.stroke();
      return;
    }

    if (currentTool === 'highlighter') {
      ctx.putImageData(snapshotBeforeDrag, 0, 0);
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = size * 4.5;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.putImageData(snapshotBeforeDrag, 0, 0);

    if (currentTool === 'arrow') {
      drawArrow(ctx, startX, startY, x, y, color, size);
    } else if (currentTool === 'rect') {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.strokeRect(startX, startY, x - startX, y - startY);
      ctx.restore();
    } else if (currentTool === 'ellipse') {
      ctx.save();
      ctx.beginPath();
      const rx = Math.abs(x - startX) / 2;
      const ry = Math.abs(y - startY) / 2;
      const cx = Math.min(startX, x) + rx;
      const cy = Math.min(startY, y) + ry;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.stroke();
      ctx.restore();
    } else if (currentTool === 'blur') {
      pixelateRegion(startX, startY, x - startX, y - startY, Math.max(10, Math.round(12 * scale)));
    } else if (currentTool === 'crop') {
      ctx.save();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2 * scale;
      ctx.setLineDash([8 * scale, 6 * scale]);
      ctx.strokeRect(startX, startY, x - startX, y - startY);
      ctx.restore();
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    ctx.restore?.();

    if (currentTool === 'crop') {
      const { x, y } = getCanvasCoords(e);
      const rx = Math.round(Math.min(startX, x));
      const ry = Math.round(Math.min(startY, y));
      const rw = Math.round(Math.abs(x - startX));
      const rh = Math.round(Math.abs(y - startY));

      ctx.putImageData(snapshotBeforeDrag, 0, 0);
      if (rw > 20 && rh > 20) {
        const cropped = ctx.getImageData(rx, ry, rw, rh);
        canvas.width = rw;
        canvas.height = rh;
        ctx.putImageData(cropped, 0, 0);
        updateDimensionsBadge();
        showToast('Imagen recortada');
      }
    }

    saveHistory();
  });
}

function drawArrow(context, fromX, fromY, toX, toY, color, width) {
  const headLen = Math.max(14, width * 3.8);
  const angle = Math.atan2(toY - fromY, toX - fromX);

  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = width;
  context.lineCap = 'round';

  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();

  context.beginPath();
  context.moveTo(toX, toY);
  context.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
  context.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
  context.restore();
}

function pixelateRegion(x, y, w, h, blockSize) {
  const rx = Math.max(0, Math.round(Math.min(x, x + w)));
  const ry = Math.max(0, Math.round(Math.min(y, y + h)));
  const rw = Math.min(canvas.width - rx, Math.round(Math.abs(w)));
  const rh = Math.min(canvas.height - ry, Math.round(Math.abs(h)));
  if (rw < 4 || rh < 4) return;

  const imgData = ctx.getImageData(rx, ry, rw, rh);
  const data = imgData.data;

  for (let py = 0; py < rh; py += blockSize) {
    for (let px = 0; px < rw; px += blockSize) {
      const i = (py * rw + px) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(rx + px, ry + py, Math.min(blockSize, rw - px), Math.min(blockSize, rh - py));
    }
  }
}

function applyBeautifyFrame() {
  const pad = Math.round(Math.max(canvas.width, canvas.height) * 0.06);
  const temp = document.createElement('canvas');
  temp.width = canvas.width;
  temp.height = canvas.height;
  temp.getContext('2d').drawImage(canvas, 0, 0);

  canvas.width = temp.width + pad * 2;
  canvas.height = temp.height + pad * 2;

  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#6366f1');
  grad.addColorStop(0.5, '#8b5cf6');
  grad.addColorStop(1, '#ec4899');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = pad * 0.6;
  ctx.shadowOffsetY = pad * 0.2;
  ctx.drawImage(temp, pad, pad);
  ctx.restore();

  saveHistory();
  updateDimensionsBadge();
  showToast('✨ Marco Pro aplicado');
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undoLast();
    }
  });

  window.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (ev) => {
          baseImageDataUrl = ev.target.result;
          loadToCanvas(baseImageDataUrl, true);
          showToast('Imagen pegada desde el portapapeles');
        };
        reader.readAsDataURL(blob);
      }
    }
  });
}

async function copyCanvasToClipboard() {
  canvas.toBlob(async (blob) => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('📋 ¡Imagen copiada al portapapeles!');
    } catch (err) {
      showToast('Error al copiar: ' + err.message);
    }
  }, 'image/png');
}

function getCleanFilename(ext) {
  const raw = document.getElementById('doc-title').value.trim() || 'captura-opencapture';
  return `${raw.replace(/[^a-zA-Z0-9-_]/g, '-')}.${ext}`;
}

function downloadPNG() {
  const url = canvas.toDataURL('image/png');
  chrome.downloads.download({
    url,
    filename: getCleanFilename('png')
  });
  showToast('⬇️ Descargando PNG de máxima calidad...');
}

// Generador nativo de PDF sin marcas de agua ni librerías externas
function downloadPDF() {
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);
  const base64 = jpegDataUrl.split(',')[1];
  const imgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const w = canvas.width;
  const h = canvas.height;
  // Escalar a puntos PDF (72 DPI) manteniendo proporción exacta
  const pdfW = Math.round(w * 0.75);
  const pdfH = Math.round(h * 0.75);

  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let byteLength = 0;

  const pushStr = (str) => {
    const bytes = encoder.encode(str);
    chunks.push(bytes);
    byteLength += bytes.length;
  };

  const pushBytes = (bytes) => {
    chunks.push(bytes);
    byteLength += bytes.length;
  };

  const startObj = (id) => {
    offsets[id] = byteLength;
    pushStr(`${id} 0 obj\n`);
  };

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  startObj(1);
  pushStr('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  startObj(2);
  pushStr('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  startObj(3);
  pushStr(
    `<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Im0 4 0 R >> >> /MediaBox [0 0 ${pdfW} ${pdfH}] /Contents 5 0 R >>\nendobj\n`
  );

  startObj(4);
  pushStr(
    `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`
  );
  pushBytes(imgBytes);
  pushStr('\nendstream\nendobj\n');

  const contentStream = `q\n${pdfW} 0 0 ${pdfH} 0 0 cm\n/Im0 Do\nQ\n`;
  startObj(5);
  pushStr(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`);

  const xrefOffset = byteLength;
  pushStr('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const pdfBlob = new Blob(chunks, { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(pdfBlob);

  chrome.downloads.download({
    url: blobUrl,
    filename: getCleanFilename('pdf')
  });

  showToast('📄 ¡PDF Pro exportado sin marcas de agua!');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}
