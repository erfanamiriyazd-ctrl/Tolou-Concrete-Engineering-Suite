# Tolou — Local Windows Release

This path builds the Windows installer **without GitHub Actions**.

## Requirements
- Windows 10/11 x64
- Node.js + npm
- Internet access for the first dependency install

## Build
From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-windows-release.ps1
```

Or double-click:

```text
scripts\build-windows-release.cmd
```

The release script:
1. checks Node/npm and x64 Windows;
2. installs dependencies using `npm ci` when `package-lock.json` exists;
3. runs `npm run qa:sample`;
4. builds the NSIS x64 installer with `npm run dist:win`;
5. verifies that the EXE exists and is not suspiciously small;
6. prints its SHA-256 hash.

Expected artifact:

```text
dist\Tolou-Concrete-Engineering-Suite-Setup-0.9.5.exe
```

The script stops before packaging if the QA gate fails.
