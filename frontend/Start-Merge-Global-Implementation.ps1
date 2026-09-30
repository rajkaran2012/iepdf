$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " iePDF - MERGE GLOBAL STANDARD BASELINE + ENGINE AUDIT" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$frontend = (Get-Location).Path

$requiredFiles = @(
    ".\app\merge-pdf\page.tsx",
    ".\components\MergeWorkspace.tsx",
    ".\components\layout\ToolLayout.tsx"
)

Write-Host "[1/6] Checking frontend..." -ForegroundColor Yellow

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        throw "Required file missing: $file"
    }
}

Write-Host "[OK] Frontend files found." -ForegroundColor Green
Write-Host ""

# ------------------------------------------------------------
# Locate BrowserMergeProcessor
# ------------------------------------------------------------

Write-Host "[2/6] Locating BrowserMergeProcessor..." -ForegroundColor Yellow

$processorMatches = Get-ChildItem `
    -Path $frontend `
    -Recurse `
    -File `
    -Include *.ts,*.tsx `
    -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch "\\node_modules\\" -and
        $_.FullName -notmatch "\\.next\\" -and
        $_.FullName -notmatch "\\_ui-backups\\"
    } |
    Select-String -Pattern "BrowserMergeProcessor" -SimpleMatch

if (-not $processorMatches) {
    throw "BrowserMergeProcessor could not be located."
}

$processorFile = $processorMatches |
    Select-Object -First 1 |
    ForEach-Object { $_.Path }

Write-Host "[OK] Processor found:" -ForegroundColor Green
Write-Host "     $processorFile"
Write-Host ""

# ------------------------------------------------------------
# Create frozen baseline
# ------------------------------------------------------------

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = ".\_ui-backups\MERGE-GLOBAL-BASELINE-$timestamp"

Write-Host "[3/6] Creating frozen baseline..." -ForegroundColor Yellow

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

Copy-Item `
    ".\app\merge-pdf\page.tsx" `
    "$backupDir\merge-pdf-page.tsx" `
    -Force

Copy-Item `
    ".\components\MergeWorkspace.tsx" `
    "$backupDir\MergeWorkspace.tsx" `
    -Force

Copy-Item `
    ".\components\layout\ToolLayout.tsx" `
    "$backupDir\ToolLayout.tsx" `
    -Force

Copy-Item `
    $processorFile `
    "$backupDir\BrowserMergeProcessor.tsx" `
    -Force

Write-Host "[OK] Frozen baseline created:" -ForegroundColor Green
Write-Host "     $backupDir"
Write-Host ""

# ------------------------------------------------------------
# Audit processor capabilities
# ------------------------------------------------------------

Write-Host "[4/6] Auditing current merge engine..." -ForegroundColor Yellow

$processorText = Get-Content -Raw -Encoding UTF8 $processorFile

$signals = [ordered]@{
    "File merge"          = @("files", "merge")
    "File ordering"       = @("order", "sort", "reorder")
    "Page selection"      = @("pages", "pageRange", "pageSelection")
    "Page reordering"     = @("reorderPages", "movePage", "pageOrder")
    "Page deletion"       = @("deletePage", "removePage")
    "Page rotation"       = @("rotate", "rotation")
    "Bookmarks / outline" = @("bookmark", "outline")
    "Table of contents"   = @("table of contents", "toc")
    "Filename footer"     = @("filename", "footer")
    "Cover / title"       = @("cover", "titlePage", "title page")
    "Form fields"         = @("formField", "form field", "AcroForm")
    "Same page size"      = @("pageSize", "same size", "normalize")
    "Password handling"   = @("password", "encrypted", "decrypt")
}

$auditLines = New-Object System.Collections.Generic.List[string]

$auditLines.Add("iePDF Merge Engine Audit")
$auditLines.Add("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$auditLines.Add("Processor: $processorFile")
$auditLines.Add("")
$auditLines.Add("IMPORTANT: These are source-code capability signals, not final feature confirmation.")
$auditLines.Add("A feature will only be considered implemented after functional testing.")
$auditLines.Add("")

foreach ($feature in $signals.Keys) {

    $foundTerms = @()

    foreach ($term in $signals[$feature]) {
        if ($processorText.IndexOf($term, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            $foundTerms += $term
        }
    }

    if ($foundTerms.Count -gt 0) {
        $status = "SIGNAL FOUND"
        $details = ($foundTerms -join ", ")
    }
    else {
        $status = "NO SIGNAL"
        $details = "-"
    }

    $line = "{0,-24} : {1,-14} {2}" -f $feature, $status, $details

    $auditLines.Add($line)

    Write-Host $line
}

Write-Host ""

# ------------------------------------------------------------
# Inspect current MergeWorkspace architecture
# ------------------------------------------------------------

Write-Host "[5/6] Auditing current MergeWorkspace architecture..." -ForegroundColor Yellow

$workspaceText = Get-Content -Raw -Encoding UTF8 ".\components\MergeWorkspace.tsx"

$workspaceChecks = [ordered]@{
    "onUnlockMerge"       = "onUnlockMerge"
    "onRemoveFile"        = "onRemoveFile"
    "onSkipFile"          = "onSkipFile"
    "password handling"   = "onPasswordChange"
    "reorder callback"    = "onReorder"
    "add-files callback"  = "onAddFiles"
    "drag handlers"       = "onDragStart"
    "drop handlers"       = "onDrop"
}

$auditLines.Add("")
$auditLines.Add("Current MergeWorkspace architecture:")

foreach ($name in $workspaceChecks.Keys) {

    $term = $workspaceChecks[$name]

    if ($workspaceText.IndexOf($term, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        $status = "PRESENT"
    }
    else {
        $status = "NOT PRESENT"
    }

    $line = "{0,-24} : {1}" -f $name, $status
    $auditLines.Add($line)

    Write-Host $line
}

# ------------------------------------------------------------
# Save audit
# ------------------------------------------------------------

$auditFile = Join-Path $backupDir "MERGE-ENGINE-AUDIT.txt"

$auditLines | Set-Content -Path $auditFile -Encoding UTF8

Write-Host ""
Write-Host "[6/6] Verifying baseline files..." -ForegroundColor Yellow

$backupFiles = Get-ChildItem $backupDir -File

foreach ($file in $backupFiles) {
    Write-Host "     [OK] $($file.Name)" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " BASELINE + AUDIT COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backup:"
Write-Host "  $backupDir"
Write-Host ""
Write-Host "Audit:"
Write-Host "  $auditFile"
Write-Host ""
Write-Host "IMPORTANT:"
Write-Host "  [OK] No source files modified"
Write-Host "  [OK] No Git commands"
Write-Host "  [OK] No deployment"
Write-Host "  [OK] Live iePDF unchanged"
Write-Host ""
Write-Host "Next step will be based on this audit only."
Write-Host ""