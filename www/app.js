/* ═══════════════════════════════════════════════════════════════
   DISCOGRAFÍA VIEWER v7.3.0 · VISOR DE CONSULTA (MÓVIL)
   Autor: HDSystem IT · Tel: +54 9 11 4563-0851

   NUEVO en v7.3.0:
     - Carpeta local (File System Access API + webkitdirectory + files)
     - URLs remotas persistentes (iCloud/Dropbox/Drive)
     - Búsqueda por voz (Web Speech API)
     - Búsqueda fuzzy + fonética (español)
     - Búsqueda semántica ("rock argentino de los 80")
     - Autocompletar inteligente
     - Command Palette (Ctrl+K)
     - Historial de vistas + historial de búsquedas
     - Recomendador "escuchar ahora"
     - Pull-to-refresh
     - Service Worker + PWA instalable
     - Skeleton loaders
     - View Transitions API
     - Color dominante en detalle
     - Hero parallax + pinch zoom
     - Compartir como imagen
     - Compartir colección como texto
     - Timeline por año
     - Heatmap de años
     - Tema automático día/noche
     - Favoritos locales
     - Deep links a apps nativas
     - Exportar M3U/HTML
     - Similares por género/sello/década
   ═══════════════════════════════════════════════════════════════ */

const VERSION = '7.3.0';
const DATA_SCHEMA_VERSION = 2;
const BACKUP_FORMAT_VERSION = 1;
const STORE_KEY = 'discografia_viewer_v4';
const STORE_KEY_LEGACY = ['discografia_viewer_v3','discografia_viewer_v2','discografia_viewer_v1'];
const THEME_KEY = 'discografia_viewer_theme';
const SYNC_WEBAPP_KEY = 'discografia_sync_webapp_v1';
const SYNC_INFO_KEY = 'discografia_sync_info';
const SYNC_AUTO_KEY = 'discografia_sync_auto';
const RECENT_KEY = 'discografia_viewer_recent';
const PREFS_KEY = 'discografia_viewer_prefs';
const CUSTOMFIELDS_KEY = 'discografia_viewer_customfields';
const LEGAL_NOTICE_KEY = 'discografia_legal_accepted_v1';
const LEGAL_SIGNATURE_KEY = 'discografia_legal_signature_v1';
const RESOLVED_LINKS_KEY = 'discografia_viewer_resolved_links_v1';
const ALL_CATS = '__all__';
const SYNC_STALE_HOURS = 6;
const SYNC_FOREGROUND_MIN = 60;
const SYNC_ON_BOOT_MIN = 60;
const LS_LIMIT_BYTES = 5 * 1024 * 1024;

const STREAMING_SERVICES = [
  { key:'spotify',    name:'Spotify',       icon:'🟢', color:'#1db954' },
  { key:'youtube',    name:'YouTube Music', icon:'🔴', color:'#ff0000' },
  { key:'apple',      name:'Apple Music',   icon:'🍎', color:'#fa243c' },
  { key:'deezer',     name:'Deezer',        icon:'🎵', color:'#a238ff' },
  { key:'tidal',      name:'Tidal',         icon:'🌊', color:'#00d4ff' },
  { key:'amazon',     name:'Amazon Music',  icon:'📦', color:'#ff9900' },
  { key:'soundcloud', name:'SoundCloud',    icon:'☁️', color:'#ff5500' },
  { key:'discogs',    name:'Discogs',       icon:'💿', color:'#777777' }
];

const ALLOWED_STREAM_DOMAINS = [
  'open.spotify.com','spotify.com',
  'music.youtube.com','youtube.com','youtu.be',
  'music.apple.com','itunes.apple.com',
  'deezer.com',
  'tidal.com','listen.tidal.com',
  'music.amazon.com','amazon.com',
  'soundcloud.com',
  'discogs.com'
];

function isSafeStreamUrl(url){
  if (!url || typeof url !== 'string') return false;
  if (!/^https:\/\//i.test(url)) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return ALLOWED_STREAM_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch(e){ return false; }
}

function isAlbumUrl(url, svcKey){
  if (!url) return false;
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase() + u.search.toLowerCase();
    switch(svcKey){
      case 'spotify':    return path.includes('/album/') && !path.includes('/track/') && !path.includes('/playlist/');
      case 'apple':      return path.includes('/album/');
      case 'deezer':     return path.includes('/album/') && !path.includes('/track/');
      case 'tidal':      return path.includes('/album/') && !path.includes('/track/');
      case 'youtube':    return path.includes('olak5uy') || path.includes('/browse/') || path.includes('/playlist');
      case 'amazon':     return path.includes('/albums/') && !path.includes('/tracks/');
      case 'soundcloud': return path.includes('/sets/');
      default: return true;
    }
  } catch(e){ return false; }
}

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => String(s ?? '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,' ').trim();
const upper = v => (v === null || v === undefined) ? '' : String(v).toUpperCase();
const debounce = (fn, ms=180) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function isVisible(sel){
  const el = $(sel);
  return !!(el && !el.hidden && el.offsetParent !== null);
}
function isOpen(sel){
  const el = $(sel);
  return !!(el && el.classList.contains('on'));
}

const fmtRel = ts => {
  if (!ts) return 'nunca';
  const d = Date.now() - ts;
  const m = Math.floor(d/60000), h = Math.floor(d/3600000), dy = Math.floor(d/86400000);
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m} min`;
  if (h < 24) return `hace ${h} h`;
  if (dy < 30) return `hace ${dy} día${dy === 1 ? '' : 's'}`;
  const mo = Math.floor(dy/30);
  if (mo < 12) return `hace ${mo} mes${mo === 1 ? '' : 'es'}`;
  return `hace ${Math.floor(mo/12)} año(s)`;
};
const fmtBytes = b => { if (!b) return '0 B'; if (b < 1024) return b+' B'; if (b < 1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(2)+' MB'; };

function parseTimestampFromFilename(name){
  const s = String(name || '');
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})[_\-\s](\d{2})(\d{2})/);
  if (m){
    const [, y, mo, d, h, mi] = m;
    const dt = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d), parseInt(h), parseInt(mi));
    if (!isNaN(dt.getTime())) return dt.getTime();
  }
  const m2 = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2){
    const [, y, mo, d] = m2;
    const dt = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d));
    if (!isNaN(dt.getTime())) return dt.getTime();
  }
  return null;
}

function limpiarTituloParaBusqueda(titulo){
  let t = String(titulo || '').trim();
  if (!t) return '';
  t = t.replace(/[*#]+/g, ' ');
  t = t.replace(/\.{2,}/g, ' ');
  const parts = t.split(/\s*\/\s*/);
  if (parts.length === 2 && norm(parts[0]) === norm(parts[1])) t = parts[0];
  t = t.replace(/\s*[\(\[]\s*(en\s+vivo|live|live\s+at|unplugged|remaster(?:ed)?(?:\s+\d{4})?|deluxe(?:\s+edition)?|expanded(?:\s+edition)?|anniversary(?:\s+edition)?|bonus(?:\s+tracks?)?|special\s+edition|limited\s+edition|edici[oó]n\s+\w+)\s*[\)\]]\s*$/i, '').trim();
  t = t.replace(/\s*[-–—:]\s*(remaster(?:ed)?(?:\s+\d{4})?|deluxe(?:\s+edition)?|en\s+vivo|live)\s*$/i, '').trim();
  t = t.replace(/\s*\(\s*(en\s+vivo|live)\s*\)\s*$/i, '').trim();
  t = t.replace(/\s+(CD|VOL|VOLUMEN|PARTE|DISC|DISCO)\s*#?\s*\d+\s*$/i, '').trim();
  t = t.replace(/\s+GIRA\s+/i, ' ').trim();
  t = t.replace(/\s+([AB])\s*$/i, (m) => {
    const sinLado = t.replace(/\s+([AB])\s*$/i, '').trim();
    return sinLado.length >= 5 ? '' : m;
  }).trim();
  return t.replace(/\s+/g, ' ').trim();
}

const TYPOS_INTERPRETES = {
  'soda estereo':'Soda Stereo','soda estéreo':'Soda Stereo',
  'the beatle':'The Beatles','beatle':'The Beatles',
  'rolling stone':'The Rolling Stones','led zeppelin':'Led Zeppelin',
  'pink floid':'Pink Floyd','ac dc':'AC/DC','acdc':'AC/DC',
  'guns and roses':"Guns N' Roses",'gun n roses':"Guns N' Roses",
  'black sabath':'Black Sabbath','charly garcia':'Charly García',
  'charly garcía':'Charly García','luis alberto spinetta':'Luis Alberto Spinetta',
  'spinetta jade':'Spinetta Jade','seru giran':'Serú Girán',
  'seru girá':'Serú Girán','fito paez':'Fito Páez','fito páez':'Fito Páez',
  'enanos verdes':'Enanitos Verdes','los enanitos verdes':'Enanitos Verdes',
  'los fabulosos cadillacs':'Los Fabulosos Cadillacs',
  'patricio rey':'Patricio Rey y sus Redonditos de Ricota',
  'redonditos de ricota':'Patricio Rey y sus Redonditos de Ricota'
};
function limpiarInterpreteParaBusqueda(interprete){
  let i = String(interprete || '').trim();
  if (!i) return '';
  i = i.replace(/[*#]+/g, ' ').replace(/\s+/g, ' ').trim();
  const key = norm(i);
  if (TYPOS_INTERPRETES[key]) i = TYPOS_INTERPRETES[key];
  return i;
}

/* ═══════════════════════════════════════════════════════════════
   BÚSQUEDA FUZZY + FONÉTICA
   ═══════════════════════════════════════════════════════════════ */
function levenshtein(a, b){
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return Math.max(m, n);
  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++){
    curr[0] = i;
    for (let j = 1; j <= n; j++){
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j-1] + 1, prev[j-1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function fuzzyMatch(needle, haystack, maxDist = 2){
  const n = norm(needle);
  const h = norm(haystack);
  if (!n || !h) return false;
  if (h.includes(n)) return true;
  const nWords = n.split(/\s+/).filter(Boolean);
  const hWords = h.split(/\s+/).filter(Boolean);
  return nWords.every(nw => {
    if (nw.length < 4) return false;
    for (const hw of hWords){
      if (Math.abs(nw.length - hw.length) > maxDist) continue;
      if (levenshtein(nw, hw) <= maxDist) return true;
      if (nw.length >= 4 && hw.startsWith(nw.slice(0, 4))) return true;
    }
    return false;
  });
}

function phoneticKey(str){
  let s = norm(str);
  if (!s) return '';
  s = s
    .replace(/[bc]/g, 'k')
    .replace(/[fv]/g, 'f')
    .replace(/[zs]/g, 's')
    .replace(/[gj]/g, 'j')
    .replace(/[h]/g, '')
    .replace(/[y]/g, 'i')
    .replace(/ll/g, 'y')
    .replace(/qu/g, 'k')
    .replace(/gue/g, 'ge')
    .replace(/gui/g, 'gi')
    .replace(/[^a-z0-9]/g, '');
  s = s.replace(/([aeiou])\1+/g, '$1');
  return s;
}

function phoneticSimilar(a, b){
  const ka = phoneticKey(a);
  const kb = phoneticKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (Math.abs(ka.length - kb.length) > 2) return false;
  return levenshtein(ka, kb) <= 2;
}

/* ═══════════════════════════════════════════════════════════════
   BÚSQUEDA SEMÁNTICA
   ═══════════════════════════════════════════════════════════════ */
const SemanticSearch = (() => {
  const DECADES = {
    'sesenta': 1960, '60s': 1960, 'sixties': 1960,
    'setenta': 1970, '70s': 1970, 'seventies': 1970,
    'ochenta': 1980, '80s': 1980, 'eighties': 1980,
    'noventa': 1990, '90s': 1990, 'nineties': 1990,
    'dosmil': 2000, '2000s': 2000, 'y2k': 2000,
    'diez': 2010, '2010s': 2010
  };
  const GENRES = {
    'rock': ['rock','rock and roll','rocknroll','hard rock','soft rock','punk','metal'],
    'pop': ['pop','pop rock','synthpop'],
    'jazz': ['jazz','bebop','swing','blues'],
    'clasica': ['clasica','clásica','classical','barroco','romantico'],
    'electronica': ['electronica','electrónica','electronic','techno','house','ambient'],
    'folklore': ['folklore','folk','country','acustico','acústico'],
    'tango': ['tango','milonga','candombe'],
    'cumbia': ['cumbia','cuarteto','reggaeton'],
    'indie': ['indie','alternativo','alternative'],
    'latina': ['latina','latino','latin','salsa','bachata','bolero']
  };
  function parse(query){
    const q = norm(query);
    const filters = { genero: null, decada: null, pais: null, anioMin: null, anioMax: null, remaining: q };
    for (const [word, year] of Object.entries(DECADES)){
      if (q.includes(word)){
        filters.decada = year;
        filters.anioMin = year;
        filters.anioMax = year + 9;
        filters.remaining = filters.remaining.replace(word, '').trim();
        break;
      }
    }
    for (const [genre, keywords] of Object.entries(GENRES)){
      for (const kw of keywords){
        if (q.includes(kw)){
          filters.genero = genre;
          filters.remaining = filters.remaining.replace(kw, '').trim();
          break;
        }
      }
      if (filters.genero) break;
    }
    const COUNTRIES = {
      'argentina': ['argentina','argentino','arg'],
      'brasil': ['brasil','brasilero','brasileño','brazil'],
      'mexico': ['mexico','méxico','mexicano'],
      'españa': ['españa','espana','español','spanish'],
      'usa': ['usa','eeuu','americano','yanqui'],
      'inglaterra': ['inglaterra','ingles','britanico','uk']
    };
    for (const [country, keywords] of Object.entries(COUNTRIES)){
      for (const kw of keywords){
        if (q.includes(kw)){
          filters.pais = country;
          filters.remaining = filters.remaining.replace(kw, '').trim();
          break;
        }
      }
      if (filters.pais) break;
    }
    filters.remaining = filters.remaining
      .replace(/\b(de|del|los|las|el|la|un|una|y|o|en|con|para|por)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return filters;
  }
  function isSemantic(query){
    const f = parse(query);
    return !!(f.genero || f.decada || f.pais);
  }
  function match(cd, query){
    const f = parse(query);
    if (f.genero){
      const cdG = norm(cd.genero || '');
      const keywords = GENRES[f.genero] || [];
      if (!keywords.some(k => cdG.includes(k))) return false;
    }
    if (f.anioMin && cd.anio){
      if (cd.anio < f.anioMin || cd.anio > f.anioMax) return false;
    }
    if (f.pais){
      const cdP = norm(cd.pais || '');
      const COUNTRY_KEYWORDS = {
        'argentina': ['argentina','arg'],
        'brasil': ['brasil','brazil'],
        'mexico': ['mexico'],
        'españa': ['españa','spain'],
        'usa': ['usa','estados unidos','eeuu'],
        'inglaterra': ['inglaterra','uk','reino unido']
      };
      const kws = COUNTRY_KEYWORDS[f.pais] || [];
      if (!kws.some(k => cdP.includes(k))) return false;
    }
    if (f.remaining && f.remaining.length >= 3){
      const h = norm([cd.titulo, cd.interprete, cd.sello].join(' '));
      if (!h.includes(f.remaining)) return false;
    }
    return true;
  }
  return { parse, isSemantic, match };
})();