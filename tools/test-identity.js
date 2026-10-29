'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { generate, REAL_CHROME } = require('../src/main/fingerprint');
const { fathiSpoof } = require('../src/shared/spoof');
test('new profiles have independent cryptographic identity and noise material', () => {
  const profiles = Array.from({ length: 2000 }, () => generate());
  assert.equal(new Set(profiles.map((p) => p.id)).size, profiles.length);
  assert.equal(new Set(profiles.map((p) => p.seed)).size, profiles.length);
  assert.equal(new Set(profiles.map((p) => `${p.canvasSeed}:${p.audioSeed}`)).size, profiles.length);
  for (const p of profiles) {
    assert.match(p.seed, /^[0-9a-f]{32}$/);
    assert.equal(p.chromeMajor, REAL_CHROME);
    assert(p.deviceMemory <= 8);
    assert(p.screen.availHeight <= p.screen.height);
    assert.equal(p.language, p.languages[0]);
    if (p.osKey === 'mac' && p.webgl.renderer.includes('Intel')) assert.equal(p.architecture, 'x86');
  }
});
test('profile mutation cannot alter later tabs or device presets', () => {
  const a = generate({ seed: 'fixed', deviceId: 'iphone-15-pro' });
  const b = generate({ seed: 'fixed', deviceId: 'iphone-15-pro' });
  a.languages.push('bad'); a.webgl.vendor = 'bad';
  assert(!b.languages.includes('bad')); assert.notEqual(b.webgl.vendor, 'bad');
  assert.equal(generate({ deviceId: 'iphone-15-pro' }).clientHints, false);
});
function realm(fp) {
  const context = vm.createContext({ cfg: fp });
  vm.runInContext('globalThis.navigator = Object.create({});', context);
  vm.runInContext(`(${fathiSpoof.toString()})(cfg)`, context);
  return (script) => vm.runInContext(script, context);
}
test('timezone offsets have correct sign and daylight saving; explicit UTC stays UTC', () => {
  const run = realm({ ...generate(), timezone: 'America/New_York', spoofCanvas: false, spoofAudio: false });
  assert.equal(run('new Date("2026-01-15T12:00:00Z").getTimezoneOffset()'), 300);
  assert.equal(run('new Date("2026-07-15T12:00:00Z").getTimezoneOffset()'), 240);
  assert.equal(run('Intl.DateTimeFormat().resolvedOptions().timeZone'), 'America/New_York');
  assert.equal(run('Intl.DateTimeFormat("en-US", { timeZone: "UTC" }).resolvedOptions().timeZone'), 'UTC');
});
test('navigator prototype and instance agree, with default UA hint fields preserved', async () => {
  const fp = generate();
  const run = realm(fp);
  assert.equal(run('navigator.userAgent'), fp.ua);
  assert.equal(run('Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), "userAgent").get.call(navigator)'), fp.ua);
  const hints = await run('navigator.userAgentData.getHighEntropyValues(["architecture"])');
  assert.equal(hints.platform, fp.uaDataPlatform); assert.equal(hints.architecture, fp.architecture); assert(hints.brands.length);
});
test('network identity strips native hint spellings, omits Safari hints and carries Android model', () => {
  const filename = path.resolve(__dirname, '../src/main/session.js');
  let hook;
  const context = { module: { exports: {} }, console, require: (name) => {
    if (name === 'node:path') return path;
    if (name === './settings') return { get: () => ({ proxy: {}, matchReplace: [] }) };
    if (name === './rewrite') return require('../src/main/rewrite');
    return {};
  } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  const api = context.module.exports;
  const ios = generate({ deviceId: 'iphone-15-pro' });
  const ses = { webRequest: { onBeforeSendHeaders: (_filter, callback) => { hook = callback; }, onHeadersReceived() {} }, setUserAgent() {}, setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, setCertificateVerifyProc() {} };
  api.configureSession(ses, ios, 'test', { proxy: false, extensions: false });
  let output;
  hook({ requestHeaders: { 'uSeR-aGeNt': 'original', 'Sec-CH-UA': 'original', 'sec-ch-ua-platform': 'original', 'X-Client-Data': 'secret' } }, (result) => { output = result.requestHeaders; });
  assert.equal(output['User-Agent'], ios.ua);
  assert(!Object.keys(output).some((key) => /^sec-ch-ua/i.test(key)));
  assert(!('uSeR-aGeNt' in output));
  const android = generate({ deviceId: 'galaxy-s24-ultra' });
  assert.equal(api.buildClientHints(android)['sec-ch-ua-model'], '"SM-S928B"');
});
