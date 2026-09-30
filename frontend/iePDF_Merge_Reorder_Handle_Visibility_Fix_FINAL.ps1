$ErrorActionPreference = "Stop"

$projectRoot = "C:\IEPDF\frontend"
$wsFile = Join-Path $projectRoot "components\MergeWorkspace.tsx"
$backupRoot = Join-Path $projectRoot "_ui-backups"

Set-Location $projectRoot

if (!(Test-Path $wsFile)) {
    throw "MergeWorkspace.tsx not found. STOP. No source was changed."
}

$enc = New-Object System.Text.UTF8Encoding($false)
$ws = [IO.File]::ReadAllText((Resolve-Path $wsFile), $enc)
$originalWs = $ws

# Find the existing V2 reorder handle.
$pattern = '(?s)<div\s+draggable\s+.*?aria-label=\{`Drag PDF \$\{index \+ 1\} to reorder`\}.*?title="Drag to reorder".*?className=\{`(?<classes>.*?)`\}'
$m = [regex]::Match($ws, $pattern)

if (!$m.Success) {
    throw "Current reorder handle was not found. STOP. No source was changed."
}

$classes = $m.Groups["classes"].Value

if ($classes -notmatch "h-10\s+w-10") {
    throw "Expected current V2 reorder handle was not found. STOP. No source was changed."
}

# Already applied?
if ($classes -match "files\.length\s*>\s*1") {
    Write-Host "OK: visibility rule is already present." -ForegroundColor Green
    exit 0
}

# Add a conditional class. The handle keeps its space, but becomes invisible
# and non-interactive when fewer than 2 PDFs exist.
$addition = '${files.length > 1 ? "" : "invisible pointer-events-none"}'

$start = $m.Groups["classes"].Index
$length = $m.Groups["classes"].Length

$ws = $ws.Substring(0, $start) +
      $addition +
      $ws.Substring($start, $length) +
      $ws.Substring($start + $length)

if ($ws -eq $originalWs) {
    throw "No source change was produced. STOP."
}

if ($ws -notmatch "files\.length\s*>\s*1") {
    throw "Visibility rule was not inserted. STOP."
}

# Safety checks: important existing logic must still be present.
$required = @(
    "handleDragStart",
    "handleDragEnd",
    "handleDragOver",
    "handleDrop",
    "application/x-iepdf-reorder"
)

foreach ($item in $required) {
    if ($ws -notmatch [regex]::Escape($item)) {
        throw "Safety check failed: $item is missing. STOP."
    }
}

# Backup before writing.
New-Item -ItemType Directory -Force $backupRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $backupRoot "merge-reorder-handle-visibility-before-$stamp-MergeWorkspace.tsx"
Copy-Item $wsFile $backupFile -Force

[IO.File]::WriteAllText((Resolve-Path $wsFile), $ws, $enc)

Write-Host ""
Write-Host "MERGE REORDER HANDLE VISIBILITY FIX APPLIED" -ForegroundColor Green
Write-Host "Backup: $backupFile"
Write-Host ""
Write-Host "0 or 1 PDF : handle hidden"
Write-Host "2 or more  : handle visible immediately"
Write-Host "Handle space remains reserved for stable row alignment"
Write-Host ""
Write-Host "Only handle presentation was changed."
Write-Host "Reorder, security, validation, drag/drop and merge logic were not changed."

try {
    Write-Host ""
    Write-Host "=== TypeScript ===" -ForegroundColor Cyan
    pnpm exec tsc --noEmit
    if ($LASTEXITCODE -ne 0) {
        throw "TypeScript verification failed."
    }
    Write-Host "TypeScript PASS" -ForegroundColor Green

    Write-Host ""
    Write-Host "=== Production build ===" -ForegroundColor Cyan
    pnpm build
    if ($LASTEXITCODE -ne 0) {
        throw "Production build failed."
    }
    Write-Host "Production build PASS" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "VALIDATION FAILED. Restoring original source." -ForegroundColor Red
    [IO.File]::WriteAllText((Resolve-Path $wsFile), $originalWs, $enc)
    throw
}

Write-Host ""
Write-Host "FIX COMPLETE" -ForegroundColor Green
Write-Host "Live site was NOT deployed or modified."
