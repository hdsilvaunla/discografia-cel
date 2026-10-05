/* ═══════════════════════════════════════════════════════════════
   DISCOGRAFÍA VIEWER v7.3.0 — SERVICES 1/2
   Streaming · iTunes · Deep links · Plataformas oficiales
   Depende de: app-core-*.js
   ═══════════════════════════════════════════════════════════════ */

function matchArtist(cd, target){
  if (!target) return true;
  return norm(cd.interprete) === norm(target);
}

function setArtistFilter(name){
  if (name){
    App.artista = name;
    App.q = '';
    const qEl = $('#q');
    if (qEl) qEl.value = '';
    $('#searchBox')?.classList.remove('has','adv-mode');
    App.filters = { estado:'', formato:'', anioD:'', anioH:'', ubic:'', port:'', pres:'', rating:'', fav:false, stream:'', unseen:false };
    Toast.show(`🎤 Solo ${upper(name)}`, 'ok', 2200);
  } else {
    App.artista = null;
    Toast.show('🎤 Filtro de artista quitado', 'info', 1500);
  }
  if (App.tab !== 'list' && App.tab !== 'grid'){ App.tab = 'list'; updateNav(); }
  Prefs.set({ cat: App.cat });
  renderAll();
  const main = $('#main');
  if (main) main.scrollTop = 0;
}

function getStreamCount(cd){
  const knownKeys = STREAMING_SERVICES.map(s => s.key);
  const cdLinks = cd.links || {};
  return Object.keys(cdLinks).filter(k => knownKeys.includes(k) && isSafeStreamUrl(cdLinks[k])).length;
}
function hasStreams(cd){ return getStreamCount(cd) > 0; }

const ITUNES_MATCH_CACHE = new Map();
const STREAM_BUSY = new WeakMap();

function streamQueryParts(cd){
  const rawTitle = String(cd?.titulo || cd?.title || '').trim();
  const rawArtist = String(cd?.interprete || cd?.artist || '').trim();
  const title = (typeof limpiarTituloParaBusqueda === 'function'
    ? limpiarTituloParaBusqueda(rawTitle) : rawTitle) || rawTitle;
  const artist = (typeof limpiarInterpreteParaBusqueda === 'function'
    ? limpiarInterpreteParaBusqueda(rawArtist) : rawArtist) || rawArtist;
  const year = cd?.anio ? String(cd.anio) : '';
  return { title, artist, year, rawTitle, rawArtist };
}

function streamCacheKey(cd){
  const p = streamQueryParts(cd);
  return [p.artist, p.title, p.year].map(s => norm(s || '')).join('|');
}

function buildPlatformSearchUrl(svcKey, cd, canonical){
  const p = streamQueryParts(cd);
  const title = (canonical && canonical.title) || p.title;
  const artist = (canonical && canonical.artist) || p.artist;
  if (!title && !artist) return null;
  const basic = [artist, title].filter(Boolean).join(' ').trim();
  const quoted = [title && `"${title}"`, artist].filter(Boolean).join(' ').trim();
  const withYear = p.year ? `${basic} ${p.year}` : basic;
  const enc = s => encodeURIComponent(s);
  const encPlus = s => encodeURIComponent(s).replace(/%20/g, '+');
  switch (svcKey){
    case 'spotify':
      return `https://open.spotify.com/search/${enc(title && artist ? `album:${title} artist:${artist}` : basic)}`;
    case 'youtube':
      return `https://music.youtube.com/search?q=${enc(quoted || basic)}`;
    case 'apple':
      return `https://music.apple.com/search?term=${enc(withYear || basic)}`;
    case 'deezer':
      return `https://www.deezer.com/search/${enc(basic)}`;
    case 'tidal':
      return `https://listen.tidal.com/search?q=${enc(basic)}`;
    case 'amazon':
      return `https://music.amazon.com/search/${encPlus(basic)}`;
    case 'soundcloud':
      return `https://soundcloud.com/search?q=${enc(basic)}`;
    case 'discogs':
      return `https://www.discogs.com/search/?q=${enc(basic)}&type=release`;
    default:
      return null;
  }
}

function scoreItunesAlbum(r, nArtist, nTitle, year){
  let s = 0;
  const ra = norm(r.artistName || '');
  const rt = norm(r.collectionName || '');
  const ry = (r.releaseDate || '').slice(0, 4);
  if (r.wrapperType && r.wrapperType !== 'collection') return -1;
  if (r.collectionType === 'Single') return -1;
  if ((r.trackCount || 0) > 0 && (r.trackCount || 0) < 4) s -= 20;
  if (ra === nArtist) s += 100;
  else if (ra.includes(nArtist) || nArtist.includes(ra)) s += 55;
  else return -1;
  if (rt === nTitle) s += 100;
  else if (rt.includes(nTitle) || nTitle.includes(rt)) s += 45;
  else return -1;
  if (year && ry === year) s += 35;
  else if (year && ry && Math.abs(parseInt(ry, 10) - parseInt(year, 10)) <= 1) s += 12;
  const bad = ['live','en vivo','karaoke','tribute','greatest hits','best of','anthology'];
  for (const b of bad){
    if (rt.includes(b) && !nTitle.includes(b)) s -= 50;
  }
  s += Math.min(r.trackCount || 0, 15);
  return s;
}

async function findItunesAlbumMatch(cd){
  const key = streamCacheKey(cd);
  if (ITUNES_MATCH_CACHE.has(key)) return ITUNES_MATCH_CACHE.get(key);
  const p = streamQueryParts(cd);
  const term = [p.artist, p.title].filter(Boolean).join(' ').trim();
  if (!term){ ITUNES_MATCH_CACHE.set(key, null); return null; }
  const nArtist = norm(p.artist);
  const nTitle = norm(p.title);
  const countries = ['US', 'AR', 'ES', 'MX', 'GB'];
  let best = null;
  let bestScore = 0;
  for (const country of countries){
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=25&country=${country}`;
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 7000) : null;
      const r = await fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined });
      if (timer) clearTimeout(timer);
      if (!r.ok) continue;
      const data = await r.json();
      const results = Array.isArray(data.results) ? data.results : [];
      for (const row of results){
        const sc = scoreItunesAlbum(row, nArtist, nTitle, p.year);
        if (sc > bestScore){ bestScore = sc; best = row; }
      }
      if (bestScore >= 180) break;
    } catch (e){
      if (e && e.name === 'AbortError') continue;
      console.warn('[iTunes]', e);
    }
  }
  const match = (best && bestScore >= 120) ? {
    title: best.collectionName || p.title,
    artist: best.artistName || p.artist,
    year: (best.releaseDate || '').slice(0, 4) || p.year,
    appleUrl: best.collectionViewUrl || null,
    artwork: best.artworkUrl100 || null,
    score: bestScore,
    trackCount: best.trackCount || 0
  } : null;
  ITUNES_MATCH_CACHE.set(key, match);
  return match;
}

function openSafeUrl(url){
  if (!url || !isSafeStreamUrl(url)){
    Toast.show('🔒 URL no permitida', 'warn', 2500);
    return false;
  }
  window.open(url, '_blank', 'noopener');
  return true;
}

function openInNativeApp(svcKey, webUrl){
  if (!webUrl || !isSafeStreamUrl(webUrl)){ openSafeUrl(webUrl); return; }
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  if (!isMobile){ openSafeUrl(webUrl); return; }

  if (svcKey === 'spotify'){
    const m = webUrl.match(/album\/([a-zA-Z0-9]+)/);
    if (m){
      const appUrl = `spotify:album:${m[1]}`;
      const start = Date.now();
      window.location.href = appUrl;
      setTimeout(() => {
        if (Date.now() - start < 800) window.open(webUrl, '_blank', 'noopener');
      }, 500);
      return;
    }
  }
  if (svcKey === 'youtube'){
    const m = webUrl.match(/[?&]v=([a-zA-Z0-9_-]+)/) || webUrl.match(/playlist\?list=([a-zA-Z0-9_-]+)/);
    if (m){
      const appUrl = `vnd.youtube://${m[1]}`;
      const start = Date.now();
      window.location.href = appUrl;
      setTimeout(() => {
        if (Date.now() - start < 800) window.open(webUrl, '_blank', 'noopener');
      }, 500);
      return;
    }
  }
  openSafeUrl(webUrl);
}

async function openPlatformForCD(cd, svcKey, btn){
  if (!cd || !svcKey) return;
  if (btn && STREAM_BUSY.get(btn)) return;
  if (btn) STREAM_BUSY.set(btn, true);
  if (typeof navigator !== 'undefined' && navigator.onLine === false){
    const cdLinks = (cd.links && typeof cd.links === 'object') ? cd.links : {};
    if (!(cdLinks[svcKey] && isSafeStreamUrl(cdLinks[svcKey]))){
      Toast.show('🔴 Sin conexión — solo links guardados funcionan offline', 'warn', 3500);
      if (btn) STREAM_BUSY.delete(btn);
      return;
    }
  }
  const setBusy = (on) => {
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle('busy', !!on);
  };
  setBusy(true);
  try {
    const cdLinks = (cd.links && typeof cd.links === 'object' && !Array.isArray(cd.links)) ? cd.links : {};
    const saved = cdLinks[svcKey];
    if (saved && isSafeStreamUrl(saved)){
      openInNativeApp(svcKey, saved);
      Toast.show(`↗ ${STREAMING_SERVICES.find(s => s.key === svcKey)?.name || svcKey}`, 'ok', 1600);
      return;
    }
    let match = null;
    try { match = await findItunesAlbumMatch(cd); }
    catch (e){ console.warn('[stream match]', e); }
    if (svcKey === 'apple' && match?.appleUrl && isSafeStreamUrl(match.appleUrl)){
      openInNativeApp(svcKey, match.appleUrl);
      Toast.show(`🍎 Álbum: ${match.title}`, 'ok', 2500);
      return;
    }
    const canonical = match ? { title: match.title, artist: match.artist } : null;
    const url = buildPlatformSearchUrl(svcKey, cd, canonical);
    if (!openSafeUrl(url)) return;
    const svcName = STREAMING_SERVICES.find(s => s.key === svcKey)?.name || svcKey;
    if (match){
      Toast.show(`🎯 ${svcName}: búsqueda de «${match.title}»`, 'info', 2800);
    } else {
      Toast.show(`🎯 ${svcName}: búsqueda (revisá el resultado)`, 'info', 2800);
    }
  } finally {
    setBusy(false);
    if (btn) STREAM_BUSY.delete(btn);
  }
}

function wireStreamingSectionEvents(sectionEl, cdRef){
  const section = sectionEl
    || document.querySelector('#detModal .stream-section')
    || document.querySelector('.stream-section');
  if (!section) return;
  const cdFixed = cdRef || null;
  section.querySelectorAll('[data-stream-svc]').forEach(btn => {
    if (btn.dataset.wired === '1') return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const key = btn.dataset.streamSvc;
      const cd = cdFixed || App.detailCD;
      if (!cd){ Toast.show('Sin álbum seleccionado', 'warn'); return; }
      openPlatformForCD(cd, key, btn);
    });
  });
}

function renderStreamingSection(cd){
  const cdLinks = (cd.links && typeof cd.links === 'object' && !Array.isArray(cd.links)) ? cd.links : {};
  const allowedSaved = STREAMING_SERVICES.filter(svc => cdLinks[svc.key] && isSafeStreamUrl(cdLinks[svc.key]));
  const otherLinks = Object.entries(cdLinks).filter(([k, v]) => !STREAMING_SERVICES.some(s => s.key === k) && isSafeStreamUrl(v));
  const directCount = allowedSaved.length;
  const p = streamQueryParts(cd);
  const badge = directCount > 0
    ? `<span class="stream-count">✅ ${directCount} directo${directCount === 1 ? '' : 's'}</span>`
    : `<span class="stream-count" style="background:rgba(167,139,250,.15);color:var(--purple);border-color:rgba(167,139,250,.4)">🎯 Inteligente</span>`;
  const items = STREAMING_SERVICES.map(svc => {
    const hasDirect = !!(cdLinks[svc.key] && isSafeStreamUrl(cdLinks[svc.key]));
    const mode = hasDirect ? 'direct' : 'search';
    const arrow = hasDirect ? '↗' : (svc.key === 'apple' ? '🍎' : '🎯');
    const title = hasDirect
      ? `Abrir ${svc.name} (link de la lista)`
      : (svc.key === 'apple'
          ? `Buscar álbum exacto en Apple Music (iTunes)`
          : `Buscar «${p.title || cd.titulo || ''}» en ${svc.name}`);
    return `<button type="button" class="stream-btn ${mode}" data-stream-svc="${esc(svc.key)}" style="--svc-color:${svc.color}" title="${esc(title)}">
      <span>${svc.icon}</span><span>${esc(svc.name)}</span><span class="stream-arrow">${arrow}</span>
    </button>`;
  }).join('');
  const othersHTML = otherLinks.length ? `
    <div style="margin-top:12px">
      <div style="font-size:.62rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px">🔗 Otros enlaces</div>
      <div class="stream-grid">${otherLinks.map(([k, url]) =>
        `<a href="${esc(url)}" target="_blank" rel="noopener" class="stream-btn direct" style="--svc-color:var(--purple)"><span>🔗</span><span>${esc(k)}</span><span class="stream-arrow">↗</span></a>`
      ).join('')}</div>
    </div>` : '';
  const queryHint = (p.title || p.artist)
    ? `<div style="font-size:.68rem;color:var(--muted);margin:6px 0 2px">Búsqueda: <b style="color:var(--txt)">${esc([p.artist, p.title].filter(Boolean).join(' — '))}</b>${p.year ? ` · ${esc(p.year)}` : ''}</div>`
    : '';
  const hint = `
    <div class="stream-hint-note" style="background:rgba(79,195,247,.06);border-left-color:var(--accent)">
      <b style="color:var(--accent)">Cómo funciona</b><br>
      • <b>↗</b> Link ya guardado<br>
      • <b>🍎 Apple</b> busca el álbum exacto vía iTunes<br>
      • <b>🎯</b> Abre la búsqueda oficial
    </div>
    <div class="stream-hint-note" style="margin-top:8px;font-size:.7rem">
      🔒 Solo plataformas oficiales · No se descarga audio
    </div>`;
  return `<div class="sec stream-section">
    <div class="sec-h" style="justify-content:space-between;flex-wrap:wrap;gap:6px">
      <span style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">🎧 Escuchar en ${badge}</span>
      <span style="font-size:.55rem;background:rgba(167,139,250,.12);color:var(--purple);border:1px solid rgba(167,139,250,.35);padding:2px 7px;border-radius:8px;font-weight:700">🔒 Oficial</span>
    </div>
    ${queryHint}
    <div class="stream-grid">${items}</div>
    ${othersHTML}
    ${hint}
  </div>`;
}