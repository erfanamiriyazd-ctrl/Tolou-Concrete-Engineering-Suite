const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createDesktopStore,
  DATA_SCHEMA_VERSION
} = require('../src/desktop-store.cjs');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tolou-store-'));

const store = createDesktopStore({
  userDataPath: tmpRoot,
  clock: () => new Date('2026-09-21T00:00:00.000Z')
});

const payload = {
  projects: [
    {
      id: 'project-yazd-001',
      title: 'طرح اختلاط یزد',
      revisions: [{ id: 'rev-a', status: 'APPROVED' }]
    }
  ],
  settings: {
    locale: 'fa-IR',
    reportLanguage: 'fa'
  }
};

const saved = store.saveWorkspace(payload);
assert.equal(saved.schemaVersion, DATA_SCHEMA_VERSION);
assert.equal(saved.savedAt, '2026-09-21T00:00:00.000Z');
assert.equal(saved.projectCount, 1);
assert.ok(fs.existsSync(path.join(tmpRoot, 'TolouUserData', 'workspace.json')));

const loaded = store.loadWorkspace();
assert.deepEqual(loaded.data, payload);
assert.equal(loaded.schemaVersion, DATA_SCHEMA_VERSION);

const backup = store.createBackup('acceptance');
assert.equal(backup.projectCount, 1);
assert.match(path.basename(backup.path), /^tolou-backup-2026-09-21T00-00-00-000Z-acceptance\.json$/);
assert.ok(fs.existsSync(backup.path));

store.saveWorkspace({
  projects: [],
  settings: { locale: 'fa-IR', reportLanguage: 'fa' }
});
assert.equal(store.loadWorkspace().data.projects.length, 0);

const restored = store.restoreBackup(backup.path);
assert.equal(restored.projectCount, 1);
assert.deepEqual(store.loadWorkspace().data, payload);

assert.throws(
  () => store.restoreBackup(path.join(tmpRoot, 'missing.json')),
  /Backup file not found/
);
