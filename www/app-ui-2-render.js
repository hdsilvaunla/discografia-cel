/* ═══════════════════════════════════════════════════════════════
   DISCOGRAFÍA VIEWER v7.3.0 — UI 2/4
   Render list · grid · timeline · stats · artists · more
   Depende de: app-core-*.js, app-services-*.js, app-ui-1-state.js
   ═══════════════════════════════════════════════════════════════ */

function renderMain(){
  const main = $('#main');
  if (!main) return;
  if (Store.isEmpty()){ main.innerHTML = renderEmpty(); bindEmpty(); return; }
  if (App.tab === 'list') return renderList(main);
  if (App.tab === 'grid') return renderGrid(main);
  if (App.tab === 'timeline') return renderTimeline(main);
  if (App.tab === 'stats') return renderStats(main);
  if (App.tab === 'artists') return renderArtists(main);
  return renderList(main);
}

function renderEmpty(){
  const hasSync = Sync.isConfigured();
  const hasLocal = LocalFolder.isConfigured();
  const hasRemote = RemoteUrls.list().length > 0;
  return `
    <div class="empty">
      <div class="ic">💿</div>
      <h2>Sin colección</h2>
      <p>${hasSync || hasLocal || hasRemote ? 'Configuraste fuentes pero aún no cargaste datos.' : 'Importá un backup .json o configurá una fuente.'}</p>
      <div class="btns">
        ${hasLocal ? `<button class="btn pri" id="empSyncNow">📂 Cargar desde carpeta local</button>` : ''}
        ${hasSync ? `<button class="btn pri" id="empDriveNow">☁️ Cargar desde Drive</button>` : ''}
        ${hasRemote ? `<button class="btn pri" id="empRemoteNow">🔗 Cargar desde URL remota</button>` : ''}
        <button class="btn ${!hasLocal && !hasSync && !hasRemote ? 'pri' : ''}" id="empImport">📁 Importar archivo</button>
        <button class="btn" id="empLocal">📂 Configurar carpeta local</button>
        <button class="btn" id="empRemote">☁️ Configurar URLs remotas</button>
        <button class="btn" id="empSync">⚙️ Configurar Google Drive</button>
      </div>
    </div>`;
}

function bindEmpty(){
  $('#empImport')?.addEventListener('click', () => openImport());
  $('#empLocal')?.addEventListener('click', () => openLocalFolder());
  $('#empRemote')?.addEventListener('click', () => openRemoteUrls());
  $('#empSync')?.addEventListener('click', () => openSync());
  $('#empSyncNow')?.addEventListener('click', () => {
    syncFromLocalFolder({ silent: false, force: false }).then(r => {
      if (r.reason === 'needs-reselect'){ Toast.show('📂 Seleccioná la carpeta', 'info', 3000); openLocalFolder(); }
    });
  });
  $('#empDriveNow')?.addEventListener('click', () => syncNow(true));
  $('#empRemoteNow')?.addEventListener('click', () => openRemoteUrls());
}

function renderCard(cd, q){
  const loaned = Loans.isLoaned(cd), overdue = Loans.isOverdue(cd);
  const cover = cd.portada ? `<img class="cover" src="${esc(cd.portada)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'ph\\'>💿</div>'">` : `<div class="ph">💿</div>`;
  const loanBadge = loaned ? `<div class="loan${overdue ? ' overdue' : ''}">📤${overdue ? '!' : ''}</div>` : '';
  const favLocal = LocalFavs.has(cd.id);
  const favStar = (cd.favorito || favLocal) ? `<span class="fav">★</span>` : '';
  const ratingStars = cd.rating > 0 ? `<span class="rate" title="${cd.rating} de 5">${'★'.repeat(cd.rating)}</span>` : '';
  const tagsHTML = (cd.tags || []).slice(0, 2).map(t => `<span class="tag">#${esc(t)}</span>`).join('');
  const edBadge = cd.anioEdicion && cd.anioEdicion !== cd.anio ? `<span class="ed" title="Año edición">📅 Ed.${cd.anioEdicion}</span>` : '';
  const streamCount = getStreamCount(cd);
  const streamBadge = streamCount > 0 ? `<span class="stream-tag" title="${streamCount} link${streamCount === 1 ? '' : 's'}">🎧 ${streamCount}</span>` : '';
  return `<div class="card" data-id="${esc(cd.id)}">${loanBadge}${cover}<div class="info"><div class="title">${favStar}${Search.highlight(cd.titulo || '—', q)}</div><div class="artist">${Search.highlight(cd.interprete || '—', q)}</div><div class="meta"><span class="nro">#${cd.nro}</span>${cd.anio ? `<b>${cd.anio}</b>` : ''}${edBadge}${cd.formato ? `<span>${esc(cd.formato)}</span>` : ''}${streamBadge}${ratingStars}${tagsHTML}</div></div><span class="arrow">›</span></div>`;
}

function renderList(main){
  const cds = sortCDs(getVisibleCDs());
  const total = App.cat === ALL_CATS ? Store.total() : Store.getCDs(App.cat).length;
  const nFilters = countActiveFilters();
  const banner = filterBannerHTML();
  const recHTML = nFilters === 0 ? Recommender.renderBanner() : '';
  if (!cds.length){
    main.innerHTML = `${banner}<div class="empty" style="padding:40px 16px"><div class="ic" style="font-size:3rem">🔍</div><h2>Sin resultados</h2><p>${Store.total() ? 'Probá con otra búsqueda o quitá los filtros.' : 'Importá un backup para empezar.'}</p></div>`;
    bindFilterBanner(main);
    return;
  }
  const html = cds.map(cd => renderCard(cd, App.q)).join('');
  const counter = nFilters > 0
    ? `<b style="color:var(--accent2)">${cds.length}</b> de ${total} · ${nFilters} filtro${nFilters === 1 ? '' : 's'}`
    : `${total} CD${total === 1 ? '' : 's'} · orden: ${orderLabel()}`;
  main.innerHTML = `${banner}${recHTML}<div style="font-size:.72rem;color:var(--muted);margin-bottom:8px;padding:0 4px">${counter}</div><div class="list">${html}</div>`;
  main.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', () => { const cd = findCDById(el.dataset.id); if (cd) openDetail(cd); });
  });
  main.querySelector('[data-rec-id]')?.addEventListener('click', (e) => {
    const cd = findCDById(e.currentTarget.dataset.recId);
    if (cd) openDetail(cd);
  });
  bindFilterBanner(main);
}

function renderGrid(main){
  const cds = sortCDs(getVisibleCDs());
  const banner = filterBannerHTML();
  if (!cds.length){
    main.innerHTML = `${banner}<div class="empty"><div class="ic" style="font-size:3rem">🔍</div><h2>Sin resultados</h2></div>`;
    bindFilterBanner(main);
    return;
  }
  const html = cds.map(cd => {
    const loaned = Loans.isLoaned(cd), overdue = Loans.isOverdue(cd);
    const img = cd.portada ? `<img class="gc-img" src="${esc(cd.portada)}" alt="" loading="lazy" style="object-fit:cover;display:block" onerror="this.outerHTML='<div class=\\'gc-img\\'>💿</div>'">` : `<div class="gc-img">💿</div>`;
    const loanBadge = loaned ? `<div class="loan${overdue ? ' overdue' : ''}">📤${overdue ? '!' : ''}</div>` : '';
    const favBadge = (cd.favorito || LocalFavs.has(cd.id)) ? `<div class="gc-fav">★</div>` : '';
    const sc = getStreamCount(cd);
    const streamBadge = sc > 0 ? `<div class="gc-stream" title="${sc} links">🎧 ${sc}</div>` : '';
    return `<div class="gcard" data-id="${esc(cd.id)}">${streamBadge || loanBadge}${favBadge}${img}<div class="gc-t">${esc(cd.titulo || '—')}</div><div class="gc-a">${esc(cd.interprete || '—')}</div><div class="gc-m"><span class="gc-n">#${cd.nro}</span><span class="gc-y">${cd.anio ?? '—'}</span></div></div>`;
  }).join('');
  main.innerHTML = `${banner}<div class="grid">${html}</div>`;
  main.querySelectorAll('.gcard').forEach(el => {
    el.addEventListener('click', () => { const cd = findCDById(el.dataset.id); if (cd) openDetail(cd); });
  });
  bindFilterBanner(main);
}

function renderTimeline(main){
  const all = Store.allCDs().filter(c => c.anio);
  if (!all.length){ main.innerHTML = '<div class="empty"><div class="ic">📅</div><h2>Sin años registrados</h2></div>'; return; }
  const byYear = new Map();
  for (const cd of all){
    if (!byYear.has(cd.anio)) byYear.set(cd.anio, []);
    byYear.get(cd.anio).push(cd);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const minY = years[0], maxY = years[years.length - 1];
  main.innerHTML = `
    <div style="padding:12px 4px">
      <div style="font-size:.72rem;color:var(--muted);margin-bottom:14px;text-align:center">
        📅 Timeline de <b>${minY}</b> a <b>${maxY}</b> · ${all.length} CDs
      </div>
      <div class="timeline">
        ${years.map(y => {
          const cds = byYear.get(y);
          return `<div class="tl-year">
            <div class="tl-year-label">${y}</div>
            <div class="tl-year-count">${cds.length} CD${cds.length === 1 ? '' : 's'}</div>
            <div class="tl-cds">
              ${cds.map(cd => `
                <div class="tl-cd" data-id="${esc(cd.id)}" title="${esc(cd.titulo)}">
                  ${cd.portada
                    ? `<img src="${esc(cd.portada)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'tl-ph\\'>💿</div>'">`
                    : `<div class="tl-ph">💿</div>`}
                </div>
              `).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  main.querySelectorAll('.tl-cd').forEach(el => {
    el.addEventListener('click', () => {
      const cd = findCDById(el.dataset.id);
      if (cd) openDetail(cd);
    });
  });
}

function renderStats(main){
  const all = Store.allCDs();
  const total = all.length;
  const artistas = new Set(), sellos = new Map(), anios = new Map(), decadas = new Map();
  let conPortada = 0, conValor = 0, valorTotal = 0, añosMin = null, añosMax = null;
  let conAnio = 0, conSello = 0, conGenero = 0, conUbic = 0, conCat = 0, conAnioEd = 0, conStream = 0;
  let prestados = 0, vencidos = 0;
  const yearCounts = new Map();
  for (const cd of all){
    if (cd.interprete) artistas.add(cd.interprete);
    if (cd.sello){ sellos.set(cd.sello, (sellos.get(cd.sello) || 0) + 1); conSello++; }
    if (cd.anio){
      anios.set(cd.anio, (anios.get(cd.anio) || 0) + 1);
      yearCounts.set(cd.anio, (yearCounts.get(cd.anio) || 0) + 1);
      const d = Math.floor(cd.anio / 10) * 10;
      decadas.set(d, (decadas.get(d) || 0) + 1);
      conAnio++;
    }
    if (cd.anioEdicion) conAnioEd++;
    if (cd.portada) conPortada++;
    if (cd.genero) conGenero++;
    if (cd.ubicacion) conUbic++;
    if (cd.catalogo) conCat++;
    if (hasStreams(cd)) conStream++;
    if (Loans.isLoaned(cd)){ prestados++; if (Loans.isOverdue(cd)) vencidos++; }
    if (cd.valor != null && Number.isFinite(Number(cd.valor))){ valorTotal += Number(cd.valor) * Math.max(1, parseInt(cd.cantidad) || 1); conValor++; }
    if (cd.anio){ añosMin = añosMin === null ? cd.anio : Math.min(añosMin, cd.anio); añosMax = añosMax === null ? cd.anio : Math.max(añosMax, cd.anio); }
  }
  const artMap = new Map();
  for (const cd of all) if (cd.interprete) artMap.set(cd.interprete, (artMap.get(cd.interprete) || 0) + 1);
  const topArt = [...artMap].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topSellos = [...sellos].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topAnios = [...anios].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const decSorted = [...decadas].sort((a, b) => a[0] - b[0]);
  const kpis = [
    { i: '💿', l: 'CDs', v: total.toLocaleString('es-AR') },
    { i: '🎤', l: 'Intérpretes', v: artistas.size.toLocaleString('es-AR') },
    { i: '📅', l: 'Rango', v: (añosMin && añosMax) ? `${añosMin}–${añosMax}` : '—' },
    { i: '🎧', l: 'Con streaming', v: `${conStream}/${total}` },
    { i: '🖼️', l: 'Portadas', v: `${conPortada}/${total}` },
    ...(prestados > 0 ? [{ i: '📚', l: 'Prestados', v: `${prestados}${vencidos > 0 ? ' ('+vencidos+'⚠️)' : ''}` }] : []),
    ...(valorTotal > 0 ? [{ i: '💰', l: 'Valor', v: '$' + valorTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 }) }] : []),
    ...(Store.catKeys().length ? [{ i: '📁', l: 'Categorías', v: String(Store.catKeys().length) }] : [])
  ];
  const health = [
    { l:'Con año álbum', v: conAnio },
    { l:'Con año edición', v: conAnioEd },
    { l:'Con sello', v: conSello },
    { l:'Con género', v: conGenero },
    { l:'Con ubicación', v: conUbic },
    { l:'Con Nº catálogo', v: conCat },
    { l:'Con streaming', v: conStream },
    { l:'Con portada', v: conPortada },
    { l:'Con valor', v: conValor }
  ].filter(h => h.v > 0 || ['Con portada','Con año álbum','Con streaming'].includes(h.l));

  const years = [...yearCounts.keys()].sort((a, b) => a - b);
  let heatmapHTML = '';
  if (years.length){
    const minY = years[0], maxY = years[years.length - 1];
    const maxCount = Math.max(...yearCounts.values());
    let cells = '';
    for (let y = minY; y <= maxY; y++){
      const c = yearCounts.get(y) || 0;
      const intensity = maxCount ? c / maxCount : 0;
      const bg = c === 0 ? 'rgba(255,255,255,.03)' : `rgba(79,195,247,${0.15 + intensity * 0.75})`;
      cells += `<div class="yh-cell" style="background:${bg}" title="${y}: ${c} CD${c === 1 ? '' : 's'}"></div>`;
    }
    heatmapHTML = `<div class="chart-box"><h3><span class="d" style="background:#4fc3f7"></span>Años en detalle</h3><div class="year-heatmap">${cells}</div></div>`;
  }

  main.innerHTML = `
    <div class="kpi">${kpis.map(k => `<div class="k"><div class="ki">${k.i}</div><div class="kt"><div class="kl">${esc(k.l)}</div><div class="kv">${esc(k.v)}</div></div></div>`).join('')}</div>
    ${decSorted.length ? `<div class="chart-box"><h3><span class="d" style="background:#ffca28"></span>CDs por década</h3><div class="dec-bars">${(() => { const mx = Math.max(...decSorted.map(([,v]) => v), 1); return decSorted.map(([d,v]) => `<div class="dec-row"><span>${esc(String(d))}s</span><div class="dec-track"><i style="width:${Math.max(6, Math.round(v/mx*100))}%"></i></div><b>${v}</b></div>`).join(''); })()}</div></div>` : ''}
    ${heatmapHTML}
    ${topArt.length ? `<div class="chart-box"><h3><span class="d" style="background:#a78bfa"></span>Top 10 intérpretes</h3><ul class="top">${topArt.map(([n, v], i) => `<li data-artist="${esc(n)}" style="cursor:pointer"><span class="r">${i+1}</span><span class="n" title="${esc(n)}">${esc(n)}</span><span class="v">${v}</span></li>`).join('')}</ul></div>` : ''}
    ${topSellos.length ? `<div class="chart-box"><h3><span class="d" style="background:#5ddc9a"></span>Top 10 sellos</h3><ul class="top">${topSellos.map(([n, v], i) => `<li><span class="r">${i+1}</span><span class="n" title="${esc(n)}">${esc(n)}</span><span class="v">${v}</span></li>`).join('')}</ul></div>` : ''}
    ${topAnios.length ? `<div class="chart-box"><h3><span class="d" style="background:#ff6b6b"></span>Top 10 años</h3><ul class="top">${topAnios.map(([n, v], i) => `<li><span class="r">${i+1}</span><span class="n">${n}</span><span class="v">${v}</span></li>`).join('')}</ul></div>` : ''}
    <div class="chart-box"><h3><span class="d" style="background:#4fc3f7"></span>Salud de la colección</h3><div class="health-grid">${health.map(h => { const p = total ? Math.round(h.v/total*100) : 0; return `<div class="hi"><div class="hi-l">${h.l}</div><div class="hi-v">${h.v} <span style="font-size:.7rem;color:var(--muted);font-weight:400">/ ${total}</span></div><div class="hi-bar"><i style="width:${p}%"></i></div></div>`; }).join('')}</div></div>
    ${topArt.length > 4 ? `<div class="chart-box"><h3><span class="d" style="background:#a78bfa"></span>Nube de intérpretes</h3><div class="wc">${(() => { const top40 = [...artMap].sort((a, b) => b[1] - a[1]).slice(0, 40); const mx = top40[0]?.[1] || 1; return top40.map(([n, v]) => { const s = 0.7 + (v / mx) * 1.1; const o = 0.5 + (v / mx) * 0.5; return `<span style="font-size:${s}rem;opacity:${o}">${esc(n)}</span>`; }).join(''); })()}</div></div>` : ''}
  `;
  main.querySelectorAll('.top [data-artist]').forEach(li => {
    li.addEventListener('click', () => setArtistFilter(li.dataset.artist));
  });
}

function renderArtists(main){
  const source = App.cat === ALL_CATS ? Store.allCDs() : Store.getCDs(App.cat);
  const map = new Map();
  for (const cd of source) if (cd.interprete) map.set(cd.interprete, (map.get(cd.interprete) || 0) + 1);
  const rawList = [...map].map(([name, count]) => ({ name, count }));
  if (App.artistsOrder === 'alpha'){ rawList.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })); }
  else { rawList.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es')); }
  _artistList = rawList;
  if (!_artistList.length){ main.innerHTML = `<div class="empty"><div class="ic" style="font-size:3rem">🎤</div><h2>Sin intérpretes</h2></div>`; return; }
  const banner = filterBannerHTML();
  const mx = Math.max(..._artistList.map(a => a.count), 1);
  const artistActive = App.artista ? norm(App.artista) : null;
  const isAlpha = App.artistsOrder === 'alpha';
  const listHTML = _artistList.map((a, i) => {
    const isOn = artistActive && norm(a.name) === artistActive;
    return `<li class="artist-item${isOn ? ' on' : ''}" data-idx="${i}">
      <span class="rk">${isAlpha ? '·' : i + 1}</span>
      <span style="min-width:0"><span class="nm">${esc(a.name)}</span><span class="bar"><i style="width:${Math.round(a.count / mx * 100)}%"></i></span></span>
      <span class="ct">${a.count}</span>
    </li>`;
  }).join('');
  main.innerHTML = `${banner}
    <div class="artists-toolbar">
      <div class="at-count"><b>${_artistList.length}</b> intérpretes · tocá uno para filtrar</div>
      <div class="artists-sort" id="artistsSort">
        <button type="button" data-sort="count" class="${isAlpha ? '' : 'on'}">🔢 Por cantidad</button>
        <button type="button" data-sort="alpha" class="${isAlpha ? 'on' : ''}">🔤 A-Z</button>
      </div>
    </div>
    <ul class="artist-list">${listHTML}</ul>`;
  main.querySelectorAll('#artistsSort button').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.sort;
      if (App.artistsOrder === mode) return;
      App.artistsOrder = mode;
      Prefs.set({ artistsOrder: mode });
      renderMain();
      Toast.show(mode === 'alpha' ? '🔤 A-Z' : '🔢 Por cantidad', 'ok', 1500);
    });
  });
  main.querySelectorAll('.artist-item').forEach(el => {
    el.addEventListener('click', () => {
      const a = _artistList[parseInt(el.dataset.idx, 10)];
      if (!a) return;
      const wasActive = App.artista && norm(App.artista) === norm(a.name);
      setArtistFilter(wasActive ? null : a.name);
    });
  });
  bindFilterBanner(main);
}

function renderMore(main){
  if (!main) main = $('#moreBody');
  const stats = { cds: Store.total(), cats: Store.catKeys().length, conPortada: Store.allCDs().filter(c => c.portada).length, conStream: Store.allCDs().filter(hasStreams).length };
  const syncReady = Sync.isConfigured();
  const info = Sync.getInfo();
  const lastRef = Math.max(info.lastSync || 0, info.lastImport || 0);
  const lastFileTxt = info.lastFileName ? `<br><span style="font-size:.7rem;opacity:.8">Último: ${esc(info.lastFileName)}</span>` : '';
  const syncInfoHTML = syncReady
    ? `<div class="sync-status ok" style="margin-bottom:10px"><span>🔄</span><div><b>Drive configurado</b><br>Última: ${lastRef ? esc(fmtRel(lastRef)) : 'nunca'}${lastFileTxt}</div></div>`
    : '';
  const localReady = LocalFolder.isConfigured();
  const localName = LocalFolder.getName();
  const localMode = LocalFolder.getMode();
  const localModeIcon = localMode === LocalFolder.MODE.FSA ? '🟢' : localMode === LocalFolder.MODE.WEBKIT ? '🟡' : '🟠';
  const localInfo = LocalFolder.getInfo();
  const localLastRef = localInfo.lastSync || 0;
  const localLastFile = localInfo.lastFileName ? `<br><span style="font-size:.7rem;opacity:.8">Último: ${esc(localInfo.lastFileName)}</span>` : '';
  const localReadyHTML = localReady
    ? `<div class="sync-status ok" style="margin-bottom:10px"><span>${localModeIcon}</span><div><b>Carpeta local</b> · ${esc(LocalFolder.modeLabel(localMode))}<br>${esc(localName || '—')}<br>Última: ${localLastRef ? esc(fmtRel(localLastRef)) : 'nunca'}${localLastFile}</div></div>`
    : '';
  const remoteCount = RemoteUrls.list().length;
  const remoteReadyHTML = remoteCount > 0
    ? `<div class="sync-status ok" style="margin-bottom:10px"><span>🔗</span><div><b>${remoteCount} URL${remoteCount === 1 ? '' : 's'} remota${remoteCount === 1 ? '' : 's'}</b></div></div>`
    : '';
  const all = Store.allCDs();
  const prestados = all.filter(Loans.isLoaned).length;
  const vencidos = all.filter(Loans.isOverdue).length;
  const u = Storage.usage();
  const pctClass = u.pct > 85 ? 'err' : u.pct > 65 ? 'warn' : 'ok';
  const lastCleanup = Storage.lastCleanup();
  const lastCleanupTxt = lastCleanup ? `Última limpieza: ${esc(fmtRel(lastCleanup))}` : 'Nunca limpiado';
  const keyCount = Storage.listKeys().length;
  const storageHTML = `
    <div class="storage-box">
      <div class="sb-head"><span>💾 <b>Almacenamiento</b></span><span class="sb-pct ${pctClass}">${u.pct}%</span></div>
      <div class="sb-bar"><i class="${pctClass}" style="width:${Math.max(2, u.pct)}%"></i></div>
      <div class="sb-info">Usado: <b>${fmtBytes(u.used)}</b> / ~${fmtBytes(u.limit)}<br>${keyCount} clave${keyCount === 1 ? '' : 's'}<br><span style="opacity:.8">${lastCleanupTxt}</span></div>
    </div>`;
  const seenCount = ViewHistory.list().length;
  main.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="padding:16px;background:linear-gradient(135deg,rgba(79,195,247,.08),rgba(93,220,154,.05));border:1px solid rgba(79,195,247,.25);border-radius:14px;text-align:center">
        <div style="font-size:1.8rem;margin-bottom:6px">💿</div>
        <div style="font-size:1.05rem;font-weight:700;margin-bottom:4px">${stats.cds} CDs en tu colección</div>
        <div style="font-size:.78rem;color:var(--muted)">${stats.cats} categoría${stats.cats === 1 ? '' : 's'} · ${stats.conPortada} con portada · ${stats.conStream} con streaming</div>
        <div style="margin-top:10px;font-size:.68rem;color:var(--ok);background:rgba(93,220,154,.08);padding:6px 10px;border-radius:8px;display:inline-block;border:1px solid rgba(93,220,154,.25)">🔒 Solo consulta · Sin descargas</div>
      </div>
      ${prestados > 0 ? `<div class="loans-banner${vencidos > 0 ? ' overdue' : ''}"><span>📚</span><div><b>${prestados}</b> CD${prestados === 1 ? '' : 's'} en préstamo${vencidos > 0 ? ` · <b>${vencidos} vencido${vencidos === 1 ? '' : 's'}</b>` : ''}</div></div>` : ''}
      ${localReadyHTML}
      ${remoteReadyHTML}
      ${syncInfoHTML}
      ${storageHTML}
      <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;padding:8px 4px 0">📥 Fuentes de datos</div>
      <button type="button" class="btn-row ${localReady ? 'accent' : ''}" data-act="local-folder">
        <span>${localReady ? localModeIcon : '📂'}</span>
        <span>${localReady ? `Carpeta local: ${esc(localName || '')}` : 'Configurar carpeta local'}</span>
      </button>
      ${localReady ? `<button type="button" class="btn-row accent" data-act="local-sync"><span>⬇️</span><span>Cargar desde carpeta ahora</span></button>` : ''}
      <button type="button" class="btn-row ${remoteCount > 0 ? 'accent' : ''}" data-act="remote-urls">
        <span>☁️</span>
        <span>${remoteCount > 0 ? `${remoteCount} URL${remoteCount === 1 ? '' : 's'} remota${remoteCount === 1 ? '' : 's'}` : 'URLs remotas (iCloud/Dropbox)'}</span>
      </button>
      <button type="button" class="btn-row ${syncReady ? 'accent' : ''}" data-act="sync">
        <span>☁️</span>
        <span>${syncReady ? 'Google Drive configurado' : 'Configurar Google Drive'}</span>
      </button>
      ${syncReady ? `<button type="button" class="btn-row accent" data-act="sync-now"><span>🔄</span><span>Cargar desde Drive</span></button>` : ''}
      <button type="button" class="btn-row" data-act="import"><span>📥</span><span>Importar archivo</span></button>
      <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;padding:8px 4px 0">🎛️ Opciones</div>
      <button type="button" class="btn-row" data-act="filters">🎛️ Filtros avanzados</button>
      <div class="seg" id="orderSeg" style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0">
        <button type="button" class="seg-btn${App.order === 'nro' ? ' on' : ''}" data-order="nro">🔢 Nº</button>
        <button type="button" class="seg-btn${App.order === 'titulo' ? ' on' : ''}" data-order="titulo">🔤 Título</button>
        <button type="button" class="seg-btn${App.order === 'interprete' ? ' on' : ''}" data-order="interprete">🎤 Intérprete</button>
        <button type="button" class="seg-btn${App.order === 'anio' ? ' on' : ''}" data-order="anio">📅 Año</button>
        <button type="button" class="seg-btn${App.order === 'anioEdicion' ? ' on' : ''}" data-order="anioEdicion">📅 Edición</button>
        ${Store.hasAnyRatings() ? `<button type="button" class="seg-btn${App.order === 'rating' ? ' on' : ''}" data-order="rating">⭐ Valoración</button>` : ''}
      </div>
      <label style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:var(--bg2);border:1px solid var(--line);border-radius:13px;font-size:.88rem;cursor:pointer;color:var(--txt);margin-top:6px">
        <input type="checkbox" id="autoTheme" style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer">
        <span>🌗 Tema automático (día/noche)</span>
      </label>
      <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;padding:8px 4px 0">📊 Datos</div>
      <button type="button" class="btn-row" data-act="history"><span>🕐</span><span>Historial de vistos (${seenCount})</span></button>
      <button type="button" class="btn-row" data-act="loans"><span>📚</span><span>Ver préstamos${prestados > 0 ? ` (${prestados})` : ''}</span></button>
      <button type="button" class="btn-row" data-act="export-json"><span>💾</span><span>Exportar JSON</span></button>
      <button type="button" class="btn-row" data-act="export-csv"><span>📊</span><span>Exportar CSV</span></button>
      <button type="button" class="btn-row" data-act="export-m3u"><span>🎵</span><span>Exportar M3U</span></button>
      <button type="button" class="btn-row" data-act="export-html"><span>🌐</span><span>Exportar HTML</span></button>
      <button type="button" class="btn-row" data-act="share-collection"><span>📤</span><span>Compartir colección como texto</span></button>
      <button type="button" class="btn-row" data-act="clean"><span>🧹</span><span>Limpiar caché ahora</span></button>
      <button type="button" class="btn-row" data-act="print"><span>🖨️</span><span>Imprimir vista actual</span></button>
      <button type="button" class="btn-row" data-act="legal"><span>⚖️</span><span>Términos y aviso legal</span></button>
      <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;padding:8px 4px 0">⚠️ Zona de peligro</div>
      <button type="button" class="btn-row danger" data-act="clear"><span>🗑️</span><span>Vaciar colección local</span></button>
      <div style="text-align:center;padding:20px 12px;font-size:.72rem;color:var(--muted);line-height:1.7;margin-top:10px;border-top:1px solid var(--line)">
        <div style="font-family:ui-monospace,monospace;font-weight:800;color:var(--accent);margin-bottom:6px">Discografía Viewer v${VERSION}</div>
        Visor de consulta · Datos desde la lista cargada<br>
        <span style="color:var(--ok);font-weight:600;margin-top:4px;display:inline-block">🔒 100% legal — No descarga ni aloja contenido</span><br>
        <span style="opacity:.7;margin-top:4px;display:inline-block">© 2024-${new Date().getFullYear()} HDSystem IT · +54 9 11 4563-0851</span>
      </div>
    </div>
    <style>
    .btn-row{padding:14px 16px;background:var(--bg2);border:1px solid var(--line);border-radius:13px;color:var(--txt);font-size:.88rem;font-weight:600;cursor:pointer;text-align:left;font-family:inherit;display:flex;align-items:center;gap:10px;transition:.15s;width:100%}
    .btn-row:active{transform:scale(.98);background:var(--bg3)}
    .btn-row.accent{background:rgba(79,195,247,.1);border-color:rgba(79,195,247,.4);color:var(--accent)}
    .btn-row.danger{color:#ffb3b3;border-color:rgba(255,107,107,.35)}
    .btn-row.danger:active{background:rgba(255,107,107,.12)}
    .seg-btn{flex:0 0 auto;padding:9px 12px;border-radius:10px;background:var(--bg2);border:1px solid var(--line);color:var(--muted);font-size:.76rem;font-weight:600;cursor:pointer;font-family:inherit;transition:.15s}
    .seg-btn.on{background:rgba(79,195,247,.18);border-color:var(--accent);color:var(--accent)}
    .seg-btn:active{transform:scale(.96)}
    </style>`;
  main.querySelectorAll('.btn-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.act;
      if (a === 'import') openImport();
      else if (a === 'sync') openSync();
      else if (a === 'sync-now') syncNow(true);
      else if (a === 'local-folder') openLocalFolder();
      else if (a === 'local-sync'){
        syncFromLocalFolder({ silent: false, force: true }).then(r => {
          if (r.ok && !r.unchanged) Toast.show(`✅ ${r.total} CDs desde ${r.file?.name}`, 'ok', 3500);
          else if (r.ok && r.unchanged) Toast.show('✓ Ya estás al día', 'info', 2000);
          else if (r.reason === 'needs-reselect'){ Toast.show('📂 Re-seleccioná la carpeta', 'info', 3000); openLocalFolder(); }
        });
      }
      else if (a === 'remote-urls') openRemoteUrls();
      else if (a === 'loans') openLoans();
      else if (a === 'history') openViewHistory();
      else if (a === 'export-json') exportJSON();
      else if (a === 'export-csv') exportCSV();
      else if (a === 'export-m3u') exportM3U();
      else if (a === 'export-html') exportHTML();
      else if (a === 'share-collection') shareFullCollection();
      else if (a === 'filters') openFilters();
      else if (a === 'theme') Theme.toggle();
      else if (a === 'print') window.print();
      else if (a === 'clear') clearCollection();
      else if (a === 'clean') manualCleanup();
      else if (a === 'legal') openLegal();
    });
  });
  main.querySelectorAll('.seg-btn[data-order]').forEach(btn => {
    btn.addEventListener('click', () => {
      App.order = btn.dataset.order;
      Prefs.set({ order: App.order });
      renderMore(main);
      Toast.show(`Ordenado por ${orderLabel()}`, 'ok', 1500);
    });
  });
  const at = $('#autoTheme');
  if (at){
    at.checked = AutoTheme.isEnabled();
    at.addEventListener('change', e => {
      AutoTheme.setEnabled(e.target.checked);
      Toast.show(e.target.checked ? '🌗 Tema automático activado' : '🎨 Tema automático desactivado', 'info', 2500);
    });
  }
}