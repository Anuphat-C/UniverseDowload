// ดึงรายการจากลิงก์ (ไม่โหลดวิดีโอ) แบบสตรีม: เจอรายการไหนส่งขึ้นจอทันที ไม่ต้องรอจนจบ
const { spawn, execFile } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const tools = require('./tools');

const FIELDS = [
  'id', 'title', 'url', 'webpage_url', 'original_url', 'duration', 'uploader', 'channel', 'uploader_id',
  'playlist_title', 'thumbnail', 'thumbnails', 'ie_key', 'extractor_key', '_type', 'upload_date',
  'timestamp', 'view_count', 'width', 'height', 'playlist_uploader', 'playlist_channel'
].join(',');

const hash = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 16);

function pickThumb(e) {
  const list = Array.isArray(e.thumbnails) ? e.thumbnails.filter(t => t && t.url) : [];
  const sized = list.filter(t => t.width);
  if (sized.length) {
    sized.sort((a, b) => a.width - b.width);
    // ขนาดพอดีกับการ์ด (~360-720px) โหลดเร็วกว่าภาพเต็ม
    return (sized.find(t => t.width >= 360) || sized[sized.length - 1]).url;
  }
  return e.thumbnail || (list.length ? list[list.length - 1].url : '');
}

const LIST_IE = /(Tab|Playlist|Channel|User|Album|Series|Season|Collection|Search|Feed)$/i;

function normalize(e, index) {
  const url = e.webpage_url || e.url || e.original_url;
  if (!url || !/^https?:/i.test(url)) return null;
  const ie = e.extractor_key || e.ie_key || '';
  const id = e.id != null ? String(e.id) : hash(url);
  const isList = e._type === 'playlist' || (LIST_IE.test(e.ie_key || '') && !e.duration);
  return {
    id,
    key: `${ie.toLowerCase()} ${id}`,
    url,
    index,
    title: (e.title || e.playlist_title || '').replace(/\s+/g, ' ').trim() || url,
    duration: Number(e.duration) || 0,
    uploader: e.uploader || e.channel || e.playlist_uploader || e.playlist_channel || e.uploader_id || '',
    date: e.upload_date || (e.timestamp ? new Date(e.timestamp * 1000).toISOString().slice(0, 10).replace(/-/g, '') : ''),
    views: e.view_count || 0,
    thumb: pickThumb(e),
    ie,
    kind: isList ? 'playlist' : 'media'
  };
}

// เช็กว่าเป็นลิงก์ไฟล์ตรง (zip, pdf, exe, รูป ฯลฯ) หรือไม่
async function probeDirect(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10000);
  try {
    let r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': BROWSER_UA } });
    if (!r.ok || !r.headers.get('content-type')) {
      r = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': BROWSER_UA, Range: 'bytes=0-0' } });
      try { r.body?.cancel(); } catch {}
    }
    if (!r.ok && r.status !== 206) return null;
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    const cd = r.headers.get('content-disposition') || '';
    if (/text\/html|application\/xhtml/.test(ct) && !/attachment/i.test(cd)) return null;
    let name = '';
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
    if (m) name = decodeURIComponent(m[1] || m[2]);
    if (!name) {
      try { name = decodeURIComponent(path.basename(new URL(r.url || url).pathname)) || ''; } catch {}
    }
    if (!name) name = 'download';
    let size = Number(r.headers.get('content-length')) || 0;
    const cr = r.headers.get('content-range');
    if (cr && /\/(\d+)$/.test(cr)) size = Number(RegExp.$1);
    return { name, size, type: ct, finalUrl: r.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// UA แบบ Firefox: UA แบบ Chrome ที่ไม่มี header Client-Hints ครบ มักโดนระบบกันบอทบล็อก (403)
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';

/**
 * เริ่มดึงรายการ
 * cb.items(list) / cb.log(line) / cb.done({count, hasMore, error, cookieWarn})
 * ถ้าอ่านคุกกี้จากเบราว์เซอร์ไม่ได้ → ลองใหม่แบบไม่ใช้คุกกี้ทันที แล้วแจ้งเตือน (ไม่ให้ทั้งโปรแกรมใช้ไม่ได้เพราะคุกกี้)
 */
function startFetch(params, cb) {
  let cur = null, stopped = false;
  const run = (opts, cookieWarn) => {
    cur = startFetchOnce({ ...params, opts }, {
      items: cb.items,
      log: cb.log,
      done: r => {
        if (!stopped && r.cookieFailed) {
          cb.log(`[UD] ${tools.cookieWarning(opts.cookiesBrowser)}`);
          return run({ ...opts, cookiesBrowser: '' }, tools.cookieWarning(opts.cookiesBrowser));
        }
        cb.done(cookieWarn ? { ...r, cookieWarn } : r);
      }
    });
  };
  run(params.opts || {});
  return { stop() { stopped = true; cur?.stop(); } };
}

function startFetchOnce({ url, start = 1, limit = 60, opts = {} }, cb) {
  const exe = tools.ytdlpPath();
  let proc = null, stopped = false, count = 0, errors = [], buf = [], flushTimer = null, genericHold = null;
  const flush = () => { flushTimer = null; if (buf.length) { cb.items(buf); buf = []; } };
  const push = it => { buf.push(it); if (!flushTimer) flushTimer = setTimeout(flush, 120); };

  const directItem = d => ({
    id: hash(url), key: '', url: d.finalUrl, index: 1, title: d.name, duration: 0, uploader: hostOf(url),
    date: '', views: 0, thumb: /^image\//.test(d.type) ? d.finalUrl : '', ie: 'Direct', kind: 'file', size: d.size, mime: d.type
  });

  const finish = async (codeErr) => {
    clearTimeout(flushTimer); flush();
    if (stopped) return cb.done({ count, hasMore: true, stopped: true });
    // yt-dlp "Generic" = ลิงก์ไฟล์ตรง: ถ้าไม่ใช่วิดีโอ/เสียง (เช่น pdf, zip, exe) ให้โหลดแบบไฟล์ธรรมดา
    if (genericHold) {
      const d = await probeDirect(url);
      const isMedia = d && (/^(video|audio)\/|mpegurl|dash\+xml/i.test(d.type)
        || /\.(mp4|mkv|webm|mov|m4v|m4a|mp3|flac|wav|ogg|opus|aac|ts|m3u8|mpd|avi|wmv|flv)$/i.test(d.name));
      if (d && !isMedia) cb.items([directItem(d)]);
      else cb.items([genericHold]);
      return cb.done({ count: 1, hasMore: false });
    }
    if (count === 0 && opts.cookiesBrowser && tools.isCookieError(errors.join('\n'))) {
      const err = errors.join('\n');
      return cb.done({ count: 0, hasMore: false, error: humanError(err), cookieFailed: true });
    }
    if (count === 0) {
      // yt-dlp ไม่รู้จัก → ลองดูว่าเป็นไฟล์ตรงไหม → ถ้าไม่ใช่ ส่งต่อให้โหมดรูปภาพ/แกลเลอรี
      const d = await probeDirect(url);
      if (d) {
        cb.items([directItem(d)]);
        return cb.done({ count: 1, hasMore: false });
      }
      const err = errors.join('\n') || codeErr || '';
      if (/Unsupported URL|No video|no video|There'?s no video|not a video|No media found|Unable to extract/i.test(err) || !err) {
        cb.items([{
          id: hash(url), key: '', url, index: 1, title: hostOf(url) + ' (รูปภาพ/แกลเลอรี)', duration: 0, uploader: hostOf(url),
          date: '', views: 0, thumb: '', ie: 'Gallery', kind: 'gallery'
        }]);
        return cb.done({ count: 1, hasMore: false, note: 'ไม่พบวิดีโอ จะลองโหลดเป็นรูปภาพ/แกลเลอรีแทน' });
      }
      return cb.done({ count: 0, hasMore: false, error: humanError(err) });
    }
    cb.done({ count, hasMore: limit > 0 && count >= limit, warn: errors.length ? humanError(errors[errors.length - 1]) : null });
  };

  if (!exe) { setTimeout(() => cb.done({ count: 0, error: 'ยังไม่ได้ติดตั้ง yt-dlp' }), 0); return { stop() {} }; }

  const args = [
    url, '--flat-playlist', '--lazy-playlist', '--ignore-errors', '--no-colors', '--encoding', 'utf-8',
    '--extractor-retries', '3', '-O', `%(.{${FIELDS}})j`, ...tools.ytdlpCommonArgs(opts)
  ];
  if (limit > 0) args.push('--playlist-items', `${start}:${start + limit - 1}`);
  else if (start > 1) args.push('--playlist-items', `${start}:`);

  proc = spawn(exe, args, { windowsHide: true, env: tools.childEnv() });
  lineReader(proc.stdout, line => {
    if (line[0] !== '{') return;
    try {
      const it = normalize(JSON.parse(line), start + count);
      if (!it) return;
      count++;
      if (it.ie === 'Generic' && start === 1 && count === 1 && !/[?&]list=|playlist/i.test(url)) genericHold = it;
      else {
        if (genericHold) { push(genericHold); genericHold = null; }
        push(it);
      }
    } catch {}
  });
  lineReader(proc.stderr, line => {
    if (/^ERROR:/.test(line)) errors.push(line.replace(/^ERROR:\s*/, ''));
    cb.log(line);
  });
  proc.on('error', e => finish(e.message));
  proc.on('close', () => finish());

  return {
    stop() {
      if (!proc || proc.exitCode !== null) return;
      stopped = true;
      killTree(proc.pid);
    }
  };
}

function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } }

function lineReader(stream, onLine) {
  let rest = '';
  stream.setEncoding('utf8');
  stream.on('data', chunk => {
    rest += chunk;
    const parts = rest.split(/\r?\n|\r/);
    rest = parts.pop();
    for (const p of parts) if (p) onLine(p);
  });
  stream.on('end', () => { if (rest) onLine(rest); });
}

function killTree(pid) {
  if (!pid) return;
  execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {});
}

// แปลงข้อความ error ของ yt-dlp เป็นภาษาคน
function humanError(msg = '') {
  const m = String(msg);
  if (tools.isCookieError(m))
    return 'อ่านคุกกี้จากเบราว์เซอร์ไม่ได้ — ปิดเบราว์เซอร์นั้นก่อน หรือเปลี่ยนเป็น Firefox / "ไม่ใช้" ในหน้าตั้งค่า';
  if (/Private video|private|login required|Sign in to confirm|requires? (authentication|login)|log ?in|cookies/i.test(m))
    return 'ต้องล็อกอินก่อนถึงจะดูได้ — เปิด "ใช้คุกกี้จากเบราว์เซอร์" ในหน้าตั้งค่า แล้วลองใหม่';
  if (/HTTP Error 429|Too Many Requests|rate.?limit/i.test(m))
    return 'เว็บจำกัดความถี่ (429) — ลดจำนวนที่โหลดพร้อมกัน หรือเพิ่มเวลาพักในหน้าตั้งค่า';
  if (/HTTP Error 403|Forbidden/i.test(m)) return 'เว็บปฏิเสธการเข้าถึง (403) — ลองอัปเดต yt-dlp หรือใช้คุกกี้จากเบราว์เซอร์';
  if (/HTTP Error 404|not found|does not exist|removed|deleted/i.test(m)) return 'ไม่พบคลิปนี้ (อาจถูกลบหรือปิดไปแล้ว)';
  if (/Requested format is not available/i.test(m)) return 'ไม่มีความละเอียดที่เลือก — ลองเลือก "ดีที่สุด"';
  if (/not available in your country|geo.?restrict/i.test(m)) return 'คลิปนี้ไม่เปิดให้ดูในประเทศไทย';
  if (/Unsupported URL/i.test(m)) return 'ยังไม่รองรับลิงก์นี้';
  if (/getaddrinfo|Unable to download webpage|timed out|Connection|network/i.test(m)) return 'เชื่อมต่อเว็บไม่ได้ — ตรวจสอบอินเทอร์เน็ต';
  if (/ffmpeg/i.test(m) && /not found|not installed/i.test(m)) return 'ต้องใช้ ffmpeg — ติดตั้งได้ในหน้าตั้งค่า';
  return m.length > 220 ? m.slice(0, 220) + '…' : m;
}

module.exports = { startFetch, probeDirect, humanError, lineReader, killTree, hostOf, BROWSER_UA };
