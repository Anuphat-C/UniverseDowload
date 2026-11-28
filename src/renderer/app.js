'use strict';
/* global ud — มาจาก preload (contextBridge) */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// ---------- icons (เส้นแบบ Lucide) ----------
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  download: '<path d="M12 3v12m0 0-5-5m5 5 5-5M4 20h16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  settings: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  'eye-off': '<path d="M9.9 4.2A10 10 0 0 1 12 4c7 0 10 8 10 8a17 17 0 0 1-2.2 3.4M6.6 6.6A17 17 0 0 0 2 12s3 8 10 8a10 10 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/>',
  sort: '<path d="m3 16 4 4 4-4M7 20V4M21 8l-4-4-4 4M17 4v16"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  rows: '<rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  play: '<path d="M6 4v16l14-8Z"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>'
};
const icon = n => `<i data-icon="${n}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg></i>`;
function hydrateIcons(root = document) {
  root.querySelectorAll('i[data-icon]:empty').forEach(el => { el.outerHTML = icon(el.dataset.icon); });
}

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const thumbUrl = u => (u ? `udthumb://t/?u=${encodeURIComponent(u)}` : '');
function fmtDur(s) {
  s = Math.round(s || 0); if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}
function fmtBytes(n) {
  if (!n) return '';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${u[i]}`;
}
const fmtSpeed = b => (b ? fmtBytes(b) + '/s' : '');
function fmtEta(s) {
  if (s == null || !isFinite(s)) return '';
  s = Math.round(s);
  if (s < 60) return `เหลือ ${s} วิ`;
  if (s < 3600) return `เหลือ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} นาที`;
  return `เหลือ ${Math.floor(s / 3600)} ชม. ${Math.floor((s % 3600) / 60)} นาที`;
}
function fmtDate(d) {
  if (!d || d.length !== 8) return '';
  const dt = new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8));
  return dt.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}
function fmtViews(n) {
  if (!n) return '';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M ครั้ง';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K ครั้ง';
  return n + ' ครั้ง';
}
const hostOf = u => { try { return new URL(u).hostname.replace(/^(www|m|mobile)\./, ''); } catch { return u; } };
function extractUrls(text) {
  const out = [];
  for (let line of String(text || '').split(/[\s,]+/)) {
    line = line.trim().replace(/^[<("']+|[>)"']+$/g, '');
    if (!line) continue;
    if (!/^https?:\/\//i.test(line) && /^[\w-]+(\.[\w-]+)+\/?/.test(line)) line = 'https://' + line;
    if (/^https?:\/\/[^\s]+\.[^\s]+/i.test(line)) out.push(line);
  }
  return [...new Set(out)];
}
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const PRESETS = [
  ['best', 'วิดีโอ · คมชัดที่สุด'],
  ['2160', 'วิดีโอ · 4K (2160p)'],
  ['1440', 'วิดีโอ · 1440p'],
  ['1080', 'วิดีโอ · 1080p'],
  ['720', 'วิดีโอ · 720p'],
  ['480', 'วิดีโอ · 480p'],
  ['360', 'วิดีโอ · 360p (ไฟล์เล็ก)'],
  ['audio-mp3', 'เสียง · MP3'],
  ['audio-m4a', 'เสียง · M4A'],
  ['original', 'ไฟล์ต้นฉบับ (ไม่แปลง)']
];

// ---------- state ----------
const S = {
  settings: {}, items: [], byKey: new Map(), selected: new Set(), anchor: null,
  sources: new Map(), archive: new Set(), queuedKeys: new Set(), reversed: false, filter: '',
  jobs: new Map(), history: [], aspect: null, tools: null, seq: 0, stats: {}, view: 'browse'
};

// ---------- toast / modal ----------
function toast(text, kind = 'info', action) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<span>${esc(text)}</span>`;
  if (action) {
    const b = document.createElement('button'); b.textContent = action.label;
    b.onclick = () => { action.run(); el.remove(); };
    el.appendChild(b);
  }
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = 0; setTimeout(() => el.remove(), 300); }, kind === 'err' || action ? 8000 : 4000);
}
// เตือนเรื่องคุกกี้ครั้งเดียวต่อนาที (ดึงหลายลิงก์/โหลดหลายคลิปพร้อมกันจะไม่เด้งซ้ำ)
let lastCookieWarn = 0;
function warnCookieOnce(text) {
  if (Date.now() - lastCookieWarn < 60000) return;
  lastCookieWarn = Date.now();
  toast(text, 'warn', { label: 'เปิดตั้งค่า', run: () => go('settings') });
}
function showModal(title, body) { $('#modalTitle').textContent = title; $('#modalBody').textContent = body; $('#modal').classList.remove('hidden'); }
$('#modalClose').onclick = () => $('#modal').classList.add('hidden');
$('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').classList.add('hidden'); };

// ---------- navigation ----------
function go(view) {
  $$('.nav').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  if (view === 'history') loadHistory();
  if (view === 'settings') renderSettings();
  S.view = view;
}
$$('.nav').forEach(b => (b.onclick = () => go(b.dataset.view)));

// ---------- theme ----------
const mq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const t = S.settings.theme === 'system' ? (mq.matches ? 'dark' : 'light') : S.settings.theme;
  document.documentElement.dataset.theme = t;
  const cs = getComputedStyle(document.documentElement);
  ud.invoke('theme:titlebar', { color: cs.getPropertyValue('--bg').trim(), symbol: cs.getPropertyValue('--muted').trim() });
}
mq.addEventListener('change', applyTheme);

async function setSetting(patch) {
  S.settings = await ud.invoke('settings:set', patch);
  return S.settings;
}

// ================= BROWSE =================
const grid = $('#grid');
const urlInput = $('#urlInput');

function autoGrow() { urlInput.style.height = 'auto'; urlInput.style.height = Math.min(140, urlInput.scrollHeight) + 'px'; }
urlInput.addEventListener('input', autoGrow);
urlInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.ctrlKey ? quickDownload() : startFetchFromInput(); }
});
$('#btnFetch').onclick = () => startFetchFromInput();
$('#btnQuick').onclick = () => quickDownload();
$('#btnPaste').onclick = async () => {
  const t = await ud.invoke('clipboard:read');
  if (!extractUrls(t).length) return toast('คลิปบอร์ดไม่มีลิงก์', 'warn');
  urlInput.value = t.trim(); autoGrow(); startFetchFromInput();
};

function startFetchFromInput() {
  const urls = extractUrls(urlInput.value);
  if (!urls.length) { urlInput.focus(); return toast('ใส่ลิงก์ก่อน (วางได้หลายลิงก์ บรรทัดละลิงก์)', 'warn'); }
  for (const u of urls) startFetch(u, 1, S.settings.fetchLimit);
  urlInput.value = ''; autoGrow();
  $('#clipHint').classList.add('hidden');
}

async function quickDownload() {
  const urls = extractUrls(urlInput.value);
  if (!urls.length) { urlInput.focus(); return toast('ใส่ลิงก์ก่อน', 'warn'); }
  const items = urls.map(u => ({ url: u, title: u, kind: 'quick', thumb: '', uploader: hostOf(u), key: '' }));
  await ud.invoke('queue:add', items, { numbering: false });
  urlInput.value = ''; autoGrow();
  toast(`ส่ง ${urls.length} ลิงก์เข้าคิวแล้ว`, 'ok', { label: 'ดูคิว', run: () => go('queue') });
}

async function startFetch(url, start = 1, limit = 60, existingSrc) {
  const id = await ud.invoke('fetch:start', { url, start, limit });
  let src = existingSrc;
  if (src) { S.sources.delete(src.id); src.id = id; Object.assign(src, { status: 'loading', error: null, note: null, batch: 0, limit, start }); }
  else src = { id, url, host: hostOf(url), status: 'loading', count: 0, batch: 0, hasMore: false, limit, start, error: null };
  S.sources.set(id, src);
  renderSources();
}

ud.on('fetch:items', ({ id, items }) => {
  const src = S.sources.get(id);
  if (!src) return;
  const fresh = [];
  for (const it of items) {
    const k = it.key || it.url;
    if (S.byKey.has(k)) continue;
    it.uid = ++S.seq; it.src = src; it.k = k;
    S.byKey.set(k, it);
    S.items.push(it);
    fresh.push(it);
  }
  src.count += fresh.length; src.batch += items.length;
  appendCards(fresh);
  renderSources();
});
ud.on('fetch:done', ({ id, count, hasMore, error, note, warn, stopped, cookieWarn }) => {
  if (cookieWarn) warnCookieOnce(cookieWarn);
  const src = S.sources.get(id);
  if (!src) return;
  src.status = error ? 'error' : 'done';
  src.error = error || null; src.note = note || (stopped ? 'หยุดแล้ว' : null);
  src.hasMore = !!hasMore; src.nextStart = (src.start || 1) + (src.batch || 0);
  renderSources();
  if (error) toast(`${src.host}: ${error}`, 'err');
  else if (warn && !count) toast(warn, 'warn');
  // ลิงก์คลิปเดียว → เลือกให้อัตโนมัติ พร้อมกดโหลด
  if (!error && src.count === 1 && S.items.length === 1) { const only = S.items[0]; S.selected.add(only.uid); syncSelection(); }
});

function renderSources() {
  const box = $('#sources');
  box.innerHTML = '';
  for (const s of S.sources.values()) {
    const el = document.createElement('div');
    el.className = 'src';
    const status = s.status === 'loading' ? `กำลังดึง… <b>${s.count}</b>` : `<b>${s.count}</b> รายการ`;
    el.innerHTML = `<span class="dot ${s.status}"></span><span class="host">${esc(s.host)}</span><span>${status}</span>`
      + (s.error ? `<span class="err" title="${esc(s.error)}">${esc(s.error)}</span>` : '')
      + (s.note ? `<span class="note">${esc(s.note)}</span>` : '');
    const btn = (label, fn, cls = '') => { const b = document.createElement('button'); b.className = cls; b.innerHTML = label; b.onclick = fn; el.appendChild(b); };
    if (s.status === 'loading') btn('หยุด', () => ud.invoke('fetch:stop', s.id));
    else {
      if (s.hasMore) {
        btn(`โหลดเพิ่ม ${S.settings.fetchLimit || ''}`, () => startFetch(s.url, s.nextStart, S.settings.fetchLimit, s));
        btn('โหลดที่เหลือทั้งหมด', () => startFetch(s.url, s.nextStart, 0, s));
      }
      if (s.status === 'error') {
        btn('ลองใหม่', () => startFetch(s.url, s.nextStart || 1, S.settings.fetchLimit, s));
        btn('อัปเดต yt-dlp', () => { go('settings'); installTool('ytdlp'); });
      }
    }
    btn('×', () => removeSource(s), 'x');
    box.appendChild(el);
  }
  const anyMore = [...S.sources.values()].filter(s => s.hasMore && s.status !== 'loading');
  const lm = $('#loadMore');
  lm.innerHTML = '';
  if (anyMore.length && S.items.length) {
    const b1 = document.createElement('button'); b1.className = 'secondary';
    b1.textContent = `โหลดรายการเก่ากว่านี้อีก ${S.settings.fetchLimit || ''}`;
    b1.onclick = () => anyMore.forEach(s => startFetch(s.url, s.nextStart, S.settings.fetchLimit, s));
    const b2 = document.createElement('button'); b2.className = 'ghost'; b2.textContent = 'โหลดที่เหลือทั้งหมด';
    b2.onclick = () => anyMore.forEach(s => startFetch(s.url, s.nextStart, 0, s));
    lm.append(b1, b2);
  }
  lm.classList.toggle('hidden', !lm.children.length);
}

function removeSource(s) {
  if (s.status === 'loading') ud.invoke('fetch:stop', s.id);
  S.sources.delete(s.id);
  S.items = S.items.filter(it => {
    if (it.src !== s) return true;
    S.byKey.delete(it.k); S.selected.delete(it.uid); return false;
  });
  renderSources(); renderGrid();
}

$('#btnClear').onclick = () => {
  for (const s of S.sources.values()) if (s.status === 'loading') ud.invoke('fetch:stop', s.id);
  S.sources.clear(); S.items = []; S.byKey.clear(); S.selected.clear(); S.aspect = null;
  document.documentElement.style.setProperty('--ar', '16 / 9');
  renderSources(); renderGrid();
};

// ----- grid rendering -----
function isVisible(it) {
  if (S.settings.hideDownloaded && it.key && S.archive.has(it.key)) return false;
  if (S.filter) {
    const q = S.filter;
    if (!(`${it.title} ${it.uploader}`.toLowerCase().includes(q))) return false;
  }
  return true;
}
function visibleItems() {
  const l = S.items.filter(isVisible);
  return S.reversed ? l.reverse() : l;
}

function cardEl(it) {
  const el = document.createElement('div');
  const done = it.key && S.archive.has(it.key);
  el.className = `card${it.kind === 'playlist' ? ' playlist' : ''}${done ? ' downloaded' : ''}${S.selected.has(it.uid) ? ' sel' : ''}`;
  el.dataset.uid = it.uid;
  let ph = '';
  if (it.kind === 'file') ph = icon('file');
  else if (it.kind === 'gallery') ph = icon('image');
  else if (it.kind === 'playlist') ph = icon('layers');
  else ph = esc((it.uploader || it.title || '?').trim().slice(0, 1).toUpperCase());
  const tags = [];
  if (it.duration) tags.push(`<span class="tag dur">${fmtDur(it.duration)}</span>`);
  if (S.items.length > 1) tags.push(`<span class="tag idx">#${it.index}</span>`);
  if (done) tags.push('<span class="tag done">✓ โหลดแล้ว</span>');
  else if (it.key && S.queuedKeys.has(it.key)) tags.push('<span class="tag inq">อยู่ในคิว</span>');
  else if (it.kind === 'playlist') tags.push('<span class="tag kind">เพลย์ลิสต์</span>');
  else if (it.kind === 'file') tags.push(`<span class="tag kind">ไฟล์ ${esc(fmtBytes(it.size))}</span>`);
  const subParts = [it.uploader, fmtDate(it.date), fmtViews(it.views)].filter(Boolean);
  el.innerHTML = `
    <div class="thumb">
      <div class="ph">${ph}</div>
      ${it.thumb ? `<img loading="lazy" decoding="async" src="${esc(thumbUrl(it.thumb))}" alt="">` : ''}
      <span class="tick"></span>${tags.join('')}
      ${it.kind === 'playlist' ? `<button class="open-list">${icon('layers')}เปิดดูข้างใน</button>` : ''}
    </div>
    <div class="meta">
      <div class="title" title="${esc(it.title)}">${esc(it.title)}</div>
      <div class="sub">${esc(subParts.join(' · '))}</div>
    </div>`;
  return el;
}

const els = new Map(); // uid -> element
function renderGrid() {
  els.clear();
  const frag = document.createDocumentFragment();
  for (const it of visibleItems()) { const el = cardEl(it); els.set(it.uid, el); frag.appendChild(el); }
  grid.replaceChildren(frag);
  updateChrome();
}
let pendingAppend = [];
const flushAppend = () => {
  const list = pendingAppend; pendingAppend = [];
  if (S.reversed || S.filter || S.settings.hideDownloaded) return renderGrid();
  const frag = document.createDocumentFragment();
  for (const it of list) { const el = cardEl(it); els.set(it.uid, el); frag.appendChild(el); }
  grid.appendChild(frag);
  // หมายเลข # แสดงเมื่อมีมากกว่า 1 รายการ: ครั้งแรกที่ข้ามจาก 1 → หลายรายการ ให้วาดใหม่
  if (S.items.length > 1 && S.items.length - list.length <= 1) return renderGrid();
  updateChrome();
};
function appendCards(list) {
  if (!list.length) return;
  pendingAppend.push(...list);
  requestAnimationFrame(() => pendingAppend.length && flushAppend());
}

function updateChrome() {
  const has = S.items.length > 0;
  $('#empty').classList.toggle('hidden', has || S.sources.size > 0);
  $('#toolbar').classList.toggle('hidden', !has);
  const vis = grid.children.length;
  $('#countLabel').textContent = vis === S.items.length ? `${S.items.length} รายการ` : `แสดง ${vis} จาก ${S.items.length} รายการ`;
  syncSelection(false);
}

// ----- ลำดับเลขตอน -----
// แหล่งที่เป็นเพลย์ลิสต์ เรียงตอนจากบนลงล่างอยู่แล้ว (ตอน 1 อยู่บน)
// ส่วนหน้าช่อง/บัญชี (TikTok, YouTube @ช่อง ฯลฯ) เรียงใหม่สุดไว้บน: ตอน 1 คือรายการล่างสุด
const isAscendingSource = src => /[?&]list=|\/playlist|\/sets\/|\/album|\/series|\/season/i.test(src?.url || '');
const itemByUid = uid => S.items.find(x => x.uid === uid);

function orderedSelection() {
  const list = [...els.keys()].filter(u => S.selected.has(u)).map(itemByUid);
  for (const u of S.selected) if (!els.has(u)) { const it = itemByUid(u); if (it) list.push(it); }
  if (S.settings.numberOrder === 'screen') return list;
  // เก่า → ใหม่: ใช้วันที่ลงถ้ามี ไม่มีก็ใช้ลำดับในแหล่ง (หน้าช่อง: เลขลำดับมาก = เก่ากว่า)
  return list
    .map((it, pos) => ({ it, pos }))
    .sort((a, b) => {
      const x = a.it, y = b.it;
      if (x.date && y.date && x.date !== y.date) return x.date < y.date ? -1 : 1;
      if (x.src === y.src) return isAscendingSource(x.src) ? x.index - y.index : y.index - x.index;
      return a.pos - b.pos;
    })
    .map(o => o.it);
}

function applyEpisodeTags() {
  const on = S.settings.numbering && S.selected.size > 0;
  const nums = new Map();
  if (on) {
    const start = Number(S.settings.numberStart) || 0;
    const pad = Number(S.settings.numberPad) || 2;
    orderedSelection().forEach((it, i) => nums.set(it.uid, String(start + i).padStart(pad, '0')));
  }
  for (const [uid, el] of els) {
    const thumb = el.querySelector('.thumb');
    let tag = thumb.querySelector('.tag.ep');
    const n = nums.get(uid);
    if (!n) { tag?.remove(); continue; }
    if (!tag) { tag = document.createElement('span'); tag.className = 'tag ep'; thumb.appendChild(tag); }
    tag.textContent = 'ตอน ' + n;
  }
}

function syncSelection(updateCards = true) {
  if (updateCards) for (const [uid, el] of els) el.classList.toggle('sel', S.selected.has(uid));
  applyEpisodeTags();
  $('#numOrder').classList.toggle('hidden', !S.settings.numbering);
  const n = S.selected.size;
  $('#selCount').textContent = n;
  $('#actionBar').classList.toggle('show', n > 0);
  grid.classList.toggle('selecting', n > 0);
  const vis = grid.children.length;
  const all = $('#chkAll');
  const visSel = [...els.keys()].filter(u => S.selected.has(u)).length;
  all.checked = vis > 0 && visSel === vis;
  all.indeterminate = visSel > 0 && visSel < vis;
  $('#btnDownload span').textContent = n > 1 ? `ดาวน์โหลด ${n} รายการ` : 'ดาวน์โหลด';
}

// thumbnail load / error (capture เพราะ event ของ img ไม่ bubble)
grid.addEventListener('load', e => {
  const img = e.target; if (img.tagName !== 'IMG') return;
  img.classList.add('ok');
  if (!S.aspect && img.naturalWidth) {
    const r = img.naturalWidth / img.naturalHeight;
    S.aspect = r < 0.9 ? '9 / 16' : r > 1.2 ? '16 / 9' : '1 / 1';
    document.documentElement.style.setProperty('--ar', S.aspect);
  }
}, true);
grid.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.remove(); }, true);

grid.addEventListener('click', e => {
  const card = e.target.closest('.card'); if (!card) return;
  const uid = +card.dataset.uid;
  const it = S.items.find(x => x.uid === uid);
  if (e.target.closest('.open-list')) { startFetch(it.url, 1, S.settings.fetchLimit); return; }
  if (e.shiftKey && S.anchor != null) {
    const order = [...els.keys()];
    const a = order.indexOf(S.anchor), b = order.indexOf(uid);
    if (a >= 0 && b >= 0) {
      const [lo, hi] = a < b ? [a, b] : [b, a];
      const on = !e.ctrlKey;
      for (let i = lo; i <= hi; i++) on ? S.selected.add(order[i]) : S.selected.delete(order[i]);
    }
  } else {
    S.selected.has(uid) ? S.selected.delete(uid) : S.selected.add(uid);
    S.anchor = uid;
  }
  syncSelection();
});
grid.addEventListener('dblclick', e => {
  const card = e.target.closest('.card'); if (!card) return;
  const it = S.items.find(x => x.uid === +card.dataset.uid);
  if (it?.kind === 'playlist') startFetch(it.url, 1, S.settings.fetchLimit);
  else if (it) ud.invoke('shell:openExternal', it.url);
});

$('#chkAll').onchange = e => {
  for (const uid of els.keys()) e.target.checked ? S.selected.add(uid) : S.selected.delete(uid);
  syncSelection();
};
$('#btnSelNone').onclick = () => { S.selected.clear(); syncSelection(); };
$('#filterInput').addEventListener('input', debounce(e => { S.filter = e.target.value.trim().toLowerCase(); renderGrid(); }, 150));
$('#btnReverse').onclick = () => { S.reversed = !S.reversed; $('#btnReverse').classList.toggle('on', S.reversed); renderGrid(); };
$('#btnHideDone').onclick = async () => {
  await setSetting({ hideDownloaded: !S.settings.hideDownloaded });
  $('#btnHideDone').classList.toggle('on', S.settings.hideDownloaded);
  renderGrid();
};
$('#sizeRange').addEventListener('input', e => {
  document.documentElement.style.setProperty('--tile', e.target.value + 'px');
});
$('#sizeRange').addEventListener('change', e => setSetting({ tileSize: +e.target.value }));
$$('#viewSeg button').forEach(b => (b.onclick = () => setViewMode(b.dataset.mode, true)));
function setViewMode(m, save) {
  grid.classList.toggle('list', m === 'list');
  $$('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  if (save) setSetting({ viewMode: m });
}

// ----- action bar -----
function fillPresets(sel) {
  sel.innerHTML = PRESETS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
}
fillPresets($('#presetSel'));
$('#presetSel').onchange = e => setSetting({ preset: e.target.value });
$('#chkNumber').onchange = async e => { await setSetting({ numbering: e.target.checked }); syncSelection(false); };
$('#numStart').onchange = async e => { await setSetting({ numberStart: Math.max(0, +e.target.value || 0) }); syncSelection(false); };
$('#numOrder').onchange = async e => { await setSetting({ numberOrder: e.target.value }); syncSelection(false); };
$('#btnFolder').onclick = pickFolder;
async function pickFolder() {
  const p = await ud.invoke('dialog:folder', S.settings.outDir);
  if (p) { await setSetting({ outDir: p }); refreshFolderLabel(); if (S.view === 'settings') renderSettings(); }
}
function refreshFolderLabel() {
  const p = S.settings.outDir || '';
  $('#folderName').textContent = p.split(/[\\/]/).filter(Boolean).pop() || p;
  $('#btnFolder').title = 'บันทึกที่: ' + p;
}

$('#btnDownload').onclick = async () => {
  // ลำดับเดียวกับป้าย "ตอน xx" บนการ์ด (คิวจะเริ่มโหลดจากตอนแรกด้วย)
  const items = orderedSelection();
  if (!items.length) return;
  const payload = items.map(({ url, title, thumb, kind, key, uploader, duration, size }) => ({ url, title, thumb, kind, key, uploader, duration, size, titleKnown: true }));
  await ud.invoke('queue:add', payload, {});
  for (const it of items) if (it.key) S.queuedKeys.add(it.key);
  if (S.settings.numbering) {
    const next = (Number(S.settings.numberStart) || 0) + items.length;
    await setSetting({ numberStart: next }); $('#numStart').value = next;
  }
  S.selected.clear();
  renderGrid();
  toast(`เพิ่ม ${items.length} รายการเข้าคิวแล้ว`, 'ok', { label: 'ดูคิว', run: () => go('queue') });
};

// ----- clipboard / paste / drop -----
let lastClip = '';
async function checkClipboard() {
  const t = (await ud.invoke('clipboard:read')) || '';
  const urls = extractUrls(t);
  if (!urls.length || t === lastClip || urlInput.value.trim()) return;
  lastClip = t;
  if ([...S.sources.values()].some(s => urls.includes(s.url))) return;
  const h = $('#clipHint');
  h.innerHTML = `${icon('clipboard')}<span>พบลิงก์ในคลิปบอร์ด</span><code>${esc(urls[0])}${urls.length > 1 ? ` +${urls.length - 1}` : ''}</code>`;
  const b1 = document.createElement('button'); b1.className = 'link'; b1.textContent = 'ดึงรายการ';
  b1.onclick = () => { urls.forEach(u => startFetch(u, 1, S.settings.fetchLimit)); h.classList.add('hidden'); };
  const b2 = document.createElement('button'); b2.className = 'link'; b2.textContent = 'ไม่ใช่';
  b2.onclick = () => h.classList.add('hidden');
  h.append(b1, b2);
  h.classList.remove('hidden');
}
window.addEventListener('focus', () => { if (S.view === 'browse' || !S.view) checkClipboard(); });

document.addEventListener('paste', e => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const t = e.clipboardData.getData('text');
  const urls = extractUrls(t);
  if (!urls.length) return;
  e.preventDefault();
  go('browse');
  urls.forEach(u => startFetch(u, 1, S.settings.fetchLimit));
});

let dragDepth = 0;
document.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; $('#dropZone').classList.remove('hidden'); });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#dropZone').classList.add('hidden'); } });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault(); dragDepth = 0; $('#dropZone').classList.add('hidden');
  const t = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  const urls = extractUrls(t);
  if (!urls.length) return toast('ไม่พบลิงก์ในสิ่งที่ลากมา', 'warn');
  go('browse');
  urls.forEach(u => startFetch(u, 1, S.settings.fetchLimit));
});
ud.on('drop:url', u => { go('browse'); startFetch(u, 1, S.settings.fetchLimit); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('#modal').classList.add('hidden'); if (S.selected.size) { S.selected.clear(); syncSelection(); } }
  const tag = document.activeElement?.tagName;
  if (e.ctrlKey && e.key.toLowerCase() === 'a' && S.view === 'browse' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
    e.preventDefault(); for (const u of els.keys()) S.selected.add(u); syncSelection();
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); go('browse'); urlInput.focus(); }
});

// ================= QUEUE =================
const qList = $('#queueList');
const qEls = new Map();

const STATUS_TEXT = {
  queued: 'รอคิว', running: 'กำลังโหลด', done: 'เสร็จแล้ว', skipped: 'มีอยู่แล้ว (ข้าม)', error: 'ผิดพลาด', canceled: 'ยกเลิกแล้ว'
};

function qRowEl(job) {
  const el = document.createElement('div');
  el.dataset.id = job.id;
  el.innerHTML = `
    <div class="qthumb"><div class="qph">${icon({ file: 'file', gallery: 'image', playlist: 'layers' }[job.item.kind] || (/^audio/.test(S.settings.preset) ? 'music' : 'play'))}</div>${job.item.thumb ? `<img loading="lazy" src="${esc(thumbUrl(job.item.thumb))}" alt="">` : ''}</div>
    <div class="qmain">
      <div class="qtitle"></div>
      <div class="qbar"><i></i></div>
      <div class="qmeta"></div>
    </div>
    <div class="qact"></div>`;
  el.querySelector('img')?.addEventListener('error', ev => ev.target.remove());
  return el;
}

function qRowUpdate(el, job) {
  const indet = job.status === 'running' && !job.pct;
  el.className = `qrow ${job.status}${indet ? ' indet' : ''}`;
  el.querySelector('.qtitle').innerHTML = (job.number != null ? `<span class="num">${esc(String(job.number).padStart(S.settings.numberPad || 2, '0'))}</span>` : '') + esc(job.item.title || job.item.url);
  el.querySelector('.qtitle').title = job.item.title || job.item.url;
  el.querySelector('.qbar i').style.width = (job.status === 'done' || job.status === 'skipped' ? 100 : job.pct || 0) + '%';
  let meta = [];
  if (job.status === 'running') {
    meta.push(`<span class="st">${esc(job.phase || 'กำลังโหลด')}${job.pct ? ` · ${job.pct.toFixed(job.pct < 10 ? 1 : 0)}%` : ''}</span>`);
    if (job.size) meta.push(`<span>${fmtBytes(job.done)} / ${fmtBytes(job.size)}</span>`);
    if (job.speed) meta.push(`<span>${fmtSpeed(job.speed)}</span>`);
    if (job.eta != null) meta.push(`<span>${fmtEta(job.eta)}</span>`);
  } else if (job.status === 'error') {
    meta.push(`<span class="st">${esc(job.error || 'ผิดพลาด')}</span>`);
  } else {
    meta.push(`<span class="st">${esc(job.status === 'skipped' ? (job.phase || STATUS_TEXT.skipped) : STATUS_TEXT[job.status])}</span>`);
    if (job.status === 'done') {
      if (job.size) meta.push(`<span>${fmtBytes(job.size)}</span>`);
      if (job.files > 1) meta.push(`<span>${job.files} ไฟล์</span>`);
    }
    meta.push(`<span>${esc(job.item.uploader || hostOf(job.item.url))}</span>`);
  }
  el.querySelector('.qmeta').innerHTML = meta.join('');
  const key = job.status + (job.file ? 'f' : '');
  if (el._actKey !== key) {
    el._actKey = key;
    const act = el.querySelector('.qact');
    act.innerHTML = '';
    const b = (html, title, fn, cls = 'ghost') => { const x = document.createElement('button'); x.className = cls; x.innerHTML = html; x.title = title; x.onclick = fn; act.appendChild(x); };
    if (job.status === 'running' || job.status === 'queued') b(icon('x') + 'ยกเลิก', 'ยกเลิก', () => ud.invoke('queue:cancel', job.id));
    if (job.status === 'done' && job.file) {
      b(icon('play') + 'เปิด', 'เปิดไฟล์', () => ud.invoke('shell:openPath', job.file).then(r => r && toast(r, 'err')));
      b(icon('folder'), 'แสดงในโฟลเดอร์', () => ud.invoke('shell:showItem', job.file));
    }
    if (job.status === 'error' || job.status === 'canceled') b(icon('refresh') + 'ลองใหม่', 'ลองใหม่', () => ud.invoke('queue:retry', job.id));
    if (job.status === 'skipped') b(icon('refresh') + 'โหลดซ้ำ', 'โหลดใหม่แม้เคยโหลดแล้ว', () => ud.invoke('queue:retry', job.id, true));
    if (job.status !== 'queued') b(icon('terminal'), 'ดูรายละเอียด (log)', async () => showModal(job.item.title || 'Log', (await ud.invoke('queue:log', job.id)) || '(ไม่มีข้อความ)'));
    if (job.status !== 'running') b(icon('trash'), 'เอาออกจากคิว', () => ud.invoke('queue:remove', job.id));
  }
}

function upsertJob(job) {
  S.jobs.set(job.id, job);
  let el = qEls.get(job.id);
  if (!el) { el = qRowEl(job); qEls.set(job.id, el); qList.appendChild(el); }
  qRowUpdate(el, job);
  $('#queueEmpty').classList.toggle('hidden', S.jobs.size > 0);
}
ud.on('queue:added', jobs => jobs.forEach(upsertJob));
ud.on('queue:update', job => {
  upsertJob(job);
  if (job.status === 'error' && S.view !== 'queue') toast(`โหลดไม่สำเร็จ: ${job.item.title?.slice(0, 40)} — ${job.error}`, 'err', { label: 'ดูคิว', run: () => go('queue') });
});
ud.on('queue:removed', ids => {
  for (const id of ids) { qEls.get(id)?.remove(); qEls.delete(id); S.jobs.delete(id); }
  $('#queueEmpty').classList.toggle('hidden', S.jobs.size > 0);
});
ud.on('queue:stats', s => {
  S.stats = s;
  const active = s.running + s.queued;
  const badge = $('#qBadge');
  badge.textContent = active; badge.classList.toggle('hidden', !active);
  const parts = [];
  if (s.running) parts.push(`กำลังโหลด ${s.running}`);
  if (s.queued) parts.push(`รอ ${s.queued}`);
  if (s.done) parts.push(`เสร็จ ${s.done}`);
  if (s.error) parts.push(`ผิดพลาด ${s.error}`);
  if (s.speed) parts.push(fmtSpeed(s.speed));
  $('#qStats').textContent = parts.join(' · ') || 'ยังไม่มีรายการ';
  document.title = active ? `(${active}) Universe Download` : 'Universe Download';
});
ud.on('archive:add', key => {
  S.archive.add(key); S.queuedKeys.delete(key);
  for (const it of S.items) if (it.key === key) {
    const el = els.get(it.uid);
    if (el) { const n = cardEl(it); n.classList.toggle('sel', S.selected.has(it.uid)); el.replaceWith(n); els.set(it.uid, n); }
  }
});

$('#btnClearDone').onclick = () => ud.invoke('queue:clearFinished');
$('#btnCancelAll').onclick = () => ud.invoke('queue:cancelAll');
$('#btnOpenFolder').onclick = () => ud.invoke('shell:openPath', S.settings.outDir);
function setConc(n) {
  n = Math.max(1, Math.min(10, n));
  $('#concVal').textContent = n;
  setSetting({ concurrency: n });
}
$('#concDec').onclick = () => setConc((S.settings.concurrency || 3) - 1);
$('#concInc').onclick = () => setConc((S.settings.concurrency || 3) + 1);

// ================= HISTORY =================
async function loadHistory() {
  S.history = await ud.invoke('history:list');
  renderHistory();
}
function renderHistory() {
  const q = $('#historyFilter').value.trim().toLowerCase();
  const list = S.history.filter(h => !q || `${h.title} ${h.uploader}`.toLowerCase().includes(q));
  const box = $('#historyList');
  box.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const h of list.slice(0, 500)) {
    const el = document.createElement('div');
    el.className = 'hrow';
    const when = new Date(h.at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    el.innerHTML = `
      <div class="qthumb">${h.thumb ? `<img loading="lazy" src="${esc(thumbUrl(h.thumb))}" alt="">` : ''}</div>
      <div class="qmain"><div class="qtitle" title="${esc(h.title)}">${esc(h.title)}</div>
      <div class="qmeta"><span>${esc(when)}</span>${h.size ? `<span>${fmtBytes(h.size)}</span>` : ''}<span>${esc(h.uploader || hostOf(h.url))}</span></div></div>
      <div class="qact"></div>`;
    el.querySelector('img')?.addEventListener('error', ev => ev.target.remove());
    const act = el.querySelector('.qact');
    const b = (html, title, fn) => { const x = document.createElement('button'); x.className = 'ghost'; x.innerHTML = html; x.title = title; x.onclick = fn; act.appendChild(x); };
    if (h.file) {
      b(icon('play') + 'เปิด', 'เปิดไฟล์', async () => { const r = await ud.invoke('shell:openPath', h.file); if (r) toast('ไม่พบไฟล์ (อาจถูกย้ายหรือลบ)', 'warn'); });
      b(icon('folder'), 'แสดงในโฟลเดอร์', async () => { if (await ud.invoke('shell:showItem', h.file)) toast('ไม่พบไฟล์ (อาจถูกย้ายหรือลบ)', 'warn'); });
    }
    b(icon('external'), 'เปิดลิงก์ต้นทาง', () => ud.invoke('shell:openExternal', h.url));
    frag.appendChild(el);
  }
  box.appendChild(frag);
  $('#hStats').textContent = S.history.length ? `${S.history.length} รายการ` : '';
  $('#historyEmpty').classList.toggle('hidden', list.length > 0);
}
$('#historyFilter').addEventListener('input', debounce(renderHistory, 150));
$('#btnClearHistory').onclick = async () => {
  if (!confirm('ล้างประวัติทั้งหมด? (ไฟล์ที่โหลดไว้จะไม่ถูกลบ)')) return;
  await ud.invoke('history:clear'); loadHistory();
};

// ================= SETTINGS =================
const NAME_OPTS = [
  ['title', 'ชื่อคลิป [รหัส]'],
  ['date_title', 'วันที่ ชื่อคลิป'],
  ['date_id', 'วันที่_รหัสคลิป'],
  ['id', 'รหัสคลิปอย่างเดียว']
];
const COOKIE_OPTS = [['', 'ไม่ใช้'], ['firefox', 'Firefox (แนะนำ)'], ['chrome', 'Chrome (ต้องปิด Chrome ก่อน)'], ['edge', 'Edge (ต้องปิด Edge ก่อน)'], ['brave', 'Brave (ต้องปิด Brave ก่อน)'], ['opera', 'Opera'], ['vivaldi', 'Vivaldi']];
const LIMIT_OPTS = [[30, '30 รายการ'], [60, '60 รายการ'], [100, '100 รายการ'], [200, '200 รายการ'], [500, '500 รายการ'], [0, 'ทั้งหมดในครั้งเดียว']];
const THEME_OPTS = [['system', 'ตามระบบ Windows'], ['dark', 'มืด'], ['light', 'สว่าง']];

function rowHTML(label, hint, control) {
  return `<div class="row"><div class="lbl"><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</div>${control}</div>`;
}
const sw = k => `<label class="switch"><input type="checkbox" data-k="${k}" ${S.settings[k] ? 'checked' : ''}><span></span></label>`;
const sel = (k, opts) => `<select data-k="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(S.settings[k]) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const num = (k, min, max) => `<input type="number" data-k="${k}" min="${min}" max="${max}" value="${esc(S.settings[k])}">`;
const txt = k => `<input type="text" data-k="${k}" value="${esc(S.settings[k])}" spellcheck="false">`;

async function renderSettings() {
  const info = await ud.invoke('app:info');
  S.tools = await ud.invoke('tools:status');
  const up = await ud.invoke('update:state');
  const t = S.tools;
  const toolRow = (name, label, hint) => {
    const st = t[name];
    return `<div class="row" data-tool="${name}"><div class="lbl"><b>${label}</b><small>${hint}</small>
      <div class="tool-ver">${st.installed ? 'เวอร์ชัน ' + esc(st.version || '-') : 'ยังไม่ได้ติดตั้ง'}</div>
      <div class="tool-prog hidden"><i></i></div></div>
      <button class="ghost" data-install="${name}">${st.installed ? icon('refresh') + 'อัปเดต' : icon('download') + 'ติดตั้ง'}</button></div>`;
  };
  $('#settingsBody').innerHTML = `
    <div class="group"><h3>การบันทึกไฟล์</h3>
      ${rowHTML('โฟลเดอร์ที่บันทึก', '', `<span class="path" title="${esc(S.settings.outDir)}">${esc(S.settings.outDir)}</span><button class="ghost" id="setFolder">${icon('folder')}เปลี่ยน</button><button class="ghost" id="openFolder">เปิด</button>`)}
      ${rowHTML('รูปแบบเริ่มต้น', 'ความละเอียด หรือโหลดเฉพาะเสียง', sel('preset', PRESETS))}
      ${rowHTML('ตั้งชื่อไฟล์', '', sel('nameTpl', NAME_OPTS))}
      ${rowHTML('แยกโฟลเดอร์ตามช่อง/บัญชี', 'เช่น Downloads\\Universe Download\\ชื่อช่อง\\...', sw('subByUploader'))}
      ${rowHTML('จำนวนหลักของเลขตอน', 'เช่น 2 = 01, 02 … / 3 = 001, 002 …', num('numberPad', 1, 4))}
    </div>
    <div class="group"><h3>ความเร็ว</h3>
      ${rowHTML('โหลดพร้อมกัน', 'จำนวนไฟล์ที่โหลดในเวลาเดียวกัน (แนะนำ 3–5 · TikTok/Instagram ถ้าโดนบล็อกให้ลดลง)', num('concurrency', 1, 10))}
      ${rowHTML('การเชื่อมต่อต่อไฟล์', 'แบ่งไฟล์เป็นชิ้นแล้วโหลดพร้อมกัน ช่วยให้ YouTube/สตรีมเร็วขึ้นมาก', num('fragments', 1, 16))}
      ${rowHTML('พักระหว่างไฟล์ (วินาที)', '0 = ไม่พัก · ตั้ง 2–5 ถ้าเว็บจำกัดความถี่ (Error 429)', num('sleep', 0, 60))}
      ${rowHTML('ดึงรายการครั้งละ', 'สำหรับช่อง/บัญชีที่มีคลิปเยอะ รายการจะขึ้นจอทันทีระหว่างดึง', sel('fetchLimit', LIMIT_OPTS))}
    </div>
    <div class="group"><h3>ไฟล์ที่ได้</h3>
      ${rowHTML('ฝังปกลงในไฟล์', 'ปกจะแสดงใน Explorer และโปรแกรมเล่นวิดีโอ/เพลง', sw('embedThumb'))}
      ${rowHTML('ฝังข้อมูลคลิป', 'ชื่อ ผู้สร้าง วันที่ คำอธิบาย และบทของคลิป', sw('embedMeta'))}
      ${rowHTML('บันทึกปกแยกเป็น .jpg', '', sw('writeThumb'))}
      ${rowHTML('โหลดคำบรรยาย (ซับไตเติล)', 'ถ้าคลิปมีให้', sw('subs'))}
      ${rowHTML('ภาษาคำบรรยาย', 'คั่นด้วยจุลภาค เช่น th,en หรือ all', txt('subLangs'))}
      ${rowHTML('วันที่ไฟล์ = วันที่โหลด', 'ปิด = ใช้วันที่ที่คลิปถูกอัปโหลด', sw('noMtime'))}
    </div>
    <div class="group"><h3>คลิปที่ต้องล็อกอิน</h3>
      ${rowHTML('ใช้คุกกี้จากเบราว์เซอร์', 'สำหรับคลิปส่วนตัว/จำกัดอายุ/สมาชิก ต้องล็อกอินเว็บนั้นในเบราว์เซอร์ไว้ก่อน · Chrome/Edge รุ่นใหม่อ่านคุกกี้ได้ยาก แนะนำ Firefox', sel('cookiesBrowser', COOKIE_OPTS))}
    </div>
    <div class="group"><h3>หน้าตา</h3>
      ${rowHTML('ธีม', '', sel('theme', THEME_OPTS))}
    </div>
    <div class="group"><h3>เครื่องมือเบื้องหลัง</h3>
      ${toolRow('ytdlp', 'yt-dlp', 'ตัวโหลดวิดีโอ/เสียง · เว็บเปลี่ยนระบบบ่อย ถ้าโหลดไม่ได้ให้กดอัปเดต')}
      ${toolRow('ffmpeg', 'ffmpeg', 'รวมภาพกับเสียง แปลงไฟล์ ฝังปก (จำเป็นสำหรับ 1080p ขึ้นไปของ YouTube)')}
      ${toolRow('gallerydl', 'gallery-dl', 'ตัวโหลดรูปภาพ/อัลบั้ม (Instagram, X, Pinterest ฯลฯ) ติดตั้งให้อัตโนมัติเมื่อจำเป็น')}
      ${rowHTML('อัปเดตเครื่องมืออัตโนมัติ', 'เช็กเวอร์ชันใหม่ทุกครั้งที่เปิดโปรแกรม', sw('autoUpdateTools'))}
    </div>
    <div class="group"><h3>เกี่ยวกับโปรแกรม</h3>
      ${rowHTML('Universe Download ' + esc(info.version), esc(updateText(up)), `<button class="ghost" id="checkUpd">${icon('refresh')}ตรวจหาอัปเดต</button>`)}
      ${rowHTML('โฟลเดอร์ข้อมูลโปรแกรม', esc(info.userData), `<button class="ghost" id="openData">เปิด</button>`)}
    </div>`;
  const body = $('#settingsBody');
  body.querySelectorAll('[data-k]').forEach(el => {
    el.addEventListener('change', async () => {
      const k = el.dataset.k;
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'number') v = Math.max(+el.min, Math.min(+el.max, +v || 0));
      if (k === 'fetchLimit') v = +v;
      await setSetting({ [k]: v });
      if (k === 'theme') applyTheme();
      if (k === 'preset') $('#presetSel').value = v;
      if (k === 'concurrency') $('#concVal').textContent = v;
    });
  });
  $('#setFolder').onclick = pickFolder;
  $('#openFolder').onclick = () => ud.invoke('shell:openPath', S.settings.outDir);
  $('#openData').onclick = () => ud.invoke('shell:openPath', info.userData);
  $('#checkUpd').onclick = async () => {
    const st = await ud.invoke('update:check');
    if (st.status === 'dev') toast('กำลังรันแบบโหมดพัฒนา — ระบบอัปเดตจะทำงานในตัวติดตั้งจริง', 'info');
  };
  body.querySelectorAll('[data-install]').forEach(b => (b.onclick = () => installTool(b.dataset.install)));
}
function updateText(u) {
  switch (u?.status) {
    case 'checking': return 'กำลังตรวจหาอัปเดต…';
    case 'downloading': return `กำลังโหลดเวอร์ชันใหม่ ${u.version || ''} ${u.pct || 0}%`;
    case 'ready': return `เวอร์ชัน ${u.version} พร้อมติดตั้ง`;
    case 'latest': return 'เป็นเวอร์ชันล่าสุดแล้ว';
    case 'error': return 'ตรวจอัปเดตไม่สำเร็จ: ' + (u.message || '');
    case 'dev': return 'โหมดพัฒนา (ไม่เช็กอัปเดต)';
    default: return 'อัปเดตอัตโนมัติเมื่อมีเวอร์ชันใหม่';
  }
}

async function installTool(name) {
  try {
    await ud.invoke('tools:install', name);
    toast('ติดตั้ง/อัปเดตเรียบร้อย', 'ok');
  } catch (e) {
    toast(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'err');
  }
  if (S.view === 'settings') renderSettings();
}

ud.on('tools:progress', p => {
  // หน้าตั้งค่า
  const row = document.querySelector(`[data-tool="${p.name}"]`);
  if (row) {
    row.querySelector('.tool-ver').textContent = p.msg;
    const bar = row.querySelector('.tool-prog');
    bar.classList.toggle('hidden', p.phase === 'done');
    bar.querySelector('i').style.width = p.pct + '%';
  }
  // หน้าจอเตรียมเครื่องมือครั้งแรก
  const ob = document.querySelector(`#onboardRows [data-ob="${p.name}"]`);
  if (ob) {
    ob.querySelector('.t span:last-child').textContent = p.phase === 'done' ? 'พร้อม ✓' : (p.pct ? p.pct + '%' : '');
    ob.querySelector('.msg').textContent = p.msg;
    ob.querySelector('.bar i').style.width = p.pct + '%';
  }
});
ud.on('tools:changed', st => { S.tools = st; if (S.view === 'settings') renderSettings(); });
ud.on('toast', t => toast(t.text, t.kind));
ud.on('cookie:warn', text => warnCookieOnce(text));

// ----- app self-update -----
ud.on('update:status', u => {
  const pill = $('#updatePill');
  if (u.status === 'ready') {
    pill.innerHTML = `<span>เวอร์ชันใหม่ ${esc(u.version)} พร้อมแล้ว</span><button id="btnRestart">รีสตาร์ทเพื่ออัปเดต</button>`;
    pill.classList.remove('hidden');
    $('#btnRestart').onclick = () => ud.invoke('update:install');
  } else if (u.status === 'downloading') {
    pill.innerHTML = `<span>กำลังโหลดเวอร์ชันใหม่ ${u.pct || 0}%</span>`;
    pill.classList.remove('hidden');
  } else pill.classList.add('hidden');
});

// ================= BOOT =================
async function bootstrapTools() {
  const st = await ud.invoke('tools:status');
  const need = [];
  if (!st.ytdlp.installed) need.push(['ytdlp', 'yt-dlp — ตัวโหลดวิดีโอ']);
  if (!st.ffmpeg.installed) need.push(['ffmpeg', 'ffmpeg — ตัวรวม/แปลงไฟล์']);
  if (need.length) {
    $('#onboardRows').innerHTML = need.map(([n, l]) => `<div class="ob-row" data-ob="${n}"><div class="t"><span>${l}</span><span></span></div><div class="bar"><i></i></div><div class="msg muted" style="font-size:12px;margin-top:4px"></div></div>`).join('');
    $('#onboardErr').classList.add('hidden'); $('#onboardRetry').classList.add('hidden');
    $('#onboard').classList.remove('hidden');
  }
  try {
    S.tools = await ud.invoke('tools:bootstrap');
    $('#onboard').classList.add('hidden');
    if (need.length) toast('พร้อมใช้งานแล้ว วางลิงก์ได้เลย', 'ok');
  } catch (e) {
    $('#onboardErr').textContent = 'เตรียมเครื่องมือไม่สำเร็จ: ' + String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') + '\nตรวจสอบอินเทอร์เน็ตแล้วกดลองใหม่';
    $('#onboardErr').classList.remove('hidden');
    $('#onboardRetry').classList.remove('hidden');
  }
}
$('#onboardRetry').onclick = bootstrapTools;

(async function boot() {
  hydrateIcons();
  S.settings = await ud.invoke('settings:get');
  applyTheme();
  document.documentElement.style.setProperty('--tile', (S.settings.tileSize || 200) + 'px');
  $('#sizeRange').value = S.settings.tileSize || 200;
  setViewMode(S.settings.viewMode || 'grid');
  $('#btnHideDone').classList.toggle('on', !!S.settings.hideDownloaded);
  $('#presetSel').value = S.settings.preset;
  $('#chkNumber').checked = !!S.settings.numbering;
  $('#numStart').value = S.settings.numberStart ?? 1;
  $('#numOrder').value = S.settings.numberOrder || 'oldest';
  $('#concVal').textContent = S.settings.concurrency;
  refreshFolderLabel();
  S.archive = new Set(await ud.invoke('archive:keys'));
  (await ud.invoke('queue:list')).forEach(upsertJob);
  $('#queueEmpty').classList.toggle('hidden', S.jobs.size > 0);
  updateChrome();
  const up = await ud.invoke('update:state');
  if (up.status === 'ready' || up.status === 'downloading') ud.invoke('update:check');
  urlInput.focus();
  await bootstrapTools();
  checkClipboard();
})();
