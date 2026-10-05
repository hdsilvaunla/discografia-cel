/* ═══════════════════════════════════════════════════════════════
   DISCOGRAFÍA VIEWER v7.3.0 — UI 4/4
   Binds · Init · Service Worker · Arranque
   Depende de: TODOS los archivos anteriores
   ═══════════════════════════════════════════════════════════════ */

function renderAll(){
  renderCats();
  renderMain();
  updateNav();
  renderFreshness();
  const total = Store.total();
  const cats = Store.catKeys().length;
  const nF = countActiveFilters();
  let sub = Store.isEmpty() ? 'Sin datos cargados' : `${total} CD${total === 1 ? '' : 's'} · ${cats} categoría${cats === 1 ? '' : 's'}`;
  if (nF > 0 && !Store.isEmpty()) sub += ` · ${nF} filtro${nF === 1 ? '' : 's'}`;
  $('#sub').textContent = sub;
  const btnSync = $('#btnSync');
  if (btnSync) btnSync.style.display = Sync.isConfigured() ? '' : 'none';
}

function bindNav(){
  $$('nav button').forEach(b => {
    b.addEventListener('click', () => {
      if (b.dataset.tab === 'more'){ openMore(); return; }
      if (App.tab === b.dataset.tab) return;
      smoothTransition(() => {
        App.tab = b.dataset.tab;
        Prefs.set({ tab: App.tab });
        updateNav();
        renderMain();
        $('#main').scrollTop = 0;
      });
    });
  });
}

function bind(){
  const q = $('#q');
  const runSearch = debounce(() => {
    App.q = q.value;
    if (App.tab !== 'list' && App.tab !== 'grid'){ App.tab = 'list'; updateNav(); }
    renderMain();
  }, 140);
  q.addEventListener('input', () => {
    $('#searchBox').classList.toggle('has', q.value.length > 0);
    updateAdvBadge(q.value);
    runSearch();
    SmartSuggest.render(q.value);
  });
  q.addEventListener('focus', () => {
    if (q.value.length >= 2) SmartSuggest.render(q.value);
    else if (!q.value) showRecent();
  });
  q.addEventListener('blur', () => setTimeout(() => {
    $('#recent')?.classList.remove('on');
    $('#smartSuggest')?.classList.remove('on');
  }, 220));
  q.addEventListener('keydown', e => { if (e.key === 'Enter'){ Recent.add(q.value); $('#recent')?.classList.remove('on'); $('#smartSuggest')?.classList.remove('on'); q.blur(); } });

  $('#clrQ').addEventListener('click', () => {
    q.value = ''; App.q = '';
    $('#searchBox').classList.remove('has','adv-mode');
    $('#recent')?.classList.remove('on');
    $('#smartSuggest')?.classList.remove('on');
    renderMain(); q.focus();
  });

  $('#btnTheme').addEventListener('click', () => Theme.toggle());
  $('#btnImportTop').addEventListener('click', () => openImport());
  $('#btnSync').addEventListener('click', () => syncNow(true));
  $('#btnCmd').addEventListener('click', () => CommandPalette.open());

  if (VoiceSearch.isSupported()){
    const vBtn = $('#btnVoice');
    if (vBtn){
      vBtn.style.display = 'flex';
      let listening = false;
      vBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (listening) return;
        listening = true;
        vBtn.textContent = '⏹️';
        vBtn.style.color = 'var(--danger)';
        Toast.show('🎤 Escuchando…', 'info', 2000);
        try {
          await VoiceSearch.listen({
            onResult: (text) => {
              if (text){
                const inp = $('#q');
                inp.value = text;
                App.q = text;
                $('#searchBox').classList.add('has');
                updateAdvBadge(text);
                if (App.tab !== 'list' && App.tab !== 'grid'){ App.tab = 'list'; updateNav(); }
                renderMain();
              }
            }
          });
        } catch(err){
          Toast.show('🎤 ' + err.message, 'warn', 3000);
        } finally {
          listening = false;
          vBtn.textContent = '🎤';
          vBtn.style.color = '';
        }
      });
    }
  }

  $('#impClose').addEventListener('click', closeImport);
  $('#impModal').addEventListener('click', e => { if (e.target.id === 'impModal') closeImport(); });
  $('#btnPickFile').addEventListener('click', () => $('#fileInp').click());
  $('#fileInp').addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });
  $('#btnPaste').addEventListener('click', () => { closeImport(); openPaste(); });
  $('#btnUrl').addEventListener('click', () => { closeImport(); openUrl(); });
  $('#btnLocalFolder').addEventListener('click', () => { closeImport(); openLocalFolder(); });
  $('#btnRemoteUrls').addEventListener('click', () => { closeImport(); openRemoteUrls(); });

  const dz = $('#dropZone');
  if (dz){
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor = 'var(--accent)'; dz.style.background = 'rgba(79,195,247,.08)'; });
    dz.addEventListener('dragleave', () => { dz.style.borderColor = 'var(--line)'; dz.style.background = ''; });
    dz.addEventListener('drop', e => { e.preventDefault(); dz.style.borderColor = 'var(--line)'; dz.style.background = ''; handleFiles(e.dataTransfer?.files); });
  }

  $('#pasteClose').addEventListener('click', closePaste);
  $('#pasteCancel').addEventListener('click', closePaste);
  $('#pasteModal').addEventListener('click', e => { if (e.target.id === 'pasteModal') closePaste(); });
  $('#pasteOK').addEventListener('click', () => {
    const txt = $('#pasteArea').value.trim();
    if (!txt){ Toast.show('Pegá el JSON primero', 'warn'); return; }
    try { importData(JSON.parse(txt.replace(/^\uFEFF/, ''))); }
    catch(err){ Toast.show('JSON inválido: ' + err.message, 'err', 5000); }
  });

  $('#urlClose').addEventListener('click', closeUrl);
  $('#urlCancel').addEventListener('click', closeUrl);
  $('#urlModal').addEventListener('click', e => { if (e.target.id === 'urlModal') closeUrl(); });
  $('#urlOK').addEventListener('click', async () => {
    const u = $('#urlInput').value.trim();
    if (!u){ Toast.show('Ingresá una URL', 'warn'); return; }
    const btn = $('#urlOK'); const orig = btn.textContent;
    btn.disabled = true; btn.textContent = '⏳ Descargando…';
    try {
      const normalized = RemoteUrls.normalizeUrl(u);
      const r = await fetch(normalized, { mode: 'cors', cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      closeUrl(); importData(data);
    } catch(err){ Toast.show('Error: ' + err.message, 'err', 5000); }
    finally { btn.disabled = false; btn.textContent = orig; }
  });

  $('#filtClose').addEventListener('click', closeFilters);
  $('#filtCancel').addEventListener('click', closeFilters);
  $('#filtModal').addEventListener('click', e => { if (e.target.id === 'filtModal') closeFilters(); });
  $('#flRating').addEventListener('click', e => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    $('#flRating').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#filtApply').addEventListener('click', () => {
    const activeRatingBtn = $('#flRating').querySelector('button.on');
    App.filters = {
      estado: $('#flEstado').value, formato: $('#flFormato').value,
      anioD: $('#flAnioD').value, anioH: $('#flAnioH').value,
      ubic: $('#flUbic').value, port: $('#flPort').value, pres: $('#flPres').value,
      stream: $('#flStream')?.value || '',
      rating: activeRatingBtn?.dataset.v || '', fav: $('#flFav').checked,
      unseen: $('#flUnseen')?.checked || false
    };
    closeFilters();
    if (App.tab !== 'list' && App.tab !== 'grid'){ App.tab = 'list'; updateNav(); }
    renderMain();
    Toast.show('Filtros aplicados', 'ok', 1500);
  });
  $('#filtClear').addEventListener('click', () => {
    App.filters = { estado:'', formato:'', anioD:'', anioH:'', ubic:'', port:'', pres:'', rating:'', fav:false, stream:'', unseen:false };
    $('#flEstado').value = ''; $('#flFormato').value = '';
    $('#flAnioD').value = ''; $('#flAnioH').value = '';
    $('#flUbic').value = ''; $('#flPort').value = ''; $('#flPres').value = '';
    const fls = $('#flStream'); if (fls) fls.value = '';
    $('#flFav').checked = false;
    const flu = $('#flUnseen'); if (flu) flu.checked = false;
    $('#flRating').querySelectorAll('button').forEach(x => x.classList.remove('on'));
    renderMain();
    Toast.show('Filtros quitados', 'info', 1200);
  });

  $('#detClose').addEventListener('click', closeDetail);
  $('#detModal').addEventListener('click', e => { if (e.target.id === 'detModal') closeDetail(); });
  $('#lbX').addEventListener('click', () => LB.close());
  $('#lb').addEventListener('click', e => { if (e.target.id === 'lb') LB.close(); });
  $('#moreClose').addEventListener('click', closeMore);
  $('#moreModal').addEventListener('click', e => { if (e.target.id === 'moreModal') closeMore(); });

  $('#syncClose').addEventListener('click', closeSync);
  $('#syncCancel').addEventListener('click', closeSync);
  $('#syncModal').addEventListener('click', e => { if (e.target.id === 'syncModal') closeSync(); });
  $('#syncSave').addEventListener('click', async () => {
    const url = $('#syncWebAppInput').value.trim();
    if (!url){ Toast.show('Pegá la URL', 'warn'); return; }
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/.test(url)){
      Toast.show('❌ URL inválida', 'err', 7000);
      return;
    }
    Sync.setWebAppUrl(url);
    Sync.setAuto($('#syncAuto').checked);
    const btn = $('#syncSave'); const orig = btn.textContent;
    btn.disabled = true; btn.textContent = '🔎 Probando…';
    try {
      const r = await Sync.testConnection();
      Toast.show(`✅ ${r.count} backup${r.count === 1 ? '' : 's'}`, 'ok', 3500);
      closeSync();
      Sync.setInfo({ ...Sync.getInfo(), lastFileName: '', lastFileTs: 0, lastModified: 0 });
      syncNow(false);
    } catch(e){
      Toast.show('❌ ' + e.message, 'err', 7000);
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  });

  $('#btnCopyGas')?.addEventListener('click', async () => {
    const pre = $('#gasCodeBlock');
    const txt = pre ? pre.textContent : '';
    if (!txt){ Toast.show('Sin código', 'warn'); return; }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(txt);
      } else {
        const ta = document.createElement('textarea');
        ta.value = txt; ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove();
      }
      Toast.show('📋 Código copiado', 'ok', 3500);
    } catch(err){
      Toast.show('No se pudo copiar: ' + err.message, 'err', 4000);
    }
  });

  $('#syncDiag')?.addEventListener('click', async () => {
    const url = $('#syncWebAppInput').value.trim();
    if (!url){ Toast.show('Pegá la URL', 'warn'); return; }
    const btn = $('#syncDiag'); const orig = btn.textContent;
    btn.disabled = true; btn.textContent = '🔎 Probando…';
    try {
      const t0 = performance.now();
      const cb = Date.now();
      const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}action=list&_cb=${cb}`, { cache: 'no-store' });
      const elapsed = Math.round(performance.now() - t0);
      if (!r.ok) throw new Error(`HTTP ${r.status} en ${elapsed}ms`);
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      const files = data.files || [];
      Toast.show(`✅ Conexión OK (${elapsed}ms) · ${files.length} archivo${files.length === 1 ? '' : 's'}`, files.length ? 'ok' : 'warn', 6000);
    } catch(e){
      Toast.show('❌ ' + e.message, 'err', 8000);
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  });

  $('#backupsClose').addEventListener('click', closeBackups);
  $('#backupsCancel').addEventListener('click', closeBackups);
  $('#backupsModal').addEventListener('click', e => { if (e.target.id === 'backupsModal') closeBackups(); });
  $('#backupsRefresh').addEventListener('click', loadBackupsList);
  $('#backupsForceSync')?.addEventListener('click', async () => {
    closeBackups();
    Toast.show('⬇️ Forzando sync…', 'info', 2000);
    await syncNow(true, true);
  });

  $('#lfClose').addEventListener('click', closeLocalFolder);
  $('#localFolderModal').addEventListener('click', e => { if (e.target.id === 'localFolderModal') closeLocalFolder(); });
  $('#lfPick').addEventListener('click', pickLocalFolder);
  $('#lfSyncNow').addEventListener('click', syncLocalNow);
  $('#lfClear').addEventListener('click', clearLocalFolder);
  $('#lfAuto').addEventListener('change', e => {
    LocalFolder.setAuto(e.target.checked);
    Toast.show(e.target.checked ? '✅ Auto-carga activada' : '⚠️ Auto-carga desactivada', e.target.checked ? 'ok' : 'warn', 2000);
  });

  $('#ruClose').addEventListener('click', closeRemoteUrls);
  $('#remoteUrlModal').addEventListener('click', e => { if (e.target.id === 'remoteUrlModal') closeRemoteUrls(); });
  $('#ruTest').addEventListener('click', testRemoteUrl);
  $('#ruAdd').addEventListener('click', () => {
    try {
      const name = $('#ruName').value;
      const url = $('#ruUrl').value;
      if (!url.trim()){ Toast.show('Ingresá una URL', 'warn'); return; }
      const item = RemoteUrls.add(name, url);
      $('#ruName').value = '';
      $('#ruUrl').value = '';
      renderRemoteList();
      Toast.show(`✅ "${item.name}" agregada`, 'ok', 2500);
    } catch(err){
      Toast.show('❌ ' + err.message, 'err', 4000);
    }
  });

  $('#cmdPalette').addEventListener('click', e => { if (e.target.id === 'cmdPalette') CommandPalette.close(); });
  $('#cmdInput').addEventListener('input', () => CommandPalette.render());

  $('#legalClose').addEventListener('click', closeLegal);
  $('#legalAceptar').addEventListener('click', aceptarLegal);
  $('#legalPDF').addEventListener('click', exportLegalPDF);
  $('#legalModal').addEventListener('click', e => { if (e.target.id === 'legalModal') closeLegal(); });
  const chkLegal = $('#legalAcepto');
  const btnAceptar = $('#legalAceptar');
  if (chkLegal && btnAceptar){
    chkLegal.addEventListener('change', () => {
      btnAceptar.disabled = !chkLegal.checked;
      btnAceptar.style.opacity = chkLegal.checked ? '1' : '.45';
      btnAceptar.style.cursor = chkLegal.checked ? 'pointer' : 'not-allowed';
    });
  }

  const main = $('#main');
  main.addEventListener('scroll', () => {
    const fab = $('#fabTop');
    if (!fab) return;
    fab.classList.toggle('on', main.scrollTop > 400);
  });
  $('#fabTop').addEventListener('click', () => main.scrollTo({ top: 0, behavior: 'smooth' }));

  ['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }));
  document.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation();
    if (e.target.closest?.('#dropZone')) return;
    handleFiles(e.dataTransfer?.files);
  });

  document.addEventListener('backbutton', (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    handleBackButton();
  }, false);

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
      e.preventDefault();
      CommandPalette.isOpen() ? CommandPalette.close() : CommandPalette.open();
      return;
    }
    if (CommandPalette.isOpen()){
      if (CommandPalette.handleKey(e)) return;
    }
    if (e.key !== 'Escape') return;
    if (isOpen('#lb')){ LB.close(); return; }
    if (isOpen('#detModal')){ closeDetail(); return; }
    if (isOpen('#impModal')){ closeImport(); return; }
    if (isOpen('#pasteModal')){ closePaste(); return; }
    if (isOpen('#urlModal')){ closeUrl(); return; }
    if (isOpen('#filtModal')){ closeFilters(); return; }
    if (isOpen('#moreModal')){ closeMore(); return; }
    if (isOpen('#syncModal')){ closeSync(); return; }
    if (isOpen('#backupsModal')){ closeBackups(); return; }
    if (isOpen('#localFolderModal')){ closeLocalFolder(); return; }
    if (isOpen('#remoteUrlModal')){ closeRemoteUrls(); return; }
    if (isOpen('#legalModal')){ closeLegal(); return; }
    if (isOpen('#cmdPalette')){ CommandPalette.close(); return; }
    if (App.q){ App.q = ''; $('#q').value = ''; $('#searchBox').classList.remove('has','adv-mode'); renderMain(); return; }
    if (App.artista){ App.artista = null; renderAll(); }
  });

  window.addEventListener('online', () => {
    Toast.show('🟢 Conexión restaurada', 'ok', 2000);
    if (Sync.isConfigured() && Sync.isAuto()){
      const info = Sync.getInfo();
      if ((Date.now() - (info.lastSync || 0)) / 3600000 >= 1) syncNow(false);
    }
  });
  window.addEventListener('offline', () => Toast.show('🔴 Sin conexión', 'warn', 3000));
  document.addEventListener('visibilitychange', maybeForegroundSync);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const mode = LocalFolder.getMode();
    if (mode !== LocalFolder.MODE.WEBKIT && mode !== LocalFolder.MODE.FILES) return;
    if (!LocalFolder.isConfigured()) return;
    if (!LocalFolder.isAuto()) return;
    if (!Store.isEmpty()) return;
    setTimeout(() => {
      if (!Store.isEmpty()) return;
      Toast.show('📂 Tocá para cargar desde la carpeta', 'info', 4000);
    }, 800);
  });
}

function handleBackButton(){
  if (isOpen('#lb')){ LB.close(); return; }
  if (isOpen('#detModal')){ closeDetail(); return; }
  if (isOpen('#impModal')){ closeImport(); return; }
  if (isOpen('#pasteModal')){ closePaste(); return; }
  if (isOpen('#urlModal')){ closeUrl(); return; }
  if (isOpen('#filtModal')){ closeFilters(); return; }
  if (isOpen('#moreModal')){ closeMore(); return; }
  if (isOpen('#syncModal')){ closeSync(); return; }
  if (isOpen('#backupsModal')){ closeBackups(); return; }
  if (isOpen('#localFolderModal')){ closeLocalFolder(); return; }
  if (isOpen('#remoteUrlModal')){ closeRemoteUrls(); return; }
  if (isOpen('#legalModal')){ closeLegal(); return; }
  if (isOpen('#cmdPalette')){ CommandPalette.close(); return; }
}

function maybeForegroundSync(){
  if (document.hidden) return;
  if (!navigator.onLine) return;
  if (!Sync.isConfigured() || !Sync.isAuto()) return;
  const info = Sync.getInfo();
  const ageMin = (Date.now() - (info.lastSync || 0)) / 60000;
  if (ageMin >= SYNC_FOREGROUND_MIN) syncNow(false);
}

function injectManifest(){
  try {
    const manifest = {
      name: 'Discografía Viewer', short_name: 'Discografía',
      description: 'Consulta tu colección de CDs',
      start_url: './index.html', scope: './',
      display: 'standalone', background_color: '#0e1116',
      theme_color: '#4fc3f7', orientation: 'portrait',
      icons: [{
        src: 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4fc3f7"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs><circle cx="256" cy="256" r="240" fill="url(#g)"/><circle cx="256" cy="256" r="90" fill="#0e1116"/><circle cx="256" cy="256" r="30" fill="#4fc3f7"/></svg>`),
        sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable'
      }]
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('link');
    link.rel = 'manifest'; link.href = url;
    document.head.appendChild(link);
  } catch(e){}
}

document.addEventListener('click', (e) => {
  if (legalAceptado()) return;
  if (e.target.closest('#legalModal')) return;
  if (e.target.closest('#btnTheme')) return;
  const modal = $('#legalModal');
  if (modal && !modal.classList.contains('on')){
    openLegal();
    Toast.show('⚖️ Aceptá el aviso legal para continuar', 'warn', 3000);
  }
}, true);

document.addEventListener('click', (e) => {
  if (e.target.id === 'legalClose' || e.target.id === 'legalModal'){
    if (!legalAceptado()){
      setTimeout(() => {
        if (!legalAceptado()) openLegal();
      }, 3000);
    }
  }
});

async function init(){
  try {
    try { await Storage.fullCleanup(); } catch(e){}
    injectManifest();
    Theme.init();
    CustomFields.load();
    Store.load();

    const p = Prefs.get();
    if (p.cat) App.cat = p.cat;
    if (p.tab && p.tab !== 'more') App.tab = p.tab;
    if (p.order) App.order = p.order;
    if (p.artistsOrder) App.artistsOrder = p.artistsOrder;

    bindNav();
    bind();
    renderAll();

    if ('serviceWorker' in navigator && location.protocol !== 'file:'){
      try {
        await navigator.serviceWorker.register('./sw.js', { scope: './' });
        console.log('%c[SW] ✅ Registrado', 'color:#5ddc9a;font-weight:600');
      } catch(e){
        console.warn('[SW] Error:', e);
      }
    }

    let _installPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      _installPrompt = e;
      setTimeout(() => {
        if (!_installPrompt) return;
        if (localStorage.getItem('pwa_install_shown') === '1') return;
        Toast.show('📲 Instalá la app en tu inicio', 'info', 6000, {
          label: '📲 Instalar',
          fn: async () => {
            if (!_installPrompt) return;
            _installPrompt.prompt();
            const { outcome } = await _installPrompt.userChoice;
            if (outcome === 'accepted') Toast.show('✅ Instalada', 'ok', 2500);
            _installPrompt = null;
            localStorage.setItem('pwa_install_shown', '1');
          }
        });
      }, 5000);
    });

    try { initPullToRefresh(); } catch(e){}
    try { AutoTheme.start(); } catch(e){}

    const u = Storage.usage();
    console.log(`%c📱 Discografía Viewer v${VERSION}`, 'color:#4fc3f7;font-weight:bold;font-size:14px');
    console.log(`%c💾 Almacenamiento: ${fmtBytes(u.used)} (${u.pct}%)`, `color:${u.pct > 85 ? '#ff6b6b' : u.pct > 65 ? '#ffa94d' : '#5ddc9a'};font-weight:600`);
    console.log(`%c📋 Modo consulta — sin descargas`, 'color:#5ddc9a;font-weight:600');
    console.log(`%c© 2024-${new Date().getFullYear()} HDSystem IT · +54 9 11 4563-0851`, 'color:#a78bfa;font-weight:600');

    if (LocalFolder.isSupported()){
      try { await LocalFolder.load(); } catch(e){}
    }
    const lfMode = LocalFolder.getMode();
    if (LocalFolder.isConfigured() && LocalFolder.isAuto()){
      if (lfMode === LocalFolder.MODE.FSA){
        console.log('%c[LocalFolder] 📂 FSA detectado', 'color:#4fc3f7;font-weight:600');
        const r = await syncFromLocalFolder({ silent: false });
        if (r.ok && !r.unchanged){
          Toast.show(`📥 Cargado: ${r.file?.name || 'archivo'} · ${r.total} CDs`, 'ok', 3500);
        } else if (r.ok && r.unchanged){
          console.log('%c[LocalFolder] ⏭️ Ya al día', 'color:#8b97a8');
        }
      } else if (Store.isEmpty()){
        setTimeout(() => {
          Toast.show('📂 Seleccioná la carpeta para cargar', 'info', 4000);
          openLocalFolder();
        }, 800);
      }
    }

    if (Store.isEmpty()){
      try { await autoLoadRemoteUrl(); } catch(e){}
    }

    if (Store.isEmpty() && Sync.isConfigured() && Sync.isAuto()){
      setTimeout(() => syncNow(false), 600);
    }

    if (!Store.isEmpty()) Toast.show(`📚 ${Store.total()} CDs cargados`, 'ok', 2200);

    if (!legalAceptado()){
      setTimeout(() => openLegal(), 1200);
    } else {
      const sig = legalSignature();
      if (sig) console.log(`%c[Legal] ✅ Aceptado ${new Date(sig.acceptedAt).toLocaleString('es-AR')}`, 'color:#5ddc9a;font-weight:600');
    }

    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    if (action === 'search') setTimeout(() => $('#q')?.focus(), 500);
    else if (action === 'favs'){
      App.filters.fav = true;
      if (App.tab !== 'list'){ App.tab = 'list'; updateNav(); }
      renderMain();
    }

    setInterval(renderFreshness, 60000);
  } catch(e){
    console.error('Error al inicializar:', e);
    const main = document.querySelector('main');
    if (main){
      main.innerHTML = `<div style="padding:40px 20px;text-align:center;color:var(--muted)">
        <div style="font-size:3rem;margin-bottom:16px">⚠️</div>
        <h2 style="margin:0 0 8px;font-size:1.1rem;color:var(--danger)">Error al iniciar</h2>
        <p style="font-size:.85rem;line-height:1.55">${esc(e.message || 'Error desconocido')}</p>
        <button onclick="location.reload()" style="margin-top:20px;padding:12px 24px;border-radius:12px;background:rgba(79,195,247,.15);border:1px solid rgba(79,195,247,.4);color:var(--accent);font-weight:600;font-family:inherit;cursor:pointer">🔄 Recargar</button>
      </div>`;
    }
  }
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}