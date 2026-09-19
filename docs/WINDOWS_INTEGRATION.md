# Windows Integration

## Application identity
- Product: Tolou Concrete Engineering Suite
- App ID: `ir.tolou.concrete.engineering`
- Windows executable name: `Tolou Concrete Engineering Suite.exe`
- Execution level: `asInvoker` (no unnecessary administrator requirement)

## Desktop behavior
The Windows shell now provides:
- single-instance behavior;
- taskbar/AppUserModel identity;
- restoration of last window size, position and maximized state;
- display-safety checks when monitor layout changes;
- persistent engineering data and recovery;
- native backup/export and restore;
- Desktop shortcut and Start Menu shortcut through NSIS;
- uninstaller that keeps user engineering data by default.

## Window state
Window state is stored independently from engineering data under:

`userData/settings/window-state.json`

The file is written atomically. If a saved window location is no longer visible on any connected display, Tolou ignores the stale coordinates and opens on a valid display.

## Installer metadata
The package configuration now carries product name, copyright, executable identity and uninstall display name.

## Icon
The final official Tolou icon is intentionally not committed yet. Once the owner supplies the approved source logo/icon, prepare `build/icon.ico` and bind it to:
- application executable;
- installer;
- Desktop shortcut;
- Start Menu shortcut;
- taskbar/window identity where supported.

Do not substitute an approximate generated logo when the approved asset is available.
