# Windows Build

## Current branch
`feature/windows-shell`

## Purpose
Package the accepted Stage 6.5 Golden Baseline as the full Tolou Windows desktop application without deleting or simplifying engineering functionality.

## Local development

```bash
npm install
npm start
```

## Windows installer

```bash
npm run dist:win
```

Expected installer name:

`Tolou-Concrete-Engineering-Suite-Setup-0.9.0.exe`

## Icon status
The Windows shell does not require the final icon to run.

Before the first release-candidate installer is produced, the owner must provide the final approved Tolou logo/icon source asset. It will then be converted/prepared as a Windows `.ico` and applied to:

- application executable
- NSIS installer
- Desktop shortcut
- Start Menu shortcut
- taskbar/window identity where supported

Do not generate an approximate replacement logo when the approved asset is available.

## Release policy
No broad rewrite of the Stage 6.5 engineering core. No mandatory CI pipeline. Use focused smoke checks while packaging and one broader regression check before the release candidate.
