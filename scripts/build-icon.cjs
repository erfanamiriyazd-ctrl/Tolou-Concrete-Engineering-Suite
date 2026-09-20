'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'assets', 'brand-mark.svg');
const buildDir = path.join(root, 'build');
const target = path.join(buildDir, 'icon.ico');

fs.mkdirSync(buildDir, { recursive: true });

const bin = process.platform === 'win32'
  ? path.join(root, 'node_modules', '.bin', 'svg-to-ico.cmd')
  : path.join(root, 'node_modules', '.bin', 'svg-to-ico');

const result = spawnSync(bin, [source, target], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

if (!fs.existsSync(target) || fs.statSync(target).size < 1024) {
  throw new Error('Tolou Windows icon generation failed.');
}

console.log('Tolou Windows icon generated:', target);
