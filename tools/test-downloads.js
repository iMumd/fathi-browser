'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const path = require('node:path');
const { EventEmitter } = require('node:events'); const { Store } = require('../src/main/downloads');
function item(name = 'fixture.txt') {
  const value = new EventEmitter(); let paused = false;
  Object.assign(value, { getFilename: () => name, getReceivedBytes: () => 7, getTotalBytes: () => 10,
    isPaused: () => paused, pause: () => { paused = true; }, resume: () => { paused = false; },
    cancel: () => { value.cancelled = true; }, setSavePath: (file) => { value.file = file; } });
  return value;
}
test('downloads use unique bounded temporary names and do not expose file paths', () => {
  const store = new Store(); const first = item('../unsafe\\fixture.txt'); const second = item('../unsafe\\fixture.txt');
  store.track(first, path.resolve('temp')); store.track(second, path.resolve('temp'));
  assert.notEqual(first.file, second.file); assert.equal(path.dirname(first.file), path.resolve('temp'));
  assert.equal(store.list().length, 2); assert.equal('file' in store.list()[0], false); assert.equal('item' in store.list()[0], false);
});
test('download progress, pause/resume and completed action validation stay truthful', () => {
  const store = new Store(); const download = item(); const id = store.track(download, path.resolve('temp'));
  store.control(id, 'pause'); assert.equal(store.list()[0].paused, true);
  store.control(id, 'resume'); assert.equal(store.list()[0].paused, false);
  download.emit('updated', {}, 'progressing'); assert.equal(store.list()[0].received, 7);
  download.emit('done', {}, 'completed'); assert.equal(store.list()[0].state, 'completed');
  assert.throws(() => store.control(id, 'cancel'), /not active/); assert.throws(() => store.get('unknown'), /Unknown/);
});
test('download cap cancels overflow rather than silently saving elsewhere', () => {
  const store = new Store();
  for (let i = 0; i < 100; i++) store.track(item(), path.resolve('temp'));
  const extra = item(); assert.equal(store.track(extra, path.resolve('temp')), undefined);
  assert.equal(extra.cancelled, true); assert.equal(store.list().length, 100);
});
