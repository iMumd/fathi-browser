'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const EVENTS = new Set([
  'fathi:window:open',
  'fathi:newtab:navigate',
  'fathi:newtab:new',
  'fathi:newtab:rotate',
  'fathi:focus-omnibox',
  'fathi:new-tab',
  'fathi:close-tab',
  'fathi:win:state',
  'fathi:proxy:changed',
  'fathi:tor:changed',
  'fathi:update:state',
  'fathi:settings:changed',
  'fathi:intercept:paused',
  'fathi:intercept:resolved',
  'fathi:intercept:state',
  'fathi:net:batch',
  'fathi:menu:open'
]);

contextBridge.exposeInMainWorld('api', {
  appInfo: () => ipcRenderer.invoke('fathi:app:info'),
  research: {
    scope: () => ipcRenderer.invoke('fathi:research:scope'),
    setScope: (value) => ipcRenderer.invoke('fathi:research:set-scope', value)
  },

  win: {
    minimize: () => ipcRenderer.invoke('fathi:win:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('fathi:win:toggle-maximize'),
    close: () => ipcRenderer.invoke('fathi:win:close'),
    hide: () => ipcRenderer.invoke('fathi:win:hide'),
    state: () => ipcRenderer.invoke('fathi:win:state')
  },

  app: {
    quit: () => ipcRenderer.invoke('fathi:app:quit')
  },

  fp: {
    create: () => ipcRenderer.invoke('fathi:fp:new'),
    current: (fpId) => ipcRenderer.invoke('fathi:fp:current', fpId)
  },

  tab: {
    ready: (wcId) => ipcRenderer.invoke('fathi:tab:ready', wcId),
    prepare: (opts) => ipcRenderer.invoke('fathi:tab:prepare', opts || {}),
    destroy: (partition) => ipcRenderer.invoke('fathi:tab:destroy', { partition }),
    proxyStatus: (partition) => ipcRenderer.invoke('fathi:tab:proxy-status', { partition })
  },

  devices: {
    list: () => ipcRenderer.invoke('fathi:devices:list')
  },

  proxy: {
    fetchBurpCa: () => ipcRenderer.invoke('fathi:proxy:fetch-ca'),
    importCa: () => ipcRenderer.invoke('fathi:proxy:import-ca'),
    get: () => ipcRenderer.invoke('fathi:proxy:get'),
    set: (patch) => ipcRenderer.invoke('fathi:proxy:set', patch),
    test: (entry, url) => ipcRenderer.invoke('fathi:proxy:test', { entry, url })
  },

  tor: {
    status: () => ipcRenderer.invoke('fathi:tor:status'),
    set: (patch) => ipcRenderer.invoke('fathi:tor:set', patch)
  },

  update: {
    state: () => ipcRenderer.invoke('fathi:update:state'),
    check: () => ipcRenderer.invoke('fathi:update:check'),
    download: () => ipcRenderer.invoke('fathi:update:download'),
    install: () => ipcRenderer.invoke('fathi:update:install'),
    open: () => ipcRenderer.invoke('fathi:update:open'),
    command: () => ipcRenderer.invoke('fathi:update:command')
  },

  intercept: {
    state: () => ipcRenderer.invoke('fathi:intercept:state'),
    set: (enabled) => ipcRenderer.invoke('fathi:intercept:set', { enabled }),
    resolve: (payload) => ipcRenderer.invoke('fathi:intercept:resolve', payload),
    drain: () => ipcRenderer.invoke('fathi:intercept:drain'),
    filter: (filter) => ipcRenderer.invoke('fathi:intercept:filter', { filter }),
    repeat: (payload) => ipcRenderer.invoke('fathi:intercept:repeat', payload || {})
  },

  device: {
    emulate: (wcId, viewport) => ipcRenderer.invoke('fathi:device:emulate', { wcId, viewport })
  },

  rules: {
    test: (input) => ipcRenderer.invoke('fathi:rules:test', input),
    list: () => ipcRenderer.invoke('fathi:rules:list'),
    save: (rules) => ipcRenderer.invoke('fathi:rules:save', { rules })
  },

  net: {
    list: (payload) => ipcRenderer.invoke('fathi:net:list', payload || {}),
    detail: (payload) => ipcRenderer.invoke('fathi:net:detail', payload || {}),
    export: (payload) => ipcRenderer.invoke('fathi:net:export', payload || {}),
    serialize: (payload) => ipcRenderer.invoke('fathi:net:serialize', payload || {}),
    clear: (payload) => ipcRenderer.invoke('fathi:net:clear', payload || {})
  },

  settings: {
    get: () => ipcRenderer.invoke('fathi:settings:get'),
    set: (patch) => ipcRenderer.invoke('fathi:settings:set', patch),
    reset: () => ipcRenderer.invoke('fathi:settings:reset')
  },

  wallpaper: () => ipcRenderer.invoke('fathi:wallpaper:fetch'),

  ext: {
    install: (input) => ipcRenderer.invoke('fathi:ext:install', { input }),
    installUnpacked: () => ipcRenderer.invoke('fathi:ext:install-unpacked'),
    list: () => ipcRenderer.invoke('fathi:ext:list'),
    remove: (id) => ipcRenderer.invoke('fathi:ext:remove', { id })
  },

  openExternal: (url) => ipcRenderer.invoke('fathi:open-external', url),

  on: (channel, cb) => {
    if (!EVENTS.has(channel)) return () => {};
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  }
});
