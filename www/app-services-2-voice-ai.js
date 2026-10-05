/* ═══════════════════════════════════════════════════════════════
   DISCOGRAFÍA VIEWER v7.3.0 — SERVICES 2/2
   Voice search · SmartSuggest · Recommender · Similares · Imagen
   Depende de: app-core-*.js, app-services-1-streaming.js
   ═══════════════════════════════════════════════════════════════ */

const VoiceSearch = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function isSupported(){ return !!SR; }
  function listen(opts = {}){
    const { onResult, onError, onEnd, lang = 'es-AR' } = opts;
    return new Promise((resolve, reject) => {
      if (!SR){ reject(new Error('Tu navegador no soporta búsqueda por voz')); return; }
      const rec = new SR();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 3;
      let finalText = '';
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++){
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (onResult) onResult(finalText || interim, !!finalText);
      };
      rec.onerror = (e) => {
        const map = {
          'not-allowed': 'Permiso de micrófono denegado',
          'service-not-allowed': 'Servicio de voz no disponible',
          'no-speech': 'No se detectó voz',
          'audio-capture': 'No se pudo acceder al micrófono',
          'network': 'Error de red',
          'aborted': 'Cancelado'
        };
        const msg = map[e.error] || ('Error: ' + e.error);
        if (onError) onError(msg);
        reject(new Error(msg));
      };
      rec.onend = () => {
        if (onEnd) onEnd(finalText);
        resolve(finalText);
      };
      try { rec.start(); }
      catch(err){ reject(err); }
    });
  }
  return { isSupported, listen };
})();

const SmartSuggest = (() => {
  function getSuggestions(query, limit = 8){
    const q = norm(query);
    if (!q || q.length < 2) return [];
    const all = Store.allCDs();
    const suggestions = new Map();
    for (const cd of all){
      if (!cd.interprete) continue;
      const n = norm(cd.interprete);
      if (n.startsWith(q) || n.includes(q)){
        const key = 'a:' + cd.interprete;
        suggestions.set(key, {
          type: 'artista',
          text: cd.interprete,
          sub: `${all.filter(c => c.interprete === cd.interprete).length} CDs`,
          icon: '🎤',
          score: n.startsWith(q) ? 100 : 50
        });
      }
    }
    for (const cd of all){
      if (!cd.titulo) continue;
      const n = norm(cd.titulo);
      if (n.startsWith(q) || n.includes(q)){
        const key = 't:' + cd.titulo;
        if (!suggestions.has(key)){
          suggestions.set(key, {
            type: 'album',
            text: cd.titulo,
            sub: cd.interprete || '',
            icon: '💿',
            score: n.startsWith(q) ? 90 : 40
          });
        }
      }
    }
    const years = new Set();
    for (const cd of all) if (cd.anio) years.add(cd.anio);
    for (const y of years){
      if (String(y).includes(q)){
        suggestions.set('y:' + y, {
          type: 'año',
          text: String(y),
          sub: `${all.filter(c => c.anio === y).length} CDs`,
          icon: '📅',
          score: 70
        });
      }
    }
    const genres = new Set();
    for (const cd of all) if (cd.genero) genres.add(cd.genero);
    for (const g of genres){
      if (norm(g).includes(q)){
        suggestions.set('g:' + g, {
          type: 'género',
          text: g,
          sub: `${all.filter(c => c.genero === g).length} CDs`,
          icon: '🎼',
          score: 60
        });
      }
    }
    return [...suggestions.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  function render(query){
    const sugg = getSuggestions(query);
    const el = $('#smartSuggest');
    if (!el) return;
    if (!sugg.length){ el.classList.remove('on'); return; }
    el.innerHTML = sugg.map(s => `
      <button type="button" class="sugg-item" data-sugg="${esc(s.text)}">
        <span class="sugg-icon">${s.icon}</span>
        <span class="sugg-text">
          <span class="sugg-main">${esc(s.text)}</span>
          <span class="sugg-sub">${esc(s.sub)}</span>
        </span>
        <span class="sugg-arrow">↗</span>
      </button>
    `).join('');
    el.classList.add('on');
    el.querySelectorAll('.sugg-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = $('#q');
        q.value = btn.dataset.sugg;
        App.q = q.value;
        $('#searchBox').classList.add('has');
        el.classList.remove('on');
        if (App.tab !== 'list' && App.tab !== 'grid'){ App.tab = 'list'; updateNav(); }
        renderMain();
      });
    });
  }
  return { render, getSuggestions };
})();

const Recommender = (() => {
  function getMood(){
    const h = new Date().getHours();
    if (h >= 6 && h < 10) return { label: '☀️ Mañana', tags: ['pop','rock','clasico','jazz'] };
    if (h >= 10 && h < 14) return { label: '🌤️ Mediodía', tags: ['rock','pop','folk'] };
    if (h >= 14 && h < 19) return { label: '🌇 Tarde', tags: ['rock','indie','punk'] };
    if (h >= 19 && h < 23) return { label: '🌆 Noche', tags: ['jazz','blues','rock','clasico'] };
    return { label: '🌙 Madrugada', tags: ['ambient','electronica','jazz'] };
  }
  function pick(){
    const all = Store.allCDs();
    if (!all.length) return null;
    const favs = all.filter(c => c.favorito || LocalFavs.has(c.id));
    const pool = favs.length > 0 && Math.random() < 0.5 ? favs : all;
    const mood = getMood();
    const scored = pool.map(cd => {
      let s = 0;
      if (cd.favorito) s += 10;
      if (LocalFavs.has(cd.id)) s += 8;
      if (cd.rating) s += cd.rating * 2;
      if (cd.genero){
        const g = norm(cd.genero);
        for (const tag of mood.tags) if (g.includes(tag)) s += 5;
      }
      const views = ViewHistory.list();
      const viewed = views.find(v => v.id === cd.id);
      if (viewed){
        const ageH = (Date.now() - viewed.ts) / 3600000;
        if (ageH > 24 * 7) s += 3;
        if (ageH < 1) s -= 5;
      } else {
        s += 4;
      }
      s += Math.random() * 3;
      return { cd, score: s };
    }).sort((a, b) => b.score - a.score);
    return scored[0]?.cd || null;
  }
  function renderBanner(){
    const cd = pick();
    if (!cd) return '';
    const mood = getMood();
    const cover = cd.portada
      ? `<img src="${esc(cd.portada)}" alt="" style="width:56px;height:56px;border-radius:10px;object-fit:cover;border:1px solid var(--line)">`
      : `<div style="width:56px;height:56px;border-radius:10px;background:var(--bg3);border:1px dashed var(--line);display:flex;align-items:center;justify-content:center;font-size:1.4rem;opacity:.5">💿</div>`;
    return `<div class="recommend-card" data-rec-id="${esc(cd.id)}" style="display:grid;grid-template-columns:56px 1fr auto;gap:12px;align-items:center;padding:12px;background:linear-gradient(135deg,rgba(167,139,250,.14),rgba(79,195,247,.08));border:1px solid rgba(167,139,250,.35);border-radius:14px;margin-bottom:12px;cursor:pointer;transition:.15s">
      ${cover}
      <div style="min-width:0">
        <div style="font-size:.62rem;color:var(--purple);text-transform:uppercase;letter-spacing:1px;font-weight:800;margin-bottom:3px">${mood.label} · Sugerencia</div>
        <div style="font-size:.85rem;font-weight:700;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:uppercase">${esc(cd.titulo || '—')}</div>
        <div style="font-size:.72rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:uppercase">${esc(cd.interprete || '—')}</div>
      </div>
      <span style="color:var(--purple);font-size:1.4rem;font-weight:700">▶</span>
    </div>`;
  }
  return { pick, renderBanner, getMood };
})();

function findSimilar(cd, limit = 10){
  const all = Store.allCDs();
  const nG = norm(cd.genero || '');
  const nS = norm(cd.sello || '');
  const nP = norm(cd.pais || '');
  const y = cd.anio || 0;
  const scored = all
    .filter(c => c.id !== cd.id)
    .map(c => {
      let score = 0;
      if (nG && norm(c.genero || '') === nG) score += 30;
      else if (nG && norm(c.genero || '').includes(nG.split(' ')[0])) score += 15;
      if (nS && norm(c.sello || '') === nS) score += 20;
      if (nP && norm(c.pais || '') === nP) score += 10;
      if (y && c.anio){
        const diff = Math.abs(c.anio - y);
        if (diff <= 2) score += 25;
        else if (diff <= 5) score += 15;
        else if (diff <= 10) score += 8;
        else if (diff <= 20) score += 3;
      }
      if (cd.interprete && c.interprete === cd.interprete) score += 40;
      if (cd.rating && c.rating) score += (c.rating - cd.rating) * 2;
      return { cd: c, score };
    })
    .filter(x => x.score >= 15)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map(x => x.cd);
}

function loadImage(url){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Error cargando imagen'));
    img.src = url;
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines){
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words){
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current){
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  const displayed = lines.slice(0, maxLines);
  displayed.forEach((line, i) => { ctx.fillText(line, x, y + i * lineHeight); });
}

async function extractDominantColor(imgUrl){
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 50;
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      try {
        const data = ctx.getImageData(0, 0, size, size).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4){
          const pr = data[i], pg = data[i+1], pb = data[i+2];
          const brightness = (pr + pg + pb) / 3;
          if (brightness > 40 && brightness < 230){
            r += pr; g += pg; b += pb; count++;
          }
        }
        if (count === 0) resolve(null);
        else resolve(`rgb(${Math.round(r/count)}, ${Math.round(g/count)}, ${Math.round(b/count)})`);
      } catch(e){ resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = imgUrl;
  });
}

function smoothTransition(fn){
  if (!document.startViewTransition){
    fn();
    return;
  }
  try {
    document.startViewTransition(() => { fn(); });
  } catch(e){
    fn();
  }
}