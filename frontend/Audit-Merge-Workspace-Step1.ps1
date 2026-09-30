$ErrorActionPreference = "Stop"

$file = ".\components\MergeWorkspace.tsx"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " iePDF - MERGE PHASE 1 / STEP 1 STRUCTURAL AUDIT" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $file)) {
    throw "MergeWorkspace.tsx not found."
}

$text = Get-Content -Raw -Encoding UTF8 $file

Write-Host "[1/5] Checking component structure..." -ForegroundColor Yellow

$checks = [ordered]@{
    "PDFFile props"             = "interface MergeWorkspaceProps"
    "canMerge logic"            = "const canMerge"
    "files.map rendering"      = "files.map"
    "status rendering"         = "status"
    "right summary panel"       = "Total"
    "Unlock & Merge handler"    = "onUnlockMerge"
    "Remove handler"            = "onRemoveFile"
    "Skip handler"              = "onSkipFile"
    "Password handler"          = "onPasswordChange"
}

foreach ($name in $checks.Keys) {
    $term = $checks[$name]

    if ($text.IndexOf($term, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        Write-Host ("[OK] {0}" -f $name) -ForegroundColor Green
    }
    else {
        Write-Host ("[MISSING] {0}" -f $name) -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "[2/5] Checking for existing reorder/add-file architecture..." -ForegroundColor Yellow

$architectureChecks = [ordered]@{
    "onReorderFiles" = "onReorderFiles"
    "onAddFiles"     = "onAddFiles"
    "draggable"      = "draggable"
    "onDragStart"    = "onDragStart"
    "onDragOver"     = "onDragOver"
    "onDrop"         = "onDrop"
    "draggedFileId"  = "draggedFileId"
}

foreach ($name in $architectureChecks.Keys) {
    $term = $architectureChecks[$name]

    if ($text.IndexOf($term, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        Write-Host ("[PRESENT] {0}" -f $name) -ForegroundColor Yellow
    }
    else {
        Write-Host ("[NOT PRESENT] {0}" -f $name)
    }
}

Write-Host ""
Write-Host "[3/5] Checking current workspace sizing/layout..." -ForegroundColor Yellow

$layoutTerms = @(
    "grid",
    "90vw",
    "overflow-y-auto",
    "lg:grid-cols",
    "min-h",
    "Unlock & Merge"
)

foreach ($term in $layoutTerms) {
    if ($text.IndexOf($term, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        Write-Host ("[OK] Layout signal: {0}" -f $term) -ForegroundColor Green
    }
    else {
        Write-Host ("[NOT FOUND] Layout signal: {0}" -f $term)
    }
}

Write-Host ""
Write-Host "[4/5] Counting current file-row/card rendering..." -ForegroundColor Yellow

$mapMatches = [regex]::Matches($text, "files\.map")
Write-Host ("files.map occurrences: {0}" -f $mapMatches.Count)

$buttonMatches = [regex]::Matches($text, "<button")
Write-Host ("button elements: {0}" -f $buttonMatches.Count)

Write-Host ""
Write-Host "[5/5] Showing relevant source locations..." -ForegroundColor Yellow
Write-Host ""

$lines = Get-Content -Encoding UTF8 $file

$patterns = @(
    "interface MergeWorkspaceProps",
    "const canMerge",
    "files.map",
    "Unlock & Merge"
)

foreach ($pattern in $patterns) {

    $matches = Select-String `
        -Path $file `
        -Pattern $pattern `
        -SimpleMatch `
        -Encoding UTF8

    foreach ($match in $matches) {
        $start = [Math]::Max(1, $match.LineNumber - 2)
        $end = [Math]::Min($lines.Count, $match.LineNumber + 3)

        Write-Host "----- $pattern (line $($match.LineNumber)) -----" -ForegroundColor Cyan

        for ($i = $start; $i -le $end; $i++) {
            Write-Host ("{0,4}: {1}" -f $i, $lines[$i - 1])
        }

        Write-Host ""
    }
}

Write-Host "============================================================" -ForegroundColor Green
Write-Host " STEP 1 STRUCTURAL AUDIT COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[OK] Read-only audit"
Write-Host "[OK] No source files modified"
Write-Host "[OK] No Git commands"
Write-Host "[OK] No deployment"
Write-Host "[OK] Live iePDF unchanged"
Write-Host ""