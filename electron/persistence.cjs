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
  } catch {
    try { fs.rmSync(file, { force: true }); } catch {}
    fs.renameSync(tmp, file);
  }
}

function canonicalBody(envelope) {
  return {
    format: envelope.format,
    version: envelope.version,
    savedAt: envelope.savedAt,
    storage: envelope.storage
  };
}

function validateEnvelope(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'INVALID_JSON' };
  }
  if (parsed.format !== FORMAT || parsed.version !== VERSION) {
    return { ok: false, reason: 'UNSUPPORTED_FORMAT' };
  }
  if (!parsed.storage || typeof parsed.storage !== 'object' || Array.isArray(parsed.storage)) {
    return { ok: false, reason: 'INVALID_STORAGE' };
  }
  if (typeof parsed.checksum !== 'string' || !parsed.checksum) {
    return { ok: false, reason: 'MISSING_CHECKSUM' };
  }
  const expected = sha256(JSON.stringify(canonicalBody(parsed)));
  if (expected !== parsed.checksum) {
    return { ok: false, reason: 'CHECKSUM_MISMATCH' };
  }
  return { ok: true, envelope: parsed };
}

function pruneBackups(backupsDir) {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter(name => /^tolou-storage-.*\.json$/i.test(name))
      .map(name => {
        const full = path.join(backupsDir, name);
        return { full, mtime: fs.statSync(full).mtimeMs };
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

  function readEnvelopeFrom(file) {
    const parsed = safeReadJson(file);
    const validation = validateEnvelope(parsed);
    return validation.ok ? validation.envelope : null;
  }

  function readCurrent() {
    return readEnvelopeFrom(currentFile);
  }

  function createInternalBackup(label = 'auto', force = false) {
    try {
      if (!fs.existsSync(currentFile)) return null;
      const stat = fs.statSync(currentFile);
      if (!force && (Date.now() - stat.mtimeMs) < BACKUP_MIN_INTERVAL_MS) return null;

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeLabel = String(label).replace(/[^a-z0-9_-]/gi, '-').slice(0, 30) || 'backup';
      const target = path.join(backupsDir, 'tolou-storage-' + safeLabel + '-' + stamp + '.json');
      fs.copyFileSync(currentFile, target);
      pruneBackups(backupsDir);
      return target;
    } catch {
      return null;
    }
  }

  function saveStorage(storage, options = {}) {
    if (!storage || typeof storage !== 'object' || Array.isArray(storage)) {
      throw new Error('Invalid Tolou storage payload.');
    }

    const body = {
      format: FORMAT,
      version: VERSION,
      savedAt: new Date().toISOString(),
      storage
    };

    const envelope = {
      ...body,
      checksum: sha256(JSON.stringify(body))
    };
    const text = JSON.stringify(envelope, null, 2);

    const existing = fs.existsSync(currentFile) ? fs.readFileSync(currentFile, 'utf8') : null;
    if (existing !== null && existing !== text) {
      createInternalBackup(options.backupLabel || 'auto', !!options.forceBackup);
    }

    atomicWrite(currentFile, text);

    return {
      ok: true,
      savedAt: envelope.savedAt,
      checksum: envelope.checksum,
      path: currentFile
    };
  }

  function exportBackup(targetFile) {
    const current = readCurrent();
    if (!current) return { ok: false, reason: 'NO_VALID_MIRROR' };
    atomicWrite(targetFile, JSON.stringify(current, null, 2));
    return {
      ok: true,
      path: targetFile,
      savedAt: current.savedAt,
      checksum: current.checksum
    };
  }

  function importBackup(sourceFile) {
    const parsed = safeReadJson(sourceFile);
    const validation = validateEnvelope(parsed);
    if (!validation.ok) {
      return { ok: false, reason: validation.reason };
    }

    createInternalBackup('pre-restore', true);
    const result = saveStorage(validation.envelope.storage, {
      forceBackup: false,
      backupLabel: 'restore'
    });

    return {
      ...result,
      restoredFrom: sourceFile,
      storage: validation.envelope.storage
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
    const target = createInternalBackup('manual', true);
    return target ? { ok: true, path: target } : { ok: false, reason: 'NO_MIRROR' };
  });

  return {
    rootDir,
    currentFile,
    backupsDir,
    readCurrent,
    saveStorage,
    exportBackup,
    importBackup,
    createInternalBackup
  };
}

module.exports = { createPersistence };
