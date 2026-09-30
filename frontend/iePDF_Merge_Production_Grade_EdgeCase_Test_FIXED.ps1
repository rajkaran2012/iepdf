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

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " iePDF MERGE PDF - PRODUCTION-GRADE EDGE-CASE TEST" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Project : $ProjectRoot"
Write-Host "Report  : $ReportFile"
Write-Host ""

# 01 Required files
Write-Host "=== 01. REQUIRED FILES ===" -ForegroundColor Yellow

$requiredFiles = @(
    @("PRE-01", "MergeWorkspace.tsx", $WorkspaceFile),
    @("PRE-02", "Merge page.tsx", $PageFile),
    @("PRE-03", "Validation constants", $ConstantsFile)
)

foreach ($item in $requiredFiles) {
    if (Test-Path $item[2]) {
        Add-Result $item[0] "Preflight" "Required $($item[1])" "PASS"
    }
    else {
        Add-Result $item[0] "Preflight" "Required $($item[1])" "FAIL" "Missing: $($item[2])"
    }
}

if (!(Test-Path $WorkspaceFile) -or !(Test-Path $PageFile) -or !(Test-Path $ConstantsFile)) {
    throw "Required source files are missing. STOP."
}

$ws = [IO.File]::ReadAllText((Resolve-Path $WorkspaceFile))
$page = [IO.File]::ReadAllText((Resolve-Path $PageFile))
$constants = [IO.File]::ReadAllText((Resolve-Path $ConstantsFile))

# 02 Frozen UI invariants
Write-Host ""
Write-Host "=== 02. FROZEN UI INVARIANTS ===" -ForegroundColor Yellow

if ($ws -match 'h-\[calc\(100vh-205px\)\]' -and $ws -match 'w-full\s+max-w-none') {
    Add-Result "UI-01" "Frozen UI" "Full one-page Merge workspace sizing" "PASS"
}
else {
    Add-Result "UI-01" "Frozen UI" "Full one-page Merge workspace sizing" "FAIL"
}

if ($ws -match 'Unlock\s*&amp;\s*Merge|Unlock\s*&\s*Merge') {
    Add-Result "UI-02" "Frozen UI" "Primary Unlock and Merge action exists" "PASS"
}
else {
    Add-Result "UI-02" "Frozen UI" "Primary Unlock and Merge action exists" "FAIL"
}

if ($ws -match 'Drop PDFs here' -and $ws -match 'Add PDF Files') {
    Add-Result "UI-03" "Frozen UI" "Add PDF and drop-zone labels" "PASS"
}
else {
    Add-Result "UI-03" "Frozen UI" "Add PDF and drop-zone labels" "FAIL"
}

if ($ws -match 'Drag PDF \$\{index \+ 1\} to reorder' -and
    $ws -match 'files\.length\s*>\s*1' -and
    $ws -match 'cursor-grab') {
    Add-Result "UI-04" "Frozen UI" "Reorder handle and 2+ visibility rule" "PASS"
}
else {
    Add-Result "UI-04" "Frozen UI" "Reorder handle and 2+ visibility rule" "FAIL"
}

# 03 Security and validation
Write-Host ""
Write-Host "=== 03. SECURITY / VALIDATION INVARIANTS ===" -ForegroundColor Yellow

if ($constants -match '15\s*\*\s*1024\s*\*\s*1024') {
    Add-Result "SEC-01" "Security" "Authoritative 15 MiB boundary expression" "PASS"
}
else {
    Add-Result "SEC-01" "Security" "Authoritative 15 MiB boundary expression" "FAIL"
}

if ($page -match 'MAX_FILE_SIZE_BYTES') {
    Add-Result "SEC-02" "Security" "Merge page uses authoritative file-size constant" "PASS"
}
else {
    Add-Result "SEC-02" "Security" "Merge page uses authoritative file-size constant" "FAIL"
}

if ($ws -match 'application/x-iepdf-reorder') {
    Add-Result "SEC-03" "Security" "Internal reorder MIME isolation marker" "PASS"
}
else {
    Add-Result "SEC-03" "Security" "Internal reorder MIME isolation marker" "FAIL"
}

if ($page -notmatch '(?i)bypass.*Launch|disable.*validator|ignore.*security') {
    Add-Result "SEC-04" "Security" "No obvious security bypass in Merge page" "PASS"
}
else {
    Add-Result "SEC-04" "Security" "No obvious security bypass in Merge page" "FAIL"
}

# 04 Drag/drop isolation
Write-Host ""
Write-Host "=== 04. DRAG / DROP ISOLATION ===" -ForegroundColor Yellow

if ($ws -match 'event\.dataTransfer\.types\.includes\(\s*"application/x-iepdf-reorder"\s*\)' -and
    $ws -match 'event\.stopPropagation\(\)') {
    Add-Result "DD-01" "Drag/Drop" "Row handler distinguishes internal reorder" "PASS"
}
else {
    Add-Result "DD-01" "Drag/Drop" "Row handler distinguishes internal reorder" "FAIL"
}

if ($page -match 'event\.dataTransfer\.types\.includes\(\s*"application/x-iepdf-reorder"\s*\)') {
    Add-Result "DD-02" "Drag/Drop" "Workspace handlers recognize internal reorder" "PASS"
}
else {
    Add-Result "DD-02" "Drag/Drop" "Workspace handlers recognize internal reorder" "FAIL"
}

if ($page -match 'handleWorkspaceDragEnter' -and
    $page -match 'handleWorkspaceDragOver' -and
    $page -match 'handleWorkspaceDragLeave' -and
    $page -match 'handleWorkspaceDrop') {
    Add-Result "DD-03" "Drag/Drop" "External workspace drop lifecycle exists" "PASS"
}
else {
    Add-Result "DD-03" "Drag/Drop" "External workspace drop lifecycle exists" "FAIL"
}

# 05 Functional invariants
Write-Host ""
Write-Host "=== 05. FUNCTIONAL INVARIANTS ===" -ForegroundColor Yellow

$functions = @(
    @("FUNC-01", "Add file processing", "processSelectedFiles"),
    @("FUNC-02", "Remove file handling", "handleRemoveFile"),
    @("FUNC-03", "Reorder handler", "handleReorderFiles"),
    @("FUNC-04", "Merge action", "handleUnlockMerge"),
    @("FUNC-05", "Password handling", "handlePasswordChange"),
    @("FUNC-06", "Skip file handling", "handleSkipFile")
)

foreach ($item in $functions) {
    if ($page -match [regex]::Escape($item[2])) {
        Add-Result $item[0] "Functionality" $item[1] "PASS"
    }
    else {
        Add-Result $item[0] "Functionality" $item[1] "FAIL"
    }
}

# 06 Existing regression artifact
Write-Host ""
Write-Host "=== 06. EXISTING REGRESSION ARTIFACTS ===" -ForegroundColor Yellow

$oldReport = Join-Path $ReportDir "merge-regression-report.txt"
if (Test-Path $oldReport) {
    Add-Result "REG-01" "Regression" "Existing Merge regression report present" "PASS" $oldReport
}
else {
    Add-Result "REG-01" "Regression" "Existing Merge regression report present" "SKIPPED" "No prior report found."
}

# 07 TypeScript
Write-Host ""
Write-Host "=== 07. TYPESCRIPT ===" -ForegroundColor Yellow

try {
    & pnpm exec tsc --noEmit
    if ($LASTEXITCODE -eq 0) {
        Add-Result "BUILD-01" "Build" "TypeScript noEmit check" "PASS"
    }
    else {
        Add-Result "BUILD-01" "Build" "TypeScript noEmit check" "FAIL" "Exit code $LASTEXITCODE"
    }
}
catch {
    Add-Result "BUILD-01" "Build" "TypeScript noEmit check" "FAIL" $_.Exception.Message
}

# 08 Production build
Write-Host ""
Write-Host "=== 08. PRODUCTION BUILD ===" -ForegroundColor Yellow

try {
    & pnpm build
    if ($LASTEXITCODE -eq 0) {
        Add-Result "BUILD-02" "Build" "Next.js production build" "PASS"
    }
    else {
        Add-Result "BUILD-02" "Build" "Next.js production build" "FAIL" "Exit code $LASTEXITCODE"
    }
}
catch {
    Add-Result "BUILD-02" "Build" "Next.js production build" "FAIL" $_.Exception.Message
}

# 09 Browser capability
Write-Host ""
Write-Host "=== 09. BROWSER TEST CAPABILITY ===" -ForegroundColor Yellow

$playwrightCli = Join-Path $ProjectRoot "node_modules\@playwright\test\cli.js"

if (Test-Path $playwrightCli) {
    Add-Result "BROWSER-01" "Browser" "Playwright package installed" "PASS"
}
else {
    Add-Result "BROWSER-01" "Browser" "Playwright package installed" "SKIPPED" "Playwright CLI not found."
}

$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$chrome = $chromePaths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if ($chrome) {
    Add-Result "BROWSER-02" "Browser" "Google Chrome detected" "PASS" $chrome
}
else {
    Add-Result "BROWSER-02" "Browser" "Google Chrome detected" "SKIPPED" "Chrome not found in standard paths."
}

# 10 Local server smoke
Write-Host ""
Write-Host "=== 10. LOCAL BROWSER SMOKE ===" -ForegroundColor Yellow
Write-Host "This test does not start or stop your dev server."

$localOk = $false

try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/merge-pdf" -UseBasicParsing -TimeoutSec 5

    if ($response.StatusCode -eq 200) {
        $localOk = $true
        Add-Result "BROWSER-03" "Browser" "Local Merge PDF page responds" "PASS"
    }
    else {
        Add-Result "BROWSER-03" "Browser" "Local Merge PDF page responds" "FAIL" "HTTP $($response.StatusCode)"
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

    $specText = @'
const { test, expect } = require("@playwright/test");

test("Merge PDF page loads with drop zone", async ({ page }) => {
  await page.goto("http://127.0.0.1:3000/merge-pdf");
  await expect(page.getByText("Drop PDFs here")).toBeVisible();
});

test("Merge PDF page shows PDF files section", async ({ page }) => {
  await page.goto("http://127.0.0.1:3000/merge-pdf");
  await expect(page.getByText("PDF files")).toBeVisible();
});
'@

    Set-Content -Path $spec -Value $specText -Encoding UTF8

    try {
        & node $playwrightCli test $spec --reporter=line

        if ($LASTEXITCODE -eq 0) {
            Add-Result "BROWSER-04" "Browser" "Playwright Merge UI smoke tests" "PASS"
        }
        else {
            Add-Result "BROWSER-04" "Browser" "Playwright Merge UI smoke tests" "FAIL" "Exit code $LASTEXITCODE"
        }
    }
    catch {
        Add-Result "BROWSER-04" "Browser" "Playwright Merge UI smoke tests" "FAIL" $_.Exception.Message
    }
}
else {
    Add-Result "BROWSER-04" "Browser" "Playwright Merge UI smoke tests" "SKIPPED" "Requires local server and Playwright."
}

# 11 Final report
$pass = @($Results | Where-Object { $_.Status -eq "PASS" }).Count
$fail = @($Results | Where-Object { $_.Status -eq "FAIL" }).Count
$skip = @($Results | Where-Object { $_.Status -eq "SKIPPED" }).Count
$info = @($Results | Where-Object { $_.Status -eq "INFO" }).Count

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("iePDF Merge PDF - Production-Grade Edge-Case Test")
$lines.Add("Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$lines.Add("Project: $ProjectRoot")
$lines.Add("")
$lines.Add("PASS=$pass FAIL=$fail SKIPPED=$skip INFO=$info")
$lines.Add("")
$lines.Add("RESULTS")
$lines.Add("-------")

foreach ($x in $Results) {
    if ([string]::IsNullOrWhiteSpace($x.Details)) {
        $detail = ""
    }
    else {
        $detail = " | " + $x.Details
    }

    $lines.Add(
        $x.Status + " " + $x.ID + " [" + $x.Area + "] " +
        $x.Description + $detail
    )
}

$lines.Add("")
$lines.Add("SAFETY")
$lines.Add("------")
$lines.Add("No source modification performed by this orchestrator.")
$lines.Add("No deployment performed.")
$lines.Add("No git reset, clean, stash or push performed.")
$lines.Add("Frozen Merge UI and security logic were not changed.")

[IO.File]::WriteAllLines($ReportFile, $lines, $enc)

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " FINAL RESULT" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "PASS=$pass FAIL=$fail SKIPPED=$skip INFO=$info"

if ($fail -eq 0) {
    Write-Host "EDGE-CASE TEST ORCHESTRATOR: PASS" -ForegroundColor Green
}
else {
    Write-Host "EDGE-CASE TEST ORCHESTRATOR: FAIL - review report before changing code." -ForegroundColor Red
}

Write-Host "Report: $ReportFile"
Write-Host ""
Write-Host "NO SOURCE CHANGES. NO LIVE DEPLOYMENT." -ForegroundColor Green
