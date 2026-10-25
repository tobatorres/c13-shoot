let selectedDelay = 0;

document.addEventListener('DOMContentLoaded', async () => {
  // Restaurar preferencias guardadas
  const saved = await chrome.storage.local.get(['afterCapture', 'selectedDelay']);
  if (saved.afterCapture) {
    document.getElementById('after-capture').value = saved.afterCapture;
  }
  if (typeof saved.selectedDelay === 'number') {
    selectedDelay = saved.selectedDelay;
    updateDelayPills();
  }

  // Cambio de pestañas (Capturar / Grabar)
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Selector de retraso (0s, 3s, 5s)
  document.querySelectorAll('#delay-selector .pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      selectedDelay = parseInt(pill.dataset.delay, 10);
      chrome.storage.local.set({ selectedDelay });
      updateDelayPills();
    });
  });

  // Guardar opción post-captura
  document.getElementById('after-capture').addEventListener('change', (e) => {
    chrome.storage.local.set({ afterCapture: e.target.value });
  });

  // Botón recargar extensión en 1 clic
  document.getElementById('reload-ext-btn')?.addEventListener('click', () => {
    chrome.runtime.reload();
  });

  // Botón abrir estudio directamente
  document.getElementById('open-studio-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('studio/studio.html') });
    window.close();
  });

  // Acciones de captura
  document.getElementById('btn-capture-visible').addEventListener('click', () => {
    triggerCapture('visible');
  });

  document.getElementById('btn-capture-area').addEventListener('click', () => {
    triggerCapture('area');
  });

  document.getElementById('btn-capture-full').addEventListener('click', () => {
    triggerCapture('fullpage');
  });

  // Acción de grabador Pro
  document.getElementById('btn-open-recorder').addEventListener('click', () => {
    const quality = document.getElementById('video-quality').value;
    const mic = document.getElementById('rec-mic').checked;
    const sysAudio = document.getElementById('rec-sys-audio').checked;
    const countdown = document.getElementById('rec-countdown').checked;

    const params = new URLSearchParams({
      quality,
      mic: mic ? '1' : '0',
      sysAudio: sysAudio ? '1' : '0',
      countdown: countdown ? '1' : '0'
    });

    chrome.tabs.create({
      url: chrome.runtime.getURL(`recorder/recorder.html?${params.toString()}`)
    });
    window.close();
  });
});

function updateDelayPills() {
  document.querySelectorAll('#delay-selector .pill').forEach((p) => {
    p.classList.toggle('active', parseInt(p.dataset.delay, 10) === selectedDelay);
  });
}

function showStatus(msg, isError = false) {
  const banner = document.getElementById('status-msg');
  banner.textContent = msg;
  banner.classList.remove('hidden', 'error');
  if (isError) banner.classList.add('error');
}

async function triggerCapture(mode) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith(' https://chromewebstore.google.com')) {
    if (mode !== 'visible') {
      showStatus('Por seguridad de Chrome, abre cualquier web normal (ej. google.com o wikipedia.org) para capturar área o página completa.', true);
      return;
    }
  }

  const afterCapture = document.getElementById('after-capture').value;

  chrome.runtime.sendMessage({
    type: 'START_CAPTURE',
    mode,
    delay: selectedDelay,
    afterCapture,
    tabId: tab.id,
    windowId: tab.windowId
  });

  window.close();
}
