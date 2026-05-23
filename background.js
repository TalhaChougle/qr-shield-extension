const GEMINI_KEY = 'AIzaSyD4dk5zFOkpvBOZziid4lNnNTuhroE1fl8';

function setupMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'scanQR',
      title: '🛡️ Scan with QRShield',
      contexts: ['image', 'page', 'link', 'selection']
    });
  });
}
setupMenu();
chrome.runtime.onInstalled.addListener(setupMenu);
chrome.runtime.onStartup.addListener(setupMenu);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'scanQR') return;
  const src = info.srcUrl || null;

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['jsqr.min.js'] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch(e) {}

  await new Promise(r => setTimeout(r, 200));

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (imgSrc) => {
      return new Promise(async (resolve) => {
        const qrFn = window.jsQR;
        if (!qrFn) { resolve({ error: 'jsQR not loaded' }); return; }

        async function tryDecode(src) {
          return new Promise((res) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              try {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth || img.width;
                c.height = img.naturalHeight || img.height;
                const ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const id = ctx.getImageData(0, 0, c.width, c.height);
                const qr = qrFn(id.data, c.width, c.height, {inversionAttempts:'dontInvert'})
                         || qrFn(id.data, c.width, c.height, {inversionAttempts:'onlyInvert'});
                res(qr ? { url: qr.data, base64: c.toDataURL() } : null);
              } catch(e) { res(null); }
            };
            img.onerror = () => res(null);
            img.src = src;
          });
        }

        if (imgSrc) {
          const r = await tryDecode(imgSrc);
          if (r) { resolve(r); return; }
        }

        for (const img of [...document.querySelectorAll('img')]) {
          if (!img.src) continue;
          const r = await tryDecode(img.src);
          if (r) { resolve(r); return; }
        }

        for (const canvas of [...document.querySelectorAll('canvas')]) {
          try {
            const base64 = canvas.toDataURL('image/png');
            const ctx = canvas.getContext('2d');
            const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const qr = qrFn(id.data, canvas.width, canvas.height, {inversionAttempts:'dontInvert'})
                     || qrFn(id.data, canvas.width, canvas.height, {inversionAttempts:'onlyInvert'});
            if (qr) { resolve({ url: qr.data, base64 }); return; }
          } catch(e) {}
        }

        resolve({ error: 'no_qr' });
      });
    },
    args: [src]
  });

  const result = results?.[0]?.result || { error: 'no_qr' };

  // Store result and open the real extension popup
  await chrome.storage.local.set({ pendingScan: { ...result, ts: Date.now() } });

  // Try native openPopup first, fallback to small window
  try {
    await chrome.action.openPopup();
  } catch(e) {
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html') + '?mode=result',
      type: 'popup',
      width: 420,
      height: 680,
      focused: true
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'analyzeWithGemini') {
    analyzeWithGemini(msg.url, msg.flags, msg.score, msg.level)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function analyzeWithGemini(url, flags, score, level) {
  const flagSummary = flags.map(f => `- ${f.type}: ${f.message}`).join('\n') || 'None';
  const prompt = `You are a cybersecurity expert analyzing a URL for phishing threats.
URL: ${url}
Rule-based risk score: ${score}/100
Rule-based verdict: ${level}
Flags:
${flagSummary}
Respond ONLY in this JSON (no markdown):
{"verdict":"DANGER|SUSPICIOUS|CAUTION|SAFE","confidence":"HIGH|MEDIUM|LOW","summary":"2-3 sentence explanation","attack_type":"e.g. Credential Phishing / None detected","target":"e.g. PayPal users / N/A","ai_tip":"One actionable tip"}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 400 }
      })
    }
  );
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}
