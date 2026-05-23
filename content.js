// QRShield content script - right-click only, no hover overlay

// Load jsQR into content script context
async function loadJsQR() {
  if (window.__qrshield_jsQR) return window.__qrshield_jsQR;
  const url = chrome.runtime.getURL('jsqr.min.js');
  const res = await fetch(url);
  const code = await res.text();
  const mod = { exports: {} };
  new Function('module', 'exports', code)(mod, mod.exports);
  window.__qrshield_jsQR = mod.exports.default || mod.exports || window.jsQR;
  return window.__qrshield_jsQR;
}

async function decodeQRFromSrc(src) {
  const qrFn = await loadJsQR();
  if (!qrFn) throw new Error('QR decoder failed to load');
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      try {
        const id = ctx.getImageData(0, 0, c.width, c.height);
        const qr = qrFn(id.data, c.width, c.height, {inversionAttempts:'dontInvert'})
                || qrFn(id.data, c.width, c.height, {inversionAttempts:'onlyInvert'});
        if (qr) resolve({ url: qr.data, base64: c.toDataURL() });
        else reject(new Error('no_qr'));
      } catch(e) { reject(e); }
    };
    img.onerror = () => reject(new Error('img_load_failed'));
    img.src = src;
  });
}

// Handle message from background (right-click context menu)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'decodeImage') {
    const src = msg.src;
    if (!src) {
      chrome.runtime.sendMessage({ action: 'qrError', error: 'No image source' });
      return;
    }
    decodeQRFromSrc(src)
      .then(r => chrome.runtime.sendMessage({ action: 'qrDecoded', url: r.url, base64: r.base64 }))
      .catch(e => chrome.runtime.sendMessage({ action: 'qrError', error: e.message }));
  }
});
