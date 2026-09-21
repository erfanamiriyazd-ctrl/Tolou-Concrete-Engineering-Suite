# W2 - Persistent Data & Backup Foundation

## Scope

This milestone adds a desktop-side persistence adapter without rewriting the Stage 6.5 engineering baseline.

## Implemented

- User-data backed workspace envelope at `TolouUserData/workspace.json`.
- Schema version marker for future migrations.
- Atomic JSON writes through a temporary file and rename.
- Manual JSON backup creation under `TolouUserData/backups`.
- Backup restore with schema validation.
- Main-process IPC handlers for load, save, backup and restore.
- Preload bridge methods exposed through `window.tolouDesktop`.
- Renderer localStorage sync loaded from preload without modifying the Stage 6.5 baseline HTML.

## Data Protection Rule

The desktop store writes only inside Electron's `app.getPath('userData')`. Installer or uninstaller behavior must not silently delete this engineering data.

## Not Yet Final

- The Stage 6.5 HTML baseline currently syncs through localStorage. Direct in-UI backup/restore buttons can be added later.
- A migration runner will be needed when the schema version changes.
- Clean Windows validation is still required before Release Candidate.
