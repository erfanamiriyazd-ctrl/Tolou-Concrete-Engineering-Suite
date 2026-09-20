$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "Tolou Local Windows Release"
Write-Host "1/5 Checking environment..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is not installed or not on PATH." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm is not installed or not on PATH." }
if (-not [Environment]::Is64BitOperatingSystem) { throw "Tolou Windows installer requires 64-bit Windows." }

Write-Host "2/5 Installing locked dependencies..."
if (Test-Path "package-lock.json") { npm ci --no-audit --no-fund } else { npm install --no-audit --no-fund }
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }

Write-Host "3/5 Running engineering/release contracts..."
npm run qa:sample
if ($LASTEXITCODE -ne 0) { throw "QA gate failed. Installer was not built." }

Write-Host "4/5 Building NSIS x64 installer..."
npm run dist:win
if ($LASTEXITCODE -ne 0) { throw "Windows installer build failed." }

Write-Host "5/5 Verifying artifact..."
$artifact = Get-ChildItem -Path "dist" -Filter "Tolou-Concrete-Engineering-Suite-Setup-*.exe" -File |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $artifact) { throw "Installer EXE was not found in dist." }
if ($artifact.Length -lt 1MB) { throw "Installer EXE is unexpectedly small." }

$hash = Get-FileHash -Algorithm SHA256 $artifact.FullName
Write-Host ""
Write-Host "RELEASE READY"
Write-Host ("Installer: " + $artifact.FullName)
Write-Host ("Size: " + [Math]::Round($artifact.Length / 1MB, 2) + " MB")
Write-Host ("SHA256: " + $hash.Hash)
