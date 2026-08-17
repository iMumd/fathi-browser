'use strict';
/**
 * Chrome Web Store extension support.
 *
 * Electron can load unpacked extensions. To install directly from the store we
 * download the official CRX from Google's update endpoint, strip the CRX header
 * and load the payload as an unpacked extension. Extensions are loaded into
 * every live tab session (so they work in any tab) and into every new session.
 */
const fs = require('node:fs');
const path = require('node:path');
const { app, net, session, dialog, BrowserWindow } = require('electron');
const AdmZip = require('adm-zip');

const STORE_ID_RE = /^[a-p]{32}$/;

function extRoot() {
  return path.join(app.getPath('userData'), 'fathi-ext');
}

function extractId(input) {
  const raw = String(input || '').trim();
  if (STORE_ID_RE.test(raw)) return raw;
  const m = raw.match(/[a-p]{32}/);
  return m ? m[0] : null;
}

/** CRX3 = "Cr24" + version + header length + header (protobuf) + ZIP */
function stripCrx(buf) {
  const magic = buf.subarray(0, 4).toString('ascii');
  if (magic !== 'Cr24') return buf;                    // maybe already a zip
  const version = buf.readUInt32LE(4);
  if (version === 3) {
    const headerLen = buf.readUInt32LE(8);
    return buf.subarray(12 + headerLen);
  }
  if (version === 2) {
    const pubLen = buf.readUInt32LE(8);
    const sigLen = buf.readUInt32LE(12);
    return buf.subarray(16 + pubLen + sigLen);
  }
  return buf;
}

function findZip(buf) {
  for (let i = 0; i < Math.min(buf.length - 4, 4096); i++) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x03 && buf[i + 3] === 0x04) {
      return buf.subarray(i);
    }
  }
  return buf;
}

async function downloadCrx(id) {
  const url = 'https://clients2.google.com/service/update2/crx' +
    '?response=redirect&os=win&arch=x64&os_ver=10.0&nacl_arch=x86-64' +
    '&prod=chromiumcrx&prodchannel=unknown&prodversion=' + (process.versions.chrome || '140.0.0.0') +
    '&acceptformat=crx2,crx3&x=id%3D' + id + '%26uc';

  const res = await net.fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`فشل التنزيل (HTTP ${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error('ملف الإضافة غير صالح');
  return buf;
}

function readManifest(dir) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    return { name: m.name || path.basename(dir), version: m.version || '0', manifest: m };
  } catch {
    return null;
  }
}

/** Load one extension directory into a session (idempotent). */
async function loadInto(ses, dir) {
  try {
    if (!ses.extensions || typeof ses.extensions.loadExtension !== 'function') {
      return { ok: false, error: 'Electron build has no extension API' };
    }
    const loaded = await ses.extensions.loadExtension(dir, { allowFileAccess: true });
    return { ok: true, id: loaded && loaded.id };
  } catch (e) {
    const msg = String(e && e.message || e);
    if (/already loaded|already exists/i.test(msg)) return { ok: true, duplicate: true };
    return { ok: false, error: msg };
  }
}

async function loadAllInto(ses) {
  const cfg = require('./settings').get();
  const results = [];
  for (const ext of cfg.extensions || []) {
    if (ext.disabled) continue;
    const dir = ext.path || path.join(extRoot(), ext.id);
    if (!fs.existsSync(path.join(dir, 'manifest.json'))) continue;
    results.push(await loadInto(ses, dir));
  }
  return results;
}

/** Install from a store URL/ID (or a local .crx path). Returns extension record. */
async function install(input, sessions) {
  const settings = require('./settings');

  let dir;
  let id;

  if (fs.existsSync(String(input)) && String(input).toLowerCase().endsWith('.crx')) {
    const buf = fs.readFileSync(String(input));
    const zip = new AdmZip(findZip(stripCrx(buf)));
    const tmp = path.join(extRoot(), 'local-' + Date.now());
    fs.mkdirSync(tmp, { recursive: true });
    zip.extractAllTo(tmp, true);
    const man = readManifest(tmp);
    if (!man) throw new Error('الإضافة لا تحتوي manifest.json صالح');
    id = 'local-' + Date.now();
    dir = tmp;
  } else {
    id = extractId(input);
    if (!id) throw new Error('معرّف الإضافة غير صالح (يجب أن يكون 32 حرفاً من a-p)');
    const crx = await downloadCrx(id);
    const zipBuf = findZip(stripCrx(crx));
    dir = path.join(extRoot(), id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    new AdmZip(zipBuf).extractAllTo(dir, true);
    if (!readManifest(dir)) throw new Error('الإضافة غير صالحة أو غير متاحة في المتجر');
  }

  const man = readManifest(dir);
  const record = {
    id,
    name: man ? man.name : id,
    version: man ? man.version : '0',
    path: dir,
    installedAt: Date.now(),
    source: 'store'
  };

  const cfg = settings.get();
  const list = (cfg.extensions || []).filter((e) => e.id !== id);
  list.push(record);
  settings.save({ extensions: list });

  const loadResults = [];
  for (const [, rec] of sessions) loadResults.push(await loadInto(rec.ses, dir));

  return { record, loaded: loadResults.filter((r) => r.ok).length, sessions: sessions.size };
}

async function installUnpacked(parentWindow, sessions) {
  const settings = require('./settings');
  const res = await dialog.showOpenDialog(parentWindow || BrowserWindow.getFocusedWindow(), {
    title: 'اختر مجلد إضافة غير مضغوطة',
    properties: ['openDirectory']
  });
  if (res.canceled || !res.filePaths[0]) return null;

  const dir = res.filePaths[0];
  const man = readManifest(dir);
  if (!man) throw new Error('المجلد لا يحتوي manifest.json صالح');

  const id = 'unpacked-' + path.basename(dir).replace(/[^a-zA-Z0-9_-]/g, '') + '-' + Date.now();
  const record = {
    id, name: man.name, version: man.version, path: dir,
    installedAt: Date.now(), source: 'unpacked'
  };

  const cfg = settings.get();
  const list = (cfg.extensions || []).filter((e) => e.path !== dir);
  list.push(record);
  settings.save({ extensions: list });

  const loadResults = [];
  for (const [, rec] of sessions) loadResults.push(await loadInto(rec.ses, dir));
  return { record, loaded: loadResults.filter((r) => r.ok).length };
}

async function remove(id, sessions) {
  const settings = require('./settings');
  const cfg = settings.get();
  const ext = (cfg.extensions || []).find((e) => e.id === id);
  settings.save({ extensions: (cfg.extensions || []).filter((e) => e.id !== id) });

  for (const [, rec] of sessions) {
    try {
      if (rec.ses.extensions && rec.ses.extensions.removeExtension) {
        await rec.ses.extensions.removeExtension(ext && ext.unpacked ? id : id);
      }
    } catch {}
  }

  if (ext && ext.path && ext.path.startsWith(extRoot())) {
    try { fs.rmSync(ext.path, { recursive: true, force: true }); } catch {}
  }
  return true;
}

async function list(sessions) {
  const settings = require('./settings');
  const cfg = settings.get();
  const anySes = sessions.size ? [...sessions.values()][0].ses : session.defaultSession;
  let loaded = [];
  try {
    loaded = anySes.extensions && anySes.extensions.getAllExtensions
      ? anySes.extensions.getAllExtensions().map((e) => ({ id: e.id, name: e.name, version: e.version, path: e.path }))
      : [];
  } catch {}

  return (cfg.extensions || []).map((e) => ({
    ...e,
    runningIn: sessions.size,
    live: loaded.some((l) => l.path === e.path || l.id === e.id)
  }));
}

module.exports = {
  extractId, install, installUnpacked, remove, list, loadInto, loadAllInto,
  extRoot, readManifest
};
