// ── INIT: wire all events after DOM ready ──
document.addEventListener('DOMContentLoaded', () => {

  // Tabs
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', () => switchTab(el.dataset.tab));
  });

  // File input
  const fileInput = document.getElementById('file-input');
  if(fileInput) fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

  // Drop zone
  const dz = document.getElementById('drop-zone-wrap') || document.getElementById('drop-zone');
  if(dz){
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); const f=e.dataTransfer.files[0]; if(f)handleFile(f); });
  }

  // Analyze button
  const aBtn = document.getElementById('analyze-btn');
  if(aBtn) aBtn.addEventListener('click', doAnalyze);

  // Manual input enter key
  const mInput = document.getElementById('manual-in');
  if(mInput) mInput.addEventListener('keydown', e => { if(e.key==='Enter') doAnalyze(); });

  // Quick test chips
  document.querySelectorAll('[data-url]').forEach(el => {
    el.addEventListener('click', () => setUrl(el.dataset.url));
  });

  // Clear history / replay
  document.addEventListener('click', e => {
    if(e.target && e.target.id==='clr-hist-btn') clearHist();
    if(e.target && e.target.closest('.hist-item')) {
      const item = e.target.closest('.hist-item');
      if(item.dataset.hist) replayResult(JSON.parse(item.dataset.hist));
    }
  });

  // Load history
  chrome.storage.local.get(['qrs-hist'], r => {
    hist = r['qrs-hist'] || [];
    updateStats();
  });

  // Check for pending scan — poll a few times to handle timing
  checkPendingScan(0);
});

function checkPendingScan(attempt) {
  chrome.storage.local.get(['pendingScan'], r => {
    const p = r.pendingScan;
    if (p && Date.now() - p.ts < 15000) {
      // Found it — clear and process
      chrome.storage.local.remove('pendingScan');
      switchTab('result');
      if (p.error) {
        document.getElementById('result-content').innerHTML = `
          <div style="text-align:center;padding:30px 16px">
            <div style="font-size:24px;margin-bottom:10px">❌</div>
            <div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:6px">Scan Failed</div>
            <div style="font-size:10px;color:var(--muted2)">${p.error === 'no_qr' ? 'No QR code found in that image.' : p.error}</div>
          </div>`;
        return;
      }
      if (p.url) {
        processUrl(p.url, p.base64 || null);
      }
    } else if (attempt < 5) {
      // Not ready yet — retry after 300ms (up to 5 times = 1.5s total)
      setTimeout(() => checkPendingScan(attempt + 1), 300);
    }
  });
}

// ── TABS ──
function switchTab(tab) {
  ['scan','manual','result','history','workflow'].forEach(t => {
    document.getElementById('pane-'+t).style.display = t===tab ? 'block' : 'none';
    document.getElementById('tab-'+t).classList.toggle('active', t===tab);
  });
  if(tab==='history') renderHist();
}

// ── DRAG & DROP ──
function onDragOver(e){e.preventDefault();document.getElementById('drop-zone').classList.add('drag')}
function onDragLeave(){document.getElementById('drop-zone').classList.remove('drag')}
function onDrop(e){e.preventDefault();document.getElementById('drop-zone').classList.remove('drag');const f=e.dataTransfer.files[0];if(f)handleFile(f)}

function handleFile(file) {
  if(!file||!file.type.startsWith('image/')){showErr('scan-err','Please upload an image file');return}
  hideErr('scan-err');
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width=img.width; c.height=img.height;
      const ctx=c.getContext('2d'); ctx.drawImage(img,0,0);
      const id=ctx.getImageData(0,0,c.width,c.height);
      const qr=jsQR(id.data,c.width,c.height,{inversionAttempts:'dontInvert'})
             ||jsQR(id.data,c.width,c.height,{inversionAttempts:'onlyInvert'});
      if(qr) processUrl(qr.data);
      else showErr('scan-err','No QR code detected. Try a clearer image.');
    };
    img.src = ev.target.result;
    // Show preview
    const dz = document.getElementById('drop-zone');
    dz.innerHTML = `<img class="preview-img" src="${ev.target.result}" alt="QR"/>
      <input type="file" accept="image/*" onchange="handleFile(this.files[0])" style="position:absolute;inset:0;opacity:0;cursor:pointer;font-size:0"/>`;
  };
  reader.readAsDataURL(file);
}

// ── MANUAL ──
function setUrl(u){document.getElementById('manual-in').value=u}
function doAnalyze(){
  const v=document.getElementById('manual-in').value.trim();
  if(!v){showErr('manual-err','Please enter a URL');return}
  hideErr('manual-err');
  processUrl(v);
}

// ── ANALYSIS ENGINE ──
const SP=[/paypa[l1][-.]?(?!\.com)/i,/amaz[o0]n[-.]?(?!\.com)/i,/g[o0]{2}g[l1]e[-.]?(?!\.com)/i,/micr[o0]s[o0]ft[-.]?(?!\.com)/i,/app[l1]e[-.]?(?!\.com)/i,/netf[l1]ix[-.]?(?!\.com)/i,/faceb[o0]{2}k[-.]?(?!\.com)/i,/inst[a4]gram[-.]?(?!\.com)/i,/[l1]inked[i1]n[-.]?(?!\.com)/i,/bank[-.]?(?!\.com|\.co\.uk)/i,/secure[-_]?login/i,/verify[-_]?account/i,/account[-_]?suspended/i,/update[-_]?payment/i,/confirm[-_]?identity/i];
const STLD=['.tk','.ml','.ga','.cf','.gq','.xyz','.top','.club','.online','.site','.website','.space','.click','.link','.pw','.cc','.su','.icu','.buzz'];
const TRUST=['google.com','github.com','microsoft.com','apple.com','amazon.com','paypal.com','facebook.com','twitter.com','instagram.com','linkedin.com','netflix.com','youtube.com','stackoverflow.com','wikipedia.org','reddit.com'];
const SHORT=['bit.ly','tinyurl.com','goo.gl','t.co','ow.ly','short.link','tiny.cc','is.gd','buff.ly','rebrand.ly','cutt.ly'];

function analyzeUrl(raw){
  const flags=[];let score=0;let p;
  let url=raw.trim();
  if(!url.startsWith('http://')&&!url.startsWith('https://'))url='https://'+url;
  try{p=new URL(url)}catch{return{url:raw,riskScore:100,riskLevel:'DANGER',flags:[{type:'error',message:'Invalid URL',severity:'high'}],details:{},safe:false,checkedAt:new Date().toISOString()}}
  const h=p.hostname.toLowerCase();const full=p.toString();
  const det={protocol:p.protocol,hostname:h,path:p.pathname,port:p.port};
  if(p.protocol==='http:'){flags.push({type:'no-ssl',message:'No SSL/TLS — HTTP not HTTPS',severity:'high'});score+=30}
  if(/^(\d{1,3}\.){3}\d{1,3}$/.test(h)){flags.push({type:'ip-host',message:'IP address used as hostname',severity:'high'});score+=35}
  const st=STLD.find(t=>h.endsWith(t));if(st){flags.push({type:'suspicious-tld',message:'Suspicious TLD: '+st,severity:'medium'});score+=20}
  if(SP.find(r=>r.test(h))){flags.push({type:'brand-spoof',message:'Brand impersonation detected',severity:'critical'});score+=50}
  const pts=h.split('.');if(pts.length>4){flags.push({type:'subdomain-abuse',message:'Excessive subdomains',severity:'medium'});score+=15}
  const isShort=SHORT.some(s=>h===s||h.endsWith('.'+s));if(isShort){flags.push({type:'url-shortener',message:'URL shortener hides destination',severity:'medium'});score+=25}
  if(full.length>150){flags.push({type:'long-url',message:'Unusually long URL',severity:'low'});score+=10}
  if(/[0-9]/.test(h.replace(/\.[a-z]+$/,''))&&!/^(\d{1,3}\.){3}\d{1,3}$/.test(h)){flags.push({type:'homoglyph',message:'Numbers in domain — lookalike attack',severity:'medium'});score+=15}
  const kws=['login','signin','secure','verify','account','password','update','confirm','banking','wallet'];
  const pq=(p.pathname+p.search).toLowerCase();const found=kws.filter(k=>pq.includes(k));
  if(found.length>0){flags.push({type:'suspicious-path',message:'Suspicious keywords: '+found.join(', '),severity:'medium'});score+=found.length*8}
  const rp=p.searchParams.get('url')||p.searchParams.get('redirect')||p.searchParams.get('next');
  if(rp){flags.push({type:'open-redirect',message:'Open redirect parameter detected',severity:'high'});score+=30}
  if(p.port&&!['80','443',''].includes(p.port)){flags.push({type:'unusual-port',message:'Non-standard port: '+p.port,severity:'medium'});score+=20}
  if(h.includes('xn--')){flags.push({type:'punycode',message:'Punycode/IDN homograph attack',severity:'high'});score+=40}
  const isTrusted=TRUST.some(d=>h===d||h.endsWith('.'+d));
  if(isTrusted&&flags.length===0)score=Math.max(0,score-20);
  score=Math.min(100,score);
  const lvl=score>=70?'DANGER':score>=40?'SUSPICIOUS':score>=15?'CAUTION':'SAFE';
  return{url:raw,normalizedUrl:url,riskScore:score,riskLevel:lvl,flags,details:det,safe:score<15,isTrusted,isShortener:isShort,checkedAt:new Date().toISOString()};
}

const RC=l=>({DANGER:'#f87171',SUSPICIOUS:'#fb923c',CAUTION:'#fbbf24',SAFE:'#34d399'}[l]||'#6b5c52');
const SC=s=>({critical:'#f87171',high:'#fb923c',medium:'#fbbf24',low:'#ff6b2b'}[s]||'#6b5c52');
const FL={'no-ssl':'No Encryption','ip-host':'IP Address Host','suspicious-tld':'Suspicious TLD','brand-spoof':'Brand Impersonation','subdomain-abuse':'Subdomain Abuse','url-shortener':'URL Shortener','long-url':'Obfuscated URL','homoglyph':'Homoglyph Attack','suspicious-path':'Suspicious Keywords','open-redirect':'Open Redirect','unusual-port':'Unusual Port','punycode':'IDN Homograph','error':'Invalid URL'};
const AV={DANGER:'⛔ Do not visit. High phishing probability.',SUSPICIOUS:'⚠️ Extreme caution — multiple threats.',CAUTION:'🔶 Verify carefully before visiting.',SAFE:'✅ Appears safe. No threats detected.'};

// ── HISTORY ──
let hist=[];
chrome.storage.local.get(['qrs-hist'], r => { hist=r['qrs-hist']||[]; updateStats(); });

async function processUrl(url, base64img) {
  switchTab('result');
  showAnalyzing();
  await new Promise(r=>setTimeout(r,300));
  const res = analyzeUrl(url);
  showResult(res, null, base64img);
  showAiLoading();

  chrome.runtime.sendMessage({
    action:'analyzeWithGemini',
    url, flags:res.flags, score:res.riskScore, level:res.riskLevel
  }, response => {
    const ai = response?.success ? response.data : {error: response?.error||'Failed'};
    res.ai = ai;
    hist = [{...res, id:Date.now()}, ...hist].slice(0,50);
    chrome.storage.local.set({'qrs-hist': hist});
    updateStats();
    showAiResult(ai);
  });
}

function showAnalyzing(){
  document.getElementById('result-content').innerHTML=`
    <div class="analyzing">
      <div class="sp-wrap"><div class="sp"></div><div class="sp-in"></div></div>
      <div style="font-size:10px;color:var(--accent);font-weight:600">Analyzing URL…</div>
      <div style="font-size:8px;color:var(--muted)">Running 14 checks + Gemini AI</div>
    </div>`;
}

function showAiLoading(){
  const b=document.getElementById('ai-result-box');
  if(!b)return;
  b.innerHTML=`<div class="ai-box"><div style="display:flex;align-items:center;gap:8px"><div style="width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,107,43,.15);border-top-color:var(--accent);animation:spin 1s linear infinite;flex-shrink:0"></div><div style="font-size:9px;color:var(--accent);font-weight:600">Gemini AI analyzing…</div></div></div>`;
}

function showAiResult(ai){
  const b=document.getElementById('ai-result-box');if(!b)return;
  if(!ai||ai.error){
    b.innerHTML=`<div class="ai-box"><div style="font-size:9px;color:var(--muted)">⚠ AI unavailable: ${ai?.error||'unknown'}</div></div>`;
    return;
  }
  // Normalise — Gemini sometimes returns different field names
  const verdict = ai.verdict || ai.Verdict || 'UNKNOWN';
  const confidence = ai.confidence || ai.Confidence || 'LOW';
  const summary = ai.summary || ai.Summary || ai.explanation || '';
  const attack = ai.attack_type || ai.attackType || ai['attack type'] || 'N/A';
  const target = ai.target || ai.Target || 'N/A';
  const tip = ai.ai_tip || ai.tip || ai.recommendation || '';

  const vc={DANGER:'var(--red)',SUSPICIOUS:'var(--orange)',CAUTION:'var(--yellow)',SAFE:'var(--green)'}[verdict]||'var(--accent)';
  const cc={HIGH:'var(--green)',MEDIUM:'var(--yellow)',LOW:'var(--muted)'}[confidence]||'var(--muted)';
  b.innerHTML=`<div class="ai-box">
    <div class="ai-hd">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2L9 9H2l5.5 4-2 7L12 16l6.5 4-2-7L22 9h-7z" fill="var(--accent)"/></svg>
      <span class="ai-title">Gemini AI</span>
      <span class="ai-conf" style="color:${cc};background:${cc}18;border:1px solid ${cc}30">${confidence}</span>
    </div>
    <div class="ai-verdict-row" style="background:${vc}08;border:1px solid ${vc}25">
      <div class="ai-verdict-text" style="color:${vc}">${verdict}</div>
      <div class="ai-summary">${esc(summary)}</div>
    </div>
    <div class="ai-grid">
      <div class="ai-cell"><div class="ai-cell-lbl">Attack Type</div><div class="ai-cell-val">${esc(attack)}</div></div>
      <div class="ai-cell"><div class="ai-cell-lbl">Target</div><div class="ai-cell-val">${esc(target)}</div></div>
    </div>
    ${tip ? `<div class="ai-tip"><span style="font-size:11px;flex-shrink:0">💡</span><div class="ai-tip-text">${esc(tip)}</div></div>` : ''}
  </div>`;
}

function showResult(r, ai, base64img){
  const c=RC(r.riskLevel);const circ=2*Math.PI*34;const off=circ-(r.riskScore/100)*circ;
  let fh='';
  if(r.safe&&r.flags.length===0){
    fh=`<div style="display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:7px;border:1px solid rgba(52,211,153,.25);background:rgba(52,211,153,.05);margin:8px 10px"><div style="color:var(--green);font-size:14px">✓</div><div style="font-size:9px;color:var(--green);font-weight:600">No threats detected</div></div>`;
  } else {
    fh=`<div class="flags-section"><div class="flags-title" style="font-size:11px">Threat Indicators (${r.flags.length})</div>`;
    r.flags.forEach(f=>{const fc=SC(f.severity);fh+=`<div class="flag-item" style="background:${fc}08;border:1px solid ${fc}28"><div class="flag-dot" style="background:${fc}"></div><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:5px"><div class="flag-name" style="color:${fc};font-size:13px">${FL[f.type]||f.type}</div><div class="flag-sev" style="color:${fc};background:${fc}20;font-size:9px;padding:2px 8px">${f.severity.toUpperCase()}</div></div><div class="flag-msg" style="font-size:11px;color:rgba(240,232,224,.85)">${f.message}</div></div></div>`});
    fh+=`</div>`;
  }

  const imgHtml = base64img
    ? `<div style="padding:8px 10px 0"><img src="${base64img}" style="width:100%;max-height:100px;object-fit:contain;border-radius:6px;border:1px solid var(--border)"/></div>`
    : '';

  document.getElementById('result-content').innerHTML=`
    <div class="result-box">
      ${imgHtml}
      <div class="result-url" style="background:${c}06;border-bottom-color:${c}20">
        <div class="r-label">Scanned URL / Content</div>
        <div style="color:${c};word-break:break-all;font-size:13px;line-height:1.5">${esc(r.url)}</div>
      </div>
      <div class="meter-row">
        <div>
          <div class="meter-wrap">
            <svg viewBox="0 0 88 88"><circle cx="44" cy="44" r="34" fill="none" stroke="var(--border)" stroke-width="6"/><circle cx="44" cy="44" r="34" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" style="transition:stroke-dashoffset 1s ease"/></svg>
            <div class="m-center"><div class="m-score" style="color:${c}">${r.riskScore}</div><div class="m-risk">RISK</div></div>
          </div>
          <div style="text-align:center"><div class="risk-pill" style="color:${c};background:${c}15;border:1px solid ${c}40">${r.riskLevel}</div></div>
        </div>
        <div class="d-list">
          ${r.details.hostname?`<div class="d-row"><div class="d-lbl">HOST</div><div class="d-val">${esc(r.details.hostname)}</div></div>`:''}
          ${r.details.protocol?`<div class="d-row"><div class="d-lbl">PROTO</div><div class="d-val">${r.details.protocol.replace(':','')}</div></div>`:''}
          ${r.details.path?`<div class="d-row"><div class="d-lbl">PATH</div><div class="d-val">${esc(r.details.path)}</div></div>`:''}
          <div class="d-row"><div class="d-lbl">PORT</div><div class="d-val">${r.details.port||'default'}</div></div>
          ${r.isTrusted?'<div style="font-size:7px;color:var(--green);margin-top:3px">✓ Trusted domain</div>':''}
        </div>
      </div>
      <div style="height:1px;background:var(--border)"></div>
      ${fh}
      <div class="advice-box" style="background:${c}06;border:1px solid ${c}20">
        <div class="advice-lbl" style="font-size:11px">Recommendation</div>
        <div class="advice-text" style="color:${c};font-size:14px;font-weight:600">${AV[r.riskLevel]}</div>
      </div>
      <div id="ai-result-box"></div>
    </div>`;
  if(ai&&!ai.error) showAiResult(ai);
}

function updateStats(){
  const t=hist.length,th=hist.filter(h=>h.riskLevel==='DANGER'||h.riskLevel==='SUSPICIOUS').length,sf=hist.filter(h=>h.riskLevel==='SAFE').length;
  document.getElementById('st-total').textContent=t;
  document.getElementById('st-threats').textContent=th;
  document.getElementById('st-safe').textContent=sf;
}

function renderHist(){
  const el=document.getElementById('hist-list');if(!el)return;
  if(hist.length===0){el.innerHTML='<div class="hist-empty">No scan history yet</div>';return}
  let html=`<button class="clr-btn" id="clr-hist-btn">🗑 Clear All</button>`;
  html+=hist.map(h=>{const c=RC(h.riskLevel);return`<div class="hist-item" data-hist='${JSON.stringify(h).replace(/'/g,"&#39;")}'>
    <div class="hist-dot" style="background:${c};box-shadow:0 0 4px ${c}80"></div>
    <div style="flex:1;min-width:0">
      <div style="font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${c}">${esc(h.url)}</div>
      <div style="font-size:7px;color:var(--muted);margin-top:1px">${h.riskLevel} · ${h.flags.length} flags · ${ago(new Date(h.checkedAt))}</div>
    </div>
  </div>`}).join('');
  el.innerHTML=html;
}

function clearHist(){hist=[];chrome.storage.local.set({'qrs-hist':[]});updateStats();renderHist()}
function replayResult(h){showResult(h,h.ai||null,h.base64||null);switchTab('result');if(h.ai)setTimeout(()=>showAiResult(h.ai),100)}

function ago(d){const m=Math.floor((Date.now()-d)/60000),h=Math.floor(m/60),day=Math.floor(h/24);return day>0?day+'d ago':h>0?h+'h ago':m>0?m+'m ago':'just now'}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function showErr(id,msg){const e=document.getElementById(id);if(e){e.textContent=msg;e.style.display='block'}}
function hideErr(id){const e=document.getElementById(id);if(e)e.style.display='none'}
