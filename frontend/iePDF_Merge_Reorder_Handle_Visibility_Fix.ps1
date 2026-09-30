# iePDF Merge PDF — Reorder Handle Visibility Fix
# Purpose:
#   - Hide the reorder handle when there is only 0 or 1 PDF.
#   - Show it immediately when there are 2+ PDFs.
#   - Keep the handle column reserved so the row layout does not jump.
#   - Do NOT change reorder logic, security validation, file processing,
#     drag/drop behavior, merge logic, or the frozen page layout.
#   - Create a backup and verify TypeScript + production build.
#   - Never deploy to the live site.

$ErrorActionPreference = "Stop"

$projectRoot = "C:\IEPDF\frontend"
$wsFile = Join-Path $projectRoot "components\MergeWorkspace.tsx"
$backupRoot = Join-Path $projectRoot "_ui-backups"

if (!(Test-Path $wsFile)) {
    throw "MergeWorkspace.tsx not found. STOP. No source was changed."
}

Set-Location $projectRoot

$enc = New-Object System.Text.UTF8Encoding($false)
$ws = [IO.File]::ReadAllText((Resolve-Path $wsFile), $enc)
$originalWs = $ws

# Locate the CURRENT V2 reorder handle using its stable accessibility marker.
$handlePattern = '(?s)<div\s+draggable\s+.*?aria-label=\{`Drag PDF \$\{index \+ 1\} to reorder`\}.*?title="Drag to reorder".*?className=\{`(?<classes>.*?)`\}'
$m = [regex]::Match($ws, $handlePattern)

if (!$m.Success) {
    throw "Current reorder handle was not found. STOP. No source was changed."
}

$classes = $m.Groups["classes"].Value

# Ensure this is the expected current V2 handle, not an unrelated draggable.
if ($classes -notmatch 'h-10\s+w-10' -or $classes -notmatch 'cursor-grab') {
    throw "Expected current V2 reorder-handle classes were not found. STOP. No source was changed."
}

# Idempotency: do not apply twice.
if ($classes -match 'files\.length\s*>\s*1') {
    Write-Host "[OK] Reorder-handle visibility rule is already present." -ForegroundColor Green
    Write-Host "No source changes were necessary."
    exit 0
}

# Keep the handle column reserved for stable row alignment.
# The handle remains in the DOM for accessibility/consistent layout, but becomes
# visually hidden and non-interactive when fewer than 2 files exist.
$oldClassExpression = $m.Groups["classes"].Value

$newClassExpression =
    '${files.length > 1 ? "" : "invisible pointer-events-none"}' +
    $oldClassExpression

$ws = $ws.Substring(0, $m.Groups["classes"].Index) +
      $newClassExpression +
      $ws.Substring($m.Groups["classes"].Index + $m.Groups["classes"].Length)

# Safety checks before writing.
if ($ws -eq $originalWs) {
    throw "No source delta was produced. STOP."
}

if ($ws -notmatch 'files\.length\s*>\s*1') {
    throw "Visibility condition was not inserted. STOP."
}

# Confirm reorder/security-related source was not structurally removed.
foreach ($required in @(
    'handleDragStart',
    'handleDragEnd',
    'handleDragOver',
    'handleDrop',
    'application/x-iepdf-reorder',
    'onReorderFiles',
    'onUnlockMerge'
)) {
    if ($ws -notmatch [regex]::Escape($required)) {
        throw "Safety check failed: required existing logic '$required' is missing. STOP."
    }
}

# Backup first.
New-Item -ItemType Directory -Force $backupRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $backupRoot "merge-reorder-handle-visibility-before-$stamp-MergeWorkspace.tsx"
Copy-Item $wsFile $backupFile -Force

[IO.File]::WriteAllText((Resolve-Path $wsFile), $ws, $enc)

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " MERGE REORDER HANDLE VISIBILITY FIX APPLIED" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Backup: $backupFile"
Write-Host ""
Write-Host "Behavior:"
Write-Host "  0 or 1 PDF  -> reorder handle hidden"
Write-Host "  2+ PDFs     -> reorder handle visible immediately"
Write-Host "  Handle space remains reserved for stable row alignment"
Write-Host ""
Write-Host "Only reorder-handle presentation/visibility was changed."
Write-Host "Reorder logic, security, validation, drag/drop, merge and layout were not changed."

try {
    Write-Host ""
    Write-Host "=== TypeScript verification ===" -ForegroundColor Cyan
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
    Write-Host "VALIDATION FAILED — restoring original source." -ForegroundColor Red
    [IO.File]::WriteAllText((Resolve-Path $wsFile), $originalWs, $enc)
    throw
}

Write-Host ""
Write-Host "FIX COMPLETE" -ForegroundColor Green
Write-Host "Live site was NOT deployed or modified."
