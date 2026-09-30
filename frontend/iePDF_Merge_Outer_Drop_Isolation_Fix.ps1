$ErrorActionPreference = "Stop"

$Root = "C:\IEPDF\frontend"
$File = Join-Path $Root "app\merge-pdf\page.tsx"
$BackupDir = Join-Path $Root "_ui-backups"

if (-not (Test-Path -LiteralPath $File)) {
    throw "Target file not found: $File"
}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Text = [System.IO.File]::ReadAllText($File, $Utf8NoBom)
$Original = $Text

# This is the actual source location of the outer workspace file-drop handlers.
# Do not touch ValidationGateway, LaunchActionValidator, analyzer, or processor.

foreach ($name in @(
    'const handleWorkspaceDragEnter',
    'const handleWorkspaceDragOver',
    'const handleWorkspaceDrop'
)) {
    if ($Text -notmatch [regex]::Escape($name)) {
        throw "$name not found. No file was changed."
    }
}

# 1. Drag-enter: ignore internal PDF reorder drags before setting the external
#    file-drop overlay state.
$pattern = '(?s)(const handleWorkspaceDragEnter\s*=\s*\(\s*event:\s*React\.DragEvent<HTMLDivElement>\s*\)\s*=>\s*\{)(.*?)(\r?\n\};)'
$m = [regex]::Match($Text, $pattern)
if (-not $m.Success) { throw "Could not locate handleWorkspaceDragEnter body. No file was changed." }
$body = $m.Groups[2].Value
if ($body -notmatch 'application/x-iepdf-reorder') {
    $needle = 'event.preventDefault();'
    $p = $body.IndexOf($needle)
    if ($p -lt 0) { throw "DragEnter preventDefault not found. No file was changed." }
    $insert = $needle + "`r`n`r`n    if (event.dataTransfer.types.includes(""application/x-iepdf-reorder"") || event.dataTransfer.types.includes(""text/plain"")) {`r`n        return;`r`n    }"
    $body = $body.Substring(0,$p) + $insert + $body.Substring($p + $needle.Length)
    $Text = $Text.Substring(0,$m.Groups[2].Index) + $body + $Text.Substring($m.Groups[2].Index + $m.Groups[2].Length)
    Write-Host "[OK] Drag-enter now ignores internal reorder drags." -ForegroundColor Green
} else {
    Write-Host "[INFO] Drag-enter already has reorder protection." -ForegroundColor Yellow
}

# 2. Drag-over: same protection, preventing the overlay from appearing while
#    an existing PDF is being reordered.
$pattern = '(?s)(const handleWorkspaceDragOver\s*=\s*\(\s*event:\s*React\.DragEvent<HTMLDivElement>\s*\)\s*=>\s*\{)(.*?)(\r?\n\};)'
$m = [regex]::Match($Text, $pattern)
if (-not $m.Success) { throw "Could not locate handleWorkspaceDragOver body. No file was changed." }
$body = $m.Groups[2].Value
if ($body -notmatch 'application/x-iepdf-reorder') {
    $needle = 'event.preventDefault();'
    $p = $body.IndexOf($needle)
    if ($p -lt 0) { throw "DragOver preventDefault not found. No file was changed." }
    $insert = $needle + "`r`n`r`n    if (event.dataTransfer.types.includes(""application/x-iepdf-reorder"") || event.dataTransfer.types.includes(""text/plain"")) {`r`n        event.dataTransfer.dropEffect = ""move"";`r`n        return;`r`n    }"
    $body = $body.Substring(0,$p) + $insert + $body.Substring($p + $needle.Length)
    $Text = $Text.Substring(0,$m.Groups[2].Index) + $body + $Text.Substring($m.Groups[2].Index + $m.Groups[2].Length)
    Write-Host "[OK] Drag-over now ignores internal reorder drags." -ForegroundColor Green
} else {
    Write-Host "[INFO] Drag-over already has reorder protection." -ForegroundColor Yellow
}

# 3. Workspace drop: ignore internal reorder drops before reading File objects.
$pattern = '(?s)(const handleWorkspaceDrop\s*=\s*\(\s*event:\s*React\.DragEvent<HTMLDivElement>\s*\)\s*=>\s*\{)(.*?)(\r?\n\};)'
$m = [regex]::Match($Text, $pattern)
if (-not $m.Success) { throw "Could not locate handleWorkspaceDrop body. No file was changed." }
$body = $m.Groups[2].Value
if ($body -notmatch 'application/x-iepdf-reorder') {
    $needle = 'event.preventDefault();'
    $p = $body.IndexOf($needle)
    if ($p -lt 0) { throw "WorkspaceDrop preventDefault not found. No file was changed." }
    $insert = $needle + "`r`n`r`n    if (event.dataTransfer.types.includes(""application/x-iepdf-reorder"") || event.dataTransfer.types.includes(""text/plain"")) {`r`n        return;`r`n    }"
    $body = $body.Substring(0,$p) + $insert + $body.Substring($p + $needle.Length)
    $Text = $Text.Substring(0,$m.Groups[2].Index) + $body + $Text.Substring($m.Groups[2].Index + $m.Groups[2].Length)
    Write-Host "[OK] Workspace drop now ignores internal reorder drops." -ForegroundColor Green
} else {
    Write-Host "[INFO] Workspace drop already has reorder protection." -ForegroundColor Yellow
}

# Final safety checks.
foreach ($mkr in @(
    'application/x-iepdf-reorder',
    'const handleWorkspaceDragEnter',
    'const handleWorkspaceDragOver',
    'const handleWorkspaceDrop'
)) {
    if ($Text -notmatch [regex]::Escape($mkr)) {
        throw "Post-patch verification failed for [$mkr]. No file was changed."
    }
}

if ($Text -eq $Original) {
    throw "No source change required. No file was changed."
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $BackupDir "MERGE-OUTER-DROP-FIX-BEFORE-$Stamp-page.tsx"
Copy-Item -LiteralPath $File -Destination $Backup -Force

[System.IO.File]::WriteAllText($File, $Text, $Utf8NoBom)

Write-Host ""
Write-Host "[SUCCESS] Corrected Merge outer-drop isolation patch applied." -ForegroundColor Green
Write-Host "Backup: $Backup" -ForegroundColor Cyan
Write-Host ""
Write-Host "Changed ONLY app\merge-pdf\page.tsx drag/drop handlers." -ForegroundColor Green
Write-Host "Validation Gateway / LaunchActionValidator / PDF analyzer / merge processor were NOT changed." -ForegroundColor Green
Write-Host "MergeWorkspace UI was NOT changed." -ForegroundColor Green
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  pnpm exec tsc --noEmit"
Write-Host "  pnpm build"
