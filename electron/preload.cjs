'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const RECOVERY_SENTINELS = [
  'Tolou_project_hub_v1',
  'QC010_full_data',
  'Tolou_material_library_v1',
  'Tolou_trial_lab_v1',
  'Tolou_quality_control_v1',
  'Tolou_production_intelligence_v1'
];

function hasLiveEngineeringData() {
  return RECOVERY_SENTINELS.some(key => window.localStorage.getItem(key) !== null);
}

function applyStorage(storage) {
  if (!storage || typeof storage !== 'object' || Array.isArray(storage)) return false;
  window.localStorage.clear();
  for (const [key, value] of Object.entries(storage)) {
    if (value !== null && value !== undefined) {
      window.localStorage.setItem(key, String(value));
    }
  }
  return true;
}

function bootstrapFromDesktopMirror() {
  try {
    if (hasLiveEngineeringData()) return;

    const mirror = ipcRenderer.sendSync('tolou:persistence:bootstrap');
    if (!mirror || !mirror.storage || typeof mirror.storage !== 'object') return;
    applyStorage(mirror.storage);
  } catch {
    // Chromium localStorage remains usable if desktop recovery is unavailable.
  }
}

bootstrapFromDesktopMirror();

// QA sample data is built in the privileged main process and merged once.
function seedQaSampleProject() {
  try {
    const keys = [
      'Tolou_sample_project_v1',
      'Tolou_project_hub_v1',
      'Tolou_material_library_v1',
      'Tolou_aggregate_intelligence_v1',
      'Tolou_trial_lab_v1',
      'Tolou_quality_control_v1',
      'Tolou_production_intelligence_v1',
      'Tolou_durability_engine_v1',
      'Tolou_cost_sustainability_v1',
      'Tolou_multiobjective_optimizer_v1',
      'QC010_full_data'
    ];
    const existing = {};
    for (const key of keys) existing[key] = window.localStorage.getItem(key);
    const seeded = ipcRenderer.sendSync('tolou:sample:seed', existing);
    if (!seeded?.result?.ok || !seeded.storage) return;
    for (const [key, value] of Object.entries(seeded.storage)) {
      if (value !== null && value !== undefined) window.localStorage.setItem(key, String(value));
    }
  } catch {}
}
seedQaSampleProject();

ipcRenderer.on('tolou:persistence:apply-restore', (_event, storage) => {
  try {
    if (applyStorage(storage)) window.location.reload();
  } catch {}
});

contextBridge.exposeInMainWorld('tolouDesktop', {
  persistence: {
    saveSnapshot: (storage) => ipcRenderer.invoke('tolou:persistence:save', storage),
    info: () => ipcRenderer.invoke('tolou:persistence:info'),
    createBackup: () => ipcRenderer.invoke('tolou:persistence:create-backup')
  },
  runtime: {
    platform: process.platform,
    desktop: true
  }
});
