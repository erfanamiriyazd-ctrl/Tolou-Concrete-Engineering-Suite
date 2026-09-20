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

ipcRenderer.on('tolou:persistence:apply-restore', (_event, storage) => {
  try {
    if (applyStorage(storage)) window.location.reload();
  } catch {}
});

contextBridge.exposeInMainWorld('tolouDesktop', {
  sample: {
    bootstrap: (existing) => ipcRenderer.sendSync('tolou:sample:seed', existing || {})
  },
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
