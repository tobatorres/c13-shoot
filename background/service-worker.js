// Service Worker principal de OpenCapture Pro

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const saved = await chrome.storage.local.get(['afterCapture', 'selectedDelay']);
  const afterCapture = saved.afterCapture || 'editor';
  const delay = saved.selectedDelay || 0;

  if (command === 'capture-visible') {
    handleStartCapture({ mode: 'visible', delay, afterCapture, tabId: tab.id, windowId: tab.windowId });
  } else if (command === 'capture-area') {
    handleStartCapture({ mode: 'area', delay, afterCapture, tabId: tab.id, windowId: tab.windowId });
  } else if (command === 'capture-fullpage') {
    handleStartCapture({ mode: 'fullpage', delay, afterCapture, tabId: tab.id, windowId: tab.windowId });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_CAPTURE') {
    handleStartCapture(message);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'CAPTURE_VISIBLE_SLICE') {
    const winId = sender.tab ? sender.tab.windowId : chrome.windows.WINDOW_ID_CURRENT;
    chrome.tabs.captureVisibleTab(winId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true; // Respuesta asíncrona
  }

  if (message.type === 'OPEN_STUDIO_WITH_DATA') {
    finalizeCapture(message.dataUrl, message.afterCapture || 'editor', message.pageTitle || 'captura');
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'OPEN_STUDIO_FROM_STORAGE') {
    handleStoredCapture(message.afterCapture || 'editor', message.pageTitle || 'captura');
    sendResponse({ ok: true });
    return true;
  }
});

async function handleStoredCapture(afterCapture, title) {
  const safeName = (title || 'captura')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 45) || 'captura';

  if (afterCapture === 'download') {
    const data = await chrome.storage.local.get(['latestCaptureDataUrl']);
    if (data.latestCaptureDataUrl) {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      chrome.downloads.download({
        url: data.latestCaptureDataUrl,
        filename: `c13-shoot-${safeName}-${timestamp}.png`,
        saveAs: false
      });
    }
    return;
  }

  await chrome.storage.local.set({
    latestCaptureTitle: safeName,
    latestCaptureTimestamp: Date.now()
  });

  await chrome.tabs.create({
    url: chrome.runtime.getURL('studio/studio.html')
  });
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/content.js']
  });
}

async function handleStartCapture({ mode, delay, afterCapture, tabId, windowId }) {
  try {
    if (mode === 'visible') {
      if (delay > 0) {
        try {
          await ensureContentScript(tabId);
          await chrome.tabs.sendMessage(tabId, { type: 'RUN_COUNTDOWN', seconds: delay });
        } catch {
          await sleep(delay * 1000);
        }
      } else {
        // Pequeña pausa para que se cierre el popup antes de tomar la foto
        await sleep(150);
      }

      const dataUrl = await captureTabPromise(windowId);
      const tab = await chrome.tabs.get(tabId);
      await finalizeCapture(dataUrl, afterCapture, tab.title || 'captura-visible');
      return;
    }

    // Modos que requieren inyección en la página: 'area' y 'fullpage'
    await ensureContentScript(tabId);

    if (delay > 0) {
      await chrome.tabs.sendMessage(tabId, { type: 'RUN_COUNTDOWN', seconds: delay });
    }

    if (mode === 'area') {
      await chrome.tabs.sendMessage(tabId, {
        type: 'START_AREA_SELECTION',
        afterCapture
      });
    } else if (mode === 'fullpage') {
      await chrome.tabs.sendMessage(tabId, {
        type: 'START_FULLPAGE_CAPTURE',
        afterCapture
      });
    }
  } catch (err) {
    console.error('Error durante la captura:', err);
  }
}

function captureTabPromise(windowId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        reject(new Error(chrome.runtime.lastError?.message || 'No se pudo capturar la pestaña'));
      } else {
        resolve(dataUrl);
      }
    });
  });
}

async function finalizeCapture(dataUrl, afterCapture, title) {
  const safeName = (title || 'captura')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 45) || 'captura';

  if (afterCapture === 'download') {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    chrome.downloads.download({
      url: dataUrl,
      filename: `c13-shoot-${safeName}-${timestamp}.png`,
      saveAs: false
    });
    return;
  }

  // Guardar la imagen en storage local y abrir el Estudio de Anotaciones
  await chrome.storage.local.set({
    latestCaptureDataUrl: dataUrl,
    latestCaptureTitle: safeName,
    latestCaptureTimestamp: Date.now()
  });

  await chrome.tabs.create({
    url: chrome.runtime.getURL('studio/studio.html')
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
