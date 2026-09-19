# Windows Release Requirements

## Mandatory release requirements

### 1. Full feature preservation
The Windows build must preserve the engineering application and its current capabilities. Packaging is not permission to delete, hide, bypass or replace working modules.

### 2. Network policy
Tolou is not required to be offline-only. Network-dependent or future online services may remain available when they are part of the product design. Windows packaging must not remove functionality solely to enforce offline operation.

### 3. Branding and icon chain
The final official Tolou artwork supplied/approved by the owner will be used as the source asset.

The same approved identity must be applied to:
- Installer executable
- Installed application executable
- Application window/taskbar identity where supported
- Desktop shortcut
- Start Menu shortcut
- Windows Apps/Installed Apps entry where supported

Do not recreate or approximate the official logo when the real source asset is available.

### 4. Installer
The release installer must:
- install the application into an appropriate Windows location;
- create a Desktop shortcut;
- create a Start Menu shortcut;
- apply the official icon to shortcuts;
- register product/version/publisher metadata;
- provide an uninstaller;
- launch the installed application successfully.

### 5. User data
Application upgrades and uninstall behavior must protect engineering project data. User data must not be silently destroyed.

### 6. Release validation
Avoid unnecessary repetitive CI during normal development. Before final delivery perform a focused release validation covering:
- installation;
- first launch;
- shortcut launch;
- icon appearance;
- application restart;
- data persistence;
- representative engineering calculation;
- Trial/QC path;
- report/export;
- backup/restore;
- uninstall behavior.

### 7. Final handoff
The final build produced by ChatGPT should be returned to the owner as a complete Windows installer for installation and acceptance testing. Any owner-supplied final logo/icon asset must be integrated before final release.
