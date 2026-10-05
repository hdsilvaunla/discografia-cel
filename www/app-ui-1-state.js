/* ═══════════════════════════════════════════════════════════════
   DISCOGRAFÍA VIEWER v7.3.0 — UI 1/4
   App state · Filtros · Sorting · Categorías · Freshness
   Depende de: app-core-*.js, app-services-*.js
   ═══════════════════════════════════════════════════════════════ */

const App = {
  db: null, cat: ALL_CATS, q: '', artista: null,
  filters: { estado:'', formato:'', anioD:'', anioH:'', ubic:'', port:'', pres:'', rating:'', fav:false, stream:'', unseen:false },
  tab: 'list', detailCD: null, order: 'nro', artistsOrder: 'count'
};
let _artistList = [];

function getVisibleCDs(){
  const source = App.cat === ALL_CATS ? Store.allCDs() : Store.getCDs(App.cat);
  const f = App.filters;
  const seenIds = f.unseen ? new Set(ViewHistory.list().map(v => v.id)) : null;
  return source.filter(cd => {
    if (!matchArtist(cd, App.artista)) return false;
    if (f.estado && (cd.estado || 'Excelente') !== f.estado) return false;
    if (f.formato && (cd.formato || 'CD') !== f.formato) return false;
    if (f.anioD){ const a = parseInt(f.anioD); if (!isNaN(a) && (cd.anio ?? -Infinity) < a) return false; }
    if (f.anioH){ const a = parseInt(f.anioH); if (!isNaN(a) && (cd.anio ?? Infinity) > a) return false; }
    if (f.ubic === '__con__' && !cd.ubicacion) return false;
    if (f.ubic === '__sin__' && cd.ubicacion) return false;
    if (f.port === '__con__' && !cd.portada) return false;
    if (f.port === '__sin__' && cd.portada) return false;
    if (f.stream === '__con__' && !hasStreams(cd)) return false;
    if (f.stream === '__sin__' && hasStreams(cd)) return false;
    if (f.pres === '__prestados__' && !Loans.isLoaned(cd)) return false;
    if (f.pres === '__disponibles__' && Loans.isLoaned(cd)) return false;
    if (f.pres === '__vencidos__' && !Loans.isOverdue(cd)) return false;
    if (f.rating){ const min = parseInt(f.rating); if (!isNaN(min) && (cd.rating || 0) < min) return false; }
    if (f.fav && !cd.favorito) return false;
    if (f.unseen && seenIds && seenIds.has(cd.id)) return false;
    if (!Search.match(cd, App.q)) return false;
    return true;
  });
}

function sortCDs(arr){
  const o = App.order;
  return arr.slice().sort((a, b) => {
    if (o === 'titulo') return norm(a.titulo).localeCompare(norm(b.titulo), 'es');
    if (o === 'interprete') return norm(a.interprete).localeCompare(norm(b.interprete), 'es');
    if (o === 'anio') return (a.anio ?? 9999) - (b.anio ?? 9999);
    if (o === 'anioEdicion') return (a.anioEdicion ?? 9999) - (b.anioEdicion ?? 9999);
    if (o === 'reciente') return (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0));
    if (o === 'rating') return (b.rating || 0) - (a.rating || 0) || (a.nro ?? 0) - (b.nro ?? 0);
    const A = a.nro ?? 0, B = b.nro ?? 0;
    if (A !== B) return A - B;
    return norm(a.titulo).localeCompare(norm(b.titulo), 'es');
  });
}

function countActiveFilters(){
  let n = 0;
  if (App.artista) n++;
  if (App.q) n++;
  for (const k in App.filters) if (App.filters[k]) n++;
  return n;
}

function orderLabel(){
  const m = { nro:'Nº', titulo:'Título', interprete:'Intérprete', anio:'Año álbum', anioEdicion:'Año edición', rating:'Valoración', reciente:'Recientes' };
  return m[App.order] || 'Nº';
}

function findCDById(id){
  for (const k of Store.catKeys()){ const cd = Store.getCDs(k).find(c => c.id === id); if (cd) return cd; }
  return null;
}

function renderFreshness(){
  const el = $('#freshBadge');
  if (!el) return;
  if (Store.isEmpty()){ el.innerHTML = ''; return; }
  const info = Sync.getInfo();
  const lfInfo = LocalFolder.getInfo();
  const ref = Math.max(info.lastSync || 0, info.lastImport || 0, lfInfo.lastSync || 0);
  if (!ref){ el.innerHTML = ''; return; }
  const ageH = (Date.now() - ref) / 3600000;
  let cls = 'ok';
  if (ageH > 24 * 7) cls = 'err';
  else if (ageH > 24) cls = 'warn';
  const icon = cls === 'ok' ? '⏱️' : cls === 'warn' ? '⚠️' : '🚨';
  el.innerHTML = `<span class="h-fresh ${cls}" title="Última: ${new Date(ref).toLocaleString('es-AR')}">${icon} ${esc(fmtRel(ref))}</span>`;
}

function renderCats(){
  const el = $('#cats');
  if (Store.isEmpty()){ el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = '';
  const all = document.createElement('button');
  all.className = 'chip all' + (App.cat === ALL_CATS ? ' on' : '');
  all.innerHTML = `<span>🗂️</span><span>Todas</span><span class="n">${Store.total()}</span>`;
  all.addEventListener('click', () => { if (App.cat === ALL_CATS && !App.artista) return; App.cat = ALL_CATS; App.artista = null; Prefs.set({ cat: App.cat }); renderAll(); });
  el.appendChild(all);
  for (const k of Store.catKeys()){
    const c = Store.get(k);
    const b = document.createElement('button');
    b.className = 'chip' + (App.cat === k ? ' on' : '');
    b.innerHTML = `<span>${esc(c.icon)}</span><span>${esc(c.label)}</span><span class="n">${c.cds.length}</span>`;
    b.addEventListener('click', () => { if (App.cat === k && !App.artista) return; App.cat = k; App.artista = null; Prefs.set({ cat: App.cat }); renderAll(); });
    el.appendChild(b);
  }
}

function renderSkeleton(count = 5){
  const main = $('#main');
  if (!main) return;
  let html = '<div style="padding:0 4px">';
  for (let i = 0; i < count; i++){
    html += `<div class="skeleton-card">
      <div class="skeleton s-cover"></div>
      <div style="padding:6px 0">
        <div class="skeleton s-line"></div>
        <div class="skeleton s-line short"></div>
        <div class="skeleton s-line tiny"></div>
      </div>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}

function updateNav(){
  $$('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === App.tab));
}

function updateAdvBadge(q){
  const sb = $('#searchBox');
  if (sb) sb.classList.toggle('adv-mode', Search.isAdvanced(q));
}

function filterBannerHTML(){
  const parts = [];
  if (App.artista) parts.push(`🎤 <b>${esc(upper(App.artista))}</b>`);
  if (App.q) parts.push(`🔍 "${esc(App.q)}"`);
  const activeF = [];
  if (App.filters.estado) activeF.push(`Estado: ${esc(App.filters.estado)}`);
  if (App.filters.formato) activeF.push(`Formato: ${esc(App.filters.formato)}`);
  if (App.filters.anioD) activeF.push(`Año ≥ ${esc(App.filters.anioD)}`);
  if (App.filters.anioH) activeF.push(`Año ≤ ${esc(App.filters.anioH)}`);
  if (App.filters.ubic) activeF.push(`Ubicación`);
  if (App.filters.port) activeF.push(`Portada`);
  if (App.filters.pres) activeF.push(`Préstamo`);
  if (App.filters.stream === '__con__') activeF.push(`🎧 Con streaming`);
  if (App.filters.stream === '__sin__') activeF.push(`Sin streaming`);
  if (App.filters.rating) activeF.push(`⭐ ${App.filters.rating}+`);
  if (App.filters.fav) activeF.push(`⭐ Solo favoritos`);
  if (App.filters.unseen) activeF.push(`🆕 Solo no vistos`);
  if (activeF.length) parts.push(`🎛️ ${activeF.join(' · ')}`);
  if (!parts.length) return '';
  const clearAllBtn = `<button class="x" data-clear-all type="button">✕ Todo</button>`;
  return `<div class="filter-banner"><span class="ic">🎯</span><span class="txt">${parts.join(' · ')}</span>${clearAllBtn}</div>`;
}

function bindFilterBanner(container){
  container.querySelector('[data-clear-all]')?.addEventListener('click', () => {
    App.artista = null; App.q = '';
    const qEl = $('#q'); if (qEl) qEl.value = '';
    $('#searchBox')?.classList.remove('has','adv-mode');
    App.filters = { estado:'', formato:'', anioD:'', anioH:'', ubic:'', port:'', pres:'', rating:'', fav:false, stream:'', unseen:false };
    renderAll();
    Toast.show('Filtros quitados', 'info', 1500);
  });
}