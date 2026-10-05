/* ═══════════════════════════════════════════════════════════════
   DISCOGRAFÍA VIEWER v7.3.0 — CORE 2/3
   Storage · LocalFolder · RemoteUrls · Sync Google Drive
   Depende de: app-core-1-base.js
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   STORAGE
   ═══════════════════════════════════════════════════════════════ */
const Storage = (() => {
  const CURRENT_KEYS = new Set([
    STORE_KEY, THEME_KEY, SYNC_WEBAPP_KEY,
    SYNC_INFO_KEY, SYNC_AUTO_KEY, RECENT_KEY, PREFS_KEY,
    CUSTOMFIELDS_KEY, RESOLVED_LINKS_KEY, LEGAL_NOTICE_KEY, LEGAL_SIGNATURE_KEY
  ]);
  const LEGACY_EXACT = [
    'discografia_viewer_v1','discografia_viewer_v2','discografia_viewer_v3',
    'discografia_db_v3','discografia_notfound_v1','discografia_metacache_v1',
    'discografia_history_v1','discografia_custom_fields_v1','discografia_owner_v1',
    'discografia_discogs_config_v1','discografia_seeded_backup',
    'discografia_sync_folder','discografia_sync_apikey'
  ];
  const LEGACY_PREFIXES = [
    'discografia_db_v3_BACKUP_','discografia_cache_','discografia_metacache_',
    'discografia_viewer_backup_','discografia_backup_'
  ];
  function listKeys(){ const keys = []; try { for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); } catch(e){} return keys; }
  function estimateSize(){ let total = 0; try { for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i) || ''; const v = localStorage.getItem(k) || ''; total += (k.length + v.length) * 2; } } catch(e){} return total; }
  function isLegacy(k){ if (CURRENT_KEYS.has(k)) return false; if (LEGACY_EXACT.includes(k)) return true; for (const p of LEGACY_PREFIXES) if (k.startsWith(p)) return true; return false; }
  function cleanupKeys(){
    const before = estimateSize(); const removed = [];
    const keys = listKeys();
    for (const k of keys){ if (isLegacy(k)){ try { localStorage.removeItem(k); removed.push(k); } catch(e){} } }
    const after = estimateSize();
    return { removed, freed: before - after, before, after };
  }
  async function fullCleanup(){
    const k = cleanupKeys();
    let swCount = 0;
    if ('caches' in window){
      try { const names = await caches.keys(); await Promise.all(names.map(n => caches.delete(n).catch(() => false))); swCount = names.length; } catch(e){}
    }
    try { localStorage.setItem('discografia_last_cleanup', String(Date.now())); } catch(e){}
    return { ...k, swCount };
  }
  function usage(){ const used = estimateSize(); const pct = Math.min(100, Math.round(used / LS_LIMIT_BYTES * 100)); return { used, pct, limit: LS_LIMIT_BYTES }; }
  function lastCleanup(){ try { return parseInt(localStorage.getItem('discografia_last_cleanup') || '0', 10) || 0; } catch(e){ return 0; } }
  return { cleanupKeys, fullCleanup, estimateSize, usage, listKeys, lastCleanup };
})();

/* ═══════════════════════════════════════════════════════════════
   PREFS
   ═══════════════════════════════════════════════════════════════ */
const Prefs = {
  get(){
    try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; }
    catch(e){ return {}; }
  },
  set(patch){
    try {
      const cur = Prefs.get();
      Object.assign(cur, patch || {});
      localStorage.setItem(PREFS_KEY, JSON.stringify(cur));
    } catch(e){}
  }
};

/* ═══════════════════════════════════════════════════════════════
   CUSTOM FIELDS
   ═══════════════════════════════════════════════════════════════ */
let _customFieldLabels = {};
const CustomFields = {
  load(){
    try {
      const raw = localStorage.getItem(CUSTOMFIELDS_KEY);
      _customFieldLabels = raw ? (JSON.parse(raw) || {}) : {};
    } catch(e){ _customFieldLabels = {}; }
  },
  label(key){
    if (!key) return '';
    return _customFieldLabels[key] || key;
  },
  mergeFromImport(arr){
    if (!Array.isArray(arr)) return;
    let changed = false;
    for (const f of arr){
      if (!f) continue;
      const k = f.key || f.id || f.name;
      if (!k) continue;
      const lab = f.label || f.title || f.name || k;
      if (_customFieldLabels[k] !== lab){
        _customFieldLabels[k] = lab;
        changed = true;
      }
    }
    if (changed){
      try { localStorage.setItem(CUSTOMFIELDS_KEY, JSON.stringify(_customFieldLabels)); } catch(e){}
    }
  }
};

/* ═══════════════════════════════════════════════════════════════
   LOCAL FOLDER
   ═══════════════════════════════════════════════════════════════ */
const LOCAL_FOLDER_LAST_KEY = 'discografia_local_folder_last_v1';
const LOCAL_FOLDER_INFO_KEY = 'discografia_local_folder_info_v1';
const LOCAL_FOLDER_AUTO_KEY = 'discografia_local_folder_auto_v1';
const LOCAL_FOLDER_NAME_KEY = 'discografia_local_folder_name_v1';
const LOCAL_FOLDER_MODE_KEY = 'discografia_local_folder_mode_v1';

const LocalFolder = (() => {
  const DB_NAME = 'discografia_viewer_fs_v1';
  const STORE   = 'handles';
  const KEY     = 'folder';

  const MODE = {
    FSA:    'fsa',
    WEBKIT: 'webkitdir',
    FILES:  'files',
    NONE:   'none'
  };

  let dirHandle   = null;
  let webkitFiles = [];
  let lastFile    = null;
  let mode        = MODE.NONE;

  const hasFSA = () =>
    typeof window !== 'undefined' &&
    'showDirectoryPicker' in window &&
    typeof window.showDirectoryPicker === 'function';

  const hasWebkitDir = () => {
    if (typeof document === 'undefined') return false;
    const el = document.createElement('input');
    return 'webkitdirectory' in el || 'directory' in el;
  };

  const hasFileInput = () =>
    typeof document !== 'undefined' && 'File' in window && 'FileReader' in window;

  function bestMode(){
    if (hasFSA())    return MODE.FSA;
    if (hasWebkitDir()) return MODE.WEBKIT;
    if (hasFileInput()) return MODE.FILES;
    return MODE.NONE;
  }

  function openDB(){
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE))
          req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => res(req.result);
      req.onerror  = () => rej(req.error);
    });
  }
  async function idbPut(k, v){
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(v, k);
      tx.oncomplete = () => { try { db.close(); } catch(_){} res(); };
      tx.onerror    = () => { try { db.close(); } catch(_){} rej(tx.error); };
    });
  }
  async function idbGet(k){
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const r  = tx.objectStore(STORE).get(k);
      r.onsuccess = () => { try { db.close(); } catch(_){} res(r.result); };
      r.onerror   = () => { try { db.close(); } catch(_){} rej(r.error); };
    });
  }
  async function idbDel(k){
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(k);
      tx.oncomplete = () => { try { db.close(); } catch(_){} res(); };
      tx.onerror    = () => { try { db.close(); } catch(_){} rej(tx.error); };
    });
  }

  async function ensurePermission(h, m = 'read'){
    if (!h) return false;
    try {
      const o = { mode: m };
      if ((await h.queryPermission(o)) === 'granted') return true;
      if ((await h.requestPermission(o)) === 'granted') return true;
    } catch(e){ return false; }
    return false;
  }

  function quickHash(str){
    let h = 0;
    const s = String(str);
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return 'h' + Math.abs(h).toString(36) + '_' + s.length;
  }

  function getPersistedMode(){
    try { return localStorage.getItem(LOCAL_FOLDER_MODE_KEY) || null; }
    catch(e){ return null; }
  }
  function setPersistedMode(m){
    try { localStorage.setItem(LOCAL_FOLDER_MODE_KEY, m); }
    catch(e){}
  }
  function getPersistedName(){
    try { return localStorage.getItem(LOCAL_FOLDER_NAME_KEY) || null; }
    catch(e){ return null; }
  }
  function setPersistedName(n){
    try { localStorage.setItem(LOCAL_FOLDER_NAME_KEY, n || ''); }
    catch(e){}
  }

  async function load(){
    const persistedMode = getPersistedMode();
    const best = bestMode();
    if (!persistedMode) return false;
    if (persistedMode === MODE.WEBKIT || persistedMode === MODE.FILES){
      mode = persistedMode;
      return true;
    }
    if (persistedMode === MODE.FSA && hasFSA()){
      try {
        const h = await idbGet(KEY);
        if (h){ dirHandle = h; mode = MODE.FSA; return true; }
      } catch(e){ console.warn('[LocalFolder] load FSA:', e); }
    }
    if (persistedMode === MODE.FSA && !hasFSA()){
      mode = best;
      setPersistedMode(best);
      return best !== MODE.NONE;
    }
    return false;
  }

  async function pickFSA(){
    const h = await window.showDirectoryPicker({
      mode: 'read',
      id: 'discografia-viewer',
      startIn: 'downloads'
    });
    if (!(await ensurePermission(h, 'read'))) throw new Error('Permiso denegado');
    dirHandle = h;
    mode = MODE.FSA;
    await idbPut(KEY, h);
    setPersistedMode(MODE.FSA);
    setPersistedName(h.name || '');
    return { name: h.name, mode: MODE.FSA };
  }

  function pickWebkitDir(){
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.directory = true;
      input.multiple = true;
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      let settled = false;
      const cleanup = () => { if (input.parentNode) input.parentNode.removeChild(input); };
      input.addEventListener('change', () => {
        if (settled) return;
        settled = true;
        const files = input.files ? [...input.files] : [];
        cleanup();
        if (!files.length){ reject(new Error('No se seleccionó ninguna carpeta')); return; }
        const jsons = files.filter(f => /\.json$/i.test(f.name));
        if (!jsons.length){ reject(new Error('La carpeta no contiene archivos .json')); return; }
        webkitFiles = jsons;
        mode = MODE.WEBKIT;
        setPersistedMode(MODE.WEBKIT);
        const firstPath = jsons[0].webkitRelativePath || '';
        const folderName = firstPath.split('/')[0] || 'Carpeta';
        setPersistedName(folderName);
        resolve({ name: folderName, mode: MODE.WEBKIT, count: jsons.length });
      });
      setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Selección cancelada'));
      }, 90000);
      input.click();
    });
  }

  function pickFiles(){
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.multiple = true;
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      let settled = false;
      const cleanup = () => { if (input.parentNode) input.parentNode.removeChild(input); };
      input.addEventListener('change', () => {
        if (settled) return;
        settled = true;
        const files = input.files ? [...input.files] : [];
        cleanup();
        if (!files.length){ reject(new Error('No se seleccionó ningún archivo')); return; }
        const jsons = files.filter(f => /\.json$/i.test(f.name));
        if (!jsons.length){ reject(new Error('Ninguno de los archivos es .json')); return; }
        webkitFiles = jsons;
        mode = MODE.FILES;
        setPersistedMode(MODE.FILES);
        setPersistedName(`${jsons.length} archivo${jsons.length === 1 ? '' : 's'}`);
        resolve({ name: `${jsons.length} archivo${jsons.length === 1 ? '' : 's'}`, mode: MODE.FILES, count: jsons.length });
      });
      setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Selección cancelada'));
      }, 90000);
      input.click();
    });
  }

  async function pick(){
    const best = bestMode();
    if (best === MODE.FSA)    return await pickFSA();
    if (best === MODE.WEBKIT) return await pickWebkitDir();
    if (best === MODE.FILES)  return await pickFiles();
    throw new Error('Este navegador no soporta ninguna forma de acceso a archivos.');
  }

  async function clear(){
    dirHandle = null;
    webkitFiles = [];
    lastFile = null;
    mode = MODE.NONE;
    try { await idbDel(KEY); } catch(e){}
    try { localStorage.removeItem(LOCAL_FOLDER_LAST_KEY); } catch(e){}
    try { localStorage.removeItem(LOCAL_FOLDER_INFO_KEY); } catch(e){}
    try { localStorage.removeItem(LOCAL_FOLDER_NAME_KEY); } catch(e){}
    try { localStorage.removeItem(LOCAL_FOLDER_MODE_KEY); } catch(e){}
  }

  async function listFSA(){
    if (!dirHandle) return [];
    if (!(await ensurePermission(dirHandle, 'read'))) throw new Error('Permiso denegado');
    const out = [];
    for await (const [name, h] of dirHandle.entries()){
      if (h.kind !== 'file') continue;
      if (!/\.json$/i.test(name)) continue;
      try {
        const f = await h.getFile();
        const nameTs = parseTimestampFromFilename(name) || 0;
        const modTs  = f.lastModified || 0;
        out.push({
          name, size: f.size, modifiedTime: modTs,
          _nameTs: nameTs, _modTs: modTs, _effTs: nameTs || modTs,
          handle: h, source: 'fsa'
        });
      } catch(e){}
    }
    return out;
  }

  function listWebkit(){
    if (!webkitFiles.length) return [];
    return webkitFiles
      .filter(f => /\.json$/i.test(f.name))
      .map(f => {
        const nameTs = parseTimestampFromFilename(f.name) || 0;
        const modTs  = f.lastModified || 0;
        return {
          name: f.name, size: f.size, modifiedTime: modTs,
          _nameTs: nameTs, _modTs: modTs, _effTs: nameTs || modTs,
          file: f, source: 'webkit'
        };
      });
  }

  function sortNewest(arr){
    return arr.slice().sort((a, b) => {
      const A = a._nameTs || a._modTs || 0;
      const B = b._nameTs || b._modTs || 0;
      if (B !== A) return B - A;
      return String(b.name || '').localeCompare(String(a.name || ''));
    });
  }

  async function listJsonFiles(){
    if (mode === MODE.FSA)    return sortNewest(await listFSA());
    if (mode === MODE.WEBKIT) return sortNewest(listWebkit());
    if (mode === MODE.FILES)  return sortNewest(listWebkit());
    return [];
  }

  async function readFile(entry){
    if (entry.source === 'fsa'){
      const f = await entry.handle.getFile();
      return await f.text();
    }
    if (entry.source === 'webkit'){
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onerror = () => reject(r.error || new Error('Error leyendo archivo'));
        r.onload = e => resolve(String(e.target.result || ''));
        r.readAsText(entry.file, 'utf-8');
      });
    }
    throw new Error('Tipo de entrada no soportado');
  }

  async function sync(opts = {}){
    const { force = false, silent = false } = opts;
    if (mode === MODE.NONE){
      const ok = await load();
      if (!ok) return { ok: false, reason: 'no-folder' };
    }
    if (mode === MODE.FSA && !dirHandle){
      try {
        const h = await idbGet(KEY);
        if (h){ dirHandle = h; }
      } catch(e){}
      if (!dirHandle) return { ok: false, reason: 'no-folder' };
    }
    if ((mode === MODE.WEBKIT || mode === MODE.FILES) && !webkitFiles.length){
      return { ok: false, reason: 'needs-reselect' };
    }
    let files;
    try {
      files = await listJsonFiles();
    } catch(e){
      if (!silent) Toast.show('⚠️ ' + e.message, 'warn', 4000);
      return { ok: false, reason: 'permission' };
    }
    if (!files.length) return { ok: false, reason: 'no-files' };
    const newest = files[0];
    lastFile = newest;
    let text;
    try { text = await readFile(newest); }
    catch(e){ return { ok: false, reason: 'read-error', error: e }; }
    const hash = quickHash(text);
    const prevHash = localStorage.getItem(LOCAL_FOLDER_LAST_KEY);
    if (!force && prevHash === hash){
      return { ok: true, unchanged: true, file: newest, total: Store.total() };
    }
    let data;
    try { data = JSON.parse(text.replace(/^\uFEFF/, '')); }
    catch(e){ return { ok: false, reason: 'json-error', error: e }; }
    const valid = data && (data.categories || Array.isArray(data.cds) || Array.isArray(data));
    if (!valid) return { ok: false, reason: 'invalid-format' };
    Store.replaceAll(data);
    try { localStorage.setItem(LOCAL_FOLDER_LAST_KEY, hash); } catch(e){}
    try {
      localStorage.setItem(LOCAL_FOLDER_INFO_KEY, JSON.stringify({
        lastSync: Date.now(),
        lastFileName: newest.name,
        lastFileTs: newest._effTs,
        lastModified: newest._modTs,
        mode
      }));
    } catch(e){}
    return {
      ok: true,
      file: newest,
      total: Store.total(),
      categories: Store.catKeys().length,
      modified: new Date(newest._modTs || Date.now()),
      mode
    };
  }

  const isSupported = () => bestMode() !== MODE.NONE;
  const isFsaSupported = () => hasFSA();
  const isConfigured = () => {
    const pm = getPersistedMode();
    if (!pm) return false;
    if (pm === MODE.FSA) return !!dirHandle;
    return true;
  };
  const isReady = () => {
    if (mode === MODE.FSA) return !!dirHandle;
    if (mode === MODE.WEBKIT || mode === MODE.FILES) return webkitFiles.length > 0;
    return false;
  };
  const getName = () => {
    if (dirHandle?.name) return dirHandle.name;
    return getPersistedName();
  };
  const getMode = () => mode || getPersistedMode() || MODE.NONE;
  const getLastFile = () => lastFile
    ? { name: lastFile.name, date: new Date(lastFile._modTs || Date.now()) }
    : null;
  const getInfo = () => {
    try { return JSON.parse(localStorage.getItem(LOCAL_FOLDER_INFO_KEY) || '{}') || {}; }
    catch(e){ return {}; }
  };
  const isAuto = () => {
    try { return localStorage.getItem(LOCAL_FOLDER_AUTO_KEY) !== '0'; }
    catch(e){ return true; }
  };
  function setAuto(v){
    try { localStorage.setItem(LOCAL_FOLDER_AUTO_KEY, v ? '1' : '0'); } catch(e){}
  }
  function modeLabel(m){
    const mm = m || mode || getPersistedMode();
    if (mm === MODE.FSA)    return 'Acceso directo (persistente)';
    if (mm === MODE.WEBKIT) return 'Selección de carpeta (por sesión)';
    if (mm === MODE.FILES)  return 'Selección de archivos (por sesión)';
    return 'Sin configurar';
  }

  return {
    MODE,
    load, pick, clear, sync,
    listJsonFiles, readFile,
    isSupported, isFsaSupported, isConfigured, isReady,
    getName, getMode, getLastFile, getInfo, modeLabel,
    isAuto, setAuto,
    bestMode
  };
})();

/* ═══════════════════════════════════════════════════════════════
   REMOTE URLS
   ═══════════════════════════════════════════════════════════════ */
const REMOTE_URLS_KEY = 'discografia_remote_urls_v1';

const RemoteUrls = (() => {
  function list(){
    try { return JSON.parse(localStorage.getItem(REMOTE_URLS_KEY) || '[]') || []; }
    catch(e){ return []; }
  }
  function save(items){
    try { localStorage.setItem(REMOTE_URLS_KEY, JSON.stringify(items)); } catch(e){}
  }
  function add(name, url){
    const clean = String(url || '').trim();
    if (!clean || !/^https?:\/\//i.test(clean)) throw new Error('URL inválida');
    const items = list();
    const exists = items.find(i => i.url === clean);
    if (exists) return exists;
    const item = {
      id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: String(name || '').trim() || 'Backup remoto',
      url: clean,
      addedAt: Date.now(),
      lastUsed: 0,
      lastHash: ''
    };
    items.push(item);
    save(items);
    return item;
  }
  function remove(id){
    const items = list().filter(i => i.id !== id);
    save(items);
  }
  function touch(id, hash){
    const items = list();
    const it = items.find(i => i.id === id);
    if (it){ it.lastUsed = Date.now(); if (hash) it.lastHash = hash; save(items); }
  }
  function normalizeUrl(url){
    let u = String(url || '').trim();
    u = u.replace(/[?&]dl=0/, m => m.replace('=0', '=1'));
    if (/dropbox\.com/.test(u) && !/[?&]dl=/.test(u)){
      u += (u.includes('?') ? '&' : '?') + 'dl=1';
    }
    if (/icloud\.com/.test(u) && !u.includes('download=')){
      u += (u.includes('?') ? '&' : '?') + 'download=1';
    }
    const gd = u.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (gd){
      u = `https://drive.google.com/uc?export=download&id=${gd[1]}`;
    }
    return u;
  }
  async function fetchUrl(item){
    const url = normalizeUrl(item.url);
    const r = await fetch(url, { cache: 'no-store', redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); }
    catch(e){ throw new Error('El contenido no es JSON válido'); }
    const valid = data && (data.categories || Array.isArray(data.cds) || Array.isArray(data));
    if (!valid) throw new Error('El JSON no es un backup válido');
    return data;
  }
  function quickHash(str){
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return 'h' + Math.abs(h).toString(36) + '_' + str.length;
  }
  return { list, add, remove, touch, normalizeUrl, fetchUrl, quickHash };
})();

/* ═══════════════════════════════════════════════════════════════
   SYNC GOOGLE DRIVE
   ═══════════════════════════════════════════════════════════════ */
const Sync = (() => {
  function getWebAppUrl(){
    try { return (localStorage.getItem(SYNC_WEBAPP_KEY) || '').trim(); }
    catch(e){ return ''; }
  }
  function setWebAppUrl(url){
    try { localStorage.setItem(SYNC_WEBAPP_KEY, String(url || '').trim()); } catch(e){}
  }
  function isConfigured(){
    return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec\/?$/i.test(getWebAppUrl());
  }
  function isAuto(){
    try {
      const v = localStorage.getItem(SYNC_AUTO_KEY);
      if (v === null || v === undefined || v === '') return true;
      return v === '1' || v === 'true';
    } catch(e){ return true; }
  }
  function setAuto(on){
    try { localStorage.setItem(SYNC_AUTO_KEY, on ? '1' : '0'); } catch(e){}
  }
  function getInfo(){
    try { return JSON.parse(localStorage.getItem(SYNC_INFO_KEY) || '{}') || {}; }
    catch(e){ return {}; }
  }
  function setInfo(info){
    try { localStorage.setItem(SYNC_INFO_KEY, JSON.stringify(info || {})); } catch(e){}
  }
  function annotate(file){
    const f = Object.assign({}, file || {});
    const modRaw = f.modifiedTime || f.modified || f.modifiedDate || 0;
    let modTs = 0;
    if (typeof modRaw === 'number') modTs = modRaw;
    else if (modRaw){ const d = new Date(modRaw); if (!isNaN(d)) modTs = d.getTime(); }
    const nameTs = (typeof parseTimestampFromFilename === 'function')
      ? (parseTimestampFromFilename(f.name) || 0)
      : 0;
    f._modTs = modTs;
    f._nameTs = nameTs;
    f._effTs = nameTs || modTs || 0;
    return f;
  }
  function sortByNewest(files){
    return files.slice().sort((a, b) => {
      const A = a._nameTs || a._effTs || a._modTs || 0;
      const B = b._nameTs || b._effTs || b._modTs || 0;
      if (B !== A) return B - A;
      return String(b.name || '').localeCompare(String(a.name || ''));
    });
  }
  async function api(action, params){
    const base = getWebAppUrl();
    if (!base) throw new Error('URL de Apps Script no configurada');
    const qs = new URLSearchParams();
    qs.set('action', action);
    if (params){
      for (const k of Object.keys(params)){
        if (params[k] != null && params[k] !== '') qs.set(k, params[k]);
      }
    }
    qs.set('_cb', String(Date.now()));
    const url = base + (base.includes('?') ? '&' : '?') + qs.toString();
    const r = await fetch(url, { method: 'GET', cache: 'no-store', redirect: 'follow', credentials: 'omit' });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' al llamar Apps Script');
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json') || ct.includes('text/plain') || ct.includes('javascript')){
      return await r.json();
    }
    const text = await r.text();
    try { return JSON.parse(text); }
    catch(e){ throw new Error('Respuesta no JSON del Web App'); }
  }
  async function listBackups(){
    const data = await api('list');
    if (data && data.error) throw new Error(String(data.error));
    const raw = Array.isArray(data?.files) ? data.files
              : Array.isArray(data) ? data
              : [];
    const files = sortByNewest(raw.map(annotate).filter(f => f && f.id && f.name));
    return files;
  }
  async function download(id){
    if (!id) throw new Error('ID de archivo vacío');
    let data;
    try {
      data = await api('get', { id: String(id) });
    } catch(e1){
      try { data = await api('download', { id: String(id) }); }
      catch(e2){ throw e1; }
    }
    if (data && data.error) throw new Error(String(data.error));
    if (data && (data.categories || Array.isArray(data.cds) || Array.isArray(data))) return data;
    if (data && data.data && typeof data.data === 'object') return data.data;
    if (data && data.content != null){
      if (typeof data.content === 'string'){
        try { return JSON.parse(data.content); }
        catch(e){ throw new Error('content JSON inválido'); }
      }
      return data.content;
    }
    if (data && data.file && typeof data.file === 'object') return data.file;
    throw new Error('El archivo descargado no tiene formato reconocible');
  }
  async function pullLatest(){
    const files = await listBackups();
    if (!files.length) throw new Error('No hay archivos .json en la carpeta de Drive');
    const file = files[0];
    const data = await download(file.id);
    return { data, file, total: files.length };
  }
  async function testConnection(){
    const files = await listBackups();
    return { count: files.length, files };
  }
  return {
    getWebAppUrl, setWebAppUrl, isConfigured,
    isAuto, setAuto, getInfo, setInfo,
    listBackups, download, pullLatest, testConnection
  };
})();