# 🛡️ QRShield — Chrome Extension

> Scan any QR code on any webpage instantly. Powered by Google Gemini AI.

![Version](https://img.shields.io/badge/version-1.1.1-ff6b2b?style=for-the-badge)
![Manifest](https://img.shields.io/badge/Manifest-V3-4285F4?style=for-the-badge)
![Browser](https://img.shields.io/badge/Chrome%20%7C%20Brave-supported-green?style=for-the-badge)

---

## 🌐 Also available as a Web App

**[qr-shield.netlify.app](https://qr-shield.netlify.app)** ← No installation needed

---

## 📥 Installation (3 steps)

Since this extension is not yet on the Chrome Web Store, install it manually in Developer Mode.

### Step 1 — Download

[![Download ZIP](https://img.shields.io/badge/⬇%20Download%20Extension-ff6b2b?style=for-the-badge)](https://github.com/TalhaChougle/qr-shield-extension/archive/refs/heads/main.zip)

Click the button above → a ZIP file downloads automatically → **Extract** the folder

### Step 2 — Enable Developer Mode

- **Chrome** → go to `chrome://extensions`
- **Brave** → go to `brave://extensions`
- Toggle **Developer Mode** ON (top right corner)

### Step 3 — Load Extension

- Click **Load unpacked**
- Select the extracted `qr-shield-extension` folder
- Done ✅ — the 🛡️ icon appears in your toolbar

---

## 🚀 How to Use

### Scan a QR code on any webpage
1. Visit any website that has a QR code
2. **Right-click** the QR image
3. Click **"🛡️ Scan with QRShield"**
4. The extension popup opens with full analysis

### Scan a QR image from your device
1. Click the 🛡️ **QRShield icon** in toolbar
2. Go to **Scan tab**
3. Upload or drag & drop any QR code image

### Check a suspicious URL manually
1. Click the 🛡️ **QRShield icon**
2. Go to **URL tab**
3. Paste any URL → press Enter

### View past scans
- Click the 🛡️ icon → **History tab**

### View detection pipeline
- Click the 🛡️ icon → **Flow tab**

---

## 🔍 What it detects

| Threat | Severity |
|--------|----------|
| No HTTPS / HTTP only | 🔴 High |
| IP address as hostname | 🔴 High |
| Brand impersonation (PayPal, Apple…) | 🔴 Critical |
| Punycode / IDN homograph attack | 🔴 High |
| Open redirect parameter | 🔴 High |
| Suspicious TLD (.tk .ml .xyz…) | 🟡 Medium |
| URL shortener (bit.ly, tinyurl…) | 🟡 Medium |
| Homoglyph / number substitution | 🟡 Medium |
| Excessive subdomains | 🟡 Medium |
| Suspicious path keywords | 🟡 Medium |
| Non-standard port | 🟡 Medium |
| Obfuscated long URL | 🟢 Low |

---

## 🧪 Test URLs

Paste these in the **URL tab** to test:

```
# DANGER
http://paypa1-secure.tk/login?verify=account
http://amaz0n-prize-claim.xyz/winner
http://192.168.1.1/banking/secure-login

# SUSPICIOUS  
https://bit.ly/3xK9mPq

# SAFE
https://google.com
https://github.com
```

---

## 🗂️ Files

```
qr-shield-extension/
├── manifest.json      ← Extension config (Manifest V3)
├── background.js      ← Service worker + Gemini AI
├── content.js         ← Page script (right-click scan)
├── popup.html         ← Extension popup UI
├── popup.js           ← Popup logic + analysis engine
├── result.html        ← Scan result page
├── result.js          ← Result page logic
├── jsqr.min.js        ← QR decoder (bundled locally)
└── icons/             ← Extension icons
```

---

## 👨‍💻 Author

Built by **Talha** · Part of the QRShield project
