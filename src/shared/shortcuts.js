(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BrowserShortcuts = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const defaults = {
    newTab: 'Ctrl+T', closeTab: 'Ctrl+W', reopenTab: 'Ctrl+Shift+T',
    newWindow: 'Ctrl+N', newPrivateWindow: 'Ctrl+Shift+N',
    moveTabLeft: 'Ctrl+Shift+PageUp', moveTabRight: 'Ctrl+Shift+PageDown', openFile: 'Ctrl+O',
    nextTab: 'Ctrl+Tab', prevTab: 'Ctrl+Shift+Tab', focusAddress: 'Ctrl+L',
    reload: 'Ctrl+R', hardReload: 'Ctrl+Shift+R', back: 'Alt+Left', forward: 'Alt+Right',
    home: 'Alt+Home', find: 'Ctrl+F', findNext: 'Ctrl+G', findPrevious: 'Ctrl+Shift+G',
    findSelection: 'Ctrl+Alt+E',
    print: 'Ctrl+P', savePage: 'Ctrl+S', fullscreen: 'F11', devtools: 'F12',
    closeWindow: 'Ctrl+Shift+W', stop: 'Escape',
    toggleDevice: 'Ctrl+Alt+M', toggleProxy: 'Ctrl+Alt+P', toggleInterceptor: 'Ctrl+Alt+I',
    printSystem: 'Ctrl+Shift+P', focusBookmarks: 'Alt+Shift+B',
    openGuide: 'Ctrl+/', settings: 'Ctrl+,', fingerprint: 'Ctrl+Alt+D',
    focusSearch: 'Ctrl+K', focusNext: 'F6', focusPrevious: 'Shift+F6', focusToolbar: 'Alt+Shift+T',
    focusPage: 'Ctrl+F6', focusDialog: 'Alt+Shift+A', focusMenu: 'F10',
    menu: 'Alt+F', viewSource: 'Ctrl+U', inspectPage: 'Ctrl+Shift+C',
    bookmark: 'Ctrl+D', bookmarkAll: 'Ctrl+Shift+D', bookmarkManager: 'Ctrl+Shift+O',
    bookmarkBar: 'Ctrl+Shift+B', history: 'Ctrl+H', downloads: 'Ctrl+J',
    tasks: 'Shift+Escape', clearData: 'Ctrl+Shift+Delete', searchTabs: 'Ctrl+Shift+A',
    zoomIn: 'Ctrl+=', zoomOut: 'Ctrl+-', zoomReset: 'Ctrl+0', quit: 'Ctrl+Q'
  };
  for (let i = 1; i <= 9; i++) defaults['tab' + i] = 'Ctrl+' + i;
  const aliases = {
    closeTab: ['Ctrl+F4'],
    focusAddress: ['Alt+D'], focusSearch: ['Ctrl+E'], menu: ['Alt+E'], openGuide: ['F1'],
    reload: ['F5'], hardReload: ['Ctrl+F5', 'Shift+F5'],
    devtools: ['Ctrl+Shift+I', 'Ctrl+Shift+J'], findNext: ['F3'], findPrevious: ['Shift+F3'],
    back: ['Ctrl+['], forward: ['Ctrl+]'], fullscreen: ['Ctrl+Meta+F'],
    nextTab: ['Ctrl+PageDown', 'Ctrl+Alt+Right'], prevTab: ['Ctrl+PageUp', 'Ctrl+Alt+Left']
  };
  function combo(input) {
    if (input.isComposing || input.key === 'Dead' || input.getModifierState?.('AltGraph') || input.modifiers?.some?.((key) => /^(altgr|altgraph)$/i.test(key))) return '';
    const ctrl = !!(input.ctrlKey || input.metaKey || input.control || input.meta);
    const alt = !!(input.altKey || input.alt);
    let shift = !!(input.shiftKey || input.shift);
    let key = String(input.key || '');
    // Browser commands remain usable on non-Latin layouts without taking
    // ordinary text or AltGraph characters away from the focused editor.
    if (ctrl && !alt && key.length === 1 && !/[a-z]/i.test(key) && /^Key[A-Z]$/.test(input.code || '')) key = input.code.slice(3);
    if (/^(Control|Meta|Alt|Shift|Unidentified)$/i.test(key)) return '';
    // Shift+Plus is the same zoom-in gesture as Ctrl+= on a US keyboard.
    if (key === '+') { key = '='; shift = false; }
    else if (key === ' ') key = 'Space';
    else if (/^Arrow/.test(key)) key = key.slice(5);
    else if (key.length === 1) key = key.toUpperCase();
    if (!key || (!ctrl && !alt && !/^F\d{1,2}$/.test(key) && key !== 'Escape')) return '';
    const both = (input.ctrlKey || input.control) && (input.metaKey || input.meta);
    return [ctrl && 'Ctrl', both && 'Meta', alt && 'Alt', shift && 'Shift', key].filter(Boolean).join('+');
  }
  function resolve(input, bindings = defaults, platform = '') {
    if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) return null;
    const value = combo(input);
    if (!value) return null;
    if (platform === 'darwin' && (input.altKey || input.alt) && !(input.metaKey || input.meta || input.ctrlKey || input.control) && ['Alt+Left', 'Alt+Right'].includes(value)) return null;
    if (platform === 'darwin' && (input.metaKey || input.meta) && !(input.ctrlKey || input.control)) {
      // Leave hide/minimize to the native macOS menu, not Windows Ctrl+H.
      if (value === 'Ctrl+H' || value === 'Ctrl+M') return null;
      const mac = { 'Ctrl+Y': 'history', 'Ctrl+Shift+J': 'downloads', 'Ctrl+Alt+B': 'bookmarkManager',
        'Ctrl+Alt+U': 'viewSource', 'Ctrl+Alt+I': 'devtools', 'Ctrl+Alt+J': 'devtools',
        'Ctrl+Shift+H': 'home', 'Ctrl+Alt+F': 'focusSearch', 'Ctrl+Alt+Up': 'focusPrevious', 'Ctrl+Alt+Down': 'focusNext',
        'Ctrl+Left': 'back', 'Ctrl+Right': 'forward', 'Ctrl+E': 'findSelection' };
      const action = mac[value];
      const explicit = Object.keys(defaults).find((name) => bindings[name] === value && bindings[name] !== defaults[name]);
      if (explicit) return explicit;
      if (action && bindings[action] === defaults[action]) return action;
    }
    for (const name of Object.keys(defaults)) if (bindings[name] === value) return name;
    // Rebinding or clearing an action disables its aliases as well.
    for (const [name, values] of Object.entries(aliases)) {
      if (bindings[name] === defaults[name] && values.includes(value)) return name;
    }
    return null;
  }
  return { defaults: Object.freeze(defaults), aliases, combo, resolve };
});
