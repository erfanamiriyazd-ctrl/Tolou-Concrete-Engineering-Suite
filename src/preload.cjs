const { contextBridge, ipcRenderer } = require('electron');
const { installLocalStorageSync } = require('./renderer-sync.cjs');

const desktopApi = {
  getAppInfo: () => ipcRenderer.invoke('tolou:getAppInfo'),
  loadWorkspace: () => ipcRenderer.invoke('tolou:workspace:load'),
  saveWorkspace: (data) => ipcRenderer.invoke('tolou:workspace:save', data),
  createBackup: (label) => ipcRenderer.invoke('tolou:workspace:backup', label),
  restoreBackup: (backupPath) => ipcRenderer.invoke('tolou:workspace:restore', backupPath)
};

contextBridge.exposeInMainWorld('tolouDesktop', desktopApi);

installLocalStorageSync(window, desktopApi);
