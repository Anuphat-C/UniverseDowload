// เก็บการตั้งค่า / ประวัติ / รายการที่โหลดแล้ว เป็นไฟล์ JSON ใน %APPDATA%\Universe Download
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const dataDir = () => app.getPath('userData');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

const DEFAULTS = {
  outDir: '',               // ว่าง = Downloads\Universe Download
  preset: 'best',
  nameTpl: 'title',
  subByUploader: true,
  concurrency: 3,
  fragments: 4,
  sleep: 0,
  noMtime: true,
  embedMeta: true,
  embedThumb: true,
  writeThumb: false,
  subs: false,
  subLangs: 'th,en',
  cookiesBrowser: '',
  fetchLimit: 60,
  numbering: false,
  numberStart: 1,
  numberPad: 2,
  theme: 'system',
  autoUpdateTools: true,
  tileSize: 200,
  viewMode: 'grid',
  hideDownloaded: false,
  window: null
};

class Settings {
  constructor() { this.file = null; this.data = null; this.timer = null; }
  load() {
    this.file = path.join(dataDir(), 'settings.json');
    this.data = { ...DEFAULTS, ...readJson(this.file, {}) };
    if (!this.data.outDir) this.data.outDir = path.join(app.getPath('downloads'), 'Universe Download');
    return this.data;
  }
  get() { return this.data || this.load(); }
  set(patch) {
    const d = this.get();
    for (const [k, v] of Object.entries(patch || {})) if (k in DEFAULTS) d[k] = v;
    if (!d.outDir) d.outDir = path.join(app.getPath('downloads'), 'Universe Download');
    this.saveSoon();
    return d;
  }
  saveSoon() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveNow(), 300);
  }
  saveNow() {
    clearTimeout(this.timer);
    try { writeJsonAtomic(this.file, this.data); } catch (e) { console.error('save settings', e); }
  }
}

class History {
  constructor() { this.file = null; this.items = null; this.timer = null; }
  list() {
    if (!this.items) {
      this.file = path.join(dataDir(), 'history.json');
      this.items = readJson(this.file, []);
    }
    return this.items;
  }
  add(entry) {
    const l = this.list();
    l.unshift(entry);
    if (l.length > 1000) l.length = 1000;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { try { writeJsonAtomic(this.file, l); } catch {} }, 500);
  }
  clear() { this.items = []; try { writeJsonAtomic(path.join(dataDir(), 'history.json'), []); } catch {} }
}

// ไฟล์ archive ของ yt-dlp (บรรทัดละ "extractor id") ใช้รวมทุกโฟลเดอร์ เพื่อกันโหลดซ้ำ และทำเครื่องหมาย "โหลดแล้ว"
const archive = {
  path: () => path.join(dataDir(), 'downloaded.txt'),
  keys() {
    try {
      return fs.readFileSync(this.path(), 'utf8').split(/\r?\n/).map(s => s.trim().toLowerCase()).filter(Boolean);
    } catch { return []; }
  }
};

module.exports = { settings: new Settings(), history: new History(), archive, DEFAULTS };
