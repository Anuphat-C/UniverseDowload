// รูปปก: โหลดผ่าน protocol ภายใน udthumb:// เพื่อ
//  - ใส่ Referer/User-Agent ที่เว็บต้องการ (บางเว็บบล็อกรูปถ้าไม่มี)
//  - เก็บแคชลงดิสก์ เปิดรายการเดิมซ้ำแล้วขึ้นทันที
//  - แปลง HEIC (ปก TikTok บางคลิป) เป็น JPG ด้วย ffmpeg เพราะ Chromium เปิด HEIC ไม่ได้
const { app, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const { spawn } = require('child_process');
const tools = require('./tools');
const { BROWSER_UA } = require('./fetcher');

const cacheDir = () => path.join(app.getPath('userData'), 'thumbcache');

function referer(u) {
  if (/tiktokcdn|tiktok|byteimg|ibyteimg|muscdn/i.test(u)) return 'https://www.tiktok.com/';
  if (/bilibili|hdslb/i.test(u)) return 'https://www.bilibili.com/';
  if (/pximg/i.test(u)) return 'https://www.pixiv.net/';
  return '';
}

function sniff(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  if (b.slice(0, 3).toString() === 'GIF') return 'image/gif';
  if (b.slice(4, 8).toString() === 'ftyp') {
    const brand = b.slice(8, 12).toString();
    if (/avif|avis/.test(brand)) return 'image/avif';
    return 'image/heic';
  }
  return 'image/jpeg';
}

function heicToJpeg(buf) {
  const dir = tools.ffmpegDir();
  if (!dir) return Promise.resolve(null);
  return new Promise(resolve => {
    const p = spawn(path.join(dir, 'ffmpeg.exe'), ['-v', 'error', '-i', 'pipe:0', '-frames:v', '1', '-vf', 'scale=480:-2', '-f', 'image2', '-c:v', 'mjpeg', 'pipe:1'], { windowsHide: true });
    const chunks = [];
    p.stdout.on('data', d => chunks.push(d));
    p.on('error', () => resolve(null));
    p.on('close', code => resolve(code === 0 && chunks.length ? Buffer.concat(chunks) : null));
    p.stdin.on('error', () => {});
    p.stdin.end(buf);
  });
}

const inflight = new Map();

async function getThumb(u) {
  const key = crypto.createHash('sha1').update(u).digest('hex');
  const file = path.join(cacheDir(), key);
  try { const b = await fsp.readFile(file); return b; } catch {}
  if (inflight.has(key)) return inflight.get(key);
  const job = (async () => {
    const headers = { 'User-Agent': BROWSER_UA, Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' };
    const ref = referer(u);
    if (ref) headers.Referer = ref;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    let r;
    try { r = await fetch(u, { headers, redirect: 'follow', signal: ctl.signal }); }
    finally { clearTimeout(t); }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    let buf = Buffer.from(await r.arrayBuffer());
    if (sniff(buf) === 'image/heic') buf = (await heicToJpeg(buf)) || buf;
    await fsp.mkdir(cacheDir(), { recursive: true });
    fsp.writeFile(file, buf).catch(() => {});
    return buf;
  })();
  inflight.set(key, job);
  job.finally(() => inflight.delete(key)).catch(() => {});
  return job;
}

function register() {
  protocol.handle('udthumb', async req => {
    let u;
    try { u = new URL(req.url).searchParams.get('u'); } catch {}
    if (!u || !/^https?:\/\//i.test(u)) return new Response('', { status: 400 });
    try {
      const buf = await getThumb(u);
      return new Response(buf, { headers: { 'Content-Type': sniff(buf), 'Cache-Control': 'max-age=604800' } });
    } catch {
      return new Response('', { status: 404 });
    }
  });
}

// แคชเกิน ~400MB ลบไฟล์เก่าทิ้ง
async function trimCache(maxBytes = 400 * 1048576) {
  try {
    const dir = cacheDir();
    const names = await fsp.readdir(dir);
    const files = [];
    let total = 0;
    for (const n of names) {
      try { const s = await fsp.stat(path.join(dir, n)); files.push({ n, s }); total += s.size; } catch {}
    }
    if (total <= maxBytes) return;
    files.sort((a, b) => a.s.mtimeMs - b.s.mtimeMs);
    for (const f of files) {
      if (total <= maxBytes * 0.7) break;
      await fsp.unlink(path.join(dir, f.n)).catch(() => {});
      total -= f.s.size;
    }
  } catch {}
}

module.exports = { register, trimCache };
