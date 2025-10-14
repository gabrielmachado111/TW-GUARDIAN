(async function(){
  const LICENSE_URL = "https://raw.githubusercontent.com/gabrielmachado111/TW-GUARDIAN/main/licenses.json";
  function normalizeNick(nick) {
    return nick
      ?.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  function getCurrentNick() {
    let el = document.querySelector('#menu_row2 a[href*="screen=info_player"]');
    if (el) return el.textContent.trim();
    el = document.querySelector('.menu_column a[href*="screen=info_player"]');
    if (el) return el.textContent.trim();
    return null;
  }
  function getJsonViaGM(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url + "?t=" + Date.now(),
        onload: r => { try { resolve(JSON.parse(r.responseText)); } catch (e) { reject(e); } },
        onerror: reject
      });
    });
  }
  async function checkLicense(nick) {
    try {
      const json = await getJsonViaGM(LICENSE_URL);
      const normalizedNick = normalizeNick(nick);
      for (const jsonKey in json) {
        const kNorm = normalizeNick(jsonKey);
        if (kNorm === normalizedNick) {
          const expiryStr = String(json[jsonKey] || '').trim();
          const [yyyy, mm, dd] = expiryStr.split('-').map(Number);
          const expiry = new Date(yyyy, mm-1, dd, 23, 59, 59);
          if (!isFinite(expiry.getTime()) || new Date() > expiry) {
            alert("Sua licença Guardian expirou!\n\nEntre em contato com o administrador para renovar.");
            return false;
          }
          return true;
        }
      }
      alert("Sua licença Guardian não existe para este nick!\nSolicite ao administrador para liberar.");
      return false;
    } catch (e) {
      alert("Erro ao validar licença: " + e);
      return false;
    }
  }
  function domReady() {
    return new Promise(resolve => {
      if (document.readyState === "complete" || document.readyState === "interactive") resolve();
      else document.addEventListener("DOMContentLoaded", resolve, { once: true });
    });
  }
  function isGuardianPage() {
    const url = new URL(location.href);
    const scr = url.searchParams.get('screen');
    const mode = url.searchParams.get('mode');
    return (scr === 'ally' && (mode === 'overview' || mode === 'members'));
  }
  await domReady();
  if (!isGuardianPage()) return;
  const url = new URL(location.href);
  const nick = getCurrentNick();
  if (!nick) { alert("Não foi possível identificar seu nick Tribal Wars!\nAbra pelo perfil do jogador."); return; }
  const ok = await checkLicense(nick);
  if (!ok) return;

  // ------- UI Flutuante Guardian (fixo) -------
  const K_ENABLED = "tw_guard_enabled";
  function enabled() { return localStorage.getItem(K_ENABLED) !== "false"; }
  function setEnabled(v) { localStorage.setItem(K_ENABLED, v ? "true" : "false"); updateUi(); }
  let uiRoot = null, statusSpan = null, toggleBtn = null;
  function ensureUi() {
    if (uiRoot && document.body.contains(uiRoot)) return;
    uiRoot = document.createElement('div');
    uiRoot.id = 'tw-guard-ui';
    uiRoot.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#101010;color:#eee;border:1px solid #444;border-radius:8px;min-width:220px;box-shadow:0 2px 8px rgba(0,0,0,.4);font:12px Arial';
    const header = document.createElement('div');
    header.textContent = 'Tribe Guardian';
    header.style.cssText = 'cursor:move;font-weight:bold;padding:8px 12px;border-bottom:1px solid #333;background:#181818;border-top-left-radius:8px;border-top-right-radius:8px;';
    const body = document.createElement('div');
    body.style.cssText = 'padding:10px 12px;';
    statusSpan = document.createElement('div');
    statusSpan.style.cssText = 'margin-bottom:8px;';
    toggleBtn = document.createElement('button');
    toggleBtn.style.cssText = 'padding:6px 10px;border:none;border-radius:5px;color:#fff;cursor:pointer;';
    toggleBtn.onclick = () => setEnabled(!enabled());
    const hint = document.createElement('div');
    hint.textContent = 'Arraste pelo topo para mover.';
    hint.style.cssText = 'margin-top:6px;color:#bbb;';
    body.append(statusSpan, toggleBtn, hint);
    uiRoot.append(header, body);
    document.body.appendChild(uiRoot);
    let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    header.addEventListener('mousedown', (e) => {
      dragging = true; startX = e.clientX; startY = e.clientY;
      const rect = uiRoot.getBoundingClientRect();
      startLeft = rect.left; startTop = rect.top;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp, { once: true });
      e.preventDefault();
    });
    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      const nl = Math.min(window.innerWidth - 40, Math.max(0, startLeft + dx));
      const nt = Math.min(window.innerHeight - 40, Math.max(0, startTop + dy));
      uiRoot.style.left = nl + 'px';
      uiRoot.style.top = nt + 'px';
      uiRoot.style.right = 'auto';
      uiRoot.style.bottom = 'auto';
    }
    function onUp() {
      dragging = false; document.removeEventListener('mousemove', onMove);
    }
    updateUi();
  }
  function updateUi() {
    if (!uiRoot) return;
    const on = enabled();
    statusSpan.textContent = on ? `Status: LIGADO` : 'Status: DESLIGADO';
    toggleBtn.textContent = on ? 'Desligar' : 'Ligar';
    toggleBtn.style.background = on ? '#d9534f' : '#5cb85c';
  }
  ensureUi();

  // --- Overview/members core logic from your code ---
  // As variáveis globais necessárias para a UI/checagem
  const POLL_MS = 2000;
  const GAP_SECONDS = 10;
  const RECENT_WINDOW_SECONDS = 180;  // 3 minutos (~180s)
  const MAX_LOOKBACK_ROWS = 80;
  const RETRIGGER_COOLDOWN_MS = 5000;
  const K_SUSPECT = 'tw_guard_suspect', K_SUSPECT_ID = 'tw_guard_suspect_id', K_ACTION_FLAG = 'tw_guard_action_flag';

  const urlParams = new URL(window.location.href).searchParams;
  const screen = urlParams.get('screen'), mode = urlParams.get('mode');
  // Recria UI ao navegar via Ajax, só overview
  function mountUiOnOverview(){
    const isOverview = (screen==='ally'&&mode==='overview');
    if(!isOverview) return;
    const mount=()=>ensureUi();
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', mount, { once:true });
    else mount();
    const root=document.querySelector('#content_value')||document.body;
    const mo=new MutationObserver(()=>ensureUi());
    mo.observe(root,{childList:true,subtree:true});
  }
  // ---------- Overview detector ----------
  function runOverview(){
    if(!(screen==='ally'&&mode==='overview')) return;
    function parsePtBrDateTime(diaMesStr, horaStr) {
      const [monStrRaw, diaStr] = (diaMesStr || '').replace('.', '').trim().split(/\s+/);
      const ptMon = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const mi = ptMon.indexOf((monStrRaw || '').toLowerCase());
      if (mi < 0) return NaN;
      const [hh, mm] = (horaStr || '00:00').split(':').map(x => parseInt(x, 10) || 0);
      const now = new Date();
      return new Date(now.getFullYear(), mi, parseInt(diaStr, 10) || 1, hh, mm, 0, 0).getTime();
    }
    function parseRow(tr) {
      const tds = tr.querySelectorAll('td');
      if (tds.length < 2) return null;
      const parts = tds[0].innerText.replace(/\r/g, '').trim().split('\n').map(s => s.trim()).filter(Boolean);
      if (parts.length < 2) return null;
      const m = tds[1].innerText.trim().match(/^(.+?)\s*foi expulso\/retirado da tribo por\s+(.+?)[\.\s]*$/i);
      if (!m) return null;
      const ts = parsePtBrDateTime(parts[0], parts[1]);
      if (!isFinite(ts)) return null;
      return { ts, victim: m[1].replace(/\s*\.$/, '').trim(), author: m[2].replace(/\s*\.$/, '').trim() };
    }
    function trigger(author) {
      if (!enabled()) return;
      const now = Date.now(), last = localStorage.getItem('tw_guard_last_trigger')||0;
      if(now-last<RETRIGGER_COOLDOWN_MS) return;
      localStorage.setItem('tw_guard_last_trigger', now);
      localStorage.setItem(K_SUSPECT, author);
      localStorage.setItem(K_ACTION_FLAG, 1);
      const membersUrl=location.origin+`/game.php?village=${urlParams.get('village')||''}&screen=ally&mode=members`;
      window.open(membersUrl,"_blank");
    }
    function scan(){
      if(!enabled()) return;
      const container=document.querySelector('#content_value')||document.body;
      const rows=Array.from(container.querySelectorAll('table tr, .vis tr, .content-border tr')).slice(0,MAX_LOOKBACK_ROWS);
      const exps=[]; for(const tr of rows){ const e=parseRow(tr); if(e) exps.push(e); }
      exps.sort((a,b)=>a.ts-b.ts);
      const cutoff=Date.now()-RECENT_WINDOW_SECONDS*1000;
      const recent=exps.filter(e=>e.ts>=cutoff);
      for(let i=1;i<recent.length;i++){
        const p=recent[i-1], c=recent[i];
        if(c.author===p.author && (c.ts-p.ts)<=GAP_SECONDS*1000){ trigger(c.author); return; }
      }
    }
    setInterval(scan, POLL_MS);
    const target=document.querySelector('#content_value')||document.body;
    const mo=new MutationObserver(()=>scan());
    mo.observe(target,{childList:true,subtree:true});
  }
  // ---------- Members executor ----------
  function runMembers(){
    if(!(screen==='ally'&&mode==='members')) return;
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    async function act(){
      if(!enabled()) return;
      if(!localStorage.getItem(K_ACTION_FLAG)) return;
      const suspectName=localStorage.getItem(K_SUSPECT)||''; if(!suspectName){ localStorage.setItem(K_ACTION_FLAG,0); return; }
      const select=document.querySelector('select[name="ally_action"]'); if(select){ select.value='rights'; select.dispatchEvent(new Event('change',{bubbles:true})); }
      await sleep(100);
      const links=Array.from(document.querySelectorAll('a[href*="screen=info_player"][href*="id="]'));
      const a=links.find(x=>x.textContent.trim().localeCompare(suspectName,undefined,{sensitivity:'accent'})===0);
      if(!a){ localStorage.setItem(K_ACTION_FLAG,0); return; }
      const href=new URL(a.getAttribute('href'),location.origin); const id=href.searchParams.get('id'); if(!id){ localStorage.setItem(K_ACTION_FLAG,0); return; }
      const radio=document.querySelector(`input[type="radio"][name="player"][value="${id}"]`); if(radio && !radio.checked) radio.click();
      const editBtn=Array.from(document.querySelectorAll('a.btn, a.show_toggle.btn')).find(x=>/Editar permiss/i.test(x.textContent)); if(editBtn) editBtn.click();
      await sleep(120);
      const lead=document.querySelector(`input[type="checkbox"][name="player_id[${id}][lead]"]`);
      const found=document.querySelector(`input[type="checkbox"][name="player_id[${id}][found]"]`);
      if(lead && lead.checked) lead.click(); if(found && found.checked) found.click();
      await sleep(80);
      if(lead && lead.checked) lead.click(); if(found && found.checked) found.click();
      const saveBtn=Array.from(document.querySelectorAll('input[type="submit"].btn.show_toggle, input[type="submit"].btn')).find(i=>/Salvar permiss/i.test(i.value));
      if(saveBtn) saveBtn.click();
      localStorage.setItem(K_ACTION_FLAG,0);
    }
    act();
  }
  mountUiOnOverview();
  runOverview();
  runMembers();
})();
