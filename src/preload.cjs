const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tolouDesktop', {
  getAppInfo: () => ipcRenderer.invoke('tolou:getAppInfo'),
  loadWorkspace: () => ipcRenderer.invoke('tolou:workspace:load'),
  saveWorkspace: (data) => ipcRenderer.invoke('tolou:workspace:save', data),
  createBackup: (label) => ipcRenderer.invoke('tolou:workspace:backup', label),
  restoreBackup: (backupPath) => ipcRenderer.invoke('tolou:workspace:restore', backupPath)
});
