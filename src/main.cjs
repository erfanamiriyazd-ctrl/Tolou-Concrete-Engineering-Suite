const path = require('node:path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');

const APP_TITLE = 'Tolou Concrete Engineering Suite';
const BASELINE_FILE = 'Tolou_MASTER_Stage6.5.html';

function resolveBaselinePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'baseline', BASELINE_FILE);
  }

  return path.join(__dirname, '..', 'baseline', BASELINE_FILE);
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    title: APP_TITLE,
    backgroundColor: '#eef1f5',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadFile(resolveBaselinePath());

  return win;
}

function registerIpc() {
  ipcMain.handle('tolou:getAppInfo', () => ({
    title: APP_TITLE,
    version: app.getVersion(),
    userDataPath: app.getPath('userData'),
    baselineFile: BASELINE_FILE
  }));
}

app.setName(APP_TITLE);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  registerIpc();

  app.whenReady().then(() => {
    const mainWindow = createMainWindow();

    app.on('second-instance', () => {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

module.exports = {
  APP_TITLE,
  BASELINE_FILE,
  resolveBaselinePath,
  createMainWindow
};
