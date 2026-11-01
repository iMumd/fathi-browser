'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const shortcuts = require('../src/shared/shortcuts');

test('every default binding is unique and resolves to its action', () => {
  assert.equal(new Set(Object.values(shortcuts.defaults)).size, Object.keys(shortcuts.defaults).length);
  for (const [name, binding] of Object.entries(shortcuts.defaults)) {
    const keys = binding.split('+'); const key = keys.pop();
    const input = { key: ['Left', 'Right'].includes(key) ? 'Arrow' + key : key,
      control: keys.includes('Ctrl'), alt: keys.includes('Alt'), shift: keys.includes('Shift') };
    assert.equal(shortcuts.resolve(input), name, binding);
  }
});
test('Tab chords and shifted close/reopen gestures remain distinct in DOM and guest events', () => {
  for (const key of ['Tab', 'T', 'W']) {
    assert.equal(shortcuts.combo({ key, ctrlKey: true, shiftKey: true }), shortcuts.combo({ key, control: true, shift: true }));
  }
  assert.equal(shortcuts.resolve({ key: 'Tab', control: true }), 'nextTab');
  assert.equal(shortcuts.resolve({ key: 'Tab', control: true, shift: true }), 'prevTab');
  assert.equal(shortcuts.resolve({ key: 't', control: true, shift: true }), 'reopenTab');
  assert.equal(shortcuts.resolve({ key: 'w', control: true, shift: true }), 'closeWindow');
});
test('browser aliases work, but customization and disabling override defaults', () => {
  assert.equal(shortcuts.resolve({ key: 'PageDown', control: true }), 'nextTab');
  assert.equal(shortcuts.resolve({ key: 'F5' }), 'reload');
  assert.equal(shortcuts.resolve({ key: 'i', control: true, shift: true }), 'devtools');
  assert.equal(shortcuts.resolve({ key: 'Tab', control: true }, { ...shortcuts.defaults, nextTab: '' }), null);
  assert.equal(shortcuts.resolve({ key: 'PageDown', control: true }, { ...shortcuts.defaults, nextTab: '' }), null);
  assert.equal(shortcuts.resolve({ key: 'F5' }, { ...shortcuts.defaults, reload: 'Ctrl+Y' }), null);
  assert.equal(shortcuts.resolve({ key: 'i', control: true, shift: true }, { ...shortcuts.defaults, toggleInterceptor: 'Ctrl+Shift+I' }), 'toggleInterceptor');
});
test('editing, IME, bare keys and AltGraph are not stolen', () => {
  assert.equal(shortcuts.resolve({ key: 't', control: true }, null), null);
  for (const key of ['a', 'c', 'v', 'x', 'z']) assert.equal(shortcuts.resolve({ key, control: true }), null);
  for (const key of ['Tab', 'Enter', 'Backspace', 'a']) assert.equal(shortcuts.combo({ key }), '');
  assert.equal(shortcuts.combo({ key: 't', control: true, isComposing: true }), '');
  assert.equal(shortcuts.combo({ key: 'Dead', control: true }), '');
  assert.equal(shortcuts.combo({ key: 't', ctrlKey: true, getModifierState: () => true }), '');
});
test('Command aliases and both plus-key forms work without claiming Ctrl+Alt is Command', () => {
  assert.equal(shortcuts.resolve({ key: 't', metaKey: true }), 'newTab');
  assert.equal(shortcuts.resolve({ key: '+', ctrlKey: true, shiftKey: true }), 'zoomIn');
  assert.equal(shortcuts.resolve({ key: '=', control: true }), 'zoomIn');
  assert.equal(shortcuts.resolve({ key: 't', control: true, alt: true }), null);
});
