$ErrorActionPreference = "Stop"

$mergePath = ".\components\MergeWorkspace.tsx"
$pagePath  = ".\app\merge-pdf\page.tsx"

Write-Host "Applying final Merge PDF one-page layout..." -ForegroundColor Cyan

$mergeFull = (Resolve-Path $mergePath).Path
$pageFull  = (Resolve-Path $pagePath).Path

# ============================================================
# BACKUP
# ============================================================
$backupDir = ".\_ui-backups\merge-onepage-final-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

Copy-Item $mergeFull "$backupDir\MergeWorkspace.tsx" -Force
Copy-Item $pageFull  "$backupDir\merge-pdf-page.tsx" -Force

# ============================================================
# READ
# ============================================================
$utf8 = [System.Text.Encoding]::UTF8

$merge = [System.IO.File]::ReadAllText($mergeFull, $utf8)
$page  = [System.IO.File]::ReadAllText($pageFull, $utf8)

# ============================================================
# PAGE WRAPPER
# ============================================================
$oldPage = '<div className="flex flex-col items-center justify-center py-16">'
$newPage = '<div className="flex w-full flex-col items-center justify-start py-4">'

if (-not $page.Contains($oldPage)) {
    throw "Merge page wrapper not found. FILES NOT CHANGED."
}

$page = $page.Replace($oldPage, $newPage)

Write-Host "[OK] Page vertical spacing reduced" -ForegroundColor Green

# ============================================================
# FIND WORKSPACE OUTER CONTAINER
# ============================================================
$outerRegex = '(?m)^(?<indent>\s*)<div className="[^"]*grid[^"]*lg:grid-cols-\[[^"]+\]"[^>]*>$'

$outerMatch = [regex]::Match($merge, $outerRegex)

if (-not $outerMatch.Success) {
    throw "Workspace outer container not found. FILES NOT CHANGED."
}

$oldOuter = $outerMatch.Value

# Preserve indentation.
$indent = $outerMatch.Groups["indent"].Value

$newOuter =
    $indent +
    '<div className="mt-4 grid h-[calc(100vh-270px)] min-h-[520px] w-[90vw] max-w-[1400px] grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl lg:grid-cols-[minmax(0,1fr)_320px]">'

$merge = $merge.Remove(
    $outerMatch.Index,
    $outerMatch.Length
).Insert(
    $outerMatch.Index,
    $newOuter
)

Write-Host "[OK] Workspace set to 90vw" -ForegroundColor Green
Write-Host "[OK] Workspace given one-screen height" -ForegroundColor Green

# ============================================================
# HEADER
# ============================================================
$headerRegex = '(?m)^(?<indent>\s*)<div className="border-b[^"]*px-8[^"]*py-[^"]*">'

$headerMatch = [regex]::Match($merge, $headerRegex)

if (-not $headerMatch.Success) {
    throw "Workspace header container not found. FILES NOT CHANGED."
}

$headerIndent = $headerMatch.Groups["indent"].Value

$newHeader =
    $headerIndent +
    '<div className="border-b px-8 py-4 lg:col-span-2 lg:row-start-1">'

$merge = $merge.Remove(
    $headerMatch.Index,
    $headerMatch.Length
).Insert(
    $headerMatch.Index,
    $newHeader
)

Write-Host "[OK] Header spans both panels" -ForegroundColor Green

# ============================================================
# FILE LIST
# ============================================================
$fileListRegex = '(?m)^(?<indent>\s*)<div className="grid grid-cols-1 gap-4 p-6[^"]*">'

$fileListMatch = [regex]::Match($merge, $fileListRegex)

if (-not $fileListMatch.Success) {
    throw "PDF file list container not found. FILES NOT CHANGED."
}

$fileIndent = $fileListMatch.Groups["indent"].Value

$newFileList =
    $fileIndent +
    '<div className="min-h-0 overflow-y-auto p-6 lg:col-start-1 lg:row-start-2">'

$merge = $merge.Remove(
    $fileListMatch.Index,
    $fileListMatch.Length
).Insert(
    $fileListMatch.Index,
    $newFileList
)

Write-Host "[OK] PDF workspace uses internal scrolling" -ForegroundColor Green

# ============================================================
# RIGHT SIDEBAR
# ============================================================
$sidebarRegex = '(?m)^(?<indent>\s*)<div className="relative flex min-h-\[420px\] flex-col border-t[^"]*lg:col-start-2[^"]*">'

$sidebarMatch = [regex]::Match($merge, $sidebarRegex)

if (-not $sidebarMatch.Success) {
    throw "Right sidebar container not found. FILES NOT CHANGED."
}

$sidebarIndent = $sidebarMatch.Groups["indent"].Value

$newSidebar =
    $sidebarIndent +
    '<div className="relative flex min-h-0 flex-col border-t bg-gray-50 px-6 py-5 lg:col-start-2 lg:row-start-2 lg:border-l lg:border-t-0">'

$merge = $merge.Remove(
    $sidebarMatch.Index,
    $sidebarMatch.Length
).Insert(
    $sidebarMatch.Index,
    $newSidebar
)

Write-Host "[OK] Right panel fills available height" -ForegroundColor Green

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
    throw "Bottom-aligned button container missing. FILES NOT CHANGED."
}

# ============================================================
# WRITE WITHOUT BOM
# ============================================================
$noBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    $mergeFull,
    $merge,
    $noBom
)

[System.IO.File]::WriteAllText(
    $pageFull,
    $page,
    $noBom
)

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host " FINAL MERGE PDF ONE-PAGE LAYOUT APPLIED" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[OK] Approximately 90% screen width"
Write-Host "[OK] One-page controlled workspace"
Write-Host "[OK] Header aligned across workspace"
Write-Host "[OK] PDF area internally scrollable"
Write-Host "[OK] Right control panel full height"
Write-Host "[OK] Unlock & Merge stays at panel bottom"
Write-Host "[OK] No floating button"
Write-Host "[OK] No sticky button"
Write-Host "[OK] Merge logic untouched"
Write-Host "[OK] Password logic untouched"
Write-Host "[OK] Validation logic untouched"
Write-Host "[OK] Homepage untouched"
Write-Host "[OK] No Git commands"
Write-Host "[OK] No deployment"
Write-Host ""
Write-Host "Backup:"
Write-Host $backupDir