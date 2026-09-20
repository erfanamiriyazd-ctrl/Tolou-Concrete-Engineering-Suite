const { app, BrowserWindow, Menu, shell, ipcMain, dialog, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { createPersistence } = require('./persistence.cjs');
const { createWindowState } = require('./window-state.cjs');
const { seedSampleProject } = require('./sample-project.cjs');

const APP_NAME = 'Tolou Concrete Engineering Suite';
const APP_ID = 'ir.tolou.concrete.engineering';
const BASELINE_FILE = path.join(__dirname, '..', 'app', 'index.html');
const PRELOAD_FILE = path.join(__dirname, 'preload.cjs');

let persistence;
let appIsQuitting = false;
let mainWindow = null;
let windowState = null;


function buildSeededSampleStorage(existing = {}) {
  const map = new Map();
  for (const [key, value] of Object.entries(existing || {})) {
    if (value !== null && value !== undefined) map.set(key, String(value));
  }
  const storage = {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value))
  };
  const result = seedSampleProject(storage);
  return { result, storage: Object.fromEntries(map) };
}

ipcMain.on('tolou:sample:seed', (event, existing) => {
  try {
    event.returnValue = buildSeededSampleStorage(existing);
  } catch (error) {
    event.returnValue = { result: { ok: false, reason: error?.message || String(error) }, storage: existing || {} };
  }
});


async function seedQaSampleIntoRenderer(win) {
  if (!win || win.isDestroyed()) return { ok: false, reason: 'window-unavailable' };
  try {
    const existing = await win.webContents.executeJavaScript(`
      (() => {
        const storage = {};
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (key !== null) storage[key] = localStorage.getItem(key);
        }
        return storage;
      })()
    `, true);

    const beforeMarker = existing?.Tolou_sample_project_v1 || null;
    const seeded = buildSeededSampleStorage(existing || {});
    if (!seeded?.result?.ok) return seeded?.result || { ok: false, reason: 'seed-failed' };

    const afterMarker = seeded.storage?.Tolou_sample_project_v1 || null;
    const changed = beforeMarker !== afterMarker ||
      Object.keys(seeded.storage || {}).some(key => existing?.[key] !== seeded.storage[key]);

    if (!changed) return { ...seeded.result, changed: false };

    // Persist the same merged snapshot that will be applied to Chromium storage.
    if (persistence) {
      persistence.saveStorage(seeded.storage, {
        backupLabel: 'sample-seed',
        forceBackup: true
      });
    }

    await win.webContents.executeJavaScript(`
      (() => {
        const incoming = ${JSON.stringify(seeded.storage)};
        for (const [key, value] of Object.entries(incoming)) {
          if (value !== null && value !== undefined) localStorage.setItem(key, String(value));
        }
        sessionStorage.setItem('__tolou_sample_seed_reload__', '1');
        return true;
      })()
    `, true);

    return { ...seeded.result, changed: true };
  } catch (error) {
    return { ok: false, reason: error?.message || String(error) };
  }
}

async function runUiSmoke(win) {
  const dir = process.env.TOLOU_UI_SMOKE_DIR;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  const failures = [];
  const results = [];
  const sanitize = (name) => String(name).replace(/[^a-z0-9_-]/gi, '-');

  async function step(name, view, prepare, selector, expected) {
    try {
      const payload = await win.webContents.executeJavaScript(`
        (async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          if (typeof openView === 'function') openView(${JSON.stringify(view)});
          ${prepare || ''}
          await sleep(150);
          const el = document.querySelector(${JSON.stringify(selector)});
          return {
            exists: !!el,
            text: el ? (el.innerText || el.textContent || '').trim() : '',
            html: el ? (el.innerHTML || '').slice(0, 12000) : ''
          };
        })()
      `, true);
      const ok = payload.exists && expected.every(x => payload.text.includes(x) || payload.html.includes(x));
      results.push({ name, view, selector, expected, ok, text: payload.text.slice(0, 4000) });
      if (!ok) failures.push(name + ': expected ' + expected.join(' | '));
      const image = await win.webContents.capturePage();
      fs.writeFileSync(path.join(dir, sanitize(name) + '.png'), image.toPNG());
    } catch (error) {
      results.push({ name, ok: false, error: error?.stack || error?.message || String(error) });
      failures.push(name + ': ' + (error?.message || String(error)));
    }
  }

  await new Promise(r => setTimeout(r, 1200));

  await step(
    '01-projects',
    'projects',
    "if(typeof projectLoad==='function')projectLoad();",
    '#prProjectList',
    ['TL-DEMO-25-400','مجتمع اداری آفتاب شرق']
  );

  await step(
    '02-mix-library',
    'mix-library',
    "if(typeof mlRender==='function')mlRender();",
    '#mlList',
    ['QC010-001','C25']
  );

  await step(
    '03-durability',
    'durability',
    "if(typeof durLoad==='function')durLoad();",
    '#durHistory',
    ['QC010-001','F0/S0/W0/C0']
  );

  await step(
    '04-economics',
    'economics',
    "if(typeof ecoLoad==='function')ecoLoad();",
    '#ecoHistory',
    ['تحلیل اقتصادی/کربن پروژه نمونه 25/400']
  );

  await step(
    '05-optimization',
    'optimization',
    "if(typeof optLoad==='function')optLoad();",
    '#optHistory',
    ['QC010-001','شدنی']
  );

  await step(
    '06-reports',
    'reports',
    `
      if(typeof reportLoad==='function')reportLoad();
      const rep=document.getElementById('repMix');
      if(rep){
        const wanted=[...rep.options].find(o=>String(o.value).includes('MX-DEMO-25-400::0')) || [...rep.options].find(o=>o.value);
        if(wanted){rep.value=wanted.value;}
      }
      if(typeof reportBuild==='function'){
        const html=reportBuild();
        if(html)document.getElementById('repPreview').innerHTML=html;
      }
    `,
    '#repPreview',
    ['مجتمع اداری آفتاب شرق','2350.251','QC010-001','Stage 6 Final Validation: PASS']
  );

  let diagnostics = null;
  try {
    diagnostics = await win.webContents.executeJavaScript(`
      (() => {
        const pid = 'PRJ-DEMO-25-400';
        const s = (window.trialLab?.series || []).find(x => x.id === 'MX-DEMO-25-400') || null;
        let e2e=null, contract=null, approval=null, integrity=null, finalValidation=null;
        try { e2e = window.TolouE2EAudit?.run ? window.TolouE2EAudit.run(pid) : null; } catch(e) { e2e={error:String(e?.stack||e)}; }
        try { contract = window.TolouContractEnforcement?.audit ? window.TolouContractEnforcement.audit() : null; } catch(e) { contract={error:String(e?.stack||e)}; }
        try { approval = s && window.TolouApprovalIntegrity ? window.TolouApprovalIntegrity(s) : null;
        const approvalFingerprints = s ? {
          stored: s.approvalRecord?.evidenceFingerprint || null,
          current: window.TolouTrialEvidenceFingerprint ? window.TolouTrialEvidenceFingerprint(s, s.approvedRevision) : null
        } : null; } catch(e) { approval={error:String(e?.stack||e)}; }
        try { integrity = window.TolouIntegrityGuard?.auditAll ? window.TolouIntegrityGuard.auditAll() : null; } catch(e) { integrity={error:String(e?.stack||e)}; }
        try { finalValidation = window.TolouFinalValidation?.run ? window.TolouFinalValidation.run(pid) : null; } catch(e) { finalValidation={error:String(e?.stack||e)}; }
        return {e2e,contract,approval,approvalFingerprints,integrity,finalValidation};
      })()
    `, true);
    fs.writeFileSync(path.join(dir, 'ui-diagnostics.json'), JSON.stringify(diagnostics, null, 2), 'utf8');
  } catch (error) {
    fs.writeFileSync(path.join(dir, 'ui-diagnostics-error.txt'), String(error?.stack || error), 'utf8');
  }

  const report = {
    at: new Date().toISOString(),
    platform: process.platform,
    failures,
    results,
    diagnosticsSummary: diagnostics ? {
      e2eStatus: diagnostics.e2e?.status || null,
      e2eIssues: diagnostics.e2e?.issues?.length || 0,
      contractStatus: diagnostics.contract?.status || null,
      contractBlocked: diagnostics.contract?.blocked ?? null,
      approvalValid: diagnostics.approval?.valid ?? null,
      integrityStatus: diagnostics.integrity?.status || null,
      finalStatus: diagnostics.finalValidation?.status || null
    } : null
  };
  fs.writeFileSync(path.join(dir, 'ui-smoke-result.json'), JSON.stringify(report, null, 2), 'utf8');
  if (failures.length) {
    console.error('TOLOU_UI_SMOKE_FAIL', failures);
    app.exit(3);
  } else {
    console.log('TOLOU_UI_SMOKE_PASS');
    app.exit(0);
  }
}

function persistenceBootstrapScript() {
  return `
    (() => {
      if (window.__tolouDesktopPersistenceInstalled) return true;
      if (!window.tolouDesktop || !window.tolouDesktop.persistence) return false;

      let timer = null;
      let flushing = false;

      const collect = () => {
        const storage = {};
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (key !== null) storage[key] = localStorage.getItem(key);
        }
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

      Storage.prototype.setItem = function() {
        const result = nativeSetItem.apply(this, arguments);
        if (this === localStorage) schedule();
        return result;
      };

      Storage.prototype.removeItem = function() {
        const result = nativeRemoveItem.apply(this, arguments);
        if (this === localStorage) schedule();
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
  if (!win || win.isDestroyed()) return false;
  try {
    return await win.webContents.executeJavaScript(
      `(async()=>{if(window.__tolouFlushPersistence){await window.__tolouFlushPersistence();return true;}return false;})()`,
      true
    );
  } catch {
    return false;
  }
}

async function exportBackup(win) {
  await flushWindowPersistence(win);
  const now = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog(win, {
    title: 'ذخیره نسخه پشتیبان طلوع',
    defaultPath: path.join(app.getPath('documents'), 'Tolou-Backup-' + now + '.tolou-backup'),
    filters: [
      { name: 'Tolou Backup', extensions: ['tolou-backup'] },
      { name: 'JSON', extensions: ['json'] }
    ]
  });
  if (result.canceled || !result.filePath) return;
  const saved = persistence.exportBackup(result.filePath);
  if (!saved.ok) {
    await dialog.showMessageBox(win, {
      type: 'error',
      title: 'پشتیبان‌گیری انجام نشد',
      message: 'نسخه معتبر از داده‌های طلوع برای خروجی یافت نشد.'
    });
  }
}

async function restoreBackup(win) {
  const result = await dialog.showOpenDialog(win, {
    title: 'بازیابی نسخه پشتیبان طلوع',
    properties: ['openFile'],
    filters: [
      { name: 'Tolou Backup', extensions: ['tolou-backup', 'json'] }
    ]
  });
  if (result.canceled || !result.filePaths?.[0]) return;

  const confirm = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['انصراف', 'بازیابی'],
    defaultId: 0,
    cancelId: 0,
    title: 'بازیابی اطلاعات',
    message: 'اطلاعات فعلی با نسخه پشتیبان انتخاب‌شده جایگزین شود؟',
    detail: 'قبل از جایگزینی، یک نسخه ایمنی از داده فعلی ساخته می‌شود.'
  });
  if (confirm.response !== 1) return;

  await flushWindowPersistence(win);
  const restored = persistence.importBackup(result.filePaths[0]);

  if (!restored.ok) {
    await dialog.showMessageBox(win, {
      type: 'error',
      title: 'بازیابی انجام نشد',
      message: 'فایل پشتیبان معتبر نیست یا سلامت آن تأیید نشد.',
      detail: String(restored.reason || 'UNKNOWN_ERROR')
    });
    return;
  }

  win.webContents.send('tolou:persistence:apply-restore', restored.storage);
}

function installApplicationMenu(win) {
  const template = [
    {
      label: 'فایل',
      submenu: [
        {
          label: 'ذخیره اطلاعات',
          accelerator: 'Ctrl+S',
          click: () => { flushWindowPersistence(win); }
        },
        {
          label: 'ایجاد نسخه پشتیبان…',
          accelerator: 'Ctrl+Shift+B',
          click: () => { exportBackup(win); }
        },
        {
          label: 'بازیابی نسخه پشتیبان…',
          accelerator: 'Ctrl+Shift+R',
          click: () => { restoreBackup(win); }
        },
        { type: 'separator' },
        {
          label: 'باز کردن پوشه اطلاعات',
          click: () => { shell.openPath(persistence.rootDir); }
        },
        { type: 'separator' },
        { role: 'quit', label: 'خروج' }
      ]
    },
    {
      label: 'نمایش',
      submenu: [
        { role: 'reload', label: 'بارگذاری مجدد' },
        { role: 'togglefullscreen', label: 'تمام‌صفحه' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createMainWindow() {
  const savedWindow = windowState ? windowState.load() : { width: 1440, height: 900, maximized: false };
  const win = new BrowserWindow({
    title: APP_NAME,
    width: savedWindow.width,
    height: savedWindow.height,
    ...(Number.isFinite(savedWindow.x) && Number.isFinite(savedWindow.y) ? { x: savedWindow.x, y: savedWindow.y } : {}),
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

  mainWindow = win;
  installApplicationMenu(win);

  if (savedWindow.maximized) {
    win.maximize();
  }

  win.once('ready-to-show', () => {
    win.show();
    if (process.env.TOLOU_DEVTOOLS === '1') {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });

  win.webContents.on('did-finish-load', async () => {
    try {
      const seedResult = await seedQaSampleIntoRenderer(win);
      if (seedResult?.ok && seedResult.changed) {
        // Reload exactly once so every renderer module rehydrates from the now-populated localStorage.
        const shouldReload = await win.webContents.executeJavaScript(
          `(() => sessionStorage.getItem('__tolou_sample_seed_reload__') === '1')()`,
          true
        );
        if (shouldReload) {
          await win.webContents.executeJavaScript(
            `(() => { sessionStorage.removeItem('__tolou_sample_seed_reload__'); return true; })()`,
            true
          );
          win.webContents.reload();
          return;
        }
      }
    } catch (error) {
      console.error('Tolou QA sample bootstrap failed:', error);
    }

    win.webContents.executeJavaScript(persistenceBootstrapScript(), true).catch(() => {});
    if (process.env.TOLOU_UI_SMOKE_DIR) {
      runUiSmoke(win).catch(error => {
        console.error('Tolou UI smoke failed:', error);
        try {
          fs.mkdirSync(process.env.TOLOU_UI_SMOKE_DIR, { recursive: true });
          fs.writeFileSync(path.join(process.env.TOLOU_UI_SMOKE_DIR, 'ui-smoke-fatal.txt'), String(error?.stack || error), 'utf8');
        } catch {}
        app.exit(4);
      });
    }
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

  let stateSaveTimer = null;
  const scheduleWindowStateSave = () => {
    clearTimeout(stateSaveTimer);
    stateSaveTimer = setTimeout(() => {
      if (windowState) windowState.save(win);
    }, 250);
  };
  win.on('resize', scheduleWindowStateSave);
  win.on('move', scheduleWindowStateSave);
  win.on('maximize', scheduleWindowStateSave);
  win.on('unmaximize', scheduleWindowStateSave);

  win.on('closed', () => {
    clearTimeout(stateSaveTimer);
    if (mainWindow === win) mainWindow = null;
  });

  win.loadFile(BASELINE_FILE).catch((error) => {
    console.error('Failed to load Tolou baseline:', error);
  });

  return win;
}

app.setName(APP_NAME);

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId(APP_ID);
  persistence = createPersistence(app, ipcMain);
  windowState = createWindowState(app, screen);
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
