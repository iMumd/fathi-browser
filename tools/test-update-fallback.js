'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
function updater(fetch) {
  const filename = path.resolve(__dirname, '../src/main/updater.js');
  const context = { module: { exports: {} }, process: { platform: 'linux', env: {}, argv: [] }, URL,
    require: () => ({ app: { getVersion: () => '1.0.1', isPackaged: false }, net: { fetch }, shell: {}, clipboard: {} }) };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}
test('manual update checks use the public latest-release redirect when API returns 404', async () => {
  const up = updater(async (url) => url.startsWith('https://api.') ? { ok: false, status: 404 } : { ok: true, url: 'https://github.com/iMumd/fathi-browser/releases/tag/v1.0.2' });
  const result = await up.check();
  assert.equal(result.status, 'available'); assert.equal(result.version, '1.0.2');
});
test('public metadata fallback rejects unexpected origins and missing stable tags', async () => {
  for (const page of ['https://evil.test/iMumd/fathi-browser/releases/tag/v1.0.2', 'https://github.com/iMumd/fathi-browser/releases/latest']) {
    const up = updater(async (url) => { if (url.startsWith('https://api.')) throw new Error('network error'); return { ok: true, url: page }; });
    assert.equal((await up.check()).status, 'error');
  }
});
