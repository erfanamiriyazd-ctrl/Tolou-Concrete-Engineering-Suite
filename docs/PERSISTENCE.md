# Tolou Windows Persistence

## Goal
Windows packaging must behave like a professional desktop product: engineering data survives restart, upgrade and normal uninstall/reinstall workflows.

## Live storage
The accepted Stage 6.5 application continues to use its existing browser storage API. The Windows shell mirrors the complete `localStorage` keyspace to a versioned disk envelope. This avoids a risky rewrite of the engineering core while giving the desktop release a recoverable persistent copy.

## Disk mirror
The mirror is stored under Electron's Windows `userData` directory:

`data/tolou-storage-v1.json`

The envelope contains:
- format identifier;
- schema version;
- saved timestamp;
- complete localStorage payload;
- SHA-256 integrity checksum.

Writes use a temporary file followed by replacement so a partial write does not become the active mirror.

## Internal backups
The application keeps rotating internal backups under:

`data/backups/`

Current policy:
- backup before meaningful mirror replacement when the previous mirror is old enough;
- forced safety backup before restore;
- manual internal backup support;
- maximum 20 internal backup files.

## User backup/export
Windows native Save dialog exports a portable backup file with extension:

`.tolou-backup`

The exported file is validated and checksum-protected.

## Restore
Restore uses a native Open dialog. Before applying the selected backup:
1. the current live state is flushed;
2. the backup format and checksum are validated;
3. a pre-restore safety backup is created;
4. the disk mirror is replaced atomically;
5. the restored storage is applied to the running app;
6. the window reloads with restored data.

## Desktop commands
- `Ctrl+S` — flush current data
- `Ctrl+Shift+B` — export backup
- `Ctrl+Shift+R` — restore backup
- File menu also contains Open Data Folder

## Product rule
Uninstall must not silently delete the user's engineering data. The NSIS configuration keeps application data by default.
