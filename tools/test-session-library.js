'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { Store } = require('../src/shared/session-library');
test('bookmarks deduplicate URLs and reject executable/internal schemes', () => {
  const store = new Store();
  const first = store.bookmark('https://example.test/', '<img onerror=bad>');
  assert.equal(store.bookmark(first.url, 'again'), first);
  for (const url of ['javascript:alert(1)', 'data:text/html,bad', 'file:///secret', 'fathi://newtab', 'not a URL']) assert.equal(store.bookmark(url, 'test'), null);
  assert.equal(store.bookmarks.length, 1);
  store.removeBookmark(first.id); assert.equal(store.bookmarks.length, 0);
});
test('session library bounds history/bookmarks without sharing state between windows', () => {
  const store = new Store();
  for (let i = 0; i < 400; i++) { store.visit('https://example.test/' + i, 'test'); store.bookmark('https://example.test/' + i, 'test'); }
  assert.equal(store.history.length, 300); assert.equal(store.bookmarks.length, 200);
  store.visit('https://example.test/399', 'new title'); assert.equal(store.history.length, 300);
  assert.equal(store.history[0].title, 'new title');
  store.clearHistory(); assert.equal(store.history.length, 0); assert.equal(store.bookmarks.length, 200);
  const other = new Store(); assert.equal(other.history.length, 0); assert.equal(other.bookmarks.length, 0);
});
