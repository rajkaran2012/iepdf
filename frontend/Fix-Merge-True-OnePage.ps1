$ErrorActionPreference = "Stop"

$layoutPath = ".\components\layout\ToolLayout.tsx"
$pagePath   = ".\app\merge-pdf\page.tsx"
$mergePath  = ".\components\MergeWorkspace.tsx"

$layoutFull = (Resolve-Path $layoutPath).Path
$pageFull   = (Resolve-Path $pagePath).Path
$mergeFull  = (Resolve-Path $mergePath).Path

Write-Host "Applying final Merge PDF one-page structure..." -ForegroundColor Cyan

$enc = [System.Text.Encoding]::UTF8

$layout = [System.IO.File]::ReadAllText($layoutFull, $enc)
$page   = [System.IO.File]::ReadAllText($pageFull, $enc)
$merge  = [System.IO.File]::ReadAllText($mergeFull, $enc)

# ============================================================
# VERIFY ORIGINAL STRUCTURE
# ============================================================

$checks = @(
    @{ Name="ToolLayout interface"; Text='interface ToolLayoutProps {'; Source=$layout },
    @{ Name="ToolLayout container"; Text='className="mx-auto max-w-5xl px-4 py-12"'; Source=$layout },
    @{ Name="ToolLayout card"; Text='className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"'; Source=$layout },
    @{ Name="Merge ToolLayout"; Text='<ToolLayout'; Source=$page },
    @{ Name="Merge workspace width"; Text='w-[90vw]'; Source=$merge },
    @{ Name="Merge internal scroll"; Text='overflow-y-auto p-6 lg:col-start-1'; Source=$merge },
    @{ Name="Merge button"; Text='onClick={onUnlockMerge}'; Source=$merge },
    @{ Name="Bottom button"; Text='mt-auto pt-6'; Source=$merge }
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

$backupDir = ".\_ui-backups\merge-true-onepage-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

Copy-Item $layoutFull "$backupDir\ToolLayout.tsx" -Force
Copy-Item $pageFull   "$backupDir\merge-pdf-page.tsx" -Force
Copy-Item $mergeFull  "$backupDir\MergeWorkspace.tsx" -Force

# ============================================================
# TOOLLAYOUT
# Add optional wide mode.
# Existing tools remain exactly as before.
# ============================================================

$oldInterface = @'
interface ToolLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}
'@

$newInterface = @'
interface ToolLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
}
'@

$layout = $layout.Replace($oldInterface, $newInterface)

$oldSignature = @'
export default function ToolLayout({
  title,
  description,
  children,
}: ToolLayoutProps) {
'@

$newSignature = @'
export default function ToolLayout({
  title,
  description,
  children,
  wide = false,
}: ToolLayoutProps) {
'@

if (-not $layout.Contains($oldSignature)) {
    throw "ToolLayout function signature not found. FILES NOT CHANGED."
}

$layout = $layout.Replace($oldSignature, $newSignature)

$oldContainer = '<div className="mx-auto max-w-5xl px-4 py-12">'

$newContainer = '<div className={wide ? "mx-auto w-full px-4 py-6" : "mx-auto max-w-5xl px-4 py-12"}>'

$layout = $layout.Replace($oldContainer, $newContainer)

$oldTitle = '<div className="mb-10 text-center">'

$newTitle = '<div className={wide ? "mb-5 text-center" : "mb-10 text-center"}>'

$layout = $layout.Replace($oldTitle, $newTitle)

$oldCard = '<div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">'

$newCard = '<div className={wide ? "w-full" : "rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"}>'

$layout = $layout.Replace($oldCard, $newCard)

Write-Host "[OK] ToolLayout wide mode added without affecting normal tools" -ForegroundColor Green

# ============================================================
# MERGE PAGE
# Use wide mode only here.
# ============================================================

$oldToolLayout = @'
    <ToolLayout
      title="Merge PDF"
      description="Combine multiple PDF files into a single PDF securely and instantly."
    >
'@

$newToolLayout = @'
    <ToolLayout
      title="Merge PDF"
      description="Combine multiple PDF files into a single PDF securely and instantly."
      wide
    >
'@

if (-not $page.Contains($oldToolLayout)) {
    throw "Merge ToolLayout block not found. FILES NOT CHANGED."
}

$page = $page.Replace($oldToolLayout, $newToolLayout)

# Compact the area containing the Select button.
$oldPageWrapper = '<div className="flex w-full flex-col items-center justify-start py-4">'

$newPageWrapper = '<div className="flex w-full flex-col items-center justify-start">'

if (-not $page.Contains($oldPageWrapper)) {
    throw "Merge page wrapper not found. FILES NOT CHANGED."
}

$page = $page.Replace($oldPageWrapper, $newPageWrapper)

Write-Host "[OK] Merge PDF now uses wide ToolLayout" -ForegroundColor Green
Write-Host "[OK] Upload area made compact" -ForegroundColor Green

# ============================================================
# MERGE WORKSPACE
# Reduce height slightly so it fits beneath title/upload area.
# ============================================================

$oldWorkspace = 'h-[calc(100vh-270px)] min-h-[520px] w-[90vw]'

$newWorkspace = 'h-[calc(100vh-260px)] min-h-[430px] w-[90vw]'

if (-not $merge.Contains($oldWorkspace)) {
    throw "Current Merge workspace sizing not found. FILES NOT CHANGED."
}

$merge = $merge.Replace($oldWorkspace, $newWorkspace)

Write-Host "[OK] Workspace height optimized for one-screen layout" -ForegroundColor Green

# ============================================================
# COMPACT RIGHT SUMMARY
# ============================================================

$merge = $merge.Replace(
    'className="grid grid-cols-2 gap-3"',
    'className="grid grid-cols-2 gap-2.5"'
)

$merge = $merge.Replace(
    'className="rounded-2xl bg-white p-5 text-center shadow-sm"',
    'className="rounded-xl bg-white p-3 text-center shadow-sm"'
)

$merge = $merge.Replace(
    'className="text-3xl font-bold"',
    'className="text-2xl font-bold"'
)

$merge = $merge.Replace(
    'className="mt-2 text-gray-500"',
    'className="mt-1 text-sm text-gray-500"'
)

Write-Host "[OK] Summary cards compacted" -ForegroundColor Green

# ============================================================
# SAFETY
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

if (-not $page.Contains('wide')) {
    throw "Merge wide mode missing. FILES NOT CHANGED."
}

# ============================================================
# WRITE UTF-8 WITHOUT BOM
# ============================================================

$noBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText($layoutFull, $layout, $noBom)
[System.IO.File]::WriteAllText($pageFull, $page, $noBom)
[System.IO.File]::WriteAllText($mergeFull, $merge, $noBom)

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host " MERGE PDF TRUE ONE-PAGE LAYOUT COMPLETE" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[OK] Merge only uses wide ToolLayout"
Write-Host "[OK] Normal tools unchanged"
Write-Host "[OK] Workspace approximately 90vw"
Write-Host "[OK] Compact page spacing"
Write-Host "[OK] Compact summary"
Write-Host "[OK] Left workspace internally scrollable"
Write-Host "[OK] Right panel full height"
Write-Host "[OK] Unlock & Merge bottom aligned"
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
Write-Host ""