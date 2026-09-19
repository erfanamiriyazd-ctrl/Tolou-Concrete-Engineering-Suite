'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const DURABLE_KEYS = [
  'QC010_full_data',
  'QC012_data',
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

const ALL_KEYS = [
  ...DURABLE_KEYS,
  'TolouUnified_lastView',
  'darkMode'
];

function bootstrapFromDesktopMirror() {
  try {
    const existingDurableCount = DURABLE_KEYS.reduce((count, key) => {
      return count + (window.localStorage.getItem(key) !== null ? 1 : 0);
    }, 0);

    if (existingDurableCount > 0) return;

    const mirror = ipcRenderer.sendSync('tolou:persistence:bootstrap');
    if (!mirror || !mirror.storage || typeof mirror.storage !== 'object') return;

    for (const key of ALL_KEYS) {
      const value = mirror.storage[key];
      if (value !== null && value !== undefined) {
        window.localStorage.setItem(key, String(value));
      }
    }
  } catch {
    // Chromium localStorage remains the primary live store if mirror bootstrap is unavailable.
  }
}

bootstrapFromDesktopMirror();

contextBridge.exposeInMainWorld('tolouDesktop', {
  persistence: {
    keys: ALL_KEYS.slice(),
    saveSnapshot: (storage) => ipcRenderer.invoke('tolou:persistence:save', storage),
    info: () => ipcRenderer.invoke('tolou:persistence:info'),
    createBackup: () => ipcRenderer.invoke('tolou:persistence:create-backup')
  },
  runtime: {
    platform: process.platform,
    desktop: true
  }
});
