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
  if(rp){flags.push({type:'open-redirect',message:'Open redirect detected',severity:'high'});score+=30}
  if(p.port&&!['80','443',''].includes(p.port)){flags.push({type:'unusual-port',message:'Non-standard port: '+p.port,severity:'medium'});score+=20}
  if(h.includes('xn--')){flags.push({type:'punycode',message:'IDN homograph attack',severity:'high'});score+=40}
  const isTrusted=TRUST.some(d=>h===d||h.endsWith('.'+d));
  if(isTrusted&&flags.length===0)score=Math.max(0,score-20);
  score=Math.min(100,score);
  const lvl=score>=70?'DANGER':score>=40?'SUSPICIOUS':score>=15?'CAUTION':'SAFE';
  return{url:raw,normalizedUrl:url,riskScore:score,riskLevel:lvl,flags,details:det,safe:score<15,isTrusted,isShortener:isShort,checkedAt:new Date().toISOString()};
}

const RC=l=>({DANGER:'#f87171',SUSPICIOUS:'#fb923c',CAUTION:'#fbbf24',SAFE:'#34d399'}[l]||'#6b5c52');
const SC=s=>({critical:'#f87171',high:'#fb923c',medium:'#fbbf24',low:'#ff6b2b'}[s]||'#6b5c52');
const FL={'no-ssl':'No Encryption','ip-host':'IP Address Host','suspicious-tld':'Suspicious TLD','brand-spoof':'Brand Impersonation','subdomain-abuse':'Subdomain Abuse','url-shortener':'URL Shortener','long-url':'Obfuscated URL','homoglyph':'Homoglyph Attack','suspicious-path':'Suspicious Keywords','open-redirect':'Open Redirect','unusual-port':'Unusual Port','punycode':'IDN Homograph','error':'Invalid URL'};
const AV={DANGER:'⛔ Do not visit this URL. High probability of phishing or malware.',SUSPICIOUS:'⚠️ Exercise extreme caution. Multiple threat indicators detected.',CAUTION:'🔶 Verify this URL carefully before proceeding.',SAFE:'✅ URL appears safe. No major threats detected.'};

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}

function showError(title, msg) {
  document.getElementById('main-wrap').innerHTML = `
    <div class="err-card">
      <div class="err-icon">❌</div>
      <div class="err-title">${title}</div>
      <div class="err-msg">${msg}</div>
    </div>`;
}

function updateStatus(txt) {
  const s = document.querySelector('#analyzing-state div:nth-child(3)');
  if(s) s.textContent = txt;
}

function renderResult(res, imgSrc) {
  const c = RC(res.riskLevel);
  const circ = 2*Math.PI*40;
  const off = circ - (res.riskScore/100)*circ;

  let fh = '';
  if(res.safe && res.flags.length===0){
    fh = `<div class="safe-box"><div style="color:var(--green);font-size:20px">✓</div><div><div style="font-size:11px;color:var(--green);font-weight:600">No threats detected</div><div style="font-size:9px;color:var(--muted);margin-top:2px">URL passed all security checks</div></div></div>`;
  } else {
    fh = `<div class="flags-title">Threat Indicators (${res.flags.length})</div>`;
    res.flags.forEach(f => {
      const fc = SC(f.severity);
      fh += `<div class="flag-item" style="background:${fc}08;border:1px solid ${fc}28">
        <div class="flag-dot" style="background:${fc}"></div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px">
            <div class="flag-name" style="color:${fc}">${FL[f.type]||f.type}</div>
            <div class="flag-sev" style="color:${fc};background:${fc}20">${f.severity.toUpperCase()}</div>
          </div>
          <div class="flag-msg">${f.message}</div>
        </div>
      </div>`;
    });
  }

  document.getElementById('main-wrap').innerHTML = `
    <div class="result-grid">

      <!-- Left column -->
      <div style="display:flex;flex-direction:column;gap:14px">

        <!-- QR Preview -->
        ${imgSrc ? `<div class="card"><div class="card-hd">📷 Scanned QR Code</div><div class="card-body"><img class="qr-preview" src="${imgSrc}" alt="QR"/></div></div>` : ''}

        <!-- Score card -->
        <div class="card">
          <div class="card-hd">🛡 Risk Assessment</div>
          <div class="card-body">
            <div class="r-url-box" style="background:${c}08;border:1px solid ${c}30">
              <div class="r-label">Decoded URL</div>
              <a href="${res.normalizedUrl}" target="_blank" rel="noopener noreferrer" class="r-open">↗ Open</a>
              <div class="r-url" style="color:${c}">${esc(res.url)}</div>
            </div>
            <div class="meter-sec">
              <div>
                <div class="meter-wrap">
                  <svg viewBox="0 0 88 88">
                    <circle cx="44" cy="44" r="40" fill="none" stroke="var(--border)" stroke-width="6"/>
                    <circle cx="44" cy="44" r="40" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"
                      stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
                      style="transition:stroke-dashoffset 1s ease"/>
                  </svg>
                  <div class="m-center">
                    <div class="m-score" style="color:${c}">${res.riskScore}</div>
                    <div class="m-risk">RISK</div>
                  </div>
                </div>
                <div style="text-align:center">
                  <div class="risk-pill" style="color:${c};background:${c}15;border:1px solid ${c}40">${res.riskLevel}</div>
                </div>
              </div>
              <div class="d-list">
                ${res.details.hostname?`<div class="d-row"><div class="d-lbl">HOST</div><div class="d-val">${esc(res.details.hostname)}</div></div>`:''}
                ${res.details.protocol?`<div class="d-row"><div class="d-lbl">PROTO</div><div class="d-val">${res.details.protocol.replace(':','')}</div></div>`:''}
                ${res.details.path?`<div class="d-row"><div class="d-lbl">PATH</div><div class="d-val">${esc(res.details.path)}</div></div>`:''}
                <div class="d-row"><div class="d-lbl">PORT</div><div class="d-val">${res.details.port||'default'}</div></div>
                ${res.isTrusted?'<div style="font-size:8px;color:var(--green);margin-top:3px">✓ Known trusted domain</div>':''}
                ${res.isShortener?'<div style="font-size:8px;color:var(--yellow);margin-top:3px">⚠ URL shortener</div>':''}
              </div>
            </div>
            <div class="advice-box" style="background:${c}06;border:1px solid ${c}20">
              <div class="advice-lbl">Recommendation</div>
              <div class="advice-text" style="color:${c}">${AV[res.riskLevel]}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right column -->
      <div style="display:flex;flex-direction:column;gap:14px">

        <!-- Flags -->
        <div class="card">
          <div class="card-hd">⚠ Threat Indicators</div>
          <div class="card-body">${fh}</div>
        </div>

        <!-- AI Result -->
        <div class="card" id="ai-card">
          <div class="card-hd">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2L9 9H2l5.5 4-2 7L12 16l6.5 4-2-7L22 9h-7z" fill="var(--accent)"/></svg>
            Gemini AI Analysis
          </div>
          <div class="card-body">
            <div class="ai-loading" id="ai-loading">
              <div class="ai-spin"></div>
              <div>
                <div style="font-size:10px;color:var(--accent);font-weight:600">Gemini AI analyzing…</div>
                <div style="font-size:8px;color:var(--muted);margin-top:2px">Fetching deeper threat intelligence</div>
              </div>
            </div>
            <div id="ai-content" style="display:none"></div>
          </div>
        </div>

      </div>
    </div>`;
}

function renderAI(ai) {
  document.getElementById('ai-loading').style.display = 'none';
  const el = document.getElementById('ai-content');
  if(!el) return;
  el.style.display = 'block';

  if(!ai || ai.error) {
    el.innerHTML = `<div style="font-size:9px;color:var(--muted);padding:8px 0">⚠ AI unavailable: ${ai?.error||'unknown error'}</div>`;
    return;
  }

  const vc = {DANGER:'var(--red)',SUSPICIOUS:'var(--orange)',CAUTION:'var(--yellow)',SAFE:'var(--green)'}[ai.verdict]||'var(--muted)';
  const cc = {HIGH:'var(--green)',MEDIUM:'var(--yellow)',LOW:'var(--muted)'}[ai.confidence]||'var(--muted)';

  el.innerHTML = `
    <div class="ai-hd">
      <span class="ai-title">Verdict</span>
      <span class="ai-conf" style="color:${cc};background:${cc}18;border:1px solid ${cc}30">${ai.confidence} CONFIDENCE</span>
    </div>
    <div class="ai-verdict-row" style="background:${vc}08;border:1px solid ${vc}25">
      <div class="ai-verdict-text" style="color:${vc}">${ai.verdict}</div>
      <div class="ai-summary">${esc(ai.summary)}</div>
    </div>
    <div class="ai-grid">
      <div class="ai-cell"><div class="ai-cell-lbl">Attack Type</div><div class="ai-cell-val">${esc(ai.attack_type||'N/A')}</div></div>
      <div class="ai-cell"><div class="ai-cell-lbl">Target</div><div class="ai-cell-val">${esc(ai.target||'N/A')}</div></div>
    </div>
    <div class="ai-tip">
      <span style="font-size:15px;flex-shrink:0">💡</span>
      <div class="ai-tip-text">${esc(ai.ai_tip||'')}</div>
    </div>`;
}

// ── MAIN: load pending scan ──
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['pendingScan'], async r => {
    const pending = r.pendingScan;
    chrome.storage.local.remove('pendingScan');

    if (!pending || Date.now() - pending.ts > 30000) {
      showError('No QR Code Found', 'Please right-click a QR code image on any webpage and select "Scan with QRShield".');
      return;
    }

    if (pending.error === 'no_qr') {
      showError('No QR Code Detected', 'Could not find a QR code in this image. Make sure you right-click directly on the QR code itself.');
      return;
    }

    if (pending.error) {
      showError('Could Not Load Image', pending.error);
      return;
    }

    try {
      updateStatus('Running threat analysis…');

      const res = analyzeUrl(pending.url);
      renderResult(res, pending.base64);

      // Gemini AI via background
      chrome.runtime.sendMessage({
        action: 'analyzeWithGemini',
        url: pending.url,
        flags: res.flags,
        score: res.riskScore,
        level: res.riskLevel
      }, response => {
        const ai = response?.success ? response.data : { error: response?.error || 'Failed' };
        renderAI(ai);
        chrome.storage.local.get(['qrs-hist'], r2 => {
          const hist = r2['qrs-hist'] || [];
          hist.unshift({ ...res, ai, id: Date.now() });
          chrome.storage.local.set({ 'qrs-hist': hist.slice(0, 50) });
        });
      });

    } catch (err) {
      showError('Analysis Failed', err.message);
    }
  });
});
