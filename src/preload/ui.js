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
  'fathi:settings:changed',
  'fathi:intercept:paused',
  'fathi:intercept:resolved',
  'fathi:intercept:state',
  'fathi:net:batch'
]);

contextBridge.exposeInMainWorld('api', {
  appInfo: () => ipcRenderer.invoke('fathi:app:info'),

  win: {
    minimize: () => ipcRenderer.invoke('fathi:win:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('fathi:win:toggle-maximize'),
    close: () => ipcRenderer.invoke('fathi:win:close'),
    state: () => ipcRenderer.invoke('fathi:win:state')
  },

  fp: {
    create: () => ipcRenderer.invoke('fathi:fp:new'),
    current: (fpId) => ipcRenderer.invoke('fathi:fp:current', fpId)
  },

  tab: {
    prepare: (opts) => ipcRenderer.invoke('fathi:tab:prepare', opts || {}),
    destroy: (partition) => ipcRenderer.invoke('fathi:tab:destroy', { partition }),
    proxyStatus: (partition) => ipcRenderer.invoke('fathi:tab:proxy-status', { partition })
  },

  devices: {
    list: () => ipcRenderer.invoke('fathi:devices:list')
  },

  proxy: {
    get: () => ipcRenderer.invoke('fathi:proxy:get'),
    set: (patch) => ipcRenderer.invoke('fathi:proxy:set', patch),
    test: (entry, url) => ipcRenderer.invoke('fathi:proxy:test', { entry, url })
  },

  intercept: {
    state: () => ipcRenderer.invoke('fathi:intercept:state'),
    set: (enabled) => ipcRenderer.invoke('fathi:intercept:set', { enabled }),
    resolve: (payload) => ipcRenderer.invoke('fathi:intercept:resolve', payload),
    drain: () => ipcRenderer.invoke('fathi:intercept:drain'),
    filter: (filter) => ipcRenderer.invoke('fathi:intercept:filter', { filter })
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
