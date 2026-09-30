$ErrorActionPreference = "Stop"

$mergePath = ".\components\MergeWorkspace.tsx"
$pagePath  = ".\app\merge-pdf\page.tsx"

Write-Host "Starting Merge PDF one-page 90% layout fix..." -ForegroundColor Cyan

# ============================================================
# BACKUP
# ============================================================
$backupDir = ".\_ui-backups\merge-onepage-90-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

Copy-Item $mergePath "$backupDir\MergeWorkspace.tsx" -Force
Copy-Item $pagePath  "$backupDir\merge-pdf-page.tsx" -Force

# ============================================================
# READ FILES
# ============================================================
$merge = [System.IO.File]::ReadAllText(
    (Resolve-Path $mergePath).Path,
    [System.Text.Encoding]::UTF8
)

$page = [System.IO.File]::ReadAllText(
    (Resolve-Path $pagePath).Path,
    [System.Text.Encoding]::UTF8
)

# ============================================================
# PAGE: REMOVE EXCESSIVE VERTICAL SPACE
# ============================================================
$oldPageWrapper = '<div className="flex flex-col items-center justify-center py-16">'

$newPageWrapper = '<div className="flex w-full flex-col items-center justify-start py-6">'

if (-not $page.Contains($oldPageWrapper)) {
    throw "Expected Merge PDF page wrapper not found. FILES NOT CHANGED."
}

$page = $page.Replace($oldPageWrapper, $newPageWrapper)

Write-Host "[OK] Reduced unnecessary page vertical spacing" -ForegroundColor Green

# ============================================================
# MERGE WORKSPACE: 90% WIDTH + VIEWPORT HEIGHT
# ============================================================
$oldOuter = 'className="relative mt-10 grid w-full max-w-6xl grid-cols-1 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl lg:grid-cols-[minmax(0,1fr)_300px]"'

$newOuter = 'className="relative mt-6 grid h-[calc(100vh-300px)] min-h-[520px] w-[90vw] max-w-[1400px] grid-cols-1 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl lg:grid-cols-[minmax(0,1fr)_320px]"'

if (-not $merge.Contains($oldOuter)) {
    throw "Expected MergeWorkspace outer layout not found. FILES NOT CHANGED."
}

$merge = $merge.Replace($oldOuter, $newOuter)

Write-Host "[OK] Workspace set to approximately 90% viewport width" -ForegroundColor Green
Write-Host "[OK] Workspace given controlled viewport height" -ForegroundColor Green

# ============================================================
# HEADER: SPAN BOTH COLUMNS
# ============================================================
$oldHeader = '<div className="border-b px-8 py-6">'

$newHeader = '<div className="border-b px-8 py-5 lg:col-span-2">'

if (-not $merge.Contains($oldHeader)) {
    throw "Expected Merge Workspace header not found. FILES NOT CHANGED."
}

$merge = $merge.Replace($oldHeader, $newHeader)

Write-Host "[OK] Workspace header aligned across both panes" -ForegroundColor Green

# ============================================================
# LEFT PDF AREA: INTERNAL SCROLL ONLY
# ============================================================
$oldLeft = 'className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:max-h-[calc(100vh-310px)] lg:overflow-y-auto"'

$newLeft = 'className="min-h-0 overflow-y-auto p-6 lg:col-start-1 lg:row-start-2"'

if (-not $merge.Contains($oldLeft)) {
    throw "Expected PDF workspace container not found. FILES NOT CHANGED."
}

$merge = $merge.Replace($oldLeft, $newLeft)

Write-Host "[OK] PDF area made independently scrollable" -ForegroundColor Green

# ============================================================
# RIGHT SIDEBAR: FULL HEIGHT / FIXED VISUAL PANEL
# ============================================================
$oldSidebar = 'className="relative flex min-h-[420px] flex-col border-t bg-gray-50 px-5 py-6 pb-32 lg:col-start-2 lg:row-start-2 lg:border-l lg:border-t-0"'

$newSidebar = 'className="relative flex min-h-0 flex-col border-t bg-gray-50 px-6 py-6 lg:col-start-2 lg:row-start-2 lg:border-l lg:border-t-0"'

if (-not $merge.Contains($oldSidebar)) {
    throw "Expected right sidebar layout not found. FILES NOT CHANGED."
}

$merge = $merge.Replace($oldSidebar, $newSidebar)

Write-Host "[OK] Right control panel aligned to full workspace height" -ForegroundColor Green

# ============================================================
# SAFETY CHECKS
# ============================================================
if ($merge.Contains("fixed bottom-5 left-1/2")) {
    throw "Floating fixed button detected. FILES NOT CHANGED."
}

if ($merge.Contains("sticky bottom-0")) {
    throw "Sticky viewport button detected. FILES NOT CHANGED."
}

if (-not $merge.Contains("onClick={onUnlockMerge}")) {
    throw "Merge handler missing. FILES NOT CHANGED."
}

if (-not $merge.Contains("mt-auto pt-6")) {
    throw "Bottom-aligned merge button container missing. FILES NOT CHANGED."
}

# ============================================================
# WRITE UTF-8 WITHOUT BOM
# ============================================================
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    (Resolve-Path $mergePath).Path,
    $merge,
    $utf8NoBom
)

[System.IO.File]::WriteAllText(
    (Resolve-Path $pagePath).Path,
    $page,
    $utf8NoBom
)

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host " MERGE PDF ONE-PAGE 90% LAYOUT COMPLETE" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[OK] Workspace width = approximately 90vw"
Write-Host "[OK] Controlled one-page workspace height"
Write-Host "[OK] Left PDF area scrolls internally"
Write-Host "[OK] Right panel remains visually fixed"
Write-Host "[OK] Unlock & Merge remains inside right panel"
Write-Host "[OK] No floating button"
Write-Host "[OK] Merge logic unchanged"
Write-Host "[OK] Password logic unchanged"
Write-Host "[OK] Validation logic unchanged"
Write-Host "[OK] Homepage unchanged"
Write-Host "[OK] No Git commands"
Write-Host "[OK] No deployment"
Write-Host ""
Write-Host "Backup:"
Write-Host "$backupDir"
Write-Host ""