(async function(){
  const LICENSE_URL = "https://raw.githubusercontent.com/gabrielmachado111/TW-GUARDIAN/main/licenses.json";

  // Função para normalizar nick
  function normalizeNick(nick) {
    return nick
      ?.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // Pega nick do DOM ao carregar
  function getCurrentNick() {
    let el = document.querySelector('#menu_row2 a[href*="screen=info_player"]');
    if (el) return el.textContent.trim();
    el = document.querySelector('.menu_column a[href*="screen=info_player"]');
    if (el) return el.textContent.trim();
    return null;
  }

  // Busca JSON de licença usando GM_xmlhttpRequest
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

  // Validação da licença, DEBUG só aqui dentro!
  async function checkLicense(nick) {
    try {
      const json = await getJsonViaGM(LICENSE_URL);
      const normalizedNick = normalizeNick(nick);
      console.log("[GUARDIAN DEBUG] Nick DOM:", JSON.stringify(nick), "| Normalizado:", normalizedNick, "| Licenças disponíveis:", Object.keys(json));
      for (const jsonKey in json) {
        const kNorm = normalizeNick(jsonKey);
        console.log("[GUARDIAN DEBUG] JSON KEY:", JSON.stringify(jsonKey), "| Normalizado:", kNorm, "| Match:", kNorm === normalizedNick);
        if (kNorm === normalizedNick) {
          const expiryStr = json[jsonKey].trim();
          const [yyyy, mm, dd] = expiryStr.split('-').map(Number);
          const expiry = new Date(yyyy, mm - 1, dd, 23, 59, 59);
          if (!yyyy || !mm || !dd || isNaN(expiry.getTime())) {
            alert(`Data de licença inválida para o nick '${nick}' (${expiryStr})`);
            return false;
          }
          return new Date() <= expiry;
        }
      }
      alert(`Nick '${nick}' não encontrado em licenses.json`);
      return false;
    } catch (e) {
      alert("Erro ao validar licença: " + e);
      return false;
    }
  }

  // Aguarda DOM pronto
  function domReady() {
    return new Promise(resolve => {
      if (document.readyState === "complete" || document.readyState === "interactive") resolve();
      else document.addEventListener("DOMContentLoaded", resolve, { once: true });
    });
  }

  await domReady();

  const nick = getCurrentNick();
  if (!nick) {
    alert("Não foi possível identificar seu nick no topo da página!\nAcesse pelo perfil da conta Tribal Wars.");
    return;
  }

  const ok = await checkLicense(nick);
  if (!ok) {
    alert(`Seu nick '${nick}' não possui licença válida ou está vencida.\nContate o administrador para liberar acesso.`);
    return;
  }

  // ---------- Código Guardian Original ----------

  // ... aqui vá com o restante do código da interface, UI, triggers, autômatos, etc

  // Exemplo de placeholder:
  console.log("Licença válida, carregando funcionalidades Guardian...");
})();
