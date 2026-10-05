/* ═══════════════════════════════════════════════════════════════
   DISCOGRAFÍA VIEWER v7.3.0 — CORE 3/3
   Store · Search · Loans · Toast · Theme · AutoTheme · Recent · Historial
   Depende de: app-core-1-base.js, app-core-2-storage.js
   ═══════════════════════════════════════════════════════════════ */

const Store = (() => {
  function buildEmpty(){
    return { schemaVersion: DATA_SCHEMA_VERSION, viewer: true, categories: {} };
  }
  function cloneJSON(value){
    try { return value == null ? value : JSON.parse(JSON.stringify(value)); }
    catch(e){ return value; }
  }
  function hydrate(cd){
    const src = (cd && typeof cd === 'object' && !Array.isArray(cd)) ? cd : {};
    const out = cloneJSON(src) || {};
    if (!out.id) out.id = 'cd_' + Math.random().toString(36).slice(2,10);
    if (out.nro == null) out.nro = 0;
    if (out.formato == null) out.formato = 'CD';
    if (out.estado == null) out.estado = 'Excelente';
    if (out.cantidad == null) out.cantidad = 1;
    if (out.moneda == null) out.moneda = 'ARS';
    if (out.rating == null || typeof out.rating !== 'number' || out.rating < 0 || out.rating > 5) out.rating = 0;
    out.favorito = !!out.favorito;
    if (!Array.isArray(out.tags)) out.tags = [];
    if (!out.links || typeof out.links !== 'object' || Array.isArray(out.links)) out.links = {};
    const incomingImages = (out.imagenes && typeof out.imagenes === 'object' && !Array.isArray(out.imagenes)) ? out.imagenes : {};
    const frontal = incomingImages.frontal || out.portada || null;
    const trasera = incomingImages.trasera || null;
    const interior = incomingImages.interior || null;
    const disco = incomingImages.disco || null;
    const libreto = incomingImages.libreto || null;
    if (frontal || trasera || interior || disco || libreto){
      out.imagenes = { ...incomingImages, frontal, trasera, interior, disco, libreto };
    } else if (out.imagenes == null){
      out.imagenes = null;
    }
    if (!out.portada && out.imagenes?.frontal) out.portada = out.imagenes.frontal;
    if (out.portada && out.imagenes && !out.imagenes.frontal) out.imagenes.frontal = out.portada;
    if (out.customFields == null || typeof out.customFields !== 'object' || Array.isArray(out.customFields)) out.customFields = {};
    return out;
  }
  function normalizeCategory(k, c){
    const src = (c && typeof c === 'object' && !Array.isArray(c)) ? c : {};
    const out = cloneJSON(src) || {};
    out.label = src.label != null && String(src.label).trim() ? String(src.label) : k;
    out.icon = src.icon != null && String(src.icon).trim() ? String(src.icon) : '📀';
    out.cds = Array.isArray(src.cds) ? src.cds.map(hydrate) : [];
    return out;
  }
  function load(){
    let migrated = false;
    try {
      let raw = localStorage.getItem(STORE_KEY);
      if (!raw){
        for (const k of STORE_KEY_LEGACY){
          raw = localStorage.getItem(k);
          if (raw){ migrated = true; break; }
        }
      }
      if (raw){
        const p = JSON.parse(raw);
        if (p && p.categories && typeof p.categories === 'object' && !Array.isArray(p.categories)){
          App.db = { ...p, schemaVersion: DATA_SCHEMA_VERSION, viewer: true, categories: {} };
          for (const k in p.categories) App.db.categories[k] = normalizeCategory(k, p.categories[k]);
          if (migrated) save();
          return;
        }
      }
    } catch(e){ console.warn('load', e); }
    App.db = buildEmpty();
  }
  function save(){
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(App.db));
      return true;
    } catch(e){
      const isQuota = e.name === 'QuotaExceededError' || e.code === 22 || /quota/i.test(e.message || '');
      if (!isQuota){ Toast.show('Error al guardar: ' + e.message, 'err', 5000); return false; }
      const cleanup = Storage.cleanupKeys();
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(App.db));
        Toast.show(cleanup.removed.length > 0 ? `🧹 Liberados ${fmtBytes(cleanup.freed)} · Guardado OK` : '⚠️ Sin espacio suficiente', cleanup.removed.length > 0 ? 'ok' : 'warn', 4500);
        return cleanup.removed.length > 0;
      } catch(e2){
        const u = Storage.usage();
        Toast.show(`❌ Almacenamiento lleno (${fmtBytes(u.used)}).`, 'err', 9000);
        return false;
      }
    }
  }
  function replaceAll(data){
    const src = data?.categories || {};
    App.db = {
      ...((data && typeof data === 'object' && !Array.isArray(data)) ? cloneJSON(data) : {}),
      schemaVersion: DATA_SCHEMA_VERSION,
      viewer: true,
      categories: {}
    };
    for (const k in src) App.db.categories[k] = normalizeCategory(k, src[k]);
    save();
  }
  const isEmpty = () => !App.db || !App.db.categories || !Object.keys(App.db.categories).length;
  const allCDs = () => isEmpty() ? [] : Object.values(App.db.categories).flatMap(c => Array.isArray(c.cds) ? c.cds : []);
  const total = () => allCDs().length;
  const catKeys = () => isEmpty() ? [] : Object.keys(App.db.categories);
  const get = k => App.db?.categories?.[k];
  const getCDs = k => App.db?.categories?.[k]?.cds || [];
  function clearAll(){ App.db = buildEmpty(); try { localStorage.removeItem(STORE_KEY); } catch(e){} }
  const hasAnyRatings = () => allCDs().some(c => c.rating > 0);
  const hasAnyFavs = () => allCDs().some(c => c.favorito);
  const hasAnyStreams = () => allCDs().some(c => c.links && Object.keys(c.links).length > 0);
  return { load, save, replaceAll, hydrate, isEmpty, allCDs, total, catKeys, get, getCDs, clearAll, hasAnyRatings, hasAnyFavs, hasAnyStreams };
})();

/* ═══════════════════════════════════════════════════════════════
   SEARCH
   ═══════════════════════════════════════════════════════════════ */
const Search = (() => {
  function tokenize(q){
    const tokens = []; let cur = ''; let inQ = false;
    for (let i = 0; i < q.length; i++){
      const ch = q[i];
      if (ch === '"'){ inQ = !inQ; continue; }
      if (!inQ && /\s/.test(ch)){ if (cur){ tokens.push(cur); cur = ''; } }
      else cur += ch;
    }
    if (cur) tokens.push(cur);
    return tokens;
  }
  function isAdvanced(q){
    const s = String(q||'').trim();
    if (!s) return false;
    if (/\b[a-zA-ZñÑáéíóúÁÉÍÓÚ]+\s*:\s*\S+/.test(s)) return true;
    if (/(^|\s)(AND|OR)(\s|$)/.test(s)) return true;
    if (/(^|\s)-[^\s-]/.test(s)) return true;
    return false;
  }
  function match(cd, q){
    if (!q) return true;
    if (SemanticSearch.isSemantic(q)){
      const r = SemanticSearch.match(cd, q);
      if (r) return true;
    }
    if (isAdvanced(q)) return advancedMatch(cd, q);
    const terms = norm(q).split(/\s+/).filter(Boolean);
    const h = norm([cd.titulo, cd.interprete, cd.sello, cd.anio, cd.anioEdicion, cd.genero, cd.ubicacion, cd.catalogo, cd.pais, cd.edicion, cd.notas, cd.isrc, (cd.tags || []).join(' ')].join(' '));
    if (terms.every(t => h.includes(t))) return true;
    const t = cd.titulo || '';
    const a = cd.interprete || '';
    return terms.every(term => {
      if (term.length < 4) return false;
      return fuzzyMatch(term, t) || fuzzyMatch(term, a) || phoneticSimilar(term, t) || phoneticSimilar(term, a);
    });
  }
  function advancedMatch(cd, q){
    const tokens = tokenize(q);
    let result = true, pendingOp = 'AND';
    for (const tk of tokens){
      if (tk === 'AND' || tk === 'OR'){ pendingOp = tk; continue; }
      if (!tk || tk === '-' || tk === '--') continue;
      const neg = tk.startsWith('-');
      const clean = neg ? tk.slice(1) : tk;
      if (!clean) continue;
      let hit;
      if (clean.includes(':')){ const i = clean.indexOf(':'); hit = matchField(cd, clean.slice(0, i).toLowerCase(), clean.slice(i + 1)); }
      else if (clean.startsWith('#')){ hit = (cd.tags || []).some(t => norm(t).includes(norm(clean.slice(1)))); }
      else { hit = norm([cd.titulo, cd.interprete, cd.sello, cd.anio, cd.genero, (cd.tags || []).join(' ')].join(' ')).includes(norm(clean)); }
      if (neg) hit = !hit;
      result = pendingOp === 'OR' ? (result || hit) : (result && hit);
      pendingOp = 'AND';
    }
    return result;
  }
  function matchField(cd, f, v){
    const vn = norm(v);
    const cmp = v.match(/^(>=|<=|>|<|=)/);
    const compare = (target) => {
      if (cmp){
        const n1 = parseFloat(target), n2 = parseFloat(v.replace(cmp[0], ''));
        if (isNaN(n1) || isNaN(n2)) return false;
        switch(cmp[0]){ case '>': return n1 > n2; case '<': return n1 < n2; case '>=': return n1 >= n2; case '<=': return n1 <= n2; case '=': return n1 === n2; }
      }
      return norm(target).includes(vn);
    };
    switch(f){
      case 'artist': case 'artista': case 'interprete': case 'intérprete': return compare(cd.interprete);
      case 'title': case 'titulo': case 'título': return compare(cd.titulo);
      case 'year': case 'anio': case 'año': return compare(String(cd.anio ?? ''));
      case 'yeared': case 'anioedicion': case 'anioed': return compare(String(cd.anioEdicion ?? ''));
      case 'genre': case 'genero': case 'género': return compare(cd.genero);
      case 'label': case 'sello': return compare(cd.sello);
      case 'format': case 'formato': return compare(cd.formato);
      case 'catalog': case 'catalogo': case 'catálogo': return compare(cd.catalogo);
      case 'isrc': return compare(cd.isrc);
      case 'country': case 'pais': case 'país': return compare(cd.pais);
      case 'location': case 'ubicacion': case 'ubicación': return compare(cd.ubicacion);
      case 'nro': case 'numero': case 'número': return compare(String(cd.nro));
      case 'tag': return (cd.tags || []).some(t => norm(t).includes(vn));
      case 'rating': return compare(String(cd.rating || 0));
      case 'fav': case 'favorito': return cd.favorito === (v === 'true' || v === '1');
      case 'stream': case 'streaming': { const has = !!(cd.links && Object.keys(cd.links).length > 0); return v === 'true' ? has : !has; }
      case 'loaned': case 'prestado': const isL = Loans.isLoaned(cd); return v === 'true' ? isL : v === 'false' ? !isL : isL;
      default: return false;
    }
  }
  function highlight(texto, q){
    const t = esc(texto);
    if (!q) return t;
    const terms = norm(q).split(/\s+/).filter(Boolean).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!terms.length) return t;
    try { return t.replace(new RegExp(`(${terms.join('|')})`, 'ig'), '<mark>$1</mark>'); } catch { return t; }
  }
  return { match, isAdvanced, highlight };
})();

/* ═══════════════════════════════════════════════════════════════
   LOANS
   ═══════════════════════════════════════════════════════════════ */
const Loans = {
  isLoaned: cd => !!(cd.prestadoA && cd.prestadoA.trim()),
  isOverdue: cd => Loans.isLoaned(cd) && cd.fechaDevolucion && new Date(cd.fechaDevolucion) < new Date()
};

/* ═══════════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════════ */
const Toast = (() => {
  const icons = { ok:'✓', err:'✕', warn:'⚠', info:'ℹ' };
  return {
    show(msg, type='ok', ms=2800, action=null){
      const host = $('#toast');
      if (!host) return;
      const el = document.createElement('div');
      el.className = 'tst ' + type;
      el.innerHTML = `<div class="ti">${icons[type]||'ℹ'}</div><div style="flex:1;min-width:0">${esc(msg)}</div>`;
      if (action){
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = action.label;
        b.style.cssText = 'background:rgba(79,195,247,.2);border:1px solid rgba(79,195,247,.4);color:var(--accent);padding:5px 10px;border-radius:8px;font-size:.72rem;font-weight:700;font-family:inherit;cursor:pointer;flex:0 0 auto';
        b.onclick = () => { try { action.fn(); } catch(e){} el.remove(); };
        el.appendChild(b);
      }
      host.appendChild(el);
      setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, ms);
    }
  };
})();

/* ═══════════════════════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════════════════════ */
const Theme = {
  load(){
    try {
      return localStorage.getItem(THEME_KEY) || (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    } catch(e){ return 'dark'; }
  },
  apply(t){
    document.body.classList.toggle('light', t === 'light');
    const btn = $('#btnTheme');
    if (btn) btn.textContent = t === 'light' ? '☀️' : '🌙';
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#f5f7fa' : '#0e1116');
  },
  toggle(){
    const cur = document.body.classList.contains('light') ? 'light' : 'dark';
    const next = cur === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(THEME_KEY, next); } catch(e){}
    if (typeof AutoTheme !== 'undefined' && AutoTheme.isEnabled()){
      AutoTheme.setEnabled(false);
      Toast.show('🌗 Tema automático desactivado', 'info', 2000);
    }
    this.apply(next);
    Toast.show(next === 'light' ? '☀️ Tema claro' : '🌙 Tema oscuro', 'info', 1500);
  },
  init(){ this.apply(this.load()); }
};

/* ═══════════════════════════════════════════════════════════════
   AUTO THEME
   ═══════════════════════════════════════════════════════════════ */
const AutoTheme = (() => {
  const KEY = 'discografia_auto_theme_v1';
  function isEnabled(){ try { return localStorage.getItem(KEY) === '1'; } catch(e){ return false; } }
  function setEnabled(v){
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch(e){}
    if (v) applyNow();
  }
  function getSunTimes(){
    const m = new Date().getMonth();
    const sunrise = [6, 6.5, 7, 7.5, 8, 8.5, 8.5, 8, 7.5, 7, 6.5, 6][m];
    const sunset  = [20, 19.5, 19, 18, 17.5, 17.5, 17.5, 18, 18.5, 19, 19.5, 20][m];
    return { sunrise, sunset };
  }
  function shouldBeLight(){
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    const { sunrise, sunset } = getSunTimes();
    return h >= sunrise && h < sunset;
  }
  function applyNow(){
    if (!isEnabled()) return;
    const wantLight = shouldBeLight();
    const current = document.body.classList.contains('light') ? 'light' : 'dark';
    const next = wantLight ? 'light' : 'dark';
    if (current !== next){
      Theme.apply(next);
      try { localStorage.setItem(THEME_KEY, next); } catch(e){}
    }
  }
  function start(){
    if (!isEnabled()) return;
    applyNow();
    setInterval(applyNow, 15 * 60 * 1000);
  }
  return { isEnabled, setEnabled, applyNow, start };
})();

/* ═══════════════════════════════════════════════════════════════
   RECENT SEARCHES
   ═══════════════════════════════════════════════════════════════ */
const Recent = {
  list(){ try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') || []; } catch(e){ return []; } },
  add(q){
    const t = String(q||'').trim();
    if (!t || t.length < 2) return;
    const cur = this.list().filter(x => norm(x) !== norm(t));
    cur.unshift(t);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, 8))); } catch(e){}
  },
  clear(){ try { localStorage.removeItem(RECENT_KEY); } catch(e){} }
};

/* ═══════════════════════════════════════════════════════════════
   VIEW HISTORY
   ═══════════════════════════════════════════════════════════════ */
const ViewHistory = (() => {
  const KEY = 'discografia_view_history_v1';
  const MAX = 30;
  function list(){
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; }
    catch(e){ return []; }
  }
  function push(cd){
    if (!cd || !cd.id) return;
    const items = list().filter(x => x.id !== cd.id);
    items.unshift({
      id: cd.id,
      titulo: cd.titulo || '',
      interprete: cd.interprete || '',
      portada: cd.portada || null,
      anio: cd.anio || null,
      ts: Date.now()
    });
    try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX))); } catch(e){}
  }
  function clear(){ try { localStorage.removeItem(KEY); } catch(e){} }
  return { list, push, clear };
})();

/* ═══════════════════════════════════════════════════════════════
   LOCAL FAVORITES
   ═══════════════════════════════════════════════════════════════ */
const LocalFavs = (() => {
  const KEY = 'discografia_local_favs_v1';
  function list(){
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; }
    catch(e){ return []; }
  }
  function toggle(cdId){
    const items = list();
    const i = items.indexOf(cdId);
    if (i === -1) items.push(cdId);
    else items.splice(i, 1);
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch(e){}
    return i === -1;
  }
  function has(cdId){ return list().includes(cdId); }
  function clear(){ try { localStorage.removeItem(KEY); } catch(e){} }
  return { list, toggle, has, clear };
})();