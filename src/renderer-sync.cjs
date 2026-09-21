function snapshotLocalStorage(localStorage) {
  const local = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key) local[key] = localStorage.getItem(key);
  }
  return local;
}

function restoreLocalStorage(localStorage, values) {
  if (!values || typeof values !== 'object') return;

  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, String(value));
    }
  }
}

function installLocalStorageSync(targetWindow, api, options = {}) {
  if (!targetWindow?.localStorage) {
    throw new Error('window.localStorage is required');
  }
  if (!api?.loadWorkspace || !api?.saveWorkspace) {
    throw new Error('workspace persistence API is required');
  }

  const debounceMs = Number(options.debounceMs ?? 500);
  const autoIntervalMs = Number(options.autoIntervalMs ?? 30000);
  let timer = null;
  let saving = false;

  async function saveNow() {
    if (saving) return null;
    saving = true;
    try {
      return await api.saveWorkspace({
        localStorage: snapshotLocalStorage(targetWindow.localStorage)
      });
    } finally {
      saving = false;
    }
  }

  function scheduleSave() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      saveNow();
    }, debounceMs);
  }

  const ready = Promise.resolve()
    .then(() => api.loadWorkspace())
    .then((workspace) => {
      restoreLocalStorage(targetWindow.localStorage, workspace?.data?.localStorage);
      return workspace;
    });

  targetWindow.addEventListener('storage', scheduleSave);
  targetWindow.addEventListener('beforeunload', saveNow);

  let interval = null;
  if (autoIntervalMs > 0) {
    interval = setInterval(saveNow, autoIntervalMs);
  }

  return {
    ready,
    saveNow,
    dispose() {
      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);
    }
  };
}

module.exports = {
  installLocalStorageSync,
  restoreLocalStorage,
  snapshotLocalStorage
};
