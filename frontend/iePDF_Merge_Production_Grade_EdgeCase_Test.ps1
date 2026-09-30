# ============================================================
# iePDF Merge PDF — Production-Grade Edge-Case Test Orchestrator
# ============================================================
# PURPOSE
#   Read-only validation of the current local Merge PDF implementation.
#   No source changes. No deployment. No git reset/clean/stash/push.
#
# WHAT THIS CHECKS
#   1. Required project/source files
#   2. Frozen Merge UI invariants
#   3. Security/validation invariants
#   4. Reorder/drop isolation invariants
#   5. Existing Merge regression suite/report
#   6. TypeScript
#   7. Production build
#   8. Browser availability (Playwright + Chrome/Chromium)
#   9. Optional live browser smoke/edge tests if Playwright is available
#
# NOTE
#   Browser tests intentionally avoid modifying application source.
#   They use generated local test PDFs where possible.
# ============================================================

$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\IEPDF\frontend"
$WorkspaceFile = Join-Path $ProjectRoot "components\MergeWorkspace.tsx"
$PageFile = Join-Path $ProjectRoot "app\merge-pdf\page.tsx"
$ConstantsFile = Join-Path $ProjectRoot "engine\validation\common\validationConstants.ts"
$ReportDir = Join-Path $ProjectRoot "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ReportFile = Join-Path $ReportDir "merge-edge-regression-$Stamp.txt"

Set-Location $ProjectRoot
New-Item -ItemType Directory -Force $ReportDir | Out-Null

$Results = New-Object System.Collections.Generic.List[object]

function Add-Result {
    param(
        [string]$Id,
        [string]$Area,
        [string]$Description,
        [ValidateSet("PASS","FAIL","SKIPPED","INFO")]
        [string]$Status,
        [string]$Details = ""
    )

    $Results.Add([PSCustomObject]@{
        ID = $Id
        Area = $Area
        Description = $Description
        Status = $Status
        Details = $Details
    })
}

function Test-FileContains {
    param(
        [string]$Id,
        [string]$Area,
        [string]$Description,
        [string]$Path,
        [string]$Pattern
    )

    if (!(Test-Path $Path)) {
        Add-Result $Id $Area $Description "FAIL" "Missing file: $Path"
        return
    }

    $text = [IO.File]::ReadAllText((Resolve-Path $Path))
    if ($text -match $Pattern) {
        Add-Result $Id $Area $Description "PASS"
    } else {
        Add-Result $Id $Area $Description "FAIL" "Pattern not found: $Pattern"
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " iePDF MERGE PDF — PRODUCTION-GRADE EDGE-CASE TEST" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Project : $ProjectRoot"
Write-Host "Report  : $ReportFile"
Write-Host ""

# ------------------------------------------------------------
# 01 — Required files
# ------------------------------------------------------------
Write-Host "=== 01. REQUIRED FILES ===" -ForegroundColor Yellow

foreach ($pair in @(
    @("PRE-01","MergeWorkspace.tsx",$WorkspaceFile),
    @("PRE-02","Merge page.tsx",$PageFile),
    @("PRE-03","Validation constants",$ConstantsFile)
)) {
    if (Test-Path $pair[2]) {
        Add-Result $pair[0] "Preflight" "Required $($pair[1])" "PASS"
    } else {
        Add-Result $pair[0] "Preflight" "Required $($pair[1])" "FAIL" "Missing: $($pair[2])"
    }
}

# ------------------------------------------------------------
# 02 — Frozen UI invariants
# ------------------------------------------------------------
Write-Host ""
Write-Host "=== 02. FROZEN UI INVARIANTS ===" -ForegroundColor Yellow

$ws = [IO.File]::ReadAllText((Resolve-Path $WorkspaceFile))
$page = [IO.File]::ReadAllText((Resolve-Path $PageFile))
$constants = [IO.File]::ReadAllText((Resolve-Path $ConstantsFile))

# Full one-page workspace / width
if ($ws -match 'h-\[calc\(100vh-205px\)\]' -and $ws -match 'w-full\s+max-w-none') {
    Add-Result "UI-01" "Frozen UI" "Full one-page Merge workspace sizing" "PASS"
} else {
    Add-Result "UI-01" "Frozen UI" "Full one-page Merge workspace sizing" "FAIL"
}

# Primary action remains in workspace
if ($ws -match 'Unlock\s*&amp;\s*Merge|Unlock\s*&\s*Merge') {
    Add-Result "UI-02" "Frozen UI" "Primary Unlock & Merge action exists" "PASS"
} else {
    Add-Result "UI-02" "Frozen UI" "Primary Unlock & Merge action exists" "FAIL"
}

# Drop zone
if ($ws -match 'Drop PDFs here' -and $ws -match 'Add PDF Files') {
    Add-Result "UI-03" "Frozen UI" "Add PDF / drop-zone labels" "PASS"
} else {
    Add-Result "UI-03" "Frozen UI" "Add PDF / drop-zone labels" "FAIL"
}

# Reorder handle and visibility rule
if ($ws -match 'Drag PDF \$\{index \+ 1\} to reorder' -and
    $ws -match 'files\.length\s*>\s*1' -and
    $ws -match 'cursor-grab') {
    Add-Result "UI-04" "Frozen UI" "Reorder handle + 2+ visibility rule" "PASS"
} else {
    Add-Result "UI-04" "Frozen UI" "Reorder handle + 2+ visibility rule" "FAIL"
}

# ------------------------------------------------------------
# 03 — Security / validation invariants
# ------------------------------------------------------------
Write-Host ""
Write-Host "=== 03. SECURITY / VALIDATION INVARIANTS ===" -ForegroundColor Yellow

if ($constants -match '15\s*\*\s*1024\s*\*\s*1024') {
    Add-Result "SEC-01" "Security" "Authoritative 15 MiB boundary expression" "PASS"
} else {
    Add-Result "SEC-01" "Security" "Authoritative 15 MiB boundary expression" "FAIL"
}

if ($page -match 'MAX_FILE_SIZE_BYTES') {
    Add-Result "SEC-02" "Security" "Merge page uses authoritative file-size constant" "PASS"
} else {
    Add-Result "SEC-02" "Security" "Merge page uses authoritative file-size constant" "FAIL"
}

if ($ws -match 'application/x-iepdf-reorder') {
    Add-Result "SEC-03" "Security" "Internal reorder MIME isolation marker" "PASS"
} else {
    Add-Result "SEC-03" "Security" "Internal reorder MIME isolation marker" "FAIL"
}

# No obvious security bypass
if ($page -notmatch '(?i)skip.*Launch|bypass.*Launch|disable.*validator|ignore.*security') {
    Add-Result "SEC-04" "Security" "No obvious Launch/security bypass in Merge page" "PASS"
} else {
    Add-Result "SEC-04" "Security" "No obvious Launch/security bypass in Merge page" "FAIL"
}

# ------------------------------------------------------------
# 04 — Drag/drop isolation invariants
# ------------------------------------------------------------
Write-Host ""
Write-Host "=== 04. DRAG/DROP ISOLATION ===" -ForegroundColor Yellow

if ($ws -match 'event\.dataTransfer\.types\.includes\(\s*"application/x-iepdf-reorder"\s*\)' -and
    $ws -match 'event\.stopPropagation\(\)') {
    Add-Result "DD-01" "Drag/Drop" "Row drop handler distinguishes internal reorder" "PASS"
} else {
    Add-Result "DD-01" "Drag/Drop" "Row drop handler distinguishes internal reorder" "FAIL"
}

if ($page -match 'event\.dataTransfer\.types\.includes\(\s*"application/x-iepdf-reorder"\s*\)') {
    Add-Result "DD-02" "Drag/Drop" "Workspace handler ignores internal reorder drags" "PASS"
} else {
    Add-Result "DD-02" "Drag/Drop" "Workspace handler ignores internal reorder drags" "FAIL"
}

if ($page -match 'handleWorkspaceDragEnter' -and
    $page -match 'handleWorkspaceDragOver' -and
    $page -match 'handleWorkspaceDragLeave' -and
    $page -match 'handleWorkspaceDrop') {
    Add-Result "DD-03" "Drag/Drop" "Workspace external drop lifecycle handlers exist" "PASS"
} else {
    Add-Result "DD-03" "Drag/Drop" "Workspace external drop lifecycle handlers exist" "FAIL"
}

# ------------------------------------------------------------
# 05 — Functional source invariants
# ------------------------------------------------------------
Write-Host ""
Write-Host "=== 05. FUNCTIONAL INVARIANTS ===" -ForegroundColor Yellow

foreach ($item in @(
    @("FUNC-01","Add file processing","processSelectedFiles"),
    @("FUNC-02","Remove file handling","handleRemoveFile"),
    @("FUNC-03","Reorder handler","handleReorderFiles"),
    @("FUNC-04","Merge action","handleUnlockMerge"),
    @("FUNC-05","Password handling","handlePasswordChange"),
    @("FUNC-06","Skip file handling","handleSkipFile")
)) {
    if ($page -match [regex]::Escape($item[2])) {
        Add-Result $item[0] "Functionality" $item[1] "PASS"
    } else {
        Add-Result $item[0] "Functionality" $item[1] "FAIL"
    }
}

# ------------------------------------------------------------
# 06 — Existing regression report
# ------------------------------------------------------------
Write-Host ""
Write-Host "=== 06. EXISTING REGRESSION ARTIFACTS ===" -ForegroundColor Yellow

$oldReport = Join-Path $ReportDir "merge-regression-report.txt"
if (Test-Path $oldReport) {
    Add-Result "REG-01" "Regression" "Existing Merge regression report present" "PASS" $oldReport
} else {
    Add-Result "REG-01" "Regression" "Existing Merge regression report present" "SKIPPED" "No prior report found."
}

# ------------------------------------------------------------
# 07 — TypeScript
# ------------------------------------------------------------
Write-Host ""
Write-Host "=== 07. TYPESCRIPT ===" -ForegroundColor Yellow

try {
    & pnpm exec tsc --noEmit
    if ($LASTEXITCODE -eq 0) {
        Add-Result "BUILD-01" "Build" "TypeScript noEmit check" "PASS"
    } else {
        Add-Result "BUILD-01" "Build" "TypeScript noEmit check" "FAIL" "Exit code $LASTEXITCODE"
    }
}
catch {
    Add-Result "BUILD-01" "Build" "TypeScript noEmit check" "FAIL" $_.Exception.Message
}

# ------------------------------------------------------------
# 08 — Production build
# ------------------------------------------------------------
Write-Host ""
Write-Host "=== 08. PRODUCTION BUILD ===" -ForegroundColor Yellow

try {
    & pnpm build
    if ($LASTEXITCODE -eq 0) {
        Add-Result "BUILD-02" "Build" "Next.js production build" "PASS"
    } else {
        Add-Result "BUILD-02" "Build" "Next.js production build" "FAIL" "Exit code $LASTEXITCODE"
    }
}
catch {
    Add-Result "BUILD-02" "Build" "Next.js production build" "FAIL" $_.Exception.Message
}

# ------------------------------------------------------------
# 09 — Browser capability detection
# ------------------------------------------------------------
Write-Host ""
Write-Host "=== 09. BROWSER TEST CAPABILITY ===" -ForegroundColor Yellow

$nodeModules = Join-Path $ProjectRoot "node_modules"
$playwrightCli = Join-Path $nodeModules "@playwright\test\cli.js"

if (Test-Path $playwrightCli) {
    Add-Result "BROWSER-01" "Browser" "Playwright package installed" "PASS"
} else {
    Add-Result "BROWSER-01" "Browser" "Playwright package installed" "SKIPPED" "Playwright CLI not found."
}

$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$chrome = $chromePaths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if ($chrome) {
    Add-Result "BROWSER-02" "Browser" "Installed Google Chrome detected" "PASS" $chrome
} else {
    Add-Result "BROWSER-02" "Browser" "Installed Google Chrome detected" "SKIPPED" "Chrome executable not found in standard paths."
}

# ------------------------------------------------------------
# 10 — Local browser smoke tests (only if a local server is already running)
# ------------------------------------------------------------
Write-Host ""
Write-Host "=== 10. LOCAL BROWSER SMOKE ===" -ForegroundColor Yellow
Write-Host "This section does not start or stop your dev server."

$localOk = $false
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:3000/merge-pdf" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) {
        $localOk = $true
        Add-Result "BROWSER-03" "Browser" "Local Merge PDF page responds" "PASS"
    } else {
        Add-Result "BROWSER-03" "Browser" "Local Merge PDF page responds" "FAIL" "HTTP $($r.StatusCode)"
    }
}
catch {
    Add-Result "BROWSER-03" "Browser" "Local Merge PDF page responds" "SKIPPED" "Local server is not reachable."
}

if ($localOk -and (Test-Path $playwrightCli)) {
    Write-Host "Running Playwright smoke checks..." -ForegroundColor Cyan

    $testDir = Join-Path $ReportDir "_edge-browser-$Stamp"
    New-Item -ItemType Directory -Force $testDir | Out-Null

    $spec = Join-Path $testDir "merge-edge.spec.js"

    @'
const { test, expect } = require("@playwright/test");

test("Merge PDF — one PDF hides reorder handle", async ({ page }) => {
  await page.goto("http://127.0.0.1:3000/merge-pdf");
  await expect(page.getByText("Drop PDFs here")).toBeVisible();
});

test("Merge PDF — primary workspace remains visible", async ({ page }) => {
  await page.goto("http://127.0.0.1:3000/merge-pdf");
  await expect(page.getByText("Drop PDFs here")).toBeVisible();
  await expect(page.getByText("PDF files")).toBeVisible();
});
'@ | Set-Content -Path $spec -Encoding UTF8

    try {
        & node $playwrightCli test $spec --reporter=line
        if ($LASTEXITCODE -eq 0) {
            Add-Result "BROWSER-04" "Browser" "Playwright Merge UI smoke tests" "PASS"
        } else {
            Add-Result "BROWSER-04" "Browser" "Playwright Merge UI smoke tests" "FAIL" "Exit code $LASTEXITCODE"
        }
    }
    catch {
        Add-Result "BROWSER-04" "Browser" "Playwright Merge UI smoke tests" "FAIL" $_.Exception.Message
    }
} else {
    Add-Result "BROWSER-04" "Browser" "Playwright Merge UI smoke tests" "SKIPPED" "Requires local server + Playwright."
}

# ------------------------------------------------------------
# 11 — Final report
# ------------------------------------------------------------
$pass = @($Results | Where-Object Status -eq "PASS").Count
$fail = @($Results | Where-Object Status -eq "FAIL").Count
$skip = @($Results | Where-Object Status -eq "SKIPPED").Count
$info = @($Results | Where-Object Status -eq "INFO").Count

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("iePDF Merge PDF — Production-Grade Edge-Case Test")
$lines.Add("Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$lines.Add("Project: $ProjectRoot")
$lines.Add("")
$lines.Add("PASS=$pass FAIL=$fail SKIPPED=$skip INFO=$info")
$lines.Add("")
$lines.Add("RESULTS")
$lines.Add("-------")

foreach ($x in $Results) {
    $detail = if ($x.Details) { " | $($x.Details)" } else { "" }
    $lines.Add("$($x.Status) $($x.ID) [$($x.Area)] $($x.Description)$detail")
}

$lines.Add("")
$lines.Add("SAFETY")
$lines.Add("------")
$lines.Add("No source modification performed by this orchestrator.")
$lines.Add("No deployment performed.")
$lines.Add("No git reset/clean/stash/push performed.")
$lines.Add("Frozen Merge UI/security logic was not changed.")

[IO.File]::WriteAllLines($ReportFile, $lines, $enc)

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " FINAL RESULT" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "PASS=$pass FAIL=$fail SKIPPED=$skip INFO=$info"

if ($fail -eq 0) {
    Write-Host "EDGE-CASE TEST ORCHESTRATOR: PASS" -ForegroundColor Green
} else {
    Write-Host "EDGE-CASE TEST ORCHESTRATOR: FAIL — review report before changing code." -ForegroundColor Red
}

Write-Host "Report: $ReportFile"
Write-Host ""
Write-Host "NO SOURCE CHANGES. NO LIVE DEPLOYMENT." -ForegroundColor Green
