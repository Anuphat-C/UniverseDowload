// อัปเดตตัวโปรแกรมเองอัตโนมัติจาก GitHub Releases (ใช้ electron-updater)
// เช็กตอนเปิดโปรแกรม และทุก 4 ชั่วโมง โหลดเบื้องหลัง แล้วให้ผู้ใช้กด "รีสตาร์ทเพื่ออัปเดต"
const { app } = require('electron');

let autoUpdater = null;
let send = () => {};
let state = { status: 'idle' };

function setState(s) { state = { ...state, ...s }; send('update:status', state); }

function init(sendFn) {
  send = sendFn;
  if (!app.isPackaged) { state = { status: 'dev', message: 'โหมดพัฒนา (ไม่เช็กอัปเดต)' }; return; }
  try { ({ autoUpdater } = require('electron-updater')); } catch { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => setState({ status: 'checking' }));
  autoUpdater.on('update-available', i => setState({ status: 'downloading', version: i.version, pct: 0 }));
  autoUpdater.on('update-not-available', () => setState({ status: 'latest' }));
  autoUpdater.on('download-progress', p => setState({ status: 'downloading', pct: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', i => setState({ status: 'ready', version: i.version }));
  autoUpdater.on('error', e => setState({ status: 'error', message: String(e?.message || e).slice(0, 200) }));
  setTimeout(check, 4000);
  setInterval(check, 4 * 3600 * 1000);
}

function check() {
  if (!autoUpdater) return state;
  autoUpdater.checkForUpdates().catch(e => setState({ status: 'error', message: String(e?.message || e).slice(0, 200) }));
  return state;
}

function install() { if (autoUpdater && state.status === 'ready') autoUpdater.quitAndInstall(false, true); }

module.exports = { init, check, install, getState: () => state };
