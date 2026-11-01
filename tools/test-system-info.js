'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { collect } = require('../src/main/system-info');
test('About reports actual runtime and OS builds with separate machine/application architectures', () => {
  const info = collect({ app: { getVersion: () => '1.0.2', isPackaged: true },
    runtime: { platform: 'darwin', arch: 'x64', versions: { node: '24.1', electron: '45.0', chrome: '150.0' } },
    os: { type: () => 'Darwin', version: () => 'Darwin Kernel Version', release: () => '25.1.0', machine: () => 'arm64' } });
  assert.equal(info.system.name, 'macOS'); assert.equal(info.system.machine, 'arm64');
  assert.equal(info.arch, 'x64'); assert.equal(info.system.release, '25.1.0');
  assert.equal(info.node, '24.1'); assert.equal(info.packaged, true);
  assert.deepEqual(Object.keys(info).sort(), ['arch', 'chrome', 'electron', 'name', 'node', 'packaged', 'platform', 'system', 'version']);
  assert.deepEqual(Object.keys(info.system).sort(), ['machine', 'name', 'release', 'version']);
});
test('OS names are readable without guessing Windows editions from kernel versions', () => {
  for (const [platform, name] of [['win32', 'Windows'], ['linux', 'Linux']]) {
    const info = collect({ app: { getVersion: () => '1', isPackaged: false }, runtime: { platform, arch: 'x64', versions: {} },
      os: { type: () => platform, version: () => 'actual build', release: () => 'actual release', arch: () => 'x64' } });
    assert.equal(info.system.name, name); assert.equal(info.system.version, 'actual build');
    assert.equal(info.system.machine, 'x64'); assert.equal(info.packaged, false);
  }
});
