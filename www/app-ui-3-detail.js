/* ═══════════════════════════════════════════════════════════════
   DISCOGRAFÍA VIEWER v7.3.0 — UI 3/4
   Detail · Lightbox · Import/Export · Command Palette
   Sync/LocalFolder/RemoteUrls modals · Legal
   Depende de: app-core-*.js, app-services-*.js, app-ui-1/2
   ═══════════════════════════════════════════════════════════════ */

function openDetail(cd){
  App.detailCD = cd;
  ViewHistory.push(cd);
  const cover = cd.portada ? `<img src="${esc(cd.portada)}" alt="Portada" id="detCover" onerror="this.outerHTML='<div class=\\'ph\\'>💿</div>'">` : `<div class="ph">💿</div>`;
  const secs = [];
  const ed = [['Formato', cd.formato],['Año álbum', cd.anio ? String(cd.anio) : ''],['Año edición', cd.anioEdicion ? String(cd.anioEdicion) : ''],['Sello', cd.sello],['Género', cd.genero],['Nº catálogo', cd.catalogo],['Código barras', cd.codigo],['ISRC', cd.isrc],['Edición', cd.edicion],['País', cd.pais]].filter(([, val]) => val);
  if (ed.length) secs.push({ t: '📀 Edición', c: ed });
  const fis = [['Estado general', cd.estado], ['Disco', cd.estadoDisco], ['Caja', cd.estadoCaja], ['Folleto', cd.estadoFolleto], ['Arte', cd.estadoArte]].filter(([, val]) => val);
  if (fis.length) secs.push({ t: '🔍 Estado físico', c: fis });
  const ubi = [['Ubicación', cd.ubicacion], ['Cantidad', cd.cantidad > 1 ? cd.cantidad : null], ['Fecha ingreso', cd.adquisicion], ['Valor', cd.valor != null ? `${cd.moneda || 'ARS'} ${Number(cd.valor).toLocaleString('es-AR')}` : null]].filter(([, val]) => val);
  if (ubi.length) secs.push({ t: '📍 Ubicación y valor', c: ubi });
  if (Loans.isLoaned(cd)){
    const pr = [['Prestado a', cd.prestadoA], ['Fecha préstamo', cd.fechaPrestamo], ['Fecha devolución', cd.fechaDevolucion], ['Notas', cd.notasPrestamo]].filter(([, val]) => val);
    secs.push({ t: '📚 Préstamo', c: pr, loan: true, overdue: Loans.isOverdue(cd) });
  }
  const cf = cd.customFields || {};
  const cfVals = [];
  for (const key in cf){ if (cf[key] !== '' && cf[key] != null) cfVals.push([CustomFields.label(key), cf[key]]); }
  if (cfVals.length) secs.push({ t: '📝 Personalizados', c: cfVals });
  const galImgs = [];
  if (cd.imagenes){
    const labels = { frontal: 'Frontal', trasera: 'Trasera', interior: 'Interior', disco: 'Disco', libreto: 'Libreto' };
    for (const k of ['frontal', 'trasera', 'interior', 'disco', 'libreto']){ if (cd.imagenes[k]) galImgs.push({ key: k, url: cd.imagenes[k], label: labels[k] }); }
  }
  const galHTML = galImgs.length > 1 ? `<div class="sec"><div class="sec-h">🖼️ Galería</div><div class="gallery">${galImgs.map(g => `<div class="gal-item" data-gal="${esc(g.url)}" data-gal-lbl="${esc(g.label)}"><img src="${esc(g.url)}" alt="${esc(g.label)}" loading="lazy" onerror="this.parentElement.style.display='none'"><span class="lbl">${esc(g.label)}</span></div>`).join('')}</div></div>` : '';
  const ratingHTML = cd.rating > 0 ? `<div class="sec"><div class="sec-h">⭐ Valoración</div><div class="det-rate">${'★'.repeat(cd.rating)}${'☆'.repeat(5 - cd.rating)}</div></div>` : '';
  const favLocal = LocalFavs.has(cd.id);
  const favHTML = (cd.favorito || favLocal) ? `<div class="sec"><div class="sec-h">⭐ Favorito</div><div style="color:var(--accent2);font-size:.9rem">★ ${cd.favorito ? 'Marcado como favorito en el origen' : 'Marcado localmente'}</div></div>` : '';
  const tagsHTML = (cd.tags && cd.tags.length) ? `<div class="sec"><div class="sec-h">🏷️ Etiquetas</div><div class="det-tags">${cd.tags.map(t => `<span class="det-tag">#${esc(t)}</span>`).join('')}</div></div>` : '';
  const enrichHTML = cd.enrichmentSource ? `<div style="padding:10px 14px;background:rgba(79,195,247,.06);border-left:3px solid var(--accent);border-radius:8px;font-size:.72rem;color:var(--muted);margin-bottom:14px">📌 Fuente: <b style="color:var(--accent)">${esc(cd.enrichmentSource)}</b>${cd.enrichmentConfidence != null ? ` · <b>${cd.enrichmentConfidence}%</b>` : ''}</div>` : '';
  $('#detTitle').textContent = cd.titulo || 'Detalles';
  $('#detBody').innerHTML = `
    <div class="det-hero">
      ${cover}
      <div class="h-txt">
        <div class="h-t">${(cd.favorito || favLocal) ? '★ ' : ''}${esc(cd.titulo || '—')}</div>
        ${cd.interprete ? `<div class="h-a" id="detArtChip">🎤 ${esc(cd.interprete)} ›</div>` : ''}
        <div class="h-m">
          <div class="n">Nº<b>${cd.nro ?? '—'}</b></div>
          <div>Año álbum<b>${cd.anio ?? '—'}</b></div>
          ${cd.anioEdicion ? `<div class="ed">Año edición<b>${cd.anioEdicion}</b></div>` : ''}
        </div>
        <div class="det-actions">
          <button type="button" class="det-act" id="detShare">📤 Texto</button>
          <button type="button" class="det-act" id="detShareImg">🖼️ Imagen</button>
          <button type="button" class="det-act" id="detSimilar">🎵 Similares</button>
          <button type="button" class="det-act" id="detFavLocal">${favLocal ? '★ Favorito local' : '⭐ Favorito local'}</button>
          ${cd.discogsId ? `<a class="det-act" href="https://www.discogs.com/release/${esc(cd.discogsId)}" target="_blank" rel="noopener">🔗 Discogs</a>` : ''}
        </div>
      </div>
    </div>
    ${renderStreamingSection(cd)}
    ${enrichHTML}
    ${ratingHTML}
    ${favHTML}
    ${tagsHTML}
    ${galHTML}
    ${secs.map(s => `
      <div class="sec">
        <div class="sec-h">${esc(s.t)}</div>
        ${s.loan ? `<div style="padding:11px 13px;background:${s.overdue ? 'rgba(255,107,107,.08)' : 'rgba(255,169,77,.08)'};border-left:4px solid ${s.overdue ? 'var(--danger)' : 'var(--warn)'};border-radius:10px;margin-bottom:10px;font-size:.78rem;color:${s.overdue ? 'var(--danger)' : 'var(--warn)'};font-weight:600">${s.overdue ? '⚠️ VENCIDO' : '📤 En préstamo'}</div>` : ''}
        <div class="sec-grid">${s.c.map(([k, val]) => `<div class="fld${String(val).length > 30 ? ' wide' : ''}"><span class="k">${esc(k)}</span><span class="v">${esc(String(val))}</span></div>`).join('')}</div>
      </div>`).join('')}
    ${cd.notas ? `<div class="sec"><div class="sec-h">📝 Observaciones</div><div class="notas">${esc(cd.notas)}</div></div>` : ''}
  `;
  const modal = $('#detModal');
  modal.classList.add('on');
  document.body.style.overflow = 'hidden';
  wireStreamingSectionEvents();
  const img = $('#detCover');
  if (img){
    img.addEventListener('click', () => LB.open(cd.portada, `${cd.titulo} — ${cd.interprete}`));
    initHeroParallax();
    initPinchZoom();
    if (cd.portada){
      extractDominantColor(cd.portada).then(color => {
        if (color){
          const md = modal.querySelector('.md');
          md.style.background = `linear-gradient(180deg, ${color}22 0%, var(--bg2) 40%)`;
        }
      });
    }
  }
  $('#detBody').querySelectorAll('.gal-item').forEach(el => {
    el.addEventListener('click', () => LB.open(el.dataset.gal, `${cd.titulo} — ${el.dataset.galLbl || ''}`));
  });
  const streamSection = $('#detBody .stream-section');
  if (streamSection) wireStreamingSectionEvents(streamSection, cd);
  $('#detArtChip')?.addEventListener('click', () => { closeDetail(); setTimeout(() => setArtistFilter(cd.interprete), 200); });
  $('#detShare')?.addEventListener('click', () => shareCD(cd));
  $('#detShareImg')?.addEventListener('click', () => shareAsImage(cd));
  $('#detSimilar')?.addEventListener('click', () => openSimilar(cd));
  $('#detFavLocal')?.addEventListener('click', () => {
    const added = LocalFavs.toggle(cd.id);
    Toast.show(added ? '⭐ Agregado a favoritos locales' : '☆ Quitado', added ? 'ok' : 'info', 2000);
    $('#detFavLocal').textContent = added ? '★ Favorito local' : '⭐ Favorito local';
  });
}

function closeDetail(){
  $('#detModal').classList.remove('on');
  document.body.style.overflow = '';
  const md = $('#detModal .md');
  if (md) md.style.background = '';
}

function initHeroParallax(){
  const body = $('#detBody');
  const hero = body?.querySelector('.det-hero');
  if (!hero) return;
  const cover = hero.querySelector('img, .ph');
  if (!cover) return;
  body.addEventListener('scroll', () => {
    const scroll = body.scrollTop;
    const scale = Math.max(0.6, 1 - scroll / 500);
    const opacity = Math.max(0.3, 1 - scroll / 400);
    cover.style.transform = `scale(${scale})`;
    cover.style.opacity = opacity;
  }, { passive: true });
}

function initPinchZoom(){
  const img = $('#detCover');
  if (!img) return;
  let scale = 1;
  let lastDist = 0;
  img.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2){
      lastDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });
  img.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2){
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      scale = Math.max(1, Math.min(3, scale * (dist / lastDist)));
      lastDist = dist;
      img.style.transform = `scale(${scale})`;
      img.style.transition = 'none';
    }
  }, { passive: false });
  img.addEventListener('touchend', () => {
    if (scale < 1.1){
      scale = 1;
      img.style.transform = '';
      img.style.transition = 'transform .3s ease';
    }
  });
}

async function shareCD(cd){
  const lines = [`💿 ${cd.titulo || '—'}`];
  if (cd.interprete) lines.push(`🎤 ${cd.interprete}`);
  if (cd.anio) lines.push(`📅 Álbum: ${cd.anio}`);
  if (cd.anioEdicion) lines.push(`📅 Edición: ${cd.anioEdicion}`);
  if (cd.sello) lines.push(`🏢 ${cd.sello}`);
  if (cd.formato) lines.push(`📀 ${cd.formato}`);
  if (cd.ubicacion) lines.push(`📍 ${cd.ubicacion}`);
  if (cd.links && cd.links.spotify && isSafeStreamUrl(cd.links.spotify)) lines.push(`🟢 Spotify: ${cd.links.spotify}`);
  if (cd.links && cd.links.youtube && isSafeStreamUrl(cd.links.youtube)) lines.push(`🔴 YouTube: ${cd.links.youtube}`);
  const text = lines.join('\n');
  const title = `${cd.titulo || 'CD'} — ${cd.interprete || ''}`;
  if (navigator.share){
    try { await navigator.share({ title, text }); return; }
    catch(e){ if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(text); Toast.show('📋 Copiado', 'ok', 2200); }
  catch(e){ prompt('Copiá manualmente:', text); }
}

async function shareAsImage(cd){
  if (!cd) return;
  try {
    const canvas = document.createElement('canvas');
    const W = 1080, H = 1080;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0e1116');
    grad.addColorStop(0.5, '#151a22');
    grad.addColorStop(1, '#1c232e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(79,195,247,.3)';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, W - 80, H - 80);
    let coverImg = null;
    if (cd.portada){
      try { coverImg = await loadImage(cd.portada); } catch(e){}
    }
    const coverSize = 500;
    const coverX = (W - coverSize) / 2;
    const coverY = 140;
    ctx.shadowColor = 'rgba(79,195,247,.5)';
    ctx.shadowBlur = 60;
    ctx.fillStyle = '#1c232e';
    ctx.fillRect(coverX - 4, coverY - 4, coverSize + 8, coverSize + 8);
    ctx.shadowBlur = 0;
    if (coverImg){
      ctx.drawImage(coverImg, coverX, coverY, coverSize, coverSize);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      ctx.fillRect(coverX, coverY, coverSize, coverSize);
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.font = '180px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💿', W/2, coverY + coverSize/2);
    }
    ctx.fillStyle = '#e6ebf2';
    ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const title = (cd.titulo || '—').toUpperCase();
    wrapText(ctx, title, W/2, coverY + coverSize + 50, W - 160, 60, 2);
    ctx.fillStyle = '#8b97a8';
    ctx.font = '36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const artist = (cd.interprete || '—').toUpperCase();
    wrapText(ctx, artist, W/2, coverY + coverSize + 190, W - 160, 44, 2);
    ctx.fillStyle = 'rgba(79,195,247,.9)';
    ctx.font = 'bold 28px ui-monospace, monospace';
    const info = [];
    if (cd.anio) info.push(`📅 ${cd.anio}`);
    if (cd.anioEdicion) info.push(`📅 Ed. ${cd.anioEdicion}`);
    if (cd.sello) info.push(`🏢 ${cd.sello}`);
    const infoText = info.join('   ·   ');
    if (infoText) ctx.fillText(infoText, W/2, coverY + coverSize + 300);
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.font = '22px -apple-system, sans-serif';
    ctx.fillText('Discografía Viewer', W/2, H - 100);
    ctx.fillStyle = 'rgba(93,220,154,.5)';
    ctx.font = '18px ui-monospace, monospace';
    ctx.fillText('🔒 Solo consulta · No descarga contenido', W/2, H - 70);
    canvas.toBlob(async (blob) => {
      const file = new File([blob], `discografia_${cd.id}.png`, { type: 'image/png' });
      const text = `💿 ${cd.titulo || '—'} — ${cd.interprete || '—'}`;
      const title = cd.titulo || 'CD';
      if (navigator.canShare && navigator.canShare({ files: [file] })){
        try { await navigator.share({ files: [file], title, text }); Toast.show('✅ Compartido', 'ok', 2000); return; }
        catch(e){ if (e.name === 'AbortError') return; }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = file.name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
      Toast.show('📥 Imagen descargada', 'ok', 2500);
    }, 'image/png');
  } catch(err){
    console.error('[shareAsImage]', err);
    Toast.show('❌ ' + err.message, 'err', 4000);
  }
}

function openSimilar(cd){
  const similar = findSimilar(cd);
  if (!similar.length){ Toast.show('Sin resultados similares', 'info', 2000); return; }
  const body = $('#moreBody');
  body.innerHTML = `
    <button type="button" class="btn-row" id="simBack" style="margin-bottom:12px">← Volver</button>
    <div style="font-size:.78rem;color:var(--muted);margin-bottom:12px;padding:8px 12px;background:rgba(167,139,250,.08);border-left:3px solid var(--purple);border-radius:8px">
      🎵 CDs similares a <b>${esc(cd.titulo)}</b>
    </div>
    ${similar.map(c => `
      <div class="card" data-id="${esc(c.id)}" style="margin-bottom:8px">
        ${c.portada ? `<img class="cover" src="${esc(c.portada)}" alt="">` : `<div class="ph">💿</div>`}
        <div class="info">
          <div class="title">${esc(c.titulo)}</div>
          <div class="artist">${esc(c.interprete)}</div>
          <div class="meta"><span class="nro">#${c.nro}</span>${c.anio ? `<b>${c.anio}</b>` : ''}${c.genero ? `<span>${esc(c.genero)}</span>` : ''}</div>
        </div>
        <span class="arrow">›</span>
      </div>
    `).join('')}
  `;
  $('#moreModal').classList.add('on');
  body.querySelector('#simBack')?.addEventListener('click', () => renderMore(body));
  body.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', () => {
      const target = findCDById(el.dataset.id);
      if (target){ closeMore(); setTimeout(() => openDetail(target), 150); }
    });
  });
}

const LB = (() => {
  function open(url, title){
    if (!url) return;
    $('#lbImg').src = url;
    $('#lbInfo').textContent = title || '';
    $('#lbIdx').textContent = '1 / 1';
    $('#lb').classList.add('on');
  }
  function close(){ $('#lb').classList.remove('on'); $('#lbImg').src = ''; }
  return { open, close };
})();

function openImport(){ $('#impModal').classList.add('on'); }
function closeImport(){ $('#impModal').classList.remove('on'); }
function openPaste(){ $('#pasteArea').value = ''; $('#pasteModal').classList.add('on'); }
function closePaste(){ $('#pasteModal').classList.remove('on'); }
function openUrl(){ $('#urlInput').value = ''; $('#urlModal').classList.add('on'); }
function closeUrl(){ $('#urlModal').classList.remove('on'); }
function openMore(){ renderMore($('#moreBody')); $('#moreModal').classList.add('on'); }
function closeMore(){ $('#moreModal').classList.remove('on'); }
function openSync(){
  $('#syncWebAppInput').value = Sync.getWebAppUrl();
  $('#syncAuto').checked = Sync.isAuto();
  renderSyncStatus();
  $('#syncModal').classList.add('on');
}
function closeSync(){ $('#syncModal').classList.remove('on'); }
function renderSyncStatus(){
  const box = $('#syncStatusBox');
  if (!Sync.isConfigured()){ box.innerHTML = ''; return; }
  const info = Sync.getInfo();
  const lastRef = info.lastSync || 0;
  const lastFile = info.lastFileName ? `<br><span style="font-size:.7rem;opacity:.8">Último: ${esc(info.lastFileName)}</span>` : '';
  box.innerHTML = `<div class="sync-status ok"><span>✅</span><div><b>Configurado</b><br>Última sync: ${lastRef ? esc(fmtRel(lastRef)) : 'nunca'}${lastFile}</div></div>`;
}

function openFilters(){
  const f = App.filters;
  $('#flEstado').value = f.estado; $('#flFormato').value = f.formato;
  $('#flAnioD').value = f.anioD; $('#flAnioH').value = f.anioH;
  $('#flUbic').value = f.ubic; $('#flPort').value = f.port; $('#flPres').value = f.pres;
  const fls = $('#flStream'); if (fls) fls.value = f.stream || '';
  $('#flFav').checked = !!f.fav;
  const flu = $('#flUnseen'); if (flu) flu.checked = !!f.unseen;
  $('#flRatingWrap').style.display = Store.hasAnyRatings() ? '' : 'none';
  $('#flFavWrap').style.display = Store.hasAnyFavs() ? '' : 'none';
  $('#flRating').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === (f.rating || '')));
  $('#filtModal').classList.add('on');
}
function closeFilters(){ $('#filtModal').classList.remove('on'); }

function openLoans(){
  const all = Store.allCDs().filter(Loans.isLoaned);
  if (!all.length){ Toast.show('No hay CDs prestados', 'info', 2000); return; }
  all.sort((a, b) => (a.fechaDevolucion || '9999').localeCompare(b.fechaDevolucion || '9999'));
  const body = $('#moreBody');
  body.innerHTML = `
    <button type="button" class="btn-row" id="loansBack" style="margin-bottom:12px">← Volver</button>
    <div style="font-size:.78rem;color:var(--muted);margin-bottom:12px;padding:8px 12px;background:rgba(255,169,77,.08);border-left:3px solid var(--warn);border-radius:8px">${all.length} CD${all.length === 1 ? '' : 's'} en préstamo</div>
    ${all.map(cd => {
      const ov = Loans.isOverdue(cd);
      return `<div class="card" data-id="${esc(cd.id)}" style="margin-bottom:8px">${cd.portada ? `<img class="cover" src="${esc(cd.portada)}" alt="">` : `<div class="ph">💿</div>`}<div class="info"><div class="title">${esc(cd.titulo)}</div><div class="artist">${esc(cd.interprete)}</div><div class="meta"><span class="nro">#${cd.nro}</span>${cd.prestadoA ? `<span>👤 ${esc(cd.prestadoA)}</span>` : ''}${cd.fechaDevolucion ? `<span style="${ov ? 'color:var(--danger);font-weight:700' : ''}">📅 ${esc(cd.fechaDevolucion)}${ov ? ' ⚠️' : ''}</span>` : ''}</div></div><span class="arrow">›</span></div>`;
    }).join('')}
  `;
  $('#moreModal').classList.add('on');
  body.querySelector('#loansBack')?.addEventListener('click', () => renderMore(body));
  body.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', () => {
      const cd = findCDById(el.dataset.id);
      if (cd){ closeMore(); setTimeout(() => openDetail(cd), 150); }
    });
  });
}

function openViewHistory(){
  const items = ViewHistory.list();
  const body = $('#moreBody');
  body.innerHTML = `
    <button type="button" class="btn-row" id="vhBack" style="margin-bottom:12px">← Volver</button>
    <div style="font-size:.78rem;color:var(--muted);margin-bottom:12px;padding:8px 12px;background:rgba(79,195,247,.08);border-left:3px solid var(--accent);border-radius:8px">${items.length} CD${items.length === 1 ? '' : 's'} visto${items.length === 1 ? '' : 's'} recientemente</div>
    ${items.length ? items.map(it => `
      <div class="card" data-id="${esc(it.id)}" style="margin-bottom:8px">
        ${it.portada ? `<img class="cover" src="${esc(it.portada)}" alt="">` : `<div class="ph">💿</div>`}
        <div class="info">
          <div class="title">${esc(it.titulo)}</div>
          <div class="artist">${esc(it.interprete)}</div>
          <div class="meta"><span>${it.anio || '—'}</span><span>${esc(fmtRel(it.ts))}</span></div>
        </div>
        <span class="arrow">›</span>
      </div>
    `).join('') : '<div class="empty" style="padding:30px"><div class="ic">🕐</div><p>Sin historial</p></div>'}
    ${items.length ? `<button type="button" class="btn-row danger" id="vhClear" style="margin-top:12px">🗑️ Limpiar historial</button>` : ''}
  `;
  $('#moreModal').classList.add('on');
  body.querySelector('#vhBack')?.addEventListener('click', () => renderMore(body));
  body.querySelector('#vhClear')?.addEventListener('click', () => {
    if (!confirm('¿Limpiar historial?')) return;
    ViewHistory.clear();
    Toast.show('Historial limpiado', 'warn', 2000);
    renderMore(body);
  });
  body.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', () => {
      const cd = findCDById(el.dataset.id);
      if (cd){ closeMore(); setTimeout(() => openDetail(cd), 150); }
    });
  });
}

function openLocalFolder(){
  const name = LocalFolder.getName();
  const info = LocalFolder.getInfo();
  const lastRef = info.lastSync || 0;
  const lastFile = info.lastFileName || '—';
  const mode = LocalFolder.getMode();
  const modeBadge = $('#lfModeBadge');
  const browserNote = $('#lfBrowserNote');
  if (modeBadge){
    const modeDescriptions = {
      'fsa':       '🟢 <b>Modo completo</b> — File System Access API. La carpeta se recuerda y auto-sincroniza sin pedir permiso cada vez.',
      'webkitdir': '🟡 <b>Modo carpeta (sesión)</b> — Permite seleccionar carpeta completa, pero requiere re-seleccionarla cada vez.',
      'files':     '🟠 <b>Modo archivos</b> — Solo permite seleccionar archivos individuales.',
      'none':      '🔴 <b>Sin soporte</b> — Este navegador no permite acceso a archivos locales.'
    };
    modeBadge.innerHTML = modeDescriptions[mode] || modeDescriptions['none'];
  }
  if (browserNote){
    if (mode === 'webkitdir' || mode === 'files'){
      browserNote.style.display = 'block';
      browserNote.innerHTML = `💡 <b>Tip:</b> En iOS/Firefox el acceso a carpetas no persiste. Usá <b>Google Drive</b> o <b>URLs remotas</b> como fuente principal.`;
    } else {
      browserNote.style.display = 'none';
    }
  }
  $('#lfCurrentName').textContent = name || '— Sin configurar —';
  $('#lfLastFile').textContent = lastFile;
  $('#lfLastSync').textContent = lastRef ? fmtRel(lastRef) : 'nunca';
  $('#lfAuto').checked = LocalFolder.isAuto();
  $('#lfInfo').style.display = name ? '' : 'none';
  const label = LocalFolder.modeLabel(mode);
  $('#lfStatus').innerHTML = name
    ? `<div class="sync-status ok"><span>✅</span><div><b>Carpeta activa</b><br>${esc(label)}</div></div>`
    : `<div class="sync-status warn"><span>⚙️</span><div><b>Sin configurar</b><br>Elegí la carpeta donde guardás los backups .json</div></div>`;
  $('#localFolderModal').classList.add('on');
}
function closeLocalFolder(){ $('#localFolderModal').classList.remove('on'); }

async function pickLocalFolder(){
  try {
    const result = await LocalFolder.pick();
    Toast.show(`📂 ${result.name}`, 'ok', 3000);
    closeLocalFolder();
    const r = await syncFromLocalFolder({ silent: false, force: true });
    if (r.ok && !r.unchanged) Toast.show(`✅ Cargados ${r.total} CDs desde ${r.file?.name}`, 'ok', 4000);
    else if (r.ok && r.unchanged) Toast.show('✓ Ya estás al día', 'info', 2200);
  } catch(err){
    if (err.name === 'AbortError') return;
    if (/cancel/i.test(err.message)) return;
    Toast.show('⚠️ ' + err.message, 'err', 5000);
  }
}

async function clearLocalFolder(){
  if (!confirm('¿Olvidar la carpeta configurada?')) return;
  await LocalFolder.clear();
  Toast.show('Carpeta olvidada', 'warn', 3000);
  closeLocalFolder();
  renderMore($('#moreBody'));
}

async function syncLocalNow(){
  const btn = $('#lfSyncNow');
  if (btn){ btn.disabled = true; btn.textContent = '⏳ Sincronizando…'; }
  try {
    const r = await syncFromLocalFolder({ silent: false, force: true });
    if (r.ok && !r.unchanged){ Toast.show(`✅ ${r.total} CDs`, 'ok', 3500); closeLocalFolder(); renderMore($('#moreBody')); }
    else if (r.ok && r.unchanged) Toast.show('✓ Ya estás al día', 'info', 2200);
  } finally {
    if (btn){ btn.disabled = false; btn.textContent = '🔄 Sincronizar ahora'; }
  }
}

async function syncFromLocalFolder(opts = {}){
  const { silent = false, force = false } = opts;
  if (!LocalFolder.isConfigured()){
    if (!silent) Toast.show('📁 Configurá una carpeta primero', 'warn', 3000);
    return { ok: false, reason: 'no-folder' };
  }
  const r = await LocalFolder.sync({ force, silent });
  if (!r.ok && r.reason === 'needs-reselect') return r;
  if (!r.ok){
    if (!silent){
      const msgs = {
        'no-folder':   '📁 No hay carpeta configurada',
        'no-files':    '📭 La carpeta no tiene archivos .json',
        'permission':  '🔐 Necesitás autorizar la carpeta',
        'json-error':  '❌ El .json tiene errores de sintaxis',
        'invalid-format': '❌ El .json no es un backup válido',
        'read-error':  '❌ No se pudo leer el archivo'
      };
      Toast.show(msgs[r.reason] || '⚠️ Error al leer la carpeta', 'warn', 5000);
    }
    return r;
  }
  if (r.unchanged){
    if (!silent) Toast.show('✓ Ya estás al día', 'info', 2000);
    return r;
  }
  App.cat = ALL_CATS;
  App.artista = null;
  App.q = '';
  App.filters = { estado:'', formato:'', anioD:'', anioH:'', ubic:'', port:'', pres:'', rating:'', fav:false, stream:'', unseen:false };
  const qEl = $('#q'); if (qEl) qEl.value = '';
  $('#searchBox')?.classList.remove('has','adv-mode');
  App.tab = 'list';
  Prefs.set({ cat: App.cat, tab: App.tab });
  renderAll();
  return r;
}

function openRemoteUrls(){ renderRemoteList(); $('#remoteUrlModal').classList.add('on'); }
function closeRemoteUrls(){ $('#remoteUrlModal').classList.remove('on'); }
function renderRemoteList(){
  const items = RemoteUrls.list();
  const host = $('#ruList');
  if (!items.length){
    host.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:.82rem;background:rgba(255,255,255,.02);border-radius:10px;border:1px solid var(--line)">Sin URLs configuradas</div>`;
    return;
  }
  host.innerHTML = items.map(it => {
    const lastUsedTxt = it.lastUsed ? fmtRel(it.lastUsed) : 'nunca';
    return `<div class="backup-item" style="margin-bottom:6px">
      <div class="b-icon">🔗</div>
      <div class="b-info">
        <div class="b-name" title="${esc(it.url)}">${esc(it.name)}</div>
        <div class="b-date">Última: ${esc(lastUsedTxt)}</div>
        <div class="b-size" style="word-break:break-all;font-size:.62rem;opacity:.7">${esc(it.url.slice(0, 45))}${it.url.length > 45 ? '…' : ''}</div>
      </div>
      <div style="display:flex;gap:4px;flex-direction:column">
        <button class="b-load" data-ru-load="${esc(it.id)}" style="padding:6px 10px;font-size:.7rem">⬇️ Cargar</button>
        <button class="b-load" data-ru-del="${esc(it.id)}" style="padding:6px 10px;font-size:.7rem;background:rgba(255,107,107,.15);border-color:rgba(255,107,107,.4);color:#ffb3b3">🗑️</button>
      </div>
    </div>`;
  }).join('');
  host.querySelectorAll('[data-ru-load]').forEach(btn => {
    btn.addEventListener('click', () => loadRemoteUrl(btn.dataset.ruLoad));
  });
  host.querySelectorAll('[data-ru-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('¿Eliminar esta URL?')) return;
      RemoteUrls.remove(btn.dataset.ruDel);
      renderRemoteList();
      Toast.show('URL eliminada', 'warn', 2000);
    });
  });
}

async function loadRemoteUrl(id){
  const items = RemoteUrls.list();
  const item = items.find(i => i.id === id);
  if (!item) return;
  const btn = document.querySelector(`[data-ru-load="${id}"]`);
  if (btn){ btn.disabled = true; btn.textContent = '⏳'; }
  try {
    const data = await RemoteUrls.fetchUrl(item);
    const hash = RemoteUrls.quickHash(JSON.stringify(data));
    if (hash === item.lastHash){
      Toast.show('✓ Sin cambios desde la última carga', 'info', 2500);
      RemoteUrls.touch(id, hash);
      renderRemoteList();
      return;
    }
    importData(data, { skipConfirm: true });
    RemoteUrls.touch(id, hash);
    renderRemoteList();
    Toast.show(`✅ Cargado desde ${item.name}`, 'ok', 3000);
    closeRemoteUrls();
  } catch(err){
    Toast.show('❌ ' + err.message, 'err', 5000);
  } finally {
    if (btn){ btn.disabled = false; btn.textContent = '⬇️ Cargar'; }
  }
}

async function testRemoteUrl(){
  const url = $('#ruUrl').value.trim();
  if (!url){ Toast.show('Ingresá una URL', 'warn'); return; }
  const btn = $('#ruTest');
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳ Probando…';
  try {
    const data = await RemoteUrls.fetchUrl({ url });
    const total = data.categories
      ? Object.values(data.categories).reduce((s, c) => s + (c.cds?.length || 0), 0)
      : (Array.isArray(data.cds) ? data.cds.length : 0);
    Toast.show(`✅ URL válida · ${total} CDs`, 'ok', 4000);
  } catch(err){
    Toast.show('❌ ' + err.message, 'err', 5000);
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}

async function autoLoadRemoteUrl(){
  const items = RemoteUrls.list();
  if (!items.length) return false;
  const sorted = items.slice().sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
  const latest = sorted[0];
  if (!latest.lastUsed) return false;
  if (Date.now() - latest.lastUsed < 5 * 60 * 1000) return false;
  try {
    const data = await RemoteUrls.fetchUrl(latest);
    const hash = RemoteUrls.quickHash(JSON.stringify(data));
    if (hash === latest.lastHash){
      RemoteUrls.touch(latest.id, hash);
      return true;
    }
    importData(data, { skipConfirm: true, silent: true });
    RemoteUrls.touch(latest.id, hash);
    Toast.show(`📥 Actualizado desde ${latest.name}`, 'ok', 3500);
    return true;
  } catch(err){
    console.warn('[RemoteUrls] Auto-load falló:', err.message);
    return false;
  }
}

async function openBackups(){ $('#backupsModal').classList.add('on'); await loadBackupsList(); }
function closeBackups(){ $('#backupsModal').classList.remove('on'); }
async function loadBackupsList(){
  const body = $('#backupsBody');
  if (!Sync.isConfigured()){ body.innerHTML = `<div class="sync-status warn"><span>⚙️</span><div>Configurá la sincronización primero.</div></div>`; return; }
  const refreshTime = new Date().toLocaleTimeString('es-AR');
  body.innerHTML = `<div style="padding:30px 20px;text-align:center;color:var(--muted)">Cargando backups…</div>`;
  try {
    const files = await Sync.listBackups();
    const info = Sync.getInfo();
    const lastFileName = info.lastFileName || '';
    body.innerHTML = `
      <div style="padding:10px 12px;background:rgba(79,195,247,.08);border-left:4px solid var(--accent);border-radius:10px;font-size:.78rem;line-height:1.5;margin-bottom:12px">
        <b>${files.length}</b> archivo${files.length === 1 ? '' : 's'} .json · actualizado a las <b>${esc(refreshTime)}</b>
      </div>
      ${files.map((f, idx) => {
        const isCurrent = f.name === lastFileName;
        const isNewest  = idx === 0;
        const ts = f._nameTs || f._modTs;
        const tsLabel = f._nameTs ? new Date(f._nameTs).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : new Date(f._modTs).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
        return `<div class="backup-item${isCurrent ? ' current' : ''}">
          <div class="b-icon">${isCurrent ? '⭐' : isNewest ? '🏆' : '📄'}</div>
          <div class="b-info">
            <div class="b-name" title="${esc(f.name)}">${esc(f.name)}</div>
            <div class="b-date">${esc(tsLabel)} · ${esc(fmtRel(ts))}</div>
            <div class="b-size">${fmtBytes(f.size ? parseInt(f.size, 10) : 0)}${isCurrent ? ' · Importado' : ''}${isNewest && !isCurrent ? ' · 🏆 Más nuevo' : ''}</div>
          </div>
          <button type="button" class="b-load" data-load-id="${esc(f.id)}" data-load-name="${esc(f.name)}" data-load-ts="${f._nameTs || f._modTs}">${isCurrent ? '🔁 Re-importar' : '⬇️ Cargar'}</button>
        </div>`;
      }).join('')}`;
    body.querySelectorAll('.b-load').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.loadId;
        const name = btn.dataset.loadName;
        const ts = parseInt(btn.dataset.loadTs, 10) || 0;
        if (!confirm(`¿Cargar "${name}"?`)) return;
        btn.disabled = true;
        btn.textContent = '⏳…';
        try {
          const data = await Sync.download(id);
          const fileObj = files.find(f => f.id === id);
          closeBackups();
          importData(data, { skipConfirm: true });
          Sync.setInfo({ ...Sync.getInfo(), lastSync: Date.now(), lastFileName: name, lastFileTs: ts, lastModified: fileObj?._modTs || Date.now() });
          renderFreshness();
          Toast.show(`✅ Cargado: ${name}`, 'ok', 3500);
        } catch(err){
          Toast.show('Error: ' + err.message, 'err', 5500);
          btn.disabled = false;
          btn.textContent = '⬇️ Cargar';
        }
      });
    });
  } catch(err){
    body.innerHTML = `
      <div class="sync-status err"><span>🚨</span><div><b>Error</b><br>${esc(err.message)}</div></div>
      <button type="button" id="backupsRetry" style="margin-top:12px;width:100%;padding:12px;border-radius:12px;background:rgba(79,195,247,.15);border:1px solid rgba(79,195,247,.4);color:var(--accent);font-weight:600;font-family:inherit;font-size:.88rem;cursor:pointer">🔄 Reintentar</button>
    `;
    $('#backupsRetry')?.addEventListener('click', loadBackupsList);
  }
}

let _syncing = false;
let _syncRetries = 0;
async function syncNow(interactive = false, force = false){
  if (!Sync.isConfigured()){ if (interactive){ Toast.show('Configurá la URL primero', 'warn', 3000); openSync(); } return; }
  if (_syncing){ if (interactive) Toast.show('⏳ Sincronización en curso', 'info', 2000); return; }
  _syncing = true;
  const guard = setTimeout(() => { _syncing = false; }, 45000);
  const badge = $('#freshBadge');
  if (badge) badge.innerHTML = `<span class="h-fresh sync">🔄 Sincronizando…</span>`;
  const btn = $('#btnSync');
  if (btn) btn.classList.add('spin');
  const wasEmpty = Store.isEmpty();
  if (wasEmpty) renderSkeleton(6);
  let failed = false;
  try {
    const { data, file, total } = await Sync.pullLatest();
    if (!data) throw new Error('El archivo está vacío');
    const info = Sync.getInfo();
    const lastFileName = info.lastFileName || '';
    const lastFileTs = info.lastFileTs || 0;
    const incomingNameTs = file._nameTs || 0;
    const incomingEffTs = file._effTs || file._modTs || 0;
    const nameChanged = incomingNameTs > 0 && file.name !== lastFileName;
    const tsAdvanced = incomingNameTs > 0 && incomingNameTs > lastFileTs;
    const noBaseline = lastFileTs === 0 && !lastFileName;
    const shouldImport = force || interactive || noBaseline || nameChanged || tsAdvanced;
    if (!shouldImport){
      Sync.setInfo({ ...info, lastSync: Date.now() });
      renderFreshness();
      if (interactive) Toast.show('✓ Ya estás al día', 'info', 2200);
      return;
    }
    importData(data, { silent: !interactive, skipConfirm: true });
    Sync.setInfo({ ...info, lastSync: Date.now(), lastFileName: file.name, lastFileTs: incomingNameTs || incomingEffTs, lastModified: file._modTs || 0 });
    renderFreshness();
    _syncRetries = 0;
    if (interactive) {
      const when = incomingNameTs ? new Date(incomingNameTs).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '';
      Toast.show(`✅ ${file.name}${when ? ` (${when})` : ''} · ${total} archivo${total === 1 ? '' : 's'}`, 'ok', 4000);
    }
  } catch(err){
    failed = true;
    if (wasEmpty) renderAll();
    console.warn('[Sync]', err);
    if (interactive) Toast.show('❌ ' + err.message, 'err', 7000);
    if (badge) badge.innerHTML = `<span class="h-fresh err" title="${esc(err.message)}">🚨 Error sync</span>`;
    if (navigator.onLine && _syncRetries < 3 && !interactive){
      _syncRetries++;
      const delay = Math.min(30000, 2000 * Math.pow(2, _syncRetries));
      setTimeout(() => syncNow(false), delay);
    }
  } finally {
    clearTimeout(guard);
    _syncing = false;
    if (btn) btn.classList.remove('spin');
    if (!failed) _syncRetries = 0;
  }
}

async function manualCleanup(){
  const result = await Storage.fullCleanup();
  renderMore($('#moreBody'));
  const lines = [];
  if (result.removed.length) lines.push(`🗑️ ${result.removed.length} clave${result.removed.length === 1 ? '' : 's'} eliminada${result.removed.length === 1 ? '' : 's'}`);
  if (result.swCount) lines.push(`📦 ${result.swCount} caché${result.swCount === 1 ? '' : 's'} SW`);
  if (result.freed > 0) lines.push(`✅ ${fmtBytes(result.freed)} liberados`);
  if (lines.length === 0) Toast.show('✨ Nada que limpiar', 'ok', 3000);
  else Toast.show(`🧹 ${lines.join(' · ')}`, 'ok', 5500);
}

function openLegal(force = false){
  const modal = $('#legalModal');
  if (!modal) return;
  if (legalAceptado() && !force){
    const chk = $('#legalAcepto');
    const btn = $('#legalAceptar');
    if (chk && btn){
      chk.checked = true;
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.textContent = '✓ Continuar';
    }
  } else {
    const chk = $('#legalAcepto');
    const btn = $('#legalAceptar');
    if (chk) chk.checked = false;
    if (btn){
      btn.disabled = true;
      btn.style.opacity = '.45';
      btn.style.cursor = 'not-allowed';
      btn.textContent = '✓ Aceptar y continuar';
    }
  }
  const vTag = $('#legalVersionTag');
  const dTag = $('#legalDateTag');
  if (vTag) vTag.textContent = 'v' + VERSION;
  if (dTag) dTag.textContent = new Date().toLocaleDateString('es-AR', { year:'numeric', month:'long', day:'numeric' });
  modal.classList.add('on');
  const body = $('#legalBody');
  if (body) body.scrollTop = 0;
}
function closeLegal(){
  const modal = $('#legalModal');
  if (modal) modal.classList.remove('on');
}
function legalAceptado(){
  try { return localStorage.getItem(LEGAL_NOTICE_KEY) === '1'; }
  catch(e){ return false; }
}
function legalSignature(){
  try {
    const raw = localStorage.getItem(LEGAL_SIGNATURE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e){ return null; }
}
async function firmarAceptacionLegal(){
  const payload = [
    'v' + VERSION,
    String(Date.now()),
    navigator.userAgent || '',
    location.origin || 'file://',
    navigator.language || '',
    String(screen.width) + 'x' + String(screen.height)
  ].join('|');
  try {
    if (window.crypto?.subtle?.digest){
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
      return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2,'0'))
        .join('');
    }
  } catch(e){
    console.warn('[legal] crypto.subtle no disponible:', e.message);
  }
  let h1 = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++){
    h1 ^= payload.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return 'fnv1a_' + h1.toString(16).padStart(8, '0');
}
async function aceptarLegal(){
  const chk = $('#legalAcepto');
  const btn = $('#legalAceptar');
  if (chk && !chk.checked){
    Toast.show('⚠️ Marcá la casilla primero', 'warn', 3000);
    return;
  }
  if (btn){
    btn.disabled = true;
    btn.textContent = '⏳ Registrando…';
  }
  const hash = await firmarAceptacionLegal();
  const firma = {
    hash,
    algo: hash.startsWith('fnv1a_') ? 'FNV-1a (fallback)' : 'SHA-256',
    version: VERSION,
    acceptedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    language: navigator.language || '',
    origin: location.origin || 'file://',
    screen: `${screen.width}x${screen.height}`,
    tz: (Intl.DateTimeFormat().resolvedOptions().timeZone) || ''
  };
  try {
    localStorage.setItem(LEGAL_NOTICE_KEY, '1');
    localStorage.setItem(LEGAL_SIGNATURE_KEY, JSON.stringify(firma));
    localStorage.setItem('discografia_legal_last_check', String(Date.now()));
  } catch(e){
    Toast.show('⚠️ No se pudo guardar la aceptación', 'warn', 4500);
  }
  closeLegal();
  if (btn){
    btn.disabled = false;
    btn.textContent = '✓ Aceptar y continuar';
  }
  Toast.show(`✅ Aviso aceptado · Firma: ${hash.slice(0, 12)}…`, 'ok', 3500);
  console.log(`%c[Legal] ✅ ${firma.algo} · ${hash}`, 'color:#5ddc9a;font-weight:600');
}
function exportLegalPDF(){
  const fecha = new Date().toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });
  const sig = legalSignature();
  const firmaTxt = sig
    ? `<div class="firma">
        <strong>🔐 Firma digital registrada</strong><br>
        Algoritmo: <code>${esc(sig.algo || 'SHA-256')}</code><br>
        Hash: <code>${esc(sig.hash)}</code><br>
        Aceptado: ${esc(new Date(sig.acceptedAt).toLocaleString('es-AR', { dateStyle:'long', timeStyle:'short' }))}<br>
        Versión: <code>${esc(sig.version)}</code>
      </div>`
    : `<div class="firma" style="background:#fff3cd;border:1px solid #ffca28"><strong>⚠️ Sin firma registrada</strong></div>`;
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Aviso Legal — Discografía Viewer v${VERSION}</title>
<style>@page{size:A4;margin:20mm}body{font-family:system-ui,sans-serif;color:#1a2332;line-height:1.7;max-width:720px;margin:0 auto;padding:24px}h1{color:#1976d2}.firma{margin-top:30px;padding:14px;background:#f0f4f8;border-radius:8px;font-family:ui-monospace,monospace;font-size:12px;word-break:break-all;line-height:1.8;border-left:4px solid #1976d2}</style>
</head><body>
<h1>⚖️ Aviso Legal — Discografía Viewer v${VERSION}</h1>
<p>Emitido: ${esc(fecha)}</p>
<p><strong>Discografía Viewer</strong> es un <strong>visor personal de catálogo musical</strong>. NO descarga, NO aloja, NO transmite y NO distribuye música ni contenido protegido.</p>
${firmaTxt}
<div style="margin-top:40px;text-align:center"><button onclick="window.print()" style="padding:12px 24px;border-radius:10px;border:1px solid #1976d2;background:#1976d2;color:#fff;cursor:pointer">🖨️ Guardar como PDF</button></div>
<p style="margin-top:40px;padding-top:20px;border-top:1px solid #ddd;text-align:center;font-size:.75rem;color:#5a6b7f">© 2024-${new Date().getFullYear()} HDSystem IT · +54 9 11 4563-0851</p>
</body></html>`;
  const win = window.open('', '_blank');
  if (!win){ Toast.show('⚠️ Permitir ventanas emergentes', 'warn', 4000); return; }
  win.document.write(html);
  win.document.close();
  Toast.show('📄 Aviso legal abierto', 'ok', 3000);
}

function handleFiles(files){
  if (!files || !files.length){ Toast.show('Sin archivo', 'warn'); return; }
  const f = files[0];
  const name = String(f.name || '').toLowerCase();
  if (!name.endsWith('.json')){ if (!confirm(`"${f.name}" no es .json.\n\n¿Intentar leerlo igual?`)) return; }
  const r = new FileReader();
  r.onerror = () => Toast.show('No se pudo leer', 'err');
  r.onload = e => {
    const txt = String(e.target.result || '').replace(/^\uFEFF/, '').trim();
    if (!txt){ Toast.show('Archivo vacío', 'err', 4000); return; }
    const first = txt[0];
    if (first !== '{' && first !== '['){ Toast.show('No es JSON válido', 'err', 4500); return; }
    try { importData(JSON.parse(txt)); }
    catch(err){ Toast.show('JSON inválido: ' + err.message, 'err', 5500); }
  };
  r.readAsText(f, 'utf-8');
}

function importData(data, opts = {}){
  const silent = opts.silent === true;
  const skipConfirm = opts.skipConfirm === true;
  if (!data || typeof data !== 'object'){
    if (!silent) Toast.show('Formato no válido', 'err', 4500);
    return false;
  }
  if (Array.isArray(data.customFields)) CustomFields.mergeFromImport(data.customFields);
  if (!silent && !skipConfirm && !Store.isEmpty()){
    const ok = confirm('La importación reemplazará la copia LOCAL.\n\n¿Continuar?');
    if (!ok) return false;
  }
  let source;
  let summary = '';
  if (data.categories && typeof data.categories === 'object' && !Array.isArray(data.categories)){
    const keys = Object.keys(data.categories);
    if (!keys.length){ if (!silent) Toast.show('Lista vacía', 'warn', 4000); return false; }
    const total = keys.reduce((sum, k) => sum + (Array.isArray(data.categories[k]?.cds) ? data.categories[k].cds.length : 0), 0);
    source = data;
    summary = `${total} CDs · ${keys.length} categoría${keys.length === 1 ? '' : 's'}`;
  } else if (Array.isArray(data.cds)){
    if (!data.cds.length){ if (!silent) Toast.show('Categoría vacía', 'warn', 4000); return false; }
    const catKey = String(data.category || 'importada').trim() || 'importada';
    const label = String(data.label || catKey);
    const icon = String(data.icon || '📀');
    source = { ...data, categories: { [catKey]: { label, icon, cds: data.cds } } };
    summary = `${data.cds.length} CDs en "${label}"`;
  } else if (Array.isArray(data)){
    if (!data.length){ if (!silent) Toast.show('Lista vacía', 'warn', 4000); return false; }
    source = { categories: { importada: { label: 'Importada', icon: '📀', cds: data } } };
    summary = `${data.length} CDs`;
  } else if (data.titulo && (data.interprete || data.artist)){
    source = { categories: { importada: { label: 'Importada', icon: '📀', cds: [data] } } };
    summary = `"${String(data.titulo)}"`;
  } else {
    if (!silent) Toast.show('Formato no reconocido', 'err', 6000);
    return false;
  }
  Store.replaceAll(source);
  App.cat = ALL_CATS;
  App.artista = null;
  App.q = '';
  App.filters = { estado:'', formato:'', anioD:'', anioH:'', ubic:'', port:'', pres:'', rating:'', fav:false, stream:'', unseen:false };
  const qEl = $('#q'); if (qEl) qEl.value = '';
  $('#searchBox')?.classList.remove('has','adv-mode');
  closeImport(); closePaste(); closeUrl();
  App.tab = 'list';
  Sync.setInfo({ ...Sync.getInfo(), lastImport: Date.now() });
  renderAll();
  if (!silent) Toast.show(`✅ ${summary}`, 'ok', 3800);
  return true;
}

function exportJSON(){
  if (Store.isEmpty()){ Toast.show('Sin datos', 'warn'); return; }
  const base = JSON.parse(JSON.stringify(App.db || {}));
  const pl = {
    ...base,
    format: 'Discografía Viewer Backup',
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: VERSION,
    schemaVersion: DATA_SCHEMA_VERSION,
    exported: new Date().toISOString(),
    viewerOnly: true,
    categories: {}
  };
  for (const k of Store.catKeys()){
    pl.categories[k] = JSON.parse(JSON.stringify(Store.get(k)));
  }
  const cfIds = new Set();
  for (const cd of Store.allCDs()) for (const id in (cd.customFields || {})) cfIds.add(id);
  pl.customFields = [...cfIds].map(id => ({ id, name: CustomFields.label(id) }));
  download(`discografia_viewer_${stamp()}.json`, JSON.stringify(pl, null, 2), 'application/json');
  Toast.show(`📥 Backup JSON exportado`, 'ok');
}

function exportCSV(){
  const cds = sortCDs(getVisibleCDs());
  if (!cds.length){ Toast.show('Sin datos visibles', 'warn'); return; }
  const sep = ';';
  const e = v => { const s = String(v ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [['Nº','Título','Intérprete','Año álbum','Año edición','Formato','Estado','Sello','Género','País','Nº catálogo','Código barras','ISRC','Edición','Ubicación','Cantidad','Adquisición','Valor','Moneda','Rating','Favorito','Tags','Prestado a','Fecha préstamo','Fecha devolución','Notas préstamo','Enlaces JSON','Campos JSON','Notas'].join(sep)];
  for (const cd of cds){
    rows.push([
      cd.nro, cd.titulo, cd.interprete, cd.anio ?? '', cd.anioEdicion ?? '', cd.formato, cd.estado,
      cd.sello, cd.genero, cd.pais, cd.catalogo, cd.codigo, cd.isrc, cd.edicion, cd.ubicacion,
      cd.cantidad ?? '', cd.adquisicion ?? '', cd.valor ?? '', cd.moneda ?? '',
      cd.rating || '', cd.favorito ? 'Sí' : 'No', (cd.tags || []).join(' '),
      cd.prestadoA ?? '', cd.fechaPrestamo ?? '', cd.fechaDevolucion ?? '', cd.notasPrestamo ?? '',
      JSON.stringify(cd.links || {}), JSON.stringify(cd.customFields || {}), cd.notas ?? ''
    ].map(e).join(sep));
  }
  download(`discografia_viewer_${stamp()}.csv`, '\uFEFF' + rows.join('\r\n'), 'text/csv');
  Toast.show('📊 CSV exportado', 'ok');
}

function exportM3U(){
  const cds = sortCDs(getVisibleCDs());
  if (!cds.length){ Toast.show('Sin datos', 'warn'); return; }
  const lines = ['#EXTM3U'];
  for (const cd of cds){
    const artist = cd.interprete || 'Desconocido';
    const title = cd.titulo || 'Sin título';
    lines.push(`#EXTINF:-1,${artist} - ${title}`);
    const link = cd.links?.spotify || cd.links?.youtube || cd.links?.apple || '';
    lines.push(link || `# local/${cd.nro}-${title}.mp3`);
  }
  download(`discografia_${stamp()}.m3u`, lines.join('\n'), 'audio/x-mpegurl');
  Toast.show('🎵 M3U exportado', 'ok');
}

function exportHTML(){
  const cds = sortCDs(getVisibleCDs());
  if (!cds.length){ Toast.show('Sin datos', 'warn'); return; }
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Mi Discografía</title>
<style>body{font-family:system-ui,sans-serif;background:#0e1116;color:#e6ebf2;padding:20px;max-width:1200px;margin:0 auto}h1{color:#4fc3f7}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-top:20px}.card{background:#1a2028;border-radius:12px;overflow:hidden;border:1px solid #252d3a}.card img{width:100%;aspect-ratio:1;object-fit:cover}.card .info{padding:12px}.card h3{margin:0 0 6px;font-size:.95rem}.card p{margin:0;color:#8b97a8;font-size:.85rem}</style>
</head><body>
<h1>📀 Mi Discografía · ${cds.length} CDs</h1>
<p style="color:#8b97a8">Generado el ${new Date().toLocaleString('es-AR')}</p>
<div class="grid">
${cds.map(cd => `
  <div class="card">
    ${cd.portada ? `<img src="${esc(cd.portada)}" alt="" loading="lazy">` : `<div style="width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:#1c232e;font-size:2.5rem;color:#8b97a8">💿</div>`}
    <div class="info"><h3>${esc(cd.titulo)}</h3><p>${esc(cd.interprete)}${cd.anio ? ` · ${cd.anio}` : ''}</p></div>
  </div>
`).join('')}
</div>
</body></html>`;
  download(`discografia_${stamp()}.html`, html, 'text/html');
  Toast.show('🌐 HTML exportado', 'ok');
}

function shareFullCollection(){
  const cds = sortCDs(getVisibleCDs());
  if (!cds.length){ Toast.show('Sin datos', 'warn'); return; }
  const text = cds.map((cd, i) =>
    `${i + 1}. ${cd.titulo} — ${cd.interprete}${cd.anio ? ` (${cd.anio})` : ''}`
  ).join('\n');
  const header = `📀 Mi colección (${cds.length} CDs)\n\n`;
  const full = header + text;
  if (navigator.share){
    navigator.share({ title: 'Mi colección', text: full }).catch(() => {
      navigator.clipboard.writeText(full).then(() => Toast.show('📋 Copiado', 'ok'));
    });
  } else {
    navigator.clipboard.writeText(full).then(() => Toast.show('📋 Copiado', 'ok', 2500));
  }
}

function download(filename, content, mime){
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}
function stamp(){
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function clearCollection(){
  if (Store.isEmpty()){ Toast.show('Sin datos', 'warn'); return; }
  if (!confirm('¿Eliminar la copia LOCAL? El archivo de origen no se modifica.')) return;
  Store.clearAll();
  App.cat = ALL_CATS; App.artista = null; App.q = '';
  App.filters = { estado:'', formato:'', anioD:'', anioH:'', ubic:'', port:'', pres:'', rating:'', fav:false, stream:'', unseen:false };
  $('#q').value = '';
  closeMore();
  renderAll();
  Storage.cleanupKeys();
  Toast.show('🗑️ Colección vaciada', 'warn');
}

const CommandPalette = (() => {
  let isPaletteOpen = false;
  let selectedIdx = 0;
  let commands = [];

  function getCommands(){
    return [
      { id: 'search', icon: '🔍', label: 'Buscar…', action: () => $('#q')?.focus() },
      { id: 'theme', icon: '🌗', label: 'Cambiar tema', action: () => Theme.toggle() },
      { id: 'sync', icon: '🔄', label: 'Sincronizar ahora', action: () => syncNow(true, true) },
      { id: 'local', icon: '📂', label: 'Carpeta local', action: () => openLocalFolder() },
      { id: 'remote', icon: '☁️', label: 'URLs remotas', action: () => openRemoteUrls() },
      { id: 'drive', icon: '☁️', label: 'Configurar Google Drive', action: () => openSync() },
      { id: 'import', icon: '📥', label: 'Importar archivo', action: () => openImport() },
      { id: 'stats', icon: '📊', label: 'Ver panel', action: () => { smoothTransition(() => { App.tab = 'stats'; updateNav(); renderMain(); }); } },
      { id: 'artists', icon: '🎤', label: 'Ver artistas', action: () => { smoothTransition(() => { App.tab = 'artists'; updateNav(); renderMain(); }); } },
      { id: 'timeline', icon: '📅', label: 'Ver timeline', action: () => { smoothTransition(() => { App.tab = 'timeline'; updateNav(); renderMain(); }); } },
      { id: 'grid', icon: '▦', label: 'Ver grid', action: () => { smoothTransition(() => { App.tab = 'grid'; updateNav(); renderMain(); }); } },
      { id: 'filter-fav', icon: '❤️', label: 'Solo favoritos', action: () => { App.filters.fav = true; renderMain(); } },
      { id: 'filter-stream', icon: '🎧', label: 'Solo con streaming', action: () => { App.filters.stream = '__con__'; renderMain(); } },
      { id: 'filter-loans', icon: '📚', label: 'Solo prestados', action: () => { App.filters.pres = '__prestados__'; renderMain(); } },
      { id: 'filter-unseen', icon: '🆕', label: 'Solo no vistos', action: () => { App.filters.unseen = true; renderMain(); } },
      { id: 'clear-filters', icon: '✕', label: 'Limpiar filtros', action: () => { App.filters = { estado:'', formato:'', anioD:'', anioH:'', ubic:'', port:'', pres:'', rating:'', fav:false, stream:'', unseen:false }; App.q = ''; $('#q').value = ''; renderMain(); } },
      { id: 'export-json', icon: '💾', label: 'Exportar JSON', action: () => exportJSON() },
      { id: 'export-csv', icon: '📊', label: 'Exportar CSV', action: () => exportCSV() },
      { id: 'export-m3u', icon: '🎵', label: 'Exportar M3U', action: () => exportM3U() },
      { id: 'export-html', icon: '🌐', label: 'Exportar HTML', action: () => exportHTML() },
      { id: 'share-collection', icon: '📤', label: 'Compartir colección', action: () => shareFullCollection() },
      { id: 'history', icon: '🕐', label: 'Ver historial', action: () => openViewHistory() },
      { id: 'loans', icon: '📚', label: 'Ver préstamos', action: () => openLoans() },
      { id: 'legal', icon: '⚖️', label: 'Aviso legal', action: () => openLegal(true) },
      { id: 'more', icon: '⋯', label: 'Abrir menú Más', action: () => openMore() }
    ];
  }

  function open(){
    isPaletteOpen = true;
    selectedIdx = 0;
    commands = getCommands();
    const input = $('#cmdInput');
    if (input) input.value = '';
    render();
    $('#cmdPalette').classList.add('on');
    setTimeout(() => input?.focus(), 50);
  }
  function close(){
    isPaletteOpen = false;
    $('#cmdPalette').classList.remove('on');
  }
  function filter(query){
    const q = norm(query);
    if (!q) return commands;
    return commands.filter(c => norm(c.label).includes(q) || norm(c.id).includes(q));
  }
  function render(){
    const q = $('#cmdInput')?.value || '';
    const filtered = filter(q);
    const list = $('#cmdList');
    if (!list) return;
    if (!filtered.length){
      list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:.85rem">Sin resultados</div>';
      return;
    }
    selectedIdx = Math.min(selectedIdx, filtered.length - 1);
    list.innerHTML = filtered.map((c, i) => `
      <button type="button" class="cmd-item${i === selectedIdx ? ' sel' : ''}" data-cmd-idx="${i}">
        <span class="cmd-icon">${c.icon}</span>
        <span class="cmd-label">${esc(c.label)}</span>
        ${i === selectedIdx ? '<span class="cmd-hint">↵</span>' : ''}
      </button>
    `).join('');
    list.querySelectorAll('.cmd-item').forEach((btn, i) => {
      btn.addEventListener('click', () => execute(filtered[i]));
      btn.addEventListener('mouseenter', () => { selectedIdx = i; render(); });
    });
  }
  function execute(cmd){
    if (!cmd) return;
    close();
    setTimeout(() => cmd.action(), 100);
  }
  function handleKey(e){
    if (!isPaletteOpen) return false;
    const q = $('#cmdInput')?.value || '';
    const filtered = filter(q);
    if (e.key === 'Escape'){ e.preventDefault(); close(); return true; }
    if (e.key === 'ArrowDown'){ e.preventDefault(); selectedIdx = Math.min(selectedIdx + 1, filtered.length - 1); render(); return true; }
    if (e.key === 'ArrowUp'){ e.preventDefault(); selectedIdx = Math.max(0, selectedIdx - 1); render(); return true; }
    if (e.key === 'Enter'){ e.preventDefault(); execute(filtered[selectedIdx]); return true; }
    return false;
  }
  return { open, close, render, execute, isOpen: () => isPaletteOpen, handleKey };
})();

function showRecent(){
  const list = Recent.list();
  const el = $('#recent');
  if (!list.length){ el.classList.remove('on'); return; }
  el.innerHTML = `<div class="rh"><span>🕐 Búsquedas recientes</span><button type="button" id="recentClear">Limpiar</button></div>` + list.map(q => `<button type="button" class="ri" data-recent="${esc(q)}"><span class="ri-ico">🔍</span><span class="ri-txt">${esc(q)}</span></button>`).join('');
  el.classList.add('on');
  el.querySelector('#recentClear')?.addEventListener('click', (e) => { e.stopPropagation(); Recent.clear(); el.classList.remove('on'); });
  el.querySelectorAll('.ri').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.dataset.recent;
      const inp = $('#q'); inp.value = q;
      App.q = q;
      $('#searchBox').classList.add('has');
      updateAdvBadge(q);
      el.classList.remove('on');
      if (App.tab !== 'list' && App.tab !== 'grid'){ App.tab = 'list'; updateNav(); }
      renderMain();
    });
  });
}

function initPullToRefresh(){
  const main = $('#main');
  if (!main) return;
  const indicator = document.createElement('div');
  indicator.className = 'ptr-indicator';
  indicator.textContent = '↓';
  document.body.appendChild(indicator);
  let startY = 0;
  let currentY = 0;
  let pulling = false;
  const THRESHOLD = 80;
  main.addEventListener('touchstart', (e) => {
    if (main.scrollTop > 5) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }, { passive: true });
  main.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    currentY = e.touches[0].clientY;
    const delta = currentY - startY;
    if (delta > 0 && main.scrollTop <= 0){
      const progress = Math.min(delta, 120);
      indicator.style.top = (80 + progress * 0.5) + 'px';
      indicator.style.opacity = Math.min(progress / THRESHOLD, 1);
      if (progress >= THRESHOLD){ indicator.classList.add('ready'); indicator.textContent = '↻'; }
      else { indicator.classList.remove('ready'); indicator.textContent = '↓'; }
    }
  }, { passive: true });
  main.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;
    const delta = currentY - startY;
    if (delta >= THRESHOLD){
      indicator.classList.add('spinning');
      indicator.textContent = '↻';
      indicator.style.top = '80px';
      try {
        let ok = false;
        if (LocalFolder.isConfigured() && LocalFolder.getMode() === LocalFolder.MODE.FSA){
          const r = await syncFromLocalFolder({ silent: true, force: true });
          ok = r.ok;
        } else if (RemoteUrls.list().length){
          ok = await autoLoadRemoteUrl();
        } else if (Sync.isConfigured()){
          await syncNow(false, true);
          ok = true;
        } else {
          Toast.show('📥 Configurá una fuente primero', 'info', 2500);
        }
        if (ok) Toast.show('✅ Actualizado', 'ok', 2000);
      } catch(err){
        Toast.show('❌ ' + err.message, 'err', 3000);
      } finally {
        indicator.classList.remove('spinning', 'ready');
        indicator.style.top = '-60px';
        indicator.style.opacity = '0';
        setTimeout(() => { indicator.textContent = '↓'; indicator.style.top = '80px'; }, 300);
      }
    } else {
      indicator.classList.remove('ready');
      indicator.style.top = '-60px';
      indicator.style.opacity = '0';
    }
    startY = 0; currentY = 0;
  });
}