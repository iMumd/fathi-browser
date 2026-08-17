
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
