const assert = require('node:assert/strict');
const { installLocalStorageSync } = require('../src/renderer-sync.cjs');

function createFakeWindow() {
  const listeners = {};
  const data = new Map();
  return {
    localStorage: {
      get length() {
        return data.size;
      },
      key(index) {
        return Array.from(data.keys())[index] ?? null;
      },
      getItem(key) {
        return data.has(String(key)) ? data.get(String(key)) : null;
      },
      setItem(key, value) {
        data.set(String(key), String(value));
      },
      removeItem(key) {
        data.delete(String(key));
      }
    },
    addEventListener(type, handler) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(handler);
    },
    async dispatch(type) {
      for (const handler of listeners[type] || []) {
        await handler();
      }
    }
  };
}

(async () => {
  const fakeWindow = createFakeWindow();
  const saves = [];
  const api = {
    loadWorkspace: async () => ({
      data: {
        localStorage: {
          tolouProjectId: 'project-yazd-001',
          tolouReportLanguage: 'fa'
        }
      }
    }),
    saveWorkspace: async (data) => {
      saves.push(data);
      return { projectCount: 0 };
    }
  };

  const sync = installLocalStorageSync(fakeWindow, api, {
    debounceMs: 0,
    autoIntervalMs: 0
  });

  await sync.ready;

  assert.equal(fakeWindow.localStorage.getItem('tolouProjectId'), 'project-yazd-001');
  assert.equal(fakeWindow.localStorage.getItem('tolouReportLanguage'), 'fa');

  fakeWindow.localStorage.setItem('tolouDraftName', 'mix-a');
  await fakeWindow.dispatch('beforeunload');

  assert.equal(saves.length, 1);
  assert.deepEqual(saves[0], {
    localStorage: {
      tolouProjectId: 'project-yazd-001',
      tolouReportLanguage: 'fa',
      tolouDraftName: 'mix-a'
    }
  });
})();
