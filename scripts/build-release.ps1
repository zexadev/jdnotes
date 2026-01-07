# JD Notes Build Release Script (PowerShell)
# Usage: .\scripts\build-release.ps1 [-Version "0.2.0"] [-SkipBuild]

param(
    [string]$Version,
    [switch]$SkipBuild,
    [string]$KeyFile = "$PSScriptRoot\..\~\.tauri\jdnotes.key"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Color output functions
function Write-Step { param($msg) Write-Host "`n[STEP] $msg" -ForegroundColor Cyan }
function Write-OK { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# Print banner
Write-Host ""
Write-Host "=========================================" -ForegroundColor Magenta
Write-Host "    JD Notes Build Release Script v1.0  " -ForegroundColor Magenta
Write-Host "=========================================" -ForegroundColor Magenta
Write-Host ""

# Check project root
if (-not (Test-Path "src-tauri\tauri.conf.json")) {
    Write-Err "Please run this script from project root directory!"
    exit 1
}

# Read current config
$tauriConf = Get-Content "src-tauri\tauri.conf.json" -Raw | ConvertFrom-Json
$currentVersion = $tauriConf.version
$productName = $tauriConf.productName

Write-Host "Current version: v$currentVersion" -ForegroundColor Gray
Write-Host "Product name: $productName" -ForegroundColor Gray

# Get new version
if (-not $Version) {
    Write-Host "`nEnter new version (current: $currentVersion):" -ForegroundColor Yellow
    $Version = Read-Host "Version (press Enter to skip)"
    if ([string]::IsNullOrWhiteSpace($Version)) {
        $Version = $currentVersion
    }
}

# Validate version format
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Err "Invalid version format! Should be x.y.z"
    exit 1
}

Write-Host "`nPreparing to build version: v$Version" -ForegroundColor Green

# Step 1: Update version
Write-Step "Updating version..."

if ($Version -ne $currentVersion) {
    # UTF-8 encoding without BOM
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    
    # Update tauri.conf.json (only the version field, preserve formatting)
    $tauriPath = "src-tauri\tauri.conf.json"
    $tauriContent = [System.IO.File]::ReadAllText((Resolve-Path $tauriPath))
    # Remove BOM if exists
    if ($tauriContent.Length -gt 0 -and $tauriContent[0] -eq [char]0xFEFF) {
        $tauriContent = $tauriContent.Substring(1)
    }
    $tauriContent = $tauriContent -replace '("version"\s*:\s*")[^"]*(")', "`${1}$Version`${2}"
    [System.IO.File]::WriteAllText((Resolve-Path $tauriPath), $tauriContent, $utf8NoBom)
    
    # Update package.json (only the version field, preserve formatting)
    $packagePath = "package.json"
    $packageContent = [System.IO.File]::ReadAllText((Resolve-Path $packagePath))
    # Remove BOM if exists
    if ($packageContent.Length -gt 0 -and $packageContent[0] -eq [char]0xFEFF) {
        $packageContent = $packageContent.Substring(1)
    }
    $packageContent = $packageContent -replace '("version"\s*:\s*")[^"]*(")', "`${1}$Version`${2}"
    [System.IO.File]::WriteAllText((Resolve-Path $packagePath), $packageContent, $utf8NoBom)
    
    # Update Cargo.toml - ONLY the version under [package], not dependencies
    $cargoPath = "src-tauri\Cargo.toml"
    $cargoLines = [System.IO.File]::ReadAllLines((Resolve-Path $cargoPath))
    $inPackageSection = $false
    $versionUpdated = $false
    $newLines = @()
    
    foreach ($line in $cargoLines) {
        # Remove BOM from first line if exists
        if ($newLines.Count -eq 0 -and $line.Length -gt 0 -and $line[0] -eq [char]0xFEFF) {
            $line = $line.Substring(1)
        }
        
        if ($line -match '^\[package\]') {
            $inPackageSection = $true
        }
        elseif ($line -match '^\[') {
            $inPackageSection = $false
        }
        
        if ($inPackageSection -and -not $versionUpdated -and $line -match '^version\s*=\s*"') {
            $newLines += "version = `"$Version`""
            $versionUpdated = $true
        }
        else {
            $newLines += $line
        }
    }
    
    [System.IO.File]::WriteAllLines((Resolve-Path $cargoPath), $newLines, $utf8NoBom)
    
    Write-OK "Version updated to $Version"
}
else {
    Write-Host "Version unchanged, skipping update" -ForegroundColor Gray
}

# Step 2: Check signing key
Write-Step "Checking signing key..."

if (Test-Path $KeyFile) {
    Write-OK "Found key file: $KeyFile"
    $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $KeyFile -Raw
}
else {
    Write-Warn "Key file not found: $KeyFile"
    Write-Host "Generate new key? (y/n): " -NoNewline -ForegroundColor Yellow
    $genKey = Read-Host
    
    if ($genKey -eq 'y') {
        $keyDir = Split-Path $KeyFile -Parent
        if (-not (Test-Path $keyDir)) {
            New-Item -ItemType Directory -Path $keyDir -Force | Out-Null
        }
        pnpm tauri signer generate -w $KeyFile
        
        if (Test-Path $KeyFile) {
            $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $KeyFile -Raw
            Write-OK "Key generated!"
            Write-Warn "Please add the public key to tauri.conf.json plugins.updater.pubkey"
        }
        else {
            Write-Err "Key generation failed!"
            exit 1
        }
    }
    else {
        Write-Warn "Skipping signing, update feature will not work"
    }
}

# Step 3: Install dependencies
Write-Step "Installing dependencies..."
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to install dependencies!"
    exit 1
}
Write-OK "Dependencies installed"

# Step 4: Build application
if (-not $SkipBuild) {
    Write-Step "Building application..."
    Write-Host "This may take a few minutes, please wait..." -ForegroundColor Gray
    
    pnpm tauri build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Build failed!"
        exit 1
    }
    Write-OK "Build completed"
}
else {
    Write-Host "Skipping build step" -ForegroundColor Gray
}

# Step 5: Organize output files
Write-Step "Organizing output files..."

$releaseDir = "release\v$Version"
if (Test-Path $releaseDir) {
    Remove-Item $releaseDir -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

# Copy Windows build artifacts
$bundleDir = "src-tauri\target\release\bundle"

# NSIS installer (used for both installation and updates in Tauri 2.0)
$nsisExe = Get-ChildItem "$bundleDir\nsis\*.exe" -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch '\.sig$' } | Select-Object -First 1
$updateFile = $null
$updateSigFile = $null

if ($nsisExe) {
    # Copy installer
    Copy-Item $nsisExe.FullName "$releaseDir\"
    Write-Host "  + Copied installer: $($nsisExe.Name)" -ForegroundColor Green
    $updateFile = $nsisExe
    
    # Copy signature file
    $sigFile = "$($nsisExe.FullName).sig"
    if (Test-Path $sigFile) {
        Copy-Item $sigFile "$releaseDir\"
        $updateSigFile = Get-Item $sigFile
        Write-Host "  + Copied signature file: $($updateSigFile.Name)" -ForegroundColor Green
    }
}

# Also check for .nsis.zip format (older Tauri versions)
$nsisZip = Get-ChildItem "$bundleDir\nsis\*.nsis.zip" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($nsisZip) {
    Copy-Item $nsisZip.FullName "$releaseDir\"
    Write-Host "  + Copied update package: $($nsisZip.Name)" -ForegroundColor Green
    $updateFile = $nsisZip
    
    $sigFile = "$($nsisZip.FullName).sig"
    if (Test-Path $sigFile) {
        Copy-Item $sigFile "$releaseDir\"
        $updateSigFile = Get-Item $sigFile
        Write-Host "  + Copied signature file" -ForegroundColor Green
    }
}

# MSI installer (if exists)
$msiFile = Get-ChildItem "$bundleDir\msi\*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($msiFile) {
    Copy-Item $msiFile.FullName "$releaseDir\"
    Write-Host "  + Copied MSI: $($msiFile.Name)" -ForegroundColor Green
}

# Step 6: Generate latest.json
Write-Step "Generating latest.json..."

# Read signature from file
$signature = ""
if ($updateSigFile -and (Test-Path $updateSigFile.FullName)) {
    $signature = (Get-Content $updateSigFile.FullName -Raw).Trim()
    Write-Host "  + Read signature from: $($updateSigFile.Name)" -ForegroundColor Gray
}

# Get update file name
$updateFileName = if ($updateFile) { $updateFile.Name } else { "" }

# Read GitHub repo from tauri.conf.json endpoints
$githubRepo = "huancheng01/jdnotes"  # Default
$endpoints = $tauriConf.plugins.updater.endpoints
if ($endpoints -and $endpoints.Count -gt 0) {
    $endpoint = $endpoints[0]
    if ($endpoint -match 'github\.com/([^/]+/[^/]+)/') {
        $githubRepo = $matches[1]
    }
}
$downloadUrl = "https://github.com/$githubRepo/releases/download/v$Version/$updateFileName"

# Generate JSON manually for better formatting
$pubDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$notes = "## v$Version Updates`n`n- Feature improvements`n- Bug fixes"

$latestJsonContent = @"
{
  "version": "$Version",
  "notes": "$($notes -replace '"', '\"' -replace "`n", '\n')",
  "pub_date": "$pubDate",
  "platforms": {
    "windows-x86_64": {
      "signature": "$signature",
      "url": "$downloadUrl"
    }
  }
}
"@

[System.IO.File]::WriteAllText("$releaseDir\latest.json", $latestJsonContent, [System.Text.UTF8Encoding]::new($false))
Write-OK "latest.json generated"

# Show signature status
if ([string]::IsNullOrWhiteSpace($signature)) {
    Write-Warn "Signature is empty! Make sure the signing key is configured correctly."
} else {
    Write-Host "  + Signature length: $($signature.Length) chars" -ForegroundColor Gray
}

# Step 7: Show summary
Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "          Build Complete!               " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Output directory: $releaseDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Generated files:" -ForegroundColor Yellow
Get-ChildItem $releaseDir | ForEach-Object {
    $size = if ($_.Length -gt 1MB) { "{0:N1} MB" -f ($_.Length / 1MB) } else { "{0:N0} KB" -f ($_.Length / 1KB) }
    Write-Host "  - $($_.Name) ($size)"
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Edit $releaseDir\latest.json to add release notes"
Write-Host "  2. Update the download URL in latest.json"
Write-Host "  3. Upload files to GitHub Releases"
Write-Host ""

# Open output directory
Write-Host "Open output directory? (y/n): " -NoNewline -ForegroundColor Yellow
$openDir = Read-Host
if ($openDir -eq 'y') {
    explorer $releaseDir
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
