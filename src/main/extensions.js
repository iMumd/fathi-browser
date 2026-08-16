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
