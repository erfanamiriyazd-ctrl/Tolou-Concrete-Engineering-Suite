'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const FORMAT = 'TolouDesktopStorageMirror';
const VERSION = 1;
const MAX_BACKUPS = 20;
const BACKUP_MIN_INTERVAL_MS = 30 * 60 * 1000;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function safeReadJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function atomicWrite(file, text) {
  ensureDir(path.dirname(file));
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text, { encoding: 'utf8', flag: 'w' });
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    try { fs.rmSync(file, { force: true }); } catch {}
    fs.renameSync(tmp, file);
  }
}

function pruneBackups(backupsDir) {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter(name => /^tolou-storage-.*\.json$/i.test(name))
      .map(name => {
        const full = path.join(backupsDir, name);
        return { name, full, mtime: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    files.slice(MAX_BACKUPS).forEach(x => {
      try { fs.rmSync(x.full, { force: true }); } catch {}
    });
  } catch {}
}

function createPersistence(app, ipcMain) {
  const rootDir = path.join(app.getPath('userData'), 'data');
  const backupsDir = path.join(rootDir, 'backups');
  const currentFile = path.join(rootDir, 'tolou-storage-v1.json');
  ensureDir(backupsDir);

  function readCurrent() {
    const parsed = safeReadJson(currentFile);
    if (!parsed || parsed.format !== FORMAT || parsed.version !== VERSION || typeof parsed.storage !== 'object') {
      return null;
    }
    return parsed;
  }

  function maybeBackupCurrent(nextText) {
    try {
      if (!fs.existsSync(currentFile)) return;
      const currentText = fs.readFileSync(currentFile, 'utf8');
      if (currentText === nextText) return;

      const stat = fs.statSync(currentFile);
      if ((Date.now() - stat.mtimeMs) < BACKUP_MIN_INTERVAL_MS) return;

      const stamp = new Date(stat.mtimeMs).toISOString().replace(/[:.]/g, '-');
      fs.copyFileSync(currentFile, path.join(backupsDir, 'tolou-storage-' + stamp + '.json'));
      pruneBackups(backupsDir);
    } catch {}
  }

  function saveStorage(storage) {
    if (!storage || typeof storage !== 'object' || Array.isArray(storage)) {
      throw new Error('Invalid Tolou storage payload.');
    }

    const body = {
      format: FORMAT,
      version: VERSION,
      savedAt: new Date().toISOString(),
      storage
    };

    const canonical = JSON.stringify(body);
    body.checksum = sha256(canonical);
    const text = JSON.stringify(body, null, 2);

    maybeBackupCurrent(text);
    atomicWrite(currentFile, text);

    return {
      ok: true,
      savedAt: body.savedAt,
      checksum: body.checksum,
      path: currentFile
    };
  }

  ipcMain.on('tolou:persistence:bootstrap', (event) => {
    event.returnValue = readCurrent();
  });

  ipcMain.handle('tolou:persistence:save', (_event, storage) => {
    return saveStorage(storage);
  });

  ipcMain.handle('tolou:persistence:info', () => {
    const current = readCurrent();
    return {
      rootDir,
      currentFile,
      backupsDir,
      hasMirror: !!current,
      savedAt: current?.savedAt || null,
      checksum: current?.checksum || null
    };
  });

  ipcMain.handle('tolou:persistence:create-backup', () => {
    const current = readCurrent();
    if (!current) return { ok: false, reason: 'NO_MIRROR' };
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(backupsDir, 'tolou-storage-' + stamp + '.json');
    fs.copyFileSync(currentFile, target);
    pruneBackups(backupsDir);
    return { ok: true, path: target };
  });

  return {
    rootDir,
    currentFile,
    backupsDir,
    readCurrent,
    saveStorage
  };
}

module.exports = { createPersistence };
