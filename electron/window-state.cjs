'use strict';

const fs = require('node:fs');
const path = require('node:path');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function atomicWrite(file, value) {
  ensureDir(path.dirname(file));
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch {
    try { fs.rmSync(file, { force: true }); } catch {}
    fs.renameSync(tmp, file);
  }
}

function createWindowState(app, screen) {
  const file = path.join(app.getPath('userData'), 'settings', 'window-state.json');

  function defaultState() {
    return {
      width: 1440,
      height: 900,
      maximized: false
    };
  }

  function isVisibleOnAnyDisplay(bounds) {
    if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) return false;
    const displays = screen.getAllDisplays();
    return displays.some(display => {
      const area = display.workArea;
      const overlapX = Math.max(0, Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x));
      const overlapY = Math.max(0, Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y));
      return overlapX >= 120 && overlapY >= 80;
    });
  }

  function load() {
    const parsed = readJson(file);
    if (!parsed || !Number.isFinite(parsed.width) || !Number.isFinite(parsed.height)) {
      return defaultState();
    }

    const state = {
      width: Math.max(1100, Math.round(parsed.width)),
      height: Math.max(720, Math.round(parsed.height)),
      maximized: !!parsed.maximized
    };

    if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
      state.x = Math.round(parsed.x);
      state.y = Math.round(parsed.y);
    }

    if (!isVisibleOnAnyDisplay(state)) {
      delete state.x;
      delete state.y;
    }

    return state;
  }

  function save(win) {
    if (!win || win.isDestroyed()) return;
    const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds();
    atomicWrite(file, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized: win.isMaximized(),
      savedAt: new Date().toISOString()
    });
  }

  return { file, load, save };
}

module.exports = { createWindowState };
