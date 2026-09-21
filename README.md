# Tolou Concrete Engineering Suite

Professional concrete engineering decision platform.

## Current status
Engineering development is complete through **Stage 6.5**. The Golden Baseline is preserved at:

- `baseline/Tolou_MASTER_Stage6.5.html`

Windows productization has started:

- **W1 - Windows Application Shell**: Electron desktop shell, installer configuration and baseline loader.
- **W2 - Persistent Data & Backup Foundation**: desktop user-data store, backup/restore adapter, IPC bridge and renderer localStorage sync.

Current implementation files:

- Electron shell entrypoint: `src/main.cjs`
- Preload bridge: `src/preload.cjs`
- Desktop persistence store: `src/desktop-store.cjs`
- Renderer sync adapter: `src/renderer-sync.cjs`
- Windows packaging config: `package.json`
- W1/W2 tests: `test/windows-shell.test.cjs`, `test/desktop-store.test.cjs`, `test/renderer-sync.test.cjs`
- W1 notes: `docs/W1_WINDOWS_SHELL.md`
- W2 notes: `docs/W2_PERSISTENCE.md`

## Windows release direction
- Preserve the current engineering capabilities.
- Do not reduce the software to a demo for packaging convenience.
- Offline-only operation is not a requirement.
- Minimize unnecessary CI/test overhead during development.
- Use focused smoke checks and a final release regression.
- Deliver a complete installer with the official Tolou logo/icon on the installer, application and Desktop shortcut.

## Local commands

```bash
npm install
npm test
npm start
npm run dist:win
```

## Notes

The final official `build/icon.ico` is still required before the icon chain can be completed in W3.
The Stage 6.5 HTML baseline is not directly edited for W2; persistence is attached through Electron preload and localStorage sync.

See:
- [ROADMAP.md](ROADMAP.md)
- [WINDOWS_RELEASE_REQUIREMENTS.md](WINDOWS_RELEASE_REQUIREMENTS.md)
- [docs/W1_WINDOWS_SHELL.md](docs/W1_WINDOWS_SHELL.md)
- [docs/W2_PERSISTENCE.md](docs/W2_PERSISTENCE.md)
