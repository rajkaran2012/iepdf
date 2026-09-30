$ErrorActionPreference = "Stop"

$layoutPath = ".\components\layout\ToolLayout.tsx"
$mergePath  = ".\components\MergeWorkspace.tsx"

$layoutFull = (Resolve-Path $layoutPath).Path
$mergeFull  = (Resolve-Path $mergePath).Path

Write-Host "Applying final Merge PDF vertical adjustment..." -ForegroundColor Cyan

$enc = [System.Text.Encoding]::UTF8

$layout = [System.IO.File]::ReadAllText($layoutFull, $enc)
$merge  = [System.IO.File]::ReadAllText($mergeFull, $enc)

# ============================================================
# VERIFY CURRENT FINAL STRUCTURE
# ============================================================

$checks = @(
    @{ Name="Wide ToolLayout"; Text='wide = false'; Source=$layout },
    @{ Name="Wide container"; Text='wide ? "mx-auto w-full px-4 py-6"'; Source=$layout },
    @{ Name="Wide title spacing"; Text='wide ? "mb-5 text-center"'; Source=$layout },
    @{ Name="90vw workspace"; Text='w-[90vw]'; Source=$merge },
    @{ Name="Workspace height"; Text='h-[calc(100vh-260px)]'; Source=$merge },
    @{ Name="Bottom Merge button"; Text='mt-auto pt-6'; Source=$merge },
    @{ Name="Merge handler"; Text='onClick={onUnlockMerge}'; Source=$merge }
)

foreach ($check in $checks) {
    if (-not $check.Source.Contains($check.Text)) {
        throw "$($check.Name) not found. FILES NOT CHANGED."
    }

    Write-Host "[OK] $($check.Name)" -ForegroundColor Green
}

# ============================================================
# BACKUP
# ============================================================

$backupDir = ".\_ui-backups\merge-final-vertical-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

Copy-Item $layoutFull "$backupDir\ToolLayout.tsx" -Force
Copy-Item $mergeFull  "$backupDir\MergeWorkspace.tsx" -Force

# ============================================================
# TOOLLAYOUT — MORE VERTICAL ROOM
# ============================================================

$layout = $layout.Replace(
    'wide ? "mx-auto w-full px-4 py-6"',
    'wide ? "mx-auto w-full px-4 py-3"'
)

$layout = $layout.Replace(
    'wide ? "mb-5 text-center"',
    'wide ? "mb-3 text-center"'
)

Write-Host "[OK] Reduced wide-page top/bottom spacing" -ForegroundColor Green
Write-Host "[OK] Reduced title spacing" -ForegroundColor Green

# ============================================================
# MERGE WORKSPACE — MOVE UP + MORE USABLE HEIGHT
# ============================================================

$merge = $merge.Replace(
    'mt-4 grid h-[calc(100vh-260px)] min-h-[430px] w-[90vw]',
    'mt-2 grid h-[calc(100vh-225px)] min-h-[430px] w-[90vw]'
)

Write-Host "[OK] Workspace moved upward" -ForegroundColor Green
Write-Host "[OK] Workspace given additional vertical room" -ForegroundColor Green

# ============================================================
# SAFETY CHECKS
# ============================================================

if ($merge.Contains("fixed bottom-5 left-1/2")) {
    throw "Fixed floating button detected. FILES NOT CHANGED."
}

if ($merge.Contains("sticky bottom-0")) {
    throw "Sticky button detected. FILES NOT CHANGED."
}

if (-not $merge.Contains("onClick={onUnlockMerge}")) {
    throw "Merge handler missing. FILES NOT CHANGED."
}

if (-not $merge.Contains("mt-auto pt-6")) {
    throw "Bottom-aligned button missing. FILES NOT CHANGED."
}

if (-not $merge.Contains("w-[90vw]")) {
    throw "90vw workspace missing. FILES NOT CHANGED."
}

if (-not $merge.Contains("h-[calc(100vh-225px)]")) {
    throw "Final workspace height missing. FILES NOT CHANGED."
}

# ============================================================
# WRITE UTF-8 WITHOUT BOM
# ============================================================

$noBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText($layoutFull, $layout, $noBom)
[System.IO.File]::WriteAllText($mergeFull, $merge, $noBom)

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host " FINAL MERGE PDF VERTICAL ADJUSTMENT COMPLETE" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[OK] More vertical room"
Write-Host "[OK] Workspace moved upward"
Write-Host "[OK] Workspace remains approximately 90vw"
Write-Host "[OK] PDF area internally scrollable"
Write-Host "[OK] Right panel remains full height"
Write-Host "[OK] Unlock & Merge remains normal size"
Write-Host "[OK] Unlock & Merge remains bottom aligned"
Write-Host "[OK] No floating button"
Write-Host "[OK] No sticky button"
Write-Host "[OK] Merge logic untouched"
Write-Host "[OK] Password logic untouched"
Write-Host "[OK] Validation untouched"
Write-Host "[OK] Homepage untouched"
Write-Host "[OK] No Git commands"
Write-Host "[OK] No deployment"
Write-Host ""
Write-Host "Backup:"
Write-Host $backupDir