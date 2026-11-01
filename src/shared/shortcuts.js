(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BrowserShortcuts = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const defaults = {
    newTab: 'Ctrl+T', closeTab: 'Ctrl+W', reopenTab: 'Ctrl+Shift+T',
    nextTab: 'Ctrl+Tab', prevTab: 'Ctrl+Shift+Tab', focusAddress: 'Ctrl+L',
    reload: 'Ctrl+R', hardReload: 'Ctrl+Shift+R', back: 'Alt+Left', forward: 'Alt+Right',
    home: 'Alt+Home', find: 'Ctrl+F', findNext: 'Ctrl+G', findPrevious: 'Ctrl+Shift+G',
    print: 'Ctrl+P', savePage: 'Ctrl+S', fullscreen: 'F11', devtools: 'F12',
    closeWindow: 'Ctrl+Shift+W', stop: 'Escape',
    toggleDevice: 'Ctrl+Shift+M', toggleProxy: 'Ctrl+Shift+P', toggleInterceptor: 'Ctrl+Alt+I',
    openGuide: 'Ctrl+/', settings: 'Ctrl+,', fingerprint: 'Ctrl+D',
    zoomIn: 'Ctrl+=', zoomOut: 'Ctrl+-', zoomReset: 'Ctrl+0', quit: 'Ctrl+Q'
  };
  for (let i = 1; i <= 9; i++) defaults['tab' + i] = 'Ctrl+' + i;
  const aliases = {
    nextTab: ['Ctrl+PageDown'], prevTab: ['Ctrl+PageUp'], closeTab: ['Ctrl+F4'],
    focusAddress: ['Alt+D', 'Ctrl+K', 'F6'], reload: ['F5'], hardReload: ['Ctrl+F5'],
    devtools: ['Ctrl+Shift+I', 'Ctrl+Shift+J'], findNext: ['F3'], findPrevious: ['Shift+F3'],
    back: ['Ctrl+['], forward: ['Ctrl+]']
  };
  function combo(input) {
    if (input.isComposing || input.key === 'Dead' || input.getModifierState?.('AltGraph')) return '';
    const ctrl = !!(input.ctrlKey || input.metaKey || input.control || input.meta);
    const alt = !!(input.altKey || input.alt);
    let shift = !!(input.shiftKey || input.shift);
    let key = String(input.key || '');
    if (/^(Control|Meta|Alt|Shift|Unidentified)$/i.test(key)) return '';
    // Shift+Plus is the same zoom-in gesture as Ctrl+= on a US keyboard.
    if (key === '+') { key = '='; shift = false; }
    else if (key === ' ') key = 'Space';
    else if (/^Arrow/.test(key)) key = key.slice(5);
    else if (key.length === 1) key = key.toUpperCase();
    if (!key || (!ctrl && !alt && !/^F\d{1,2}$/.test(key) && key !== 'Escape')) return '';
    return [ctrl && 'Ctrl', alt && 'Alt', shift && 'Shift', key].filter(Boolean).join('+');
  }
  function resolve(input, bindings = defaults) {
    if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) return null;
    const value = combo(input);
    if (!value) return null;
    for (const name of Object.keys(defaults)) if (bindings[name] === value) return name;
    // Rebinding or clearing an action disables its aliases as well.
    for (const [name, values] of Object.entries(aliases)) {
      if (bindings[name] === defaults[name] && values.includes(value)) return name;
    }
    return null;
  }
  return { defaults: Object.freeze(defaults), aliases, combo, resolve };
});
