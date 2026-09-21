const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

const pkg = readJson('package.json');

assert.equal(pkg.name, 'tolou-concrete-engineering-suite');
assert.equal(pkg.productName, 'Tolou Concrete Engineering Suite');
assert.equal(pkg.main, 'src/main.cjs');
assert.equal(pkg.scripts.start, 'electron .');
assert.equal(pkg.scripts['dist:win'], 'electron-builder --win');
assert.equal(pkg.build.appId, 'ir.tolou.concrete.engineering.suite');
assert.equal(pkg.build.win.target[0].target, 'nsis');
assert.equal(pkg.build.nsis.createDesktopShortcut, true);
assert.equal(pkg.build.nsis.createStartMenuShortcut, true);
assert.equal(pkg.build.extraResources[0].from, 'baseline/Tolou_MASTER_Stage6.5.html');
assert.equal(pkg.build.extraResources[0].to, 'baseline/Tolou_MASTER_Stage6.5.html');

assert.ok(exists('src/main.cjs'), 'Electron main process file must exist');
assert.ok(exists('src/preload.cjs'), 'Preload bridge must exist');
assert.ok(exists('docs/W1_WINDOWS_SHELL.md'), 'W1 handoff document must exist');

const main = fs.readFileSync(path.join(root, 'src/main.cjs'), 'utf8');
assert.match(main, /Tolou Concrete Engineering Suite/);
assert.match(main, /Tolou_MASTER_Stage6\.5\.html/);
assert.match(main, /app\.getPath\('userData'\)/);
assert.match(main, /contextIsolation:\s*true/);
assert.match(main, /nodeIntegration:\s*false/);

const preload = fs.readFileSync(path.join(root, 'src/preload.cjs'), 'utf8');
assert.match(preload, /contextBridge\.exposeInMainWorld\('tolouDesktop'/);
assert.match(preload, /getAppInfo/);
