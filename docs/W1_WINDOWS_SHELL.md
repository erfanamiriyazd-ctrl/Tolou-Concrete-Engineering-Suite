# W1 - Windows Application Shell

## Scope

This milestone wraps the accepted Stage 6.5 Golden Baseline HTML application in an Electron desktop shell without changing the engineering engine or UI behavior.

## Implemented

- Electron main process entrypoint.
- Secure renderer defaults: `contextIsolation: true` and `nodeIntegration: false`.
- Baseline loader for development and packaged Windows runtime.
- Stable Windows product identity and application name.
- Local user-data path exposed through a minimal preload bridge.
- `electron-builder` NSIS installer configuration.
- Desktop shortcut and Start Menu shortcut configuration.

## Not Yet Final

- The final official `build/icon.ico` must be supplied before release packaging.
- W2 persistence adapter and migration/backup flow are not implemented in this milestone.
- Final installer validation must be performed on a clean Windows environment.
