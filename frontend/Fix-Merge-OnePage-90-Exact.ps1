$ErrorActionPreference = "Stop"

$mergePath = ".\components\MergeWorkspace.tsx"
$pagePath  = ".\app\merge-pdf\page.tsx"

$mergeFull = (Resolve-Path $mergePath).Path
$pageFull  = (Resolve-Path $pagePath).Path

Write-Host "Applying exact Merge PDF one-page layout..." -ForegroundColor Cyan

# ------------------------------------------------------------
# READ
# ------------------------------------------------------------
$utf8 = [System.Text.Encoding]::UTF8

$merge = [System.IO.File]::ReadAllText($mergeFull, $utf8)
$page  = [System.IO.File]::ReadAllText($pageFull, $utf8)

# ------------------------------------------------------------
# VERIFY ALL EXPECTED ORIGINAL BLOCKS FIRST
# NO WRITING UNTIL EVERYTHING IS FOUND
# ------------------------------------------------------------
$oldOuter = '<div className="relative mt-10 grid w-full max-w-6xl grid-cols-1 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl lg:grid-cols-[minmax(0,1fr)_300px]">'

$oldHeader = '<div className="border-b px-8 py-6 lg:col-span-2">'

$oldFileList = '<div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:max-h-[calc(100vh-310px)] lg:overflow-y-auto">'

$oldSidebar = '<div className="relative flex min-h-[420px] flex-col border-t bg-gray-50 px-5 py-6 pb-24 lg:col-start-2 lg:row-start-2 lg:border-l lg:border-t-0">'

$oldPageWrapper = '<div className="flex flex-col items-center justify-center py-16">'

$required = @(
    @{ Name = "Workspace outer"; Text = $oldOuter; Source = $merge },
    @{ Name = "Workspace header"; Text = $oldHeader; Source = $merge },
    @{ Name = "PDF file list"; Text = $oldFileList; Source = $merge },
    @{ Name = "Right sidebar"; Text = $oldSidebar; Source = $merge },
    @{ Name = "Merge page wrapper"; Text = $oldPageWrapper; Source = $page }
)

foreach ($item in $required) {
    if (-not $item.Source.Contains($item.Text)) {
        throw "$($item.Name) source block not found. FILES NOT CHANGED."
    }

    Write-Host "[OK] Found $($item.Name)" -ForegroundColor Green
}

# ------------------------------------------------------------
# BACKUP
# ------------------------------------------------------------
$backupDir = ".\_ui-backups\merge-onepage-exact-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

Copy-Item $mergeFull "$backupDir\MergeWorkspace.tsx" -Force
Copy-Item $pageFull "$backupDir\merge-pdf-page.tsx" -Force

# ------------------------------------------------------------
# EXACT REPLACEMENTS
# ------------------------------------------------------------

$newOuter = '<div className="relative mt-4 grid h-[calc(100vh-270px)] min-h-[520px] w-[90vw] max-w-[1400px] grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl lg:grid-cols-[minmax(0,1fr)_320px]">'

$newHeader = '<div className="border-b px-8 py-4 lg:col-span-2 lg:row-start-1">'

$newFileList = '<div className="min-h-0 overflow-y-auto p-6 lg:col-start-1 lg:row-start-2">'

$newSidebar = '<div className="relative flex min-h-0 flex-col border-t bg-gray-50 px-6 py-5 lg:col-start-2 lg:row-start-2 lg:border-l lg:border-t-0">'

$newPageWrapper = '<div className="flex w-full flex-col items-center justify-start py-4">'

$merge = $merge.Replace($oldOuter, $newOuter)
$merge = $merge.Replace($oldHeader, $newHeader)
$merge = $merge.Replace($oldFileList, $newFileList)
$merge = $merge.Replace($oldSidebar, $newSidebar)

$page = $page.Replace($oldPageWrapper, $newPageWrapper)

# ------------------------------------------------------------
# SAFETY CHECKS
# ------------------------------------------------------------

if ($merge.Contains("fixed bottom-5 left-1/2")) {
    throw "Fixed floating button detected. FILES NOT CHANGED."
}

if ($merge.Contains("sticky bottom-0")) {
    throw "Sticky button detected. FILES NOT CHANGED."
}

if (-not $merge.Contains("onClick={onUnlockMerge}")) {
    throw "Existing merge handler missing. FILES NOT CHANGED."
}

if (-not $merge.Contains("mt-auto pt-6")) {
    throw "Bottom-aligned Merge button missing. FILES NOT CHANGED."
}

if (-not $merge.Contains("w-[90vw]")) {
    throw "90vw workspace width missing. FILES NOT CHANGED."
}

if (-not $merge.Contains("overflow-y-auto p-6 lg:col-start-1")) {
    throw "Internal PDF workspace scrolling missing. FILES NOT CHANGED."
}

# ------------------------------------------------------------
# WRITE UTF-8 WITHOUT BOM
# ------------------------------------------------------------
$noBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText($mergeFull, $merge, $noBom)
[System.IO.File]::WriteAllText($pageFull, $page, $noBom)

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host " MERGE PDF 90% ONE-PAGE LAYOUT APPLIED" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[OK] Workspace approximately 90vw"
Write-Host "[OK] Controlled viewport height"
Write-Host "[OK] Header spans workspace"
Write-Host "[OK] PDF workspace internally scrollable"
Write-Host "[OK] Right panel fills workspace"
Write-Host "[OK] Unlock & Merge remains at panel bottom"
Write-Host "[OK] No floating button"
Write-Host "[OK] No sticky button"
Write-Host "[OK] Merge handler preserved"
Write-Host "[OK] Merge logic untouched"
Write-Host "[OK] Password logic untouched"
Write-Host "[OK] Validation logic untouched"
Write-Host "[OK] Homepage untouched"
Write-Host "[OK] No Git commands"
Write-Host "[OK] No deployment"
Write-Host ""
Write-Host "Backup:"
Write-Host $backupDir