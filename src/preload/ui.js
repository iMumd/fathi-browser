
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
