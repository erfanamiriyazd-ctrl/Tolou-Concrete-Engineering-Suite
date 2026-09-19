const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('node:path');
const { createPersistence } = require('./persistence.cjs');

const APP_NAME = 'Tolou Concrete Engineering Suite';
const BASELINE_FILE = path.join(__dirname, '..', 'baseline', 'Tolou_MASTER_Stage6.5.html');
const PRELOAD_FILE = path.join(__dirname, 'preload.cjs');

const STORAGE_KEYS = [
  'QC010_full_data',
  'QC012_data',
  'darkMode',
  'TolouUnified_lastView',
  'Tolou_material_library_v1',
  'Tolou_trial_lab_v1',
  'Tolou_aggregate_intelligence_v1',
  'Tolou_quality_control_v1',
  'Tolou_production_intelligence_v1',
  'Tolou_durability_engine_v1',
  'Tolou_cost_sustainability_v1',
  'Tolou_multiobjective_optimizer_v1',
  'Tolou_project_hub_v1',
  'Tolou_user_profile_v1',
  'Tolou_report_prefs_v1',
  'Tolou_ui_state_v1',
  'Tolou_pending_revision_brief'
];

let persistence;
let appIsQuitting = false;

function persistenceBootstrapScript() {
  return `
    (() => {
      if (window.__tolouDesktopPersistenceInstalled) return true;
      if (!window.tolouDesktop || !window.tolouDesktop.persistence) return false;

      const keys = ${JSON.stringify(STORAGE_KEYS)};
      const watched = new Set(keys);
      let timer = null;
      let flushing = false;

      const collect = () => {
        const storage = {};
        for (const key of keys) storage[key] = localStorage.getItem(key);
        return storage;
      };

      const flush = async () => {
        if (flushing) return;
        flushing = true;
        try {
          await window.tolouDesktop.persistence.saveSnapshot(collect());
        } finally {
          flushing = false;
        }
      };

      const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(() => { flush().catch(() => {}); }, 700);
      };

      const nativeSetItem = Storage.prototype.setItem;
      const nativeRemoveItem = Storage.prototype.removeItem;
      const nativeClear = Storage.prototype.clear;

      Storage.prototype.setItem = function(key, value) {
        const result = nativeSetItem.apply(this, arguments);
        if (this === localStorage && watched.has(String(key))) schedule();
        return result;
      };

      Storage.prototype.removeItem = function(key) {
        const result = nativeRemoveItem.apply(this, arguments);
        if (this === localStorage && watched.has(String(key))) schedule();
        return result;
      };

      Storage.prototype.clear = function() {
        const result = nativeClear.apply(this, arguments);
        if (this === localStorage) schedule();
        return result;
      };

      window.__tolouFlushPersistence = flush;
      window.__tolouDesktopPersistenceInstalled = true;

      setTimeout(() => { flush().catch(() => {}); }, 1200);
      setInterval(() => { flush().catch(() => {}); }, 60000);
      return true;
    })();
  `;
}

async function flushWindowPersistence(win) {
  if (!win || win.isDestroyed()) return;
  try {
    await win.webContents.executeJavaScript(
      `(async()=>{if(window.__tolouFlushPersistence){await window.__tolouFlushPersistence();return true;}return false;})()`,
      true
    );
  } catch {}
}

function createMainWindow() {
  const win = new BrowserWindow({
    title: APP_NAME,
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: '#f4f5f2',
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD_FILE,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  win.once('ready-to-show', () => {
    win.show();
    if (process.env.TOLOU_DEVTOOLS === '1') {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(persistenceBootstrapScript(), true).catch(() => {});
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (/^https?:\/\//i.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  let closeAfterFlush = false;
  win.on('close', (event) => {
    if (closeAfterFlush || appIsQuitting) return;
    event.preventDefault();
    flushWindowPersistence(win).finally(() => {
      closeAfterFlush = true;
      win.close();
    });
  });

  win.loadFile(BASELINE_FILE).catch((error) => {
    console.error('Failed to load Tolou baseline:', error);
  });

  return win;
}

app.setName(APP_NAME);

app.whenReady().then(() => {
  persistence = createPersistence(app, ipcMain);
  Menu.setApplicationMenu(null);
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', (event) => {
  if (appIsQuitting) return;
  const windows = BrowserWindow.getAllWindows();
  if (!windows.length) {
    appIsQuitting = true;
    return;
  }

  event.preventDefault();
  Promise.all(windows.map(flushWindowPersistence)).finally(() => {
    appIsQuitting = true;
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
