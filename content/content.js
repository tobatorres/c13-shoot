// Content Script de C13 Shoot (Selección de Área, Cuenta Atrás y Auto-Scroll de Página Completa)

if (window.__c13ShootListener) {
  chrome.runtime.onMessage.removeListener(window.__c13ShootListener);
}

window.__c13ShootListener = (message, sender, sendResponse) => {
  if (message.type === 'PING_CONTENT') {
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'RUN_COUNTDOWN') {
    runPageCountdown(message.seconds || 3).then(() => sendResponse({ done: true }));
    return true;
  }

  if (message.type === 'START_AREA_SELECTION') {
    startAreaSelectionOverlay(message.afterCapture || 'editor');
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'START_FULLPAGE_CAPTURE') {
    captureFullPageScroll(message.afterCapture || 'editor');
    sendResponse({ ok: true });
    return true;
  }
};

chrome.runtime.onMessage.addListener(window.__c13ShootListener);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function requestVisibleSlice() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_SLICE' }, (res) => {
      if (chrome.runtime.lastError || !res || res.error) {
        reject(new Error(res?.error || chrome.runtime.lastError?.message || 'Error capturando vista'));
      } else {
        resolve(res.dataUrl);
      }
    });
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ==========================================
// 1. CUENTA ATRÁS EN PÁGINA (3, 2, 1...)
// ==========================================
async function runPageCountdown(seconds) {
  const host = document.createElement('div');
  host.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483647;
    display: flex; align-items: center; justify-content: center;
    background: rgba(15, 23, 42, 0.35); backdrop-filter: blur(2px);
    pointer-events: none; font-family: system-ui, -apple-system, sans-serif;
  `;
  const bubble = document.createElement('div');
  bubble.style.cssText = `
    width: 110px; height: 110px; border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff; font-size: 52px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 20px 50px rgba(99, 102, 241, 0.5);
  `;
  host.appendChild(bubble);
  document.documentElement.appendChild(host);

  for (let i = seconds; i > 0; i--) {
    bubble.textContent = String(i);
    await sleep(950);
  }

  host.remove();
  await sleep(80);
}

// ==========================================
// 2. SELECCIÓN DE ÁREA INTERACTIVA
// ==========================================
function startAreaSelectionOverlay(defaultAfterCapture) {
  const existing = document.getElementById('__ocp-area-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = '__ocp-area-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483647;
    cursor: crosshair; user-select: none;
    background: rgba(15, 23, 42, 0.42);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const hint = document.createElement('div');
  hint.style.cssText = `
    position: fixed; top: 18px; left: 50%; transform: translateX(-50%);
    background: #0f172a; color: #f8fafc; padding: 8px 16px;
    border-radius: 99px; font-size: 13px; font-weight: 600;
    border: 1px solid #4f46e5; box-shadow: 0 8px 25px rgba(0,0,0,0.4);
    pointer-events: none;
  `;
  hint.textContent = 'Arrastra para seleccionar un área • Pulsa ESC para cancelar';

  const box = document.createElement('div');
  box.style.cssText = `
    position: fixed; display: none;
    border: 2px solid #6366f1;
    box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.55);
    background: transparent; pointer-events: none;
  `;

  const sizeBadge = document.createElement('div');
  sizeBadge.style.cssText = `
    position: absolute; top: -28px; left: 0;
    background: #6366f1; color: #fff; font-size: 11px; font-weight: 700;
    padding: 3px 8px; border-radius: 5px; white-space: nowrap;
  `;
  box.appendChild(sizeBadge);

  const actionsBar = document.createElement('div');
  actionsBar.style.cssText = `
    position: fixed; display: none; gap: 6px;
    background: #0f172a; border: 1px solid #334155;
    padding: 6px; border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.45);
  `;

  const makeBtn = (label, bg, onClick) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `
      background: ${bg}; color: #fff; border: none;
      padding: 6px 11px; border-radius: 6px; font-size: 12px;
      font-weight: 600; cursor: pointer;
    `;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  };

  let rect = { x: 0, y: 0, w: 0, h: 0 };
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  const cleanup = () => {
    window.removeEventListener('keydown', onKeyDown, true);
    overlay.remove();
  };

  const executeCrop = async (actionMode) => {
    overlay.style.opacity = '0';
    await sleep(60);
    try {
      const sliceDataUrl = await requestVisibleSlice();
      const img = await loadImage(sliceDataUrl);
      const dpr = window.devicePixelRatio || 1;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(rect.w * dpr));
      canvas.height = Math.max(1, Math.round(rect.h * dpr));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        img,
        Math.round(rect.x * dpr),
        Math.round(rect.y * dpr),
        Math.round(rect.w * dpr),
        Math.round(rect.h * dpr),
        0,
        0,
        canvas.width,
        canvas.height
      );

      const croppedDataUrl = canvas.toDataURL('image/png');
      cleanup();

      if (actionMode === 'copy') {
        const blob = await (await fetch(croppedDataUrl)).blob();
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('¡Área copiada al portapapeles!');
      } else {
        await chrome.storage.local.set({ latestCaptureDataUrl: croppedDataUrl });
        chrome.runtime.sendMessage({
          type: 'OPEN_STUDIO_FROM_STORAGE',
          afterCapture: actionMode,
          pageTitle: document.title || 'area'
        });
      }
    } catch (err) {
      cleanup();
      alert('No se pudo recortar el área: ' + err.message);
    }
  };

  actionsBar.appendChild(makeBtn('✏️ Editar y Anotar', '#6366f1', () => executeCrop('editor')));
  actionsBar.appendChild(makeBtn('📋 Copiar', '#0ea5e9', () => executeCrop('copy')));
  actionsBar.appendChild(makeBtn('⬇️ Descargar PNG', '#10b981', () => executeCrop('download')));
  actionsBar.appendChild(makeBtn('✕', '#475569', cleanup));

  overlay.appendChild(hint);
  overlay.appendChild(box);
  overlay.appendChild(actionsBar);
  document.documentElement.appendChild(overlay);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') cleanup();
    if (e.key === 'Enter' && rect.w > 10 && rect.h > 10) {
      executeCrop(defaultAfterCapture);
    }
  };
  window.addEventListener('keydown', onKeyDown, true);

  overlay.addEventListener('mousedown', (e) => {
    if (actionsBar.contains(e.target)) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    overlay.style.background = 'transparent';
    box.style.display = 'block';
    actionsBar.style.display = 'none';
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const x = Math.min(startX, e.clientX);
    const y = Math.min(startY, e.clientY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    rect = { x, y, w, h };

    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.style.width = `${w}px`;
    box.style.height = `${h}px`;
    sizeBadge.textContent = `${Math.round(w)} × ${Math.round(h)} px`;
  });

  overlay.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    if (rect.w < 12 || rect.h < 12) {
      return;
    }
    actionsBar.style.display = 'flex';
    const barTop = Math.min(window.innerHeight - 54, rect.y + rect.h + 10);
    const barLeft = Math.max(12, Math.min(window.innerWidth - 360, rect.x));
    actionsBar.style.top = `${barTop}px`;
    actionsBar.style.left = `${barLeft}px`;
  });
}

// ==========================================
// 3. CAPTURA DE PÁGINA COMPLETA (AUTO-SCROLL)
// ==========================================
async function captureFullPageScroll(afterCapture) {
  const originalScrollX = window.scrollX;
  const originalScrollY = window.scrollY;
  const docEl = document.documentElement;
  const body = document.body;

  const prevScrollBehavior = docEl.style.scrollBehavior;
  docEl.style.scrollBehavior = 'auto';

  // Ocultar barra de scroll durante la captura para que no salga repetida en cada tramo
  const hideScrollbarStyle = document.createElement('style');
  hideScrollbarStyle.textContent = `
    ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
    html, body { scrollbar-width: none !important; -ms-overflow-style: none !important; }
  `;
  document.head.appendChild(hideScrollbarStyle);

  let cancelRequested = false;
  const onEsc = (e) => {
    if (e.key === 'Escape') cancelRequested = true;
  };
  window.addEventListener('keydown', onEsc, true);

  // Banner flotante de progreso
  const hud = document.createElement('div');
  hud.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 2147483647;
    background: #0f172a; color: #f8fafc; border: 1px solid #6366f1;
    border-radius: 12px; padding: 12px 16px; font-family: system-ui, sans-serif;
    box-shadow: 0 12px 30px rgba(0,0,0,0.45); display: flex; align-items: center; gap: 12px;
  `;
  const hudText = document.createElement('span');
  hudText.style.cssText = 'font-size: 13px; font-weight: 600;';
  hudText.textContent = 'Capturando página completa... 0%';
  hud.appendChild(hudText);
  docEl.appendChild(hud);

  // Detectar solo cabeceras/flotantes fijos reales (sin ocultar bloques sticky del contenido del periódico)
  const modifiedFixedElements = [];
  function hideFixedAndStickyElements() {
    const all = document.querySelectorAll('*');
    const vh = window.innerHeight;
    for (const el of all) {
      if (el === hud || hud.contains(el)) continue;
      if (el === document.body || el === document.documentElement) continue;
      const cs = window.getComputedStyle(el);
      if (cs.position === 'fixed') {
        modifiedFixedElements.push({ el, prevVisibility: el.style.visibility });
        el.style.setProperty('visibility', 'hidden', 'important');
      } else if (cs.position === 'sticky') {
        const rect = el.getBoundingClientRect();
        // Solo ocultar barras superiores/inferiores pegajosas (menús de navegación), nunca artículos ni fotos
        if (rect.height > 0 && rect.height < vh * 0.28 && rect.top <= 70) {
          modifiedFixedElements.push({ el, prevVisibility: el.style.visibility });
          el.style.setProperty('visibility', 'hidden', 'important');
        }
      }
    }
  }

  function restoreFixedAndStickyElements() {
    for (const item of modifiedFixedElements) {
      if (item.prevVisibility) {
        item.el.style.visibility = item.prevVisibility;
      } else {
        item.el.style.removeProperty('visibility');
      }
    }
  }

  // Forzar carga de imágenes lazy y colapsar huecos vacíos de publicidad bloqueada
  const collapsedAdElements = [];
  function preparePageForCleanCapture() {
    document.querySelectorAll('img[loading="lazy"], iframe[loading="lazy"]').forEach((el) => {
      el.setAttribute('loading', 'eager');
    });
    document.querySelectorAll('img[data-src], img[data-lazy-src], img[data-original]').forEach((img) => {
      const realSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original');
      if (realSrc && (!img.src || img.src.startsWith('data:'))) {
        img.src = realSrc;
      }
    });

    // Colapsar contenedores de anuncios vacíos que dejan huecos blancos gigantes en periódicos
    const adSelectors = [
      'ins.adsbygoogle',
      '[id^="google_ads_"]',
      '[id*="dfp-"]',
      '[class*="ad-slot"]',
      '[class*="ad-container"]',
      '[class*="publi-"]',
      '[class*="publicidad"]',
      '[data-ad-slot]'
    ];
    document.querySelectorAll(adSelectors.join(',')).forEach((adEl) => {
      const rect = adEl.getBoundingClientRect();
      const hasVisibleImg = adEl.querySelector('img') && adEl.querySelector('img').complete && adEl.querySelector('img').naturalHeight > 20;
      const textLen = (adEl.innerText || '').trim().length;
      if (rect.height >= 90 && !hasVisibleImg && textLen < 35) {
        collapsedAdElements.push({
          el: adEl,
          prevDisplay: adEl.style.display,
          parent: adEl.parentElement,
          parentPrevMinHeight: adEl.parentElement ? adEl.parentElement.style.minHeight : ''
        });
        adEl.style.setProperty('display', 'none', 'important');
        if (adEl.parentElement) {
          adEl.parentElement.style.setProperty('min-height', '0px', 'important');
        }
      }
    });
  }

  function restoreCollapsedAds() {
    for (const item of collapsedAdElements) {
      if (item.prevDisplay) item.el.style.display = item.prevDisplay;
      else item.el.style.removeProperty('display');
      if (item.parent) {
        if (item.parentPrevMinHeight) item.parent.style.minHeight = item.parentPrevMinHeight;
        else item.parent.style.removeProperty('min-height');
      }
    }
  }

  async function waitForVisibleImagesInViewport() {
    const vh = window.innerHeight;
    const visibleImgs = Array.from(document.querySelectorAll('img')).filter((img) => {
      const r = img.getBoundingClientRect();
      return r.bottom > 0 && r.top < vh && r.width > 10 && r.height > 10;
    });
    const pending = visibleImgs.filter((img) => !img.complete);
    if (pending.length === 0) return;
    await Promise.race([
      Promise.all(
        pending.map(
          (img) =>
            new Promise((res) => {
              img.addEventListener('load', res, { once: true });
              img.addEventListener('error', res, { once: true });
            })
        )
      ),
      sleep(550)
    ]);
  }

  try {
    preparePageForCleanCapture();
    await sleep(120);

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const getScrollHeight = () =>
      Math.min(
        Math.max(
          body ? body.scrollHeight : 0,
          docEl.scrollHeight,
          body ? body.offsetHeight : 0,
          docEl.offsetHeight
        ),
        25000
      );
    let maxHeight = getScrollHeight();

    const slices = [];
    let currentY = 0;
    let stepIndex = 0;

    while (currentY < maxHeight && !cancelRequested) {
      window.scrollTo(0, currentY);
      await waitForVisibleImagesInViewport();
      await sleep(360); // Respeta cuota de Chrome captureVisibleTab y asienta el renderizado

      maxHeight = getScrollHeight();
      const actualScrollY = window.scrollY;
      const pct = Math.min(99, Math.round(((actualScrollY + viewportH) / maxHeight) * 100));
      hudText.textContent = `Capturando página completa... ${pct}% (ESC para parar)`;

      // Ocultar elementos sticky superiores a partir del segundo corte
      if (stepIndex > 0) {
        hideFixedAndStickyElements();
      }

      // Ocultar HUD en el instante exacto de la foto
      hud.style.visibility = 'hidden';
      await sleep(50);

      const dataUrl = await requestVisibleSlice();
      hud.style.visibility = 'visible';

      slices.push({
        y: actualScrollY,
        dataUrl
      });

      if (stepIndex === 0) {
        hideFixedAndStickyElements();
      }
      stepIndex++;

      if (actualScrollY + viewportH >= maxHeight) {
        break;
      }

      const nextY = currentY + viewportH;
      // Si la página no pudo hacer más scroll (p.ej. contenedor bloqueado), terminar bucle
      if (stepIndex > 1 && actualScrollY === slices[slices.length - 2].y) {
        break;
      }
      currentY = nextY;
    }

    hudText.textContent = 'Uniendo imagen en alta resolución...';

    if (slices.length > 0) {
      const firstImg = await loadImage(slices[0].dataUrl);
      const rawScale = firstImg.width / viewportW;
      const lastSlice = slices[slices.length - 1];
      const totalCapturedHeight = Math.min(maxHeight, lastSlice.y + viewportH);

      // Respetar el límite físico de lienzo de Chrome (32.767px) y evitar desbordar memoria en periódicos largos
      const MAX_CANVAS_PX = 28000;
      const maxAllowedScale = MAX_CANVAS_PX / Math.max(1, totalCapturedHeight);
      const scale = Math.min(rawScale, maxAllowedScale);

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewportW * scale);
      canvas.height = Math.round(totalCapturedHeight * scale);
      const ctx = canvas.getContext('2d');

      for (const slice of slices) {
        const img = await loadImage(slice.dataUrl);
        ctx.drawImage(
          img,
          0,
          0,
          img.width,
          img.height,
          0,
          Math.round(slice.y * scale),
          canvas.width,
          Math.round(viewportH * scale)
        );
      }

      // En páginas muy largas (>4500px, como periódicos), usar WebP/JPEG de alta definición (92%) para que sea instantáneo y ligero
      let finalDataUrl;
      if (canvas.height > 4500) {
        finalDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      } else {
        finalDataUrl = canvas.toDataURL('image/png');
        if (finalDataUrl.length > 25 * 1024 * 1024) {
          finalDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        }
      }

      // Guardar directo en chrome.storage.local (con permiso unlimitedStorage) para no chocar con el límite de 64MiB de sendMessage
      await chrome.storage.local.set({
        latestCaptureDataUrl: finalDataUrl
      });

      chrome.runtime.sendMessage({
        type: 'OPEN_STUDIO_FROM_STORAGE',
        afterCapture,
        pageTitle: document.title || 'pagina-completa'
      });
    }
  } catch (err) {
    console.error('Error en captura de página completa:', err);
    alert('Error al capturar la página completa: ' + err.message);
  } finally {
    window.removeEventListener('keydown', onEsc, true);
    hideScrollbarStyle.remove();
    restoreFixedAndStickyElements();
    restoreCollapsedAds();
    docEl.style.scrollBehavior = prevScrollBehavior;
    window.scrollTo(originalScrollX, originalScrollY);
    hud.remove();
  }
}

function showToast(text) {
  const toast = document.createElement('div');
  toast.textContent = text;
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
    background: #10b981; color: #fff; padding: 12px 20px;
    border-radius: 10px; font-family: system-ui, sans-serif;
    font-size: 14px; font-weight: 700; box-shadow: 0 10px 25px rgba(0,0,0,0.3);
  `;
  document.documentElement.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}
