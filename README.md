# Tolou Concrete Engineering Suite

Professional concrete engineering decision platform.

## Current status
Engineering development is complete through **Stage 6.5**. The Golden Baseline is preserved at:

- `baseline/Tolou_MASTER_Stage6.5.html`

Windows productization has started with **W1 - Windows Application Shell**:

- Electron shell entrypoint: `src/main.cjs`
- Preload bridge: `src/preload.cjs`
- Windows packaging config: `package.json`
- W1 contract test: `test/windows-shell.test.cjs`
- W1 notes: `docs/W1_WINDOWS_SHELL.md`

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

See:
- [ROADMAP.md](ROADMAP.md)
- [WINDOWS_RELEASE_REQUIREMENTS.md](WINDOWS_RELEASE_REQUIREMENTS.md)
- [docs/W1_WINDOWS_SHELL.md](docs/W1_WINDOWS_SHELL.md)
