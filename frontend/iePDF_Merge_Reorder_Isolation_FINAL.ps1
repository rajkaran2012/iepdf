$ErrorActionPreference = "Stop"

$Root = "C:\IEPDF\frontend"
$WS = Join-Path $Root "components\MergeWorkspace.tsx"
$PAGE = Join-Path $Root "app\merge-pdf\page.tsx"
$BACKUP = Join-Path $Root "_ui-backups"
$enc = New-Object System.Text.UTF8Encoding($false)

if (!(Test-Path $WS)) { throw "Missing: $WS. No file changed." }
if (!(Test-Path $PAGE)) { throw "Missing: $PAGE. No file changed." }

$wsText = [IO.File]::ReadAllText($WS,$enc)
$pageText = [IO.File]::ReadAllText($PAGE,$enc)
$wsOriginal = $wsText
$pageOriginal = $pageText

# ------------------------------------------------------------
# 1) Mark only iePDF internal reorder drags.
# ------------------------------------------------------------
$rx = '(?s)(const\s+handleDragStart\s*=\s*\(\s*event:\s*React\.DragEvent<HTMLDivElement>\s*,\s*id:\s*string\s*\)\s*=>\s*\{)(.*?)(\r?\n\s*\};)'
$m = [regex]::Match($wsText,$rx)
if (!$m.Success) { throw "handleDragStart not found. No file changed." }

$body = $m.Groups[2].Value
if ($body -notmatch 'application/x-iepdf-reorder') {
    $rxSet = '(?s)(event\.dataTransfer\.setData\s*\(\s*"text/plain"\s*,\s*id\s*\)\s*;)'
    $sm = [regex]::Match($body,$rxSet)
    if (!$sm.Success) { throw "text/plain drag marker not found. No file changed." }

    $add = $sm.Groups[1].Value + "`r`n        event.dataTransfer.setData(""application/x-iepdf-reorder"", ""1"");"
    $body = $body.Substring(0,$sm.Index) + $add + $body.Substring($sm.Index+$sm.Length)
    $wsText = $wsText.Substring(0,$m.Groups[2].Index) + $body + $wsText.Substring($m.Groups[2].Index+$m.Groups[2].Length)
    Write-Host "[OK] Added internal reorder marker." -ForegroundColor Green
} else {
    Write-Host "[OK] Internal reorder marker already present." -ForegroundColor Green
}

# ------------------------------------------------------------
# Helper: insert a guard immediately after preventDefault()
# ------------------------------------------------------------
function Add-Guard {
    param(
        [string]$Text,
        [string]$FunctionPattern,
        [string]$Guard,
        [string]$Name
    )

    $mm = [regex]::Match($Text,$FunctionPattern)
    if (!$mm.Success) { throw "$Name not found. No file changed." }

    $b = $mm.Groups[2].Value
    if ($b -match 'application/x-iepdf-reorder') {
        Write-Host "[OK] $Name already protected." -ForegroundColor Green
        return $Text
    }

    $needle = 'event.preventDefault();'
    $i = $b.IndexOf($needle)
    if ($i -lt 0) { throw "$Name preventDefault() not found. No file changed." }

    $newB = $b.Substring(0,$i) + $needle + "`r`n`r`n" + $Guard + $b.Substring($i+$needle.Length)
    return $Text.Substring(0,$mm.Groups[2].Index) + $newB + $Text.Substring($mm.Groups[2].Index+$mm.Groups[2].Length)
}

# ------------------------------------------------------------
# 2) Parent must ignore internal reorder drag-enter/over/drop.
# ------------------------------------------------------------
$pageText = Add-Guard $pageText `
    '(?s)(const\s+handleWorkspaceDragEnter\s*=\s*\(\s*event:\s*React\.DragEvent<HTMLDivElement>\s*\)\s*=>\s*\{)(.*?)(\r?\n\s*\};)' `
    '    if (event.dataTransfer.types.includes("application/x-iepdf-reorder")) {`r`n        return;`r`n    }' `
    'handleWorkspaceDragEnter'

$pageText = Add-Guard $pageText `
    '(?s)(const\s+handleWorkspaceDragOver\s*=\s*\(\s*event:\s*React\.DragEvent<HTMLDivElement>\s*\)\s*=>\s*\{)(.*?)(\r?\n\s*\};)' `
    '    if (event.dataTransfer.types.includes("application/x-iepdf-reorder")) {`r`n        event.dataTransfer.dropEffect = "move";`r`n        return;`r`n    }' `
    'handleWorkspaceDragOver'

$pageText = Add-Guard $pageText `
    '(?s)(const\s+handleWorkspaceDrop\s*=\s*async\s*\(\s*event:\s*React\.DragEvent<HTMLDivElement>\s*\)\s*=>\s*\{)(.*?)(\r?\n\s*\};)' `
    '    if (event.dataTransfer.types.includes("application/x-iepdf-reorder")) {`r`n        event.stopPropagation();`r`n        return;`r`n    }' `
    'handleWorkspaceDrop'

# ------------------------------------------------------------
# 3) Final validation BEFORE touching disk.
# ------------------------------------------------------------
if ($wsText -notmatch 'application/x-iepdf-reorder') {
    throw "Final verification failed: MergeWorkspace marker missing. No file changed."
}

foreach ($x in @(
    'const handleWorkspaceDragEnter',
    'const handleWorkspaceDragOver',
    'const handleWorkspaceDrop',
    'application/x-iepdf-reorder'
)) {
    if ($pageText -notmatch [regex]::Escape($x)) {
        throw "Final verification failed in page.tsx: $x. No file changed."
    }
}

if (($wsText -eq $wsOriginal) -and ($pageText -eq $pageOriginal)) {
    throw "Nothing to change. No file changed."
}

# ------------------------------------------------------------
# 4) Backup current versions, then write.
# ------------------------------------------------------------
New-Item -ItemType Directory -Force $BACKUP | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

$wsBackup = Join-Path $BACKUP "MERGE-REORDER-FIX-BEFORE-$stamp-MergeWorkspace.tsx"
$pageBackup = Join-Path $BACKUP "MERGE-REORDER-FIX-BEFORE-$stamp-page.tsx"

Copy-Item $WS $wsBackup -Force
Copy-Item $PAGE $pageBackup -Force

[IO.File]::WriteAllText($WS,$wsText,$enc)
[IO.File]::WriteAllText($PAGE,$pageText,$enc)

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " SUCCESS: MERGE REORDER ISOLATION FIX APPLIED" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Changed only:" -ForegroundColor Cyan
Write-Host "  components\MergeWorkspace.tsx"
Write-Host "    -> internal reorder MIME marker"
Write-Host "  app\merge-pdf\page.tsx"
Write-Host "    -> parent drag-enter/over/drop ignores internal reorder"
Write-Host ""
Write-Host "NOT changed:" -ForegroundColor Yellow
Write-Host "  Validation Gateway"
Write-Host "  LaunchActionValidator"
Write-Host "  Security rules"
Write-Host "  PDF analyzer"
Write-Host "  Merge processor"
Write-Host "  Frozen Merge UI/layout"
Write-Host ""
Write-Host "Backups created:" -ForegroundColor Cyan
Write-Host "  $wsBackup"
Write-Host "  $pageBackup"
Write-Host ""
Write-Host "Next: run ONLY this first:" -ForegroundColor Cyan
Write-Host "  pnpm exec tsc --noEmit"
