const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, protocol, nativeTheme, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

if (!app.requestSingleInstanceLock()) { app.quit(); return; }

protocol.registerSchemesAsPrivileged([
  { scheme: 'udthumb', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

const store = require('./store');
const tools = require('./tools');
const fetcher = require('./fetcher');
const { DownloadQueue } = require('./queue');
const thumbs = require('./thumbs');
const updater = require('./updater');

app.setAppUserModelId('com.universedownload.app');

let win = null;
const queue = new DownloadQueue();
const fetches = new Map();
let fetchSeq = 0;

const send = (ch, data) => { if (win && !win.isDestroyed()) win.webContents.send(ch, data); };

function createWindow() {
  const s = store.settings.get();
  const b = s.window || {};
  win = new BrowserWindow({
    width: b.width || 1320, height: b.height || 860, x: b.x, y: b.y,
    minWidth: 960, minHeight: 640,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0d0f13' : '#f6f7f9',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: nativeTheme.shouldUseDarkColors ? '#0d0f13' : '#f6f7f9', symbolColor: '#8a93a3', height: 44 },
    icon: path.join(__dirname, '..', 'renderer', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      spellcheck: false
    }
  });
  if (b.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  // ลากลิงก์มาวางบนหน้าต่าง → ไม่ให้เปลี่ยนหน้า แต่ส่งลิงก์เข้าช่องกรอกแทน
  win.webContents.on('will-navigate', (e, url) => { e.preventDefault(); if (/^https?:/.test(url)) send('drop:url', url); });
  win.on('close', () => {
    const maximized = win.isMaximized();
    const bounds = maximized ? (store.settings.get().window || {}) : win.getBounds();
    store.settings.set({ window: { ...bounds, maximized } });
    store.settings.saveNow();
  });
}

// ---------- IPC ----------
const handle = (ch, fn) => ipcMain.handle(ch, async (_e, ...a) => fn(...a));

handle('app:info', () => ({
  version: app.getVersion(), isPackaged: app.isPackaged, electron: process.versions.electron,
  userData: app.getPath('userData')
}));
handle('settings:get', () => store.settings.get());
handle('settings:set', patch => {
  const s = store.settings.set(patch);
  if ('concurrency' in patch) queue.setConcurrency(s.concurrency);
  return s;
});

handle('tools:status', () => tools.status());
handle('tools:install', async name => {
  if (name === 'ytdlp' && !queue.isIdle()) throw new Error('รอให้คิวดาวน์โหลดเสร็จก่อนแล้วค่อยอัปเดต');
  await tools.install(name, p => send('tools:progress', p));
  return tools.status();
});
// เปิดโปรแกรมครั้งแรก: ติดตั้ง yt-dlp + ffmpeg ให้อัตโนมัติ / ครั้งต่อไป: เช็กอัปเดต yt-dlp เบื้องหลัง
handle('tools:bootstrap', async () => {
  await tools.detectSystemFfmpeg();
  const st = tools.status();
  const need = [];
  if (!st.ytdlp.installed) need.push('ytdlp');
  if (!st.ffmpeg.installed) need.push('ffmpeg');
  if (need.length) {
    await Promise.all(need.map(n => tools.install(n, p => send('tools:progress', p))));
  } else {
    tools.cleanupUnused();
    if (store.settings.get().autoUpdateTools) backgroundToolUpdate();
  }
  return tools.status();
});

async function backgroundToolUpdate() {
  for (const name of ['ytdlp', 'gallerydl']) {
    try {
      if (!tools.status()[name].installed) continue;
      if (!(await tools.hasUpdate(name))) continue;
      if (!queue.isIdle()) continue;
      send('toast', { kind: 'info', text: `กำลังอัปเดต ${tools.SPECS[name].label} เป็นเวอร์ชันล่าสุด…` });
      const r = await tools.install(name, p => send('tools:progress', p));
      send('toast', { kind: 'ok', text: `อัปเดต ${tools.SPECS[name].label} เป็น ${r.version} แล้ว` });
      send('tools:changed', tools.status());
    } catch {}
  }
}

handle('fetch:start', ({ url, start, limit }) => {
  const id = ++fetchSeq;
  const s = store.settings.get();
  const f = fetcher.startFetch({ url, start, limit, opts: { cookiesBrowser: s.cookiesBrowser } }, {
    items: items => send('fetch:items', { id, items }),
    log: line => send('fetch:log', { id, line }),
    done: r => { fetches.delete(id); send('fetch:done', { id, ...r }); }
  });
  fetches.set(id, f);
  return id;
});
handle('fetch:stop', id => { fetches.get(id)?.stop(); });

handle('queue:add', (items, overrides = {}) => {
  const s = store.settings.get();
  queue.setConcurrency(s.concurrency);
  return queue.add(items, { ...s, ...overrides });
});
handle('queue:list', () => queue.list());
handle('queue:cancel', id => queue.cancel(id));
handle('queue:cancelAll', () => queue.cancelAll());
handle('queue:retry', (id, force) => queue.retry(id, force));
handle('queue:remove', id => queue.remove(id));
handle('queue:clearFinished', () => queue.clearFinished());
handle('queue:log', id => queue.log(id));

queue.on('added', jobs => send('queue:added', jobs));
queue.on('update', job => send('queue:update', job));
queue.on('removed', ids => send('queue:removed', ids));
queue.on('stats', s => send('queue:stats', s));
queue.on('archived', key => send('archive:add', key));
let finishedBatch = 0, notifyTimer = null;
queue.on('finished', () => {
  finishedBatch++;
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    if (queue.isIdle() && win && !win.isFocused() && Notification.isSupported()) {
      new Notification({ title: 'Universe Download', body: `ดาวน์โหลดเสร็จแล้ว ${finishedBatch} รายการ` }).show();
    }
    if (queue.isIdle()) finishedBatch = 0;
  }, 1500);
});

handle('archive:keys', () => store.archive.keys());
handle('history:list', () => store.history.list());
handle('history:clear', () => store.history.clear());

handle('dialog:folder', async current => {
  const r = await dialog.showOpenDialog(win, { defaultPath: current, properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
handle('shell:openPath', async p => {
  if (p && !fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  return shell.openPath(p);
});
handle('shell:showItem', p => { if (p && fs.existsSync(p)) shell.showItemInFolder(p); else return 'missing'; });
handle('shell:openExternal', u => { if (/^https?:/.test(u)) shell.openExternal(u); });
handle('clipboard:read', () => clipboard.readText());

handle('update:check', () => updater.check());
handle('update:state', () => updater.getState());
handle('update:install', () => updater.install());

handle('theme:titlebar', ({ color, symbol }) => {
  try { win.setTitleBarOverlay({ color, symbolColor: symbol, height: 44 }); } catch {}
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  thumbs.register();
  createWindow();
  updater.init(send);
  setTimeout(() => thumbs.trimCache(), 15000);
});

app.on('window-all-closed', () => {
  queue.cancelAll();
  for (const f of fetches.values()) f.stop();
  app.quit();
});
