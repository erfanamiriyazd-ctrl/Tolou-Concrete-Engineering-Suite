const fs = require('node:fs');
const path = require('node:path');

const DATA_SCHEMA_VERSION = 1;
const DATA_DIR_NAME = 'TolouUserData';
const WORKSPACE_FILE = 'workspace.json';
const BACKUP_DIR_NAME = 'backups';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeStamp(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function cleanLabel(label) {
  return String(label || 'manual')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'manual';
}

function atomicWriteJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function parseWorkspaceEnvelope(raw, source) {
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid Tolou workspace JSON in ${source}`);
  }

  if (!envelope || envelope.schemaVersion !== DATA_SCHEMA_VERSION || !envelope.data) {
    throw new Error(`Unsupported Tolou workspace schema in ${source}`);
  }

  return envelope;
}

function createEnvelope(data, now) {
  const projects = Array.isArray(data?.projects) ? data.projects : [];
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    savedAt: now.toISOString(),
    projectCount: projects.length,
    data
  };
}

function createDesktopStore(options) {
  if (!options || !options.userDataPath) {
    throw new Error('userDataPath is required');
  }

  const clock = options.clock || (() => new Date());
  const dataDir = path.join(options.userDataPath, DATA_DIR_NAME);
  const backupDir = path.join(dataDir, BACKUP_DIR_NAME);
  const workspacePath = path.join(dataDir, WORKSPACE_FILE);

  function saveWorkspace(data) {
    const envelope = createEnvelope(data, clock());
    atomicWriteJson(workspacePath, envelope);
    return {
      schemaVersion: envelope.schemaVersion,
      savedAt: envelope.savedAt,
      projectCount: envelope.projectCount,
      path: workspacePath
    };
  }

  function loadWorkspace() {
    if (!fs.existsSync(workspacePath)) {
      return {
        schemaVersion: DATA_SCHEMA_VERSION,
        savedAt: null,
        projectCount: 0,
        data: { projects: [], settings: {} },
        path: workspacePath
      };
    }

    return {
      ...parseWorkspaceEnvelope(fs.readFileSync(workspacePath, 'utf8'), workspacePath),
      path: workspacePath
    };
  }

  function createBackup(label) {
    const current = loadWorkspace();
    const backupPath = path.join(
      backupDir,
      `tolou-backup-${safeStamp(clock())}-${cleanLabel(label)}.json`
    );
    atomicWriteJson(backupPath, {
      schemaVersion: current.schemaVersion,
      savedAt: current.savedAt,
      backedUpAt: clock().toISOString(),
      projectCount: current.projectCount,
      data: current.data
    });

    return {
      path: backupPath,
      projectCount: current.projectCount,
      backedUpAt: clock().toISOString()
    };
  }

  function restoreBackup(backupPath) {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    const envelope = parseWorkspaceEnvelope(fs.readFileSync(backupPath, 'utf8'), backupPath);
    return saveWorkspace(envelope.data);
  }

  return {
    paths: {
      dataDir,
      backupDir,
      workspacePath
    },
    saveWorkspace,
    loadWorkspace,
    createBackup,
    restoreBackup
  };
}

module.exports = {
  DATA_SCHEMA_VERSION,
  createDesktopStore
};
