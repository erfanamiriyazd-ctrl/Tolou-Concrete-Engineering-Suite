const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tolouDesktop', {
  getAppInfo: () => ipcRenderer.invoke('tolou:getAppInfo')
});
