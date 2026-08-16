
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
