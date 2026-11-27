// คิวดาวน์โหลด: โหลดพร้อมกันหลายรายการ (ตั้งจำนวนได้) แต่ละรายการมีความคืบหน้า/ความเร็ว/เวลาที่เหลือของตัวเอง
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const tools = require('./tools');
const { lineReader, killTree, humanError, probeDirect, BROWSER_UA } = require('./fetcher');
const store = require('./store');

const NAME_TPL = {
  title: '%(title).150B [%(id)s].%(ext)s',
  date_title: '%(upload_date>%Y-%m-%d|)s %(title).140B.%(ext)s',
  date_id: '%(upload_date)s_%(id)s.%(ext)s',
  id: '%(id)s.%(ext)s'
};

const H264 = 'vcodec:h264,acodec:aac';
function formatArgs(preset, hasFF) {
  if (preset === 'audio-mp3') return hasFF ? ['-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0'] : ['-f', 'ba/b'];
  if (preset === 'audio-m4a') return hasFF ? ['-f', 'ba[ext=m4a]/ba/b', '-x', '--audio-format', 'm4a'] : ['-f', 'ba[ext=m4a]/ba/b'];
  if (preset === 'original') return ['-f', hasFF ? 'bv*+ba/b' : 'b'];
  const h = Number(preset);
  if (!hasFF) return h ? ['-f', `b[height<=${h}]/b`] : ['-f', 'b'];
  if (h) return ['-f', `bv*[height<=${h}]+ba/b[height<=${h}]/b`, '-S', `res:${h},fps,${H264}`, '--merge-output-format', 'mp4'];
  return ['-f', 'bv*+ba/b', '-S', `res,fps,${H264}`, '--merge-output-format', 'mp4'];
}

const PP_RE = /^\[(Merger|ExtractAudio|EmbedThumbnail|Metadata|FFmpeg\w*|VideoConvertor|VideoRemuxer|ThumbnailsConvertor|EmbedSubtitle|SponsorBlock|ModifyChapters|FixupM3u8|Fixup\w*)\]/;

class DownloadQueue extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map();
    this.running = new Set();
    this.concurrency = 3;
  }

  setConcurrency(n) { this.concurrency = Math.max(1, Math.min(10, Number(n) || 1)); this.pump(); }

  // items: [{url,title,thumb,kind,key,uploader,duration}] opts: snapshot ของการตั้งค่า
  add(items, opts) {
    const added = [];
    items.forEach((item, i) => {
      const id = crypto.randomUUID();
      const job = {
        id, item, opts: { ...opts }, status: 'queued', pct: 0, speed: 0, eta: null, size: 0, done: 0,
        file: null, files: 0, error: null, engine: null, phase: '', addedAt: Date.now(), log: [], part: 0
      };
      if (opts.numbering) job.opts.number = (Number(opts.numberStart) || 1) + i;
      this.jobs.set(id, job);
      added.push(this.snap(job));
    });
    this.emit('added', added);
    this.pump();
    return added;
  }

  list() { return [...this.jobs.values()].map(j => this.snap(j)); }

  snap(j) {
    const { item, opts, status, pct, speed, eta, size, done, file, files, error, engine, phase, addedAt, id, part } = j;
    return { id, item, status, pct, speed, eta, size, done, file, files, error, engine, phase, addedAt, part, number: opts.number };
  }

  emitUpdate(job, force) {
    const now = Date.now();
    if (!force && now - (job._last || 0) < 200) {
      if (!job._pending) job._pending = setTimeout(() => { job._pending = null; this.emitUpdate(job, true); }, 220);
      return;
    }
    clearTimeout(job._pending); job._pending = null;
    job._last = now;
    this.emit('update', this.snap(job));
  }

  pump() {
    for (const job of this.jobs.values()) {
      if (this.running.size >= this.concurrency) break;
      if (job.status === 'queued') this.run(job);
    }
    this.emit('stats', this.stats());
  }

  stats() {
    const s = { queued: 0, running: 0, done: 0, error: 0, speed: 0 };
    for (const j of this.jobs.values()) {
      if (j.status === 'queued') s.queued++;
      else if (j.status === 'running') { s.running++; s.speed += j.speed || 0; }
      else if (j.status === 'done' || j.status === 'skipped') s.done++;
      else if (j.status === 'error') s.error++;
    }
    return s;
  }

  isIdle() { return this.running.size === 0; }

  cancel(id) {
    const j = this.jobs.get(id);
    if (!j) return;
    if (j.status === 'queued') { j.status = 'canceled'; this.emitUpdate(j, true); this.pump(); return; }
    if (j.status === 'running') { j.canceled = true; if (j.abort) j.abort(); if (j.proc) killTree(j.proc.pid); }
  }
  cancelAll() { for (const j of this.jobs.values()) if (j.status === 'queued' || j.status === 'running') this.cancel(j.id); }

  retry(id, force) {
    const j = this.jobs.get(id);
    if (!j || j.status === 'running' || j.status === 'queued') return;
    Object.assign(j, { status: 'queued', pct: 0, speed: 0, eta: null, error: null, phase: '', canceled: false, part: 0, files: 0 });
    if (force) j.opts.force = true;
    this.emitUpdate(j, true);
    this.pump();
  }
  remove(id) {
    const j = this.jobs.get(id);
    if (!j) return;
    if (j.status === 'running') this.cancel(id);
    this.jobs.delete(id);
    this.emit('removed', [id]);
    this.emit('stats', this.stats());
  }
  clearFinished() {
    const ids = [];
    for (const [id, j] of this.jobs) if (['done', 'skipped', 'canceled', 'error'].includes(j.status)) { this.jobs.delete(id); ids.push(id); }
    this.emit('removed', ids);
    this.emit('stats', this.stats());
  }
  log(id) { return this.jobs.get(id)?.log.join('\n') || ''; }

  async run(job) {
    this.running.add(job.id);
    job.status = 'running'; job.phase = 'กำลังเริ่ม'; job.startedAt = Date.now();
    this.emitUpdate(job, true);
    try {
      await fsp.mkdir(job.opts.outDir, { recursive: true });
      const kind = job.item.kind;
      if (kind === 'file') await this.runDirect(job);
      else if (kind === 'gallery') await this.runGallery(job);
      else {
        try { await this.runYtdlp(job); }
        catch (e) {
          if (!job.canceled && /Unsupported URL|No video formats|There'?s no video|no video in this|No media found/i.test(e.raw || e.message)) {
            const d = await probeDirect(job.item.url);
            if (d) {
              Object.assign(job.item, { url: d.finalUrl, title: d.name, size: d.size, kind: 'file' });
              await this.runDirect(job);
            } else await this.runGallery(job);
          } else throw e;
        }
      }
      if (job.status === 'running') job.status = 'done';
    } catch (e) {
      if (job.canceled) { job.status = 'canceled'; job.error = null; }
      else { job.status = 'error'; job.error = humanError(e.raw || e.message); }
    }
    job.proc = null; job.abort = null; job.speed = 0; job.eta = null;
    if (job.status === 'done') {
      job.pct = 100; job.phase = '';
      store.history.add({
        title: job.item.title, url: job.item.url, thumb: job.item.thumb, file: job.file, size: job.size,
        uploader: job.item.uploader, at: Date.now(), engine: job.engine
      });
      if (job.item.key) this.emit('archived', job.item.key);
      this.emit('finished', this.snap(job));
    }
    this.running.delete(job.id);
    this.emitUpdate(job, true);
    this.pump();
  }

  pushLog(job, line) {
    job.log.push(line);
    if (job.log.length > 300) job.log.splice(0, job.log.length - 300);
  }

  runYtdlp(job) {
    return new Promise((resolve, reject) => {
      const exe = tools.ytdlpPath();
      if (!exe) return reject(new Error('ยังไม่ได้ติดตั้ง yt-dlp'));
      const o = job.opts;
      const ff = tools.ffmpegDir();
      job.engine = 'yt-dlp';
      let name = NAME_TPL[o.nameTpl] || NAME_TPL.title;
      if (o.number != null) name = `${String(o.number).padStart(Number(o.numberPad) || 2, '0')} - ${name}`;
      const sub = o.subByUploader ? '%(uploader,channel,uploader_id|Unknown)s/' : '';
      const printFile = path.join(os.tmpdir(), `ud-${job.id}.txt`);
      try { fs.unlinkSync(printFile); } catch {}
      const audio = /^audio/.test(o.preset);

      const args = [
        job.item.url, '--newline', '--progress', '--no-colors', '--encoding', 'utf-8',
        '-o', path.join(o.outDir, sub + name),
        '--progress-template', 'download:UDP%(progress)j',
        '--print-to-file', 'after_move:%(filepath)s', printFile,
        '-N', String(o.fragments || 4), '--retries', '10', '--fragment-retries', '10',
        '--windows-filenames', '--trim-filenames', '200'
      ];
      if (job.item.kind === 'media') args.push('--no-playlist');
      if (!o.force) args.push('--download-archive', store.archive.path());
      else args.push('--force-overwrites');
      if (o.noMtime) args.push('--no-mtime');
      if (ff) args.push('--ffmpeg-location', ff);
      args.push(...formatArgs(o.preset, !!ff));
      if (ff && o.embedMeta) args.push('--embed-metadata', '--embed-chapters');
      if (o.writeThumb) { args.push('--write-thumbnail'); if (ff) args.push('--convert-thumbnails', 'jpg'); }
      if (ff && o.embedThumb) args.push('--embed-thumbnail');
      if (o.subs && !audio) { args.push('--write-subs', '--sub-langs', o.subLangs || 'th,en'); if (ff) args.push('--embed-subs'); }
      if (Number(o.sleep) > 0) args.push('--sleep-interval', String(o.sleep));
      args.push(...tools.ytdlpCommonArgs(o));

      const proc = spawn(exe, args, { windowsHide: true, env: tools.childEnv() });
      job.proc = proc;
      let errors = [], skipped = false, lastName = '';

      const onLine = line => {
        if (line.startsWith('UDP')) {
          let p; try { p = JSON.parse(line.slice(3)); } catch { return; }
          const fname = p.filename || '';
          if (fname && fname !== lastName) { lastName = fname; job.part++; }
          const total = p.total_bytes || p.total_bytes_estimate || 0;
          let pct = total ? (p.downloaded_bytes / total) * 100 : 0;
          if (!total && p.fragment_count) pct = ((p.fragment_index || 0) / p.fragment_count) * 100;
          job.pct = Math.min(100, pct);
          job.speed = p.speed || 0;
          job.eta = p.eta ?? null;
          job.size = total || job.size;
          job.done = p.downloaded_bytes || 0;
          job.phase = p.status === 'finished' ? 'กำลังจัดการไฟล์' : (job.part > 1 ? `กำลังโหลด (ส่วนที่ ${job.part})` : 'กำลังโหลด');
          this.emitUpdate(job);
          return;
        }
        this.pushLog(job, line);
        if (/has already been recorded in the archive/.test(line)) skipped = true;
        else if (/^\[download\] Downloading item (\d+) of (\d+)/.test(line)) {
          job.phase = `รายการที่ ${RegExp.$1} / ${RegExp.$2}`; this.emitUpdate(job);
        } else if (/^\[download\] Destination: (.+)$/.test(line)) {
          if (!job.item.titleKnown && job.item.kind !== 'media') {
            job.item.title = path.basename(RegExp.$1).replace(/(\.f[\w-]+)?\.\w+$/, '').replace(/\s*\[[^\]]+\]$/, '').replace(/^\d+ - /, '');
            this.emitUpdate(job);
          }
        } else if (PP_RE.test(line)) {
          job.phase = 'กำลังจัดการไฟล์'; job.speed = 0; job.eta = null; this.emitUpdate(job);
        } else if (/^ERROR:/.test(line)) errors.push(line.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?/, ''));
      };
      lineReader(proc.stdout, onLine);
      lineReader(proc.stderr, onLine);
      proc.on('error', reject);
      proc.on('close', async code => {
        let printed = [];
        try { printed = (await fsp.readFile(printFile, 'utf8')).split(/\r?\n/).filter(Boolean); } catch {}
        fsp.unlink(printFile).catch(() => {});
        if (printed.length) {
          job.file = printed[printed.length - 1];
          job.files = printed.length;
          try { job.size = (await fsp.stat(job.file)).size; } catch {}
        }
        if (job.canceled) return reject(new Error('canceled'));
        if (code === 0 || (printed.length && !errors.length)) {
          if (!printed.length && skipped) { job.status = 'skipped'; job.phase = 'มีอยู่แล้ว (ข้าม)'; }
          return resolve();
        }
        if (printed.length) return resolve(); // โหลดได้บางส่วน (เช่นเพลย์ลิสต์ที่มีบางคลิปเสีย)
        const e = new Error(errors[errors.length - 1] || `yt-dlp ออกด้วยรหัส ${code}`);
        e.raw = errors.join('\n');
        reject(e);
      });
    });
  }

  async runGallery(job) {
    let exe = tools.galleryDlPath();
    if (!exe) {
      job.phase = 'กำลังติดตั้งตัวช่วยโหลดรูปภาพ (ครั้งแรกครั้งเดียว)'; this.emitUpdate(job, true);
      await tools.install('gallerydl', p => { job.phase = p.msg; job.pct = p.pct; this.emitUpdate(job); });
      exe = tools.galleryDlPath();
    }
    job.engine = 'gallery-dl'; job.pct = 0; job.phase = 'กำลังโหลดรูปภาพ';
    this.emitUpdate(job, true);
    const o = job.opts;
    const args = [job.item.url, '-d', o.outDir];
    if (o.cookiesBrowser) args.push('--cookies-from-browser', o.cookiesBrowser);
    if (Number(o.sleep) > 0) args.push('--sleep', String(o.sleep));
    return new Promise((resolve, reject) => {
      const proc = spawn(exe, args, { windowsHide: true, env: tools.childEnv() });
      job.proc = proc;
      let errors = [];
      const onLine = line => {
        this.pushLog(job, line);
        const l = line.replace(/^#\s*/, '');
        if (/^[A-Za-z]:\\/.test(l)) {
          job.files++; job.file = l;
          job.phase = `โหลดแล้ว ${job.files} ไฟล์`;
          this.emitUpdate(job);
        } else if (/\[error\]|error:/i.test(line)) errors.push(line.replace(/^.*?\[error\]\s*/i, ''));
      };
      lineReader(proc.stdout, onLine);
      lineReader(proc.stderr, onLine);
      proc.on('error', reject);
      proc.on('close', code => {
        if (job.canceled) return reject(new Error('canceled'));
        if (job.files > 0) { job.phase = ''; return resolve(); }
        const e = new Error(errors[errors.length - 1] || (code === 0 ? 'ไม่พบไฟล์ให้โหลดจากลิงก์นี้' : `gallery-dl ออกด้วยรหัส ${code}`));
        e.raw = errors.join('\n');
        reject(e);
      });
    });
  }

  async runDirect(job) {
    job.engine = 'direct';
    const ctl = new AbortController();
    job.abort = () => ctl.abort();
    const r = await fetch(job.item.url, { redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': BROWSER_UA } });
    if (!r.ok || !r.body) throw new Error(`HTTP Error ${r.status}`);
    const total = Number(r.headers.get('content-length')) || job.item.size || 0;
    const safe = (job.item.title || 'download').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 180);
    let dest = path.join(job.opts.outDir, safe);
    const { name, ext } = path.parse(safe);
    for (let i = 1; fs.existsSync(dest); i++) dest = path.join(job.opts.outDir, `${name} (${i})${ext}`);
    const tmp = dest + '.part';
    const out = fs.createWriteStream(tmp);
    const reader = r.body.getReader();
    let got = 0, t0 = Date.now(), lastT = t0, lastGot = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        got += value.length;
        if (!out.write(value)) await new Promise(res => out.once('drain', res));
        const now = Date.now();
        if (now - lastT > 400) {
          job.speed = ((got - lastGot) * 1000) / (now - lastT); lastT = now; lastGot = got;
          job.done = got; job.size = total; job.pct = total ? (got / total) * 100 : 0;
          job.eta = total && job.speed ? Math.round((total - got) / job.speed) : null;
          job.phase = 'กำลังโหลด';
          this.emitUpdate(job);
        }
      }
      await new Promise((res, rej) => out.end(e => (e ? rej(e) : res())));
      await fsp.rename(tmp, dest);
      job.file = dest; job.size = got; job.files = 1;
    } catch (e) {
      out.destroy(); fsp.unlink(tmp).catch(() => {});
      if (job.canceled) throw new Error('canceled');
      throw e;
    }
  }
}

module.exports = { DownloadQueue, formatArgs, NAME_TPL };
