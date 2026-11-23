// mod2sid – preload bridge
const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('m2s', {
  openMod: () => ipcRenderer.invoke('open-mod'),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  pathForFile: (f) => { try { return webUtils.getPathForFile(f); } catch { return null; } },
  saveOutput: (o) => ipcRenderer.invoke('save-output', o),
  reveal: (p) => ipcRenderer.invoke('reveal', p),
  openUrl: (u) => ipcRenderer.invoke('open-url', u),
  appInfo: () => ipcRenderer.invoke('app-info'),
  onMenu: (cb) => ipcRenderer.on('menu', (_e, a) => cb(a)),
});
