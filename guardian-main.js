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
        onload: r => {
          try {
            resolve(JSON.parse(r.responseText));
          } catch (e) {
            reject(e);
          }
        },
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

  // --- Só prossegue nas telas permitidas ---
  function isGuardianPage() {
    const url = new URL(location.href);
    const scr = url.searchParams.get('screen');
    const mode = url.searchParams.get('mode');
    return (scr === 'ally' && (mode === 'overview' || mode === 'members'));
  }

  await domReady();
  if (!isGuardianPage()) return; // <- mostra interface só em overview ou members da tribo

  const nick = getCurrentNick();
  if (!nick) {
    alert("Não foi possível identificar seu nick Tribal Wars!\nAbra pelo perfil do jogador.");
    return;
  }
  const ok = await checkLicense(nick);
  if (!ok) return;

  // ------- UI Flutuante Guardian -------
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
  if (enabled()) {
    console.log("[GUARDIAN] Ativo para nick:", nick);
  }
})();
