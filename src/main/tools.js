// จัดการเครื่องมือเบื้องหลัง: yt-dlp (วิดีโอ/เสียง), ffmpeg (รวมไฟล์/แปลง), gallery-dl (รูปภาพ/แกลเลอรี)
// ติดตั้ง/อัปเดตอัตโนมัติจาก GitHub Releases ของแต่ละโปรเจกต์ ไว้ใน %APPDATA%\Universe Download\bin
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { spawn, execFile } = require('child_process');

const UA = 'UniverseDownload-App';

const SPECS = {
  ytdlp: {
    label: 'yt-dlp',
    repo: 'yt-dlp/yt-dlp',
    exe: 'yt-dlp.exe',
    // yt-dlp_win.zip = แบบโฟลเดอร์ เปิดเร็วกว่า .exe ไฟล์เดียวมาก (ไม่ต้องแตกไฟล์ทุกครั้งที่รัน)
    pick: a => a.find(x => x.name === 'yt-dlp_win.zip') || a.find(x => x.name === 'yt-dlp.exe')
  },
  ffmpeg: {
    label: 'ffmpeg',
    repo: 'yt-dlp/FFmpeg-Builds',
    exe: 'ffmpeg.exe',
    pick: a => a.find(x => x.name === 'ffmpeg-master-latest-win64-gpl-shared.zip')
      || a.find(x => /win64-gpl-shared\.zip$/.test(x.name))
      || a.find(x => /win64-gpl\.zip$/.test(x.name))
  },
  gallerydl: {
    label: 'gallery-dl',
    // release หลักช่วงหลังไม่แนบ .exe แล้ว ตัว build อย่างเป็นทางการย้ายไปที่ gdl-org/builds
    repo: ['mikf/gallery-dl', 'gdl-org/builds'],
    exe: 'gallery-dl.exe',
    pick: a => a.find(x => x.name === 'gallery-dl.exe') || a.find(x => x.name === 'gallery-dl_windows.exe')
  }
};

const binDir = () => path.join(app.getPath('userData'), 'bin');
const manifestFile = () => path.join(binDir(), 'manifest.json');
let manifest = null;
let pathFfmpeg = null;          // ffmpeg ที่มีอยู่แล้วในเครื่อง (PATH)
const installing = {};          // name -> Promise

function exists(p) { try { return !!p && fs.existsSync(p); } catch { return false; } }

function getManifest() {
  if (!manifest) {
    try { manifest = JSON.parse(fs.readFileSync(manifestFile(), 'utf8')); } catch { manifest = {}; }
  }
  return manifest;
}
function saveManifest() {
  fs.mkdirSync(binDir(), { recursive: true });
  fs.writeFileSync(manifestFile(), JSON.stringify(manifest, null, 2));
}

function exePath(name) {
  const m = getManifest()[name];
  return m && exists(m.exe) ? m.exe : null;
}
const ytdlpPath = () => exePath('ytdlp');
const galleryDlPath = () => exePath('gallerydl');
function ffmpegDir() {
  const p = exePath('ffmpeg');
  if (p) return path.dirname(p);
  return pathFfmpeg;
}

function status() {
  const m = getManifest();
  const one = name => ({
    installed: !!exePath(name) || (name === 'ffmpeg' && !!pathFfmpeg),
    version: m[name]?.version || (name === 'ffmpeg' && pathFfmpeg ? 'ในเครื่อง' : null),
    busy: !!installing[name]
  });
  return { ytdlp: one('ytdlp'), ffmpeg: one('ffmpeg'), gallerydl: one('gallerydl') };
}

async function ghLatest(repo) {
  const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { 'User-Agent': UA, Accept: 'application/vnd.github+json' }
  });
  if (!r.ok) throw new Error(`GitHub ตอบกลับ ${r.status}`);
  const j = await r.json();
  return {
    tag: j.tag_name,
    published: j.published_at,
    assets: (j.assets || []).map(a => ({ name: a.name, url: a.browser_download_url, size: a.size }))
  };
}

async function downloadTo(url, dest, onProgress) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!r.ok || !r.body) throw new Error(`ดาวน์โหลดไม่สำเร็จ (${r.status})`);
  const total = Number(r.headers.get('content-length')) || 0;
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const out = fs.createWriteStream(dest);
  let got = 0, last = 0;
  const reader = r.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      if (!out.write(value)) await new Promise(res => out.once('drain', res));
      const now = Date.now();
      if (onProgress && now - last > 150) { last = now; onProgress(got, total); }
    }
  } finally {
    await new Promise((res, rej) => out.end(err => (err ? rej(err) : res())));
  }
  onProgress && onProgress(got, total || got);
}

function extractZip(zip, dir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(dir, { recursive: true });
    const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    const p = spawn(tar, ['-xf', zip, '-C', dir], { windowsHide: true });
    let err = '';
    p.stderr.on('data', d => (err += d));
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve() : reject(new Error('แตกไฟล์ไม่สำเร็จ: ' + err.slice(0, 200)))));
  });
}

function findFile(dir, name, depth = 4) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of entries) if (e.isFile() && e.name.toLowerCase() === name) return path.join(dir, e.name);
  if (depth <= 0) return null;
  for (const e of entries) {
    if (e.isDirectory()) {
      const f = findFile(path.join(dir, e.name), name, depth - 1);
      if (f) return f;
    }
  }
  return null;
}

function runVersion(exe, args = ['--version']) {
  return new Promise(resolve => {
    execFile(exe, args, { windowsHide: true, timeout: 20000 }, (err, stdout) => {
      resolve(err ? null : String(stdout).split(/\r?\n/)[0].trim());
    });
  });
}

// ติดตั้งหรืออัปเดตเครื่องมือ onProgress({name, phase, pct, msg})
function install(name, onProgress = () => {}) {
  if (installing[name]) return installing[name];
  const spec = SPECS[name];
  const job = (async () => {
    onProgress({ name, phase: 'check', pct: 0, msg: `กำลังตรวจสอบ ${spec.label} เวอร์ชันล่าสุด` });
    const { rel, asset, repo } = await findRelease(spec);
    const stamp = Date.now().toString(36);
    const tmp = path.join(binDir(), '_dl', asset.name);
    await downloadTo(asset.url, tmp, (got, total) => {
      const t = total || asset.size || 0;
      onProgress({
        name, phase: 'download', pct: t ? Math.round((got / t) * 100) : 0,
        msg: `กำลังดาวน์โหลด ${spec.label}  ${mb(got)}${t ? ' / ' + mb(t) : ''}`
      });
    });
    const target = path.join(binDir(), `${name}-${stamp}`);
    let exe;
    if (asset.name.endsWith('.zip')) {
      onProgress({ name, phase: 'extract', pct: 100, msg: `กำลังแตกไฟล์ ${spec.label}` });
      await extractZip(tmp, target);
      exe = findFile(target, spec.exe);
      await fsp.rm(tmp, { force: true });
    } else {
      await fsp.mkdir(target, { recursive: true });
      exe = path.join(target, spec.exe);
      await fsp.rename(tmp, exe);
    }
    if (!exe || !exists(exe)) throw new Error(`ติดตั้ง ${spec.label} ไม่สำเร็จ (ไม่พบ ${spec.exe})`);
    let version = rel.tag;
    if (name === 'ffmpeg') version = (rel.published || '').slice(0, 10) || rel.tag;
    else version = (await runVersion(exe)) || rel.tag;
    const m = getManifest();
    const old = m[name]?.exe;
    m[name] = { exe, version, tag: rel.tag, repo, published: rel.published, installedAt: new Date().toISOString() };
    saveManifest();
    if (old) cleanupUnused();
    onProgress({ name, phase: 'done', pct: 100, msg: `${spec.label} ${version} พร้อมใช้งาน` });
    return m[name];
  })();
  installing[name] = job;
  job.finally(() => { delete installing[name]; });
  return job;
}

// ลบโฟลเดอร์เวอร์ชันเก่าที่ไม่ได้ใช้แล้ว (ถ้ายังถูกใช้อยู่จะข้ามไป แล้วลบรอบหน้า)
function cleanupUnused() {
  const keep = new Set(Object.values(getManifest()).map(v => v?.exe && path.relative(binDir(), v.exe).split(path.sep)[0]));
  keep.add('no-ffmpeg'); // โฟลเดอร์ว่างที่ fetcher ใช้ปิด ffmpeg ตอนดึงรายการ
  let entries = [];
  try { entries = fs.readdirSync(binDir(), { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (!e.isDirectory() || keep.has(e.name)) continue;
    fs.rm(path.join(binDir(), e.name), { recursive: true, force: true }, () => {});
  }
}

// มีเวอร์ชันใหม่ไหม (เช็กเฉพาะ yt-dlp / gallery-dl ซึ่งเว็บเปลี่ยนระบบบ่อย ต้องอัปเดตตามบ่อย)
async function hasUpdate(name) {
  const m = getManifest()[name];
  if (!m) return false;
  const { rel } = await findRelease(SPECS[name]);
  return rel.tag && rel.tag !== m.tag;
}

// หา release ล่าสุดที่มีไฟล์สำหรับ Windows (ลองทีละ repo)
async function findRelease(spec) {
  const repos = [].concat(spec.repo);
  let lastErr;
  for (const repo of repos) {
    try {
      const rel = await ghLatest(repo);
      const asset = spec.pick(rel.assets);
      if (asset) return { rel, asset, repo };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error(`ไม่พบไฟล์สำหรับ Windows ของ ${spec.label}`);
}

async function detectSystemFfmpeg() {
  if (exePath('ffmpeg')) return;
  await new Promise(resolve => {
    execFile('where.exe', ['ffmpeg'], { windowsHide: true, timeout: 5000 }, (err, stdout) => {
      const p = !err && String(stdout).split(/\r?\n/)[0].trim();
      if (p && exists(p)) pathFfmpeg = path.dirname(p);
      resolve();
    });
  });
}

function mb(n) { return (n / 1048576).toFixed(1) + ' MB'; }

// อาร์กิวเมนต์ที่ใช้ร่วมกันทุกครั้งที่เรียก yt-dlp
function ytdlpCommonArgs(opts = {}) {
  const a = [];
  if (opts.cookiesBrowser) a.push('--cookies-from-browser', opts.cookiesBrowser);
  // YouTube ต้องมีตัวรัน JavaScript: ใช้ Node ที่ติดมากับโปรแกรมนี้ (Electron) ได้เลย ไม่ต้องติดตั้งเพิ่ม
  a.push('--js-runtimes', `node:${process.execPath}`);
  return a;
}
// อ่านคุกกี้จากเบราว์เซอร์ไม่ได้ (เบราว์เซอร์เปิดอยู่จนไฟล์ถูกล็อก / Chrome-Edge รุ่นใหม่เข้ารหัสแบบ app-bound ฯลฯ)
const COOKIE_ERR_RE = /cookie database|cookies? database|Failed to decrypt|DPAPI|app.?bound|could not find \w+ cookies|failed to load cookies|cookies?-from-browser|extract cookies/i;
const isCookieError = msg => COOKIE_ERR_RE.test(String(msg || ''));
const BROWSER_NAMES = { chrome: 'Chrome', edge: 'Edge', brave: 'Brave', opera: 'Opera', vivaldi: 'Vivaldi', firefox: 'Firefox', chromium: 'Chromium' };
function cookieWarning(browser) {
  const b = BROWSER_NAMES[browser] || browser;
  return /firefox/i.test(browser)
    ? `อ่านคุกกี้จาก ${b} ไม่ได้ (ล็อกอินใน ${b} ไว้หรือยัง?) — โหลดแบบไม่ใช้คุกกี้แทน`
    : `อ่านคุกกี้จาก ${b} ไม่ได้ (${b} รุ่นใหม่ล็อกไฟล์คุกกี้ไว้) — โหลดแบบไม่ใช้คุกกี้แทน · ถ้าต้องล็อกอิน เปลี่ยนเป็น Firefox ในหน้าตั้งค่า`;
}

function childEnv() {
  return { ...process.env, ELECTRON_RUN_AS_NODE: '1', PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };
}

module.exports = {
  SPECS, status, install, hasUpdate, ytdlpPath, galleryDlPath, ffmpegDir,
  detectSystemFfmpeg, cleanupUnused, ytdlpCommonArgs, childEnv, binDir, isCookieError, cookieWarning
};
