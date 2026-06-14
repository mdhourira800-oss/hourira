'use strict';

/* ─────────────────────────────────────────────
   STREAM URL RESOLVER
   On HTTPS (Netlify): route through _redirects proxy → /stream/...
   On HTTP  (direct) : use original server URLs directly
   ───────────────────────────────────────────── */
const IS_HTTPS   = location.protocol === 'https:';
const STREAM_SRV = 'http://198.195.239.50:8095';
const IMG_SRV    = 'http://198.195.239.50';

function streamUrl(path) {
  // path e.g. "/tsports/index.m3u8"
  return IS_HTTPS ? '/stream' + path : STREAM_SRV + path;
}
function imgUrl(path) {
  // path e.g. "/img/channels/T SPORTS.png"
  return IS_HTTPS ? path : IMG_SRV + path;
}

/* ─────────────────────────────────────────────
   STATE
   ───────────────────────────────────────────── */
let allChannels        = [];
let activeFilter       = 'all';
let searchQuery        = '';
let currentHls         = null;
let mobileHls          = null;
let currentCh          = null;
let controlsTimer      = null;
let mobileControlsTimer = null;

/* ─────────────────────────────────────────────
   DOM REFS
   ───────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const channelList       = $('channelList');
const filterTabs        = $('filterTabs');
const searchInput       = $('searchInput');
const mobileSearchInput = $('mobileSearchInput');
const mobileSearchBar   = $('mobileSearchBar');
const searchToggleBtn   = $('searchToggleBtn');
const hamburger         = $('hamburger');
const mobileNavMenu     = $('mobileNavMenu');
const navLinks          = document.querySelectorAll('.nav-link[data-filter]');
const playerEmpty       = $('playerEmpty');
const videoWrap         = $('videoWrap');
const liveVideo         = $('liveVideo');
const videoOverlay      = $('videoOverlay');
const videoSpinner      = $('videoSpinner');
const bigPlayBtn        = $('bigPlayBtn');
const overlayLogo       = $('overlayLogo');
const overlayChName     = $('overlayChName');
const nowPlayingBar     = $('nowPlayingBar');
const npLogo            = $('npLogo');
const npName            = $('npName');
const npCat             = $('npCat');
const btnPlayPause      = $('btnPlayPause');
const ppIcon            = $('ppIcon');
const btnMute           = $('btnMute');
const muteIcon          = $('muteIcon');
const volumeRange       = $('volumeRange');
const btnFullscreen     = $('btnFullscreen');
const fsIcon            = $('fsIcon');
const btnPip            = $('btnPip');
const qualitySelect     = $('qualitySelect');
const mobileModal       = $('mobileModal');
const modalCloseBtn     = $('modalCloseBtn');
const mobileVideo       = $('mobileVideo');
const mobileSpinner     = $('mobileSpinner');
const mobileOverlay     = $('mobileOverlay');
const mobileOverlayLogo = $('mobileOverlayLogo');
const mobileChName      = $('mobileChName');
const mobilePpBtn       = $('mobilePpBtn');
const mobilePpIcon      = $('mobilePpIcon');
const mobileMuteBtn     = $('mobileMuteBtn');
const mobileMuteIcon    = $('mobileMuteIcon');
const mobileFsBtn       = $('mobileFsBtn');
const mobileFullBtn     = $('mobileFullBtn');
const modalNpName       = $('modalNpName');
const modalNpCat        = $('modalNpCat');
const mobileBottomNav   = $('mobileBottomNav');
const header            = $('header');

/* ─────────────────────────────────────────────
   CHANNEL DATA  (embedded — no external fetch needed)
   ───────────────────────────────────────────── */
const CHANNELS = [
  { name:'TSPORTS HD',           cat:'Sports',       path:'/tsports/index.m3u8',            logo:'T SPORTS.png' },
  { name:'STAR SPORTS 1',        cat:'Sports',       path:'/starSports1/index.m3u8',         logo:'STAR SPORTS1 HD.png' },
  { name:'STAR SPORTS 2',        cat:'Sports',       path:'/starSports2/index.m3u8',         logo:'STAR SPORTS2 HD.png' },
  { name:'STAR SPORTS 3',        cat:'Sports',       path:'/starSports3/index.m3u8',         logo:'STAR SPORTS3.png' },
  { name:'STAR SPORTS SELECT 1', cat:'Sports',       path:'/starSportsSelect1/index.m3u8',   logo:'STAR SPORTS SELECT1 HD.png' },
  { name:'STAR SPORTS SELECT 2', cat:'Sports',       path:'/starSportsSelect2/index.m3u8',   logo:'STAR SPORTS SELECT2 HD.png' },
  { name:'SONY SPORTS 1 HD',     cat:'Sports',       path:'/sonyTenSports1/index.m3u8',      logo:'SONY SPORTS1 HD.png' },
  { name:'SONY SPORTS 2 HD',     cat:'Sports',       path:'/sonyTenSports2/index.m3u8',      logo:'SONY SPORTS2 HD.png' },
  { name:'SONY SPORTS 3 HD',     cat:'Sports',       path:'/sonyTenSports3/index.m3u8',      logo:'SONY SPORTS3 HD.png' },
  { name:'SONY SPORTS 5 HD',     cat:'Sports',       path:'/sonyTenSports5/index.m3u8',      logo:'SONY SPORTS5 HD.png' },
  { name:'PTV SPORTS',           cat:'Sports',       path:'/ptv/index.m3u8',                 logo:'PTV SPORTS HD.png' },
  { name:'EURO SPORTS HD',       cat:'Sports',       path:'/euroSports/index.m3u8',          logo:'EUROSPORTS HD.png' },
  { name:'SOMOY TV HD',          cat:'News',         path:'/somoyTv/index.m3u8',             logo:'SOMOY TV.png' },
  { name:'CHANNEL 24',           cat:'News',         path:'/channel24/index.m3u8',           logo:'CHANNEL 24.png' },
  { name:'ATN NEWS HD',          cat:'News',         path:'/atnNews/index.m3u8',             logo:'ATN NEWS.png' },
  { name:'EKATTOR TV HD',        cat:'News',         path:'/ekattorTv/index.m3u8',           logo:'EKATTOR_TV.png' },
  { name:'JAMUNA TV',            cat:'News',         path:'/jamunaTv/index.m3u8',            logo:'JAMUNA TV.png' },
  { name:'ATN BANGLA HD',        cat:'Bangla',       path:'/atnBangla/index.m3u8',           logo:'ATN BANGLA.png' },
  { name:'BANGLA VISION HD',     cat:'Bangla',       path:'/banglaVision/index.m3u8',        logo:'BANGLA_VISION.png' },
  { name:'CHANNEL I HD',         cat:'Bangla',       path:'/channelI/index.m3u8',            logo:'CHANNEL I.png' },
  { name:'NTV HD',               cat:'Bangla',       path:'/ntv/index.m3u8',                 logo:'NTV.png' },
  { name:'DEEPTO TV',            cat:'Bangla',       path:'/deepto/index.m3u8',              logo:'DEEPTO.png' },
  { name:'BTV',                  cat:'Bangla',       path:'/btv/index.m3u8',                 logo:'BTV.HD.png' },
  { name:'STAR JALSHA HD',       cat:'Indian Bangla',path:'/starJalsha/index.m3u8',          logo:'STAR JALSHA HD.png' },
  { name:'JALSHA MOVIES HD',     cat:'Indian Bangla',path:'/jalshaMovies/index.m3u8',        logo:'JALSHA MOVIES HD.png' },
  { name:'ZEE BANGLA HD',        cat:'Indian Bangla',path:'/zeeBangla/index.m3u8',           logo:'ZEE BANGLA HD.png' },
  { name:'COLORS BANGLA CINEMA', cat:'Indian Bangla',path:'/colorsBanglaChinema/index.m3u8', logo:'COLORS BANGLA CINEMA.png' },
  { name:'SONY AATH',            cat:'Indian Bangla',path:'/sonyAath/index.m3u8',            logo:'SONY AATH.png' },
  { name:'STAR PLUS HD',         cat:'Hindi',        path:'/starPlus/index.m3u8',            logo:'STAR PLUS HD.png' },
  { name:'STAR MOVIES HD',       cat:'Hindi',        path:'/starMovies/index.m3u8',          logo:'STAR MOVIES HD.png' },
  { name:'SONY MAX HD',          cat:'Hindi',        path:'/sonyMax/index.m3u8',             logo:'SONY MAX HD.png' },
  { name:'SONY ENTERTAINMENT HD',cat:'Hindi',        path:'/sonyEntertainment/index.m3u8',   logo:'SONY ENTERTAINMENT HD.png' },
  { name:'COLORS HD',            cat:'Hindi',        path:'/colors/index.m3u8',              logo:'COLORS HD.png' },
  { name:'COLORS CINEPLEX HD',   cat:'Hindi',        path:'/colorsCineplex/index.m3u8',      logo:'COLORS CINEPLEX HD.png' },
  { name:'SANGEET BANGLA',       cat:'Music',        path:'/sangeetBangla/index.m3u8',       logo:'SANGEET BANGLA.png' },
  { name:'9XM MUSIC',            cat:'Music',        path:'/9xm/index.m3u8',                 logo:'9XM MUSIC.png' },
  { name:'DISCOVERY HD',         cat:'Documentary',  path:'/discovery/index.m3u8',           logo:'DISCOVERY HD.png' },
  { name:'CARTOON NETWORK HD',   cat:'Kids',         path:'/cartoonNetwork/index.m3u8',      logo:'CARTOON NETWORK.png' },
  { name:'DISCOVERY KIDS HD',    cat:'Kids',         path:'/disnepKids/index.m3u8',          logo:'DISCOVERY KIDS.png' },
];

/* Build full channel objects */
allChannels = CHANNELS.map(c => ({
  name:     c.name,
  category: c.cat,
  url:      streamUrl(c.path),
  logo:     imgUrl('/img/channels/' + c.logo),
}));

/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */
function isMobile() { return window.innerWidth <= 768; }

function fallbackSvg(name) {
  const a = encodeURIComponent(name.substring(0,3).toUpperCase());
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect width="60" height="60" rx="30" fill="%236c63ff"/><text x="50%25" y="55%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="16" font-weight="bold" font-family="Poppins,sans-serif">${a}</text></svg>`;
}

function showEl(el, v) { el.style.display = v ? 'flex' : 'none'; }

/* ─────────────────────────────────────────────
   RENDER CHANNELS
   ───────────────────────────────────────────── */
function renderChannels() {
  channelList.innerHTML = '';
  const q = searchQuery.toLowerCase();
  const list = allChannels.filter(ch => {
    const okCat  = activeFilter === 'all' || ch.category === activeFilter;
    const okFind = ch.name.toLowerCase().includes(q) || ch.category.toLowerCase().includes(q);
    return okCat && okFind;
  });

  if (!list.length) {
    channelList.innerHTML = '<li style="grid-column:1/-1;text-align:center;padding:30px;color:#6b7280"><i class="fas fa-search" style="font-size:1.5rem;display:block;margin-bottom:10px"></i>No channels found.</li>';
    return;
  }

  list.forEach((ch, i) => {
    const li = document.createElement('li');
    li.className = 'ch-item';
    li.style.animationDelay = `${(i % 20) * 28}ms`;
    if (currentCh && currentCh.url === ch.url) li.classList.add('active');
    li.innerHTML = `
      <div class="ch-logo-wrap">
        <img src="${ch.logo}" alt="${ch.name}" loading="lazy" onerror="this.src='${fallbackSvg(ch.name)}'">
      </div>
      <div class="ch-name">${ch.name}</div>`;
    li.addEventListener('click', () => play(ch, li));
    channelList.appendChild(li);
  });
}

/* ─────────────────────────────────────────────
   PLAY
   ───────────────────────────────────────────── */
function play(ch, liEl) {
  currentCh = ch;
  document.querySelectorAll('.ch-item').forEach(i => i.classList.remove('active'));
  if (liEl) liEl.classList.add('active');
  isMobile() ? openMobile(ch) : openDesktop(ch);
}

/* ─────────────────────────────────────────────
   DESKTOP PLAYER
   ───────────────────────────────────────────── */
function openDesktop(ch) {
  showEl(playerEmpty, false);
  videoWrap.style.display     = 'flex';
  nowPlayingBar.style.display = 'flex';
  overlayLogo.src   = ch.logo;
  overlayChName.textContent = ch.name;
  npLogo.src        = ch.logo;
  npName.textContent = ch.name;
  npCat.textContent  = ch.category;
  showEl(videoSpinner, true);
  bigPlayBtn.style.display = 'none';
  ppIcon.className = 'fas fa-pause';
  if (currentHls) { currentHls.destroy(); currentHls = null; }
  currentHls = hlsPlay(ch.url, liveVideo,
    hls  => { showEl(videoSpinner, false); buildQuality(hls); },
    ()   => showEl(videoSpinner, false)
  );
}

function buildQuality(hls) {
  qualitySelect.innerHTML = '<option value="-1">Auto</option>';
  if (hls && hls.levels && hls.levels.length > 1) {
    hls.levels.forEach((l, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = l.height ? `${l.height}p` : `Level ${i+1}`;
      qualitySelect.appendChild(o);
    });
    qualitySelect.style.display = 'inline-block';
  } else qualitySelect.style.display = 'none';
}

/* ─────────────────────────────────────────────
   MOBILE PLAYER
   ───────────────────────────────────────────── */
function openMobile(ch) {
  mobileOverlayLogo.src    = ch.logo;
  mobileChName.textContent = ch.name;
  modalNpName.textContent  = ch.name;
  modalNpCat.textContent   = ch.category;
  mobilePpIcon.className   = 'fas fa-pause';
  showEl(mobileSpinner, true);
  mobileModal.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (mobileHls) { mobileHls.destroy(); mobileHls = null; }
  mobileHls = hlsPlay(ch.url, mobileVideo,
    () => showEl(mobileSpinner, false),
    () => showEl(mobileSpinner, false)
  );
  showMobileCtrl();
}

function closeMobile() {
  mobileModal.classList.remove('open');
  document.body.style.overflow = '';
  if (mobileHls) { mobileHls.destroy(); mobileHls = null; }
  mobileVideo.pause();
  mobileVideo.removeAttribute('src');
  mobileVideo.load();
}

function showMobileCtrl() {
  mobileOverlay.style.cssText = 'opacity:1;pointer-events:auto';
  clearTimeout(mobileControlsTimer);
  mobileControlsTimer = setTimeout(() =>
    mobileOverlay.style.cssText = 'opacity:0;pointer-events:none', 3500);
}

mobileModal.addEventListener('click', e => {
  if (!modalCloseBtn.contains(e.target)) showMobileCtrl();
});

/* ─────────────────────────────────────────────
   HLS.JS CORE
   ───────────────────────────────────────────── */
function hlsPlay(url, vid, onReady, onErr) {
  if (typeof Hls === 'undefined') { onErr && onErr(); return null; }

  if (Hls.isSupported()) {
    const hls = new Hls({
      maxBufferLength:         30,
      startLevel:              -1,
      enableWorker:            true,
      lowLatencyMode:          true,
      manifestLoadingMaxRetry: 6,
      levelLoadingMaxRetry:    6,
      fragLoadingMaxRetry:     6,
      xhrSetup(xhr) {
        xhr.withCredentials = false;
      },
    });
    hls.loadSource(url);
    hls.attachMedia(vid);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      vid.play().catch(() => {});
      onReady && onReady(hls);
    });
    hls.on(Hls.Events.ERROR, (_e, d) => {
      if (!d.fatal) return;
      if      (d.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
      else if (d.type === Hls.ErrorTypes.MEDIA_ERROR)   hls.recoverMediaError();
      else { hls.destroy(); onErr && onErr(); }
    });
    return hls;
  }

  // Safari native HLS
  if (vid.canPlayType('application/vnd.apple.mpegurl')) {
    vid.src = url;
    vid.addEventListener('loadedmetadata', () => {
      vid.play().catch(() => {});
      onReady && onReady(null);
    }, { once: true });
    return null;
  }

  onErr && onErr();
  return null;
}

/* ─────────────────────────────────────────────
   DESKTOP CONTROLS
   ───────────────────────────────────────────── */
btnPlayPause.addEventListener('click', () => {
  if (liveVideo.paused) {
    liveVideo.play(); ppIcon.className = 'fas fa-pause'; bigPlayBtn.style.display = 'none';
  } else {
    liveVideo.pause(); ppIcon.className = 'fas fa-play'; bigPlayBtn.style.display = 'flex';
  }
});
bigPlayBtn.addEventListener('click', () => {
  liveVideo.play(); ppIcon.className = 'fas fa-pause'; bigPlayBtn.style.display = 'none';
});
btnMute.addEventListener('click', () => {
  liveVideo.muted = !liveVideo.muted;
  muteIcon.className = liveVideo.muted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
  volumeRange.value  = liveVideo.muted ? 0 : liveVideo.volume;
});
volumeRange.addEventListener('input', e => {
  const v = +e.target.value;
  liveVideo.volume = v; liveVideo.muted = !v;
  muteIcon.className = !v ? 'fas fa-volume-mute' : v < 0.4 ? 'fas fa-volume-down' : 'fas fa-volume-up';
});
btnFullscreen.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    videoWrap.requestFullscreen().catch(() => {});
    fsIcon.className = 'fas fa-compress';
  } else { document.exitFullscreen(); }
});
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) fsIcon.className = 'fas fa-expand';
});
btnPip.addEventListener('click', async () => {
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await liveVideo.requestPictureInPicture();
  } catch(_) {}
});
qualitySelect.addEventListener('change', () => {
  if (currentHls) currentHls.currentLevel = +qualitySelect.value;
});

videoWrap.addEventListener('mousemove', resetCtrlTimer);
videoWrap.addEventListener('click',     resetCtrlTimer);
function resetCtrlTimer() {
  videoOverlay.classList.add('force-show');
  clearTimeout(controlsTimer);
  controlsTimer = setTimeout(() => videoOverlay.classList.remove('force-show'), 3000);
}

document.addEventListener('keydown', e => {
  if (!currentCh || isMobile()) return;
  if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
  if (e.code === 'Space' || e.code === 'KeyK') { e.preventDefault(); btnPlayPause.click(); }
  else if (e.code === 'KeyM') btnMute.click();
  else if (e.code === 'KeyF') btnFullscreen.click();
  else if (e.code === 'ArrowUp')   { e.preventDefault(); liveVideo.volume = Math.min(1, liveVideo.volume+.1); volumeRange.value = liveVideo.volume; }
  else if (e.code === 'ArrowDown') { e.preventDefault(); liveVideo.volume = Math.max(0, liveVideo.volume-.1); volumeRange.value = liveVideo.volume; }
});

/* ─────────────────────────────────────────────
   MOBILE CONTROLS
   ───────────────────────────────────────────── */
mobilePpBtn.addEventListener('click',   e => { e.stopPropagation(); mobileVideo.paused ? (mobileVideo.play(), mobilePpIcon.className='fas fa-pause') : (mobileVideo.pause(), mobilePpIcon.className='fas fa-play'); showMobileCtrl(); });
mobileMuteBtn.addEventListener('click', e => { e.stopPropagation(); mobileVideo.muted=!mobileVideo.muted; mobileMuteIcon.className=mobileVideo.muted?'fas fa-volume-mute':'fas fa-volume-up'; showMobileCtrl(); });
mobileFullBtn.addEventListener('click', e => { e.stopPropagation(); const v=mobileVideo; (v.requestFullscreen||v.webkitRequestFullscreen||v.webkitEnterFullscreen||function(){}).call(v); });
mobileFsBtn.addEventListener('click',   e => { e.stopPropagation(); mobileFullBtn.click(); });
modalCloseBtn.addEventListener('click', e => { e.stopPropagation(); closeMobile(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobile(); });

/* ─────────────────────────────────────────────
   FILTERS + SEARCH
   ───────────────────────────────────────────── */
function setFilter(f) { activeFilter = f; renderChannels(); }
function syncTabs(f)  { document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter===f)); }

filterTabs.addEventListener('click', e => {
  const t = e.target.closest('.filter-tab'); if (!t) return;
  document.querySelectorAll('.filter-tab').forEach(x => x.classList.remove('active'));
  t.classList.add('active'); setFilter(t.dataset.filter);
});
mobileBottomNav.addEventListener('click', e => {
  const b = e.target.closest('.mob-nav-btn'); if (!b) return;
  document.querySelectorAll('.mob-nav-btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); setFilter(b.dataset.filter); syncTabs(b.dataset.filter);
  if (isMobile()) document.getElementById('sidebar').scrollIntoView({behavior:'smooth'});
});
navLinks.forEach(l => l.addEventListener('click', e => {
  e.preventDefault();
  navLinks.forEach(x => x.classList.remove('active')); l.classList.add('active');
  setFilter(l.dataset.filter); syncTabs(l.dataset.filter);
}));
document.querySelectorAll('.mobile-nav-menu .nav-link').forEach(l => l.addEventListener('click', e => {
  e.preventDefault();
  document.querySelectorAll('.mobile-nav-menu .nav-link').forEach(x => x.classList.remove('active'));
  l.classList.add('active'); setFilter(l.dataset.filter); syncTabs(l.dataset.filter); closeMenu();
}));

searchInput.addEventListener('input',       e => { searchQuery = e.target.value.trim(); renderChannels(); });
mobileSearchInput.addEventListener('input', e => { searchQuery = e.target.value.trim(); renderChannels(); });
searchToggleBtn.addEventListener('click', () => {
  const open = mobileSearchBar.classList.toggle('open');
  if (open) mobileSearchInput.focus();
  else { mobileSearchInput.value=''; searchQuery=''; renderChannels(); }
});

/* ─────────────────────────────────────────────
   HAMBURGER
   ───────────────────────────────────────────── */
hamburger.addEventListener('click', () => {
  const o = mobileNavMenu.classList.toggle('open');
  hamburger.classList.toggle('open', o);
  if (o) mobileSearchBar.classList.remove('open');
});
function closeMenu() { mobileNavMenu.classList.remove('open'); hamburger.classList.remove('open'); }
document.addEventListener('click', e => {
  if (!hamburger.contains(e.target) && !mobileNavMenu.contains(e.target)) closeMenu();
  if (!searchToggleBtn.contains(e.target) && !mobileSearchBar.contains(e.target)) mobileSearchBar.classList.remove('open');
});

/* ─────────────────────────────────────────────
   MISC
   ───────────────────────────────────────────── */
window.addEventListener('scroll', () => {
  header.style.boxShadow = window.scrollY > 4 ? '0 4px 20px rgba(0,0,0,.6)' : '';
}, {passive:true});
window.addEventListener('resize', () => {
  if (!currentCh) return;
  if (!isMobile() && mobileModal.classList.contains('open')) { closeMobile(); openDesktop(currentCh); }
}, {passive:true});

/* ─────────────────────────────────────────────
   ANTI-INSPECT  (multi-layer protection)
   ───────────────────────────────────────────── */
(function _shield() {

  /* 1 ── Disable right-click */
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault(); e.stopPropagation(); return false;
  }, true);

  /* 2 ── Block all DevTools keyboard shortcuts */
  document.addEventListener('keydown', function(e) {
    // F12
    if (e.key === 'F12') { e.preventDefault(); e.stopPropagation(); return false; }
    var cm = e.ctrlKey || e.metaKey;
    // Ctrl+Shift+I/J/C/K/E  (inspect, console, element, source)
    if (cm && e.shiftKey && ['i','j','c','k','e'].indexOf(e.key.toLowerCase()) > -1) {
      e.preventDefault(); e.stopPropagation(); return false;
    }
    // Ctrl+U (view-source), Ctrl+S (save), Ctrl+P (print), Ctrl+A (select all)
    if (cm && ['u','s','p','a'].indexOf(e.key.toLowerCase()) > -1) {
      e.preventDefault(); e.stopPropagation(); return false;
    }
  }, true);

  /* 3 ── Disable text selection everywhere except inputs */
  document.addEventListener('selectstart', function(e) {
    var t = e.target.tagName;
    if (t !== 'INPUT' && t !== 'TEXTAREA') { e.preventDefault(); return false; }
  }, true);

  /* 4 ── Disable drag */
  document.addEventListener('dragstart', function(e) {
    e.preventDefault(); return false;
  }, true);

  /* 5 ── Disable copy/cut */
  document.addEventListener('copy',  function(e) { e.preventDefault(); return false; }, true);
  document.addEventListener('cut',   function(e) { e.preventDefault(); return false; }, true);

  /* 6 ── Disable print */
  window.onbeforeprint = function() { document.body.style.display = 'none'; };
  window.onafterprint  = function() { document.body.style.display = ''; };

  /* 7 ── DevTools size detection (window gap method) */
  var _devOpen  = false;
  var _THRESH   = 160;
  var _warnHTML = '<div style="position:fixed;inset:0;background:#0a0a0f;z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;font-family:Poppins,sans-serif;color:#fff;text-align:center;padding:30px;user-select:none"><div style="font-size:4rem">🚫</div><h1 style="font-size:1.8rem;font-weight:800;color:#ef4444;margin:0">Access Denied</h1><p style="color:#b0b8d4;font-size:.95rem;max-width:360px;line-height:1.6;margin:0">Developer tools are not allowed on this page.<br>Please close DevTools and reload.</p><button onclick="location.reload()" style="padding:12px 32px;background:linear-gradient(135deg,#6c63ff,#a855f7);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;margin-top:4px">↻ Reload Page</button></div>';

  function _checkDevTools() {
    var widthGap  = window.outerWidth  - window.innerWidth;
    var heightGap = window.outerHeight - window.innerHeight;
    if (widthGap > _THRESH || heightGap > _THRESH) {
      if (!_devOpen) {
        _devOpen = true;
        try { document.body.innerHTML = _warnHTML; } catch(x) {}
      }
    } else {
      _devOpen = false;
    }
  }
  setInterval(_checkDevTools, 800);

  /* 8 ── DevTools detection via console.log timing trick */
  var _element = new Image();
  Object.defineProperty(_element, 'id', {
    get: function() {
      _devOpen = true;
      try { document.body.innerHTML = _warnHTML; } catch(x) {}
    }
  });

  /* 9 ── Continuous debugger trap — makes stepping impossible */
  (function _dbgTrap() {
    try { (function(){})['constructor']('debugger')(); } catch(x) {}
    setTimeout(_dbgTrap, 100);
  })();

  /* 10 ── toString override detection */
  var _nativeAlert = window.alert.toString();
  setInterval(function() {
    if (window.alert.toString() !== _nativeAlert) {
      try { document.body.innerHTML = _warnHTML; } catch(x) {}
    }
  }, 2000);

  /* 11 ── Override common console methods so they do nothing */
  try {
    var _noop = function(){};
    ['log','warn','error','info','debug','table','dir','trace'].forEach(function(m) {
      try { Object.defineProperty(console, m, { get: function(){ return _noop; }, set: function(){} }); } catch(x) {}
    });
  } catch(x) {}

})();


/* ─────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────── */
renderChannels();
