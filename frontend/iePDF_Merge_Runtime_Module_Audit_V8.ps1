$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$ReportDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $ReportDir "merge-runtime-module-audit-v8-safe-$Stamp.txt"

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$Out = New-Object System.Collections.Generic.List[string]

function Add-Line {
    param([string]$Text = "")
    $Out.Add([string]$Text)
    Write-Host ([string]$Text)
}

function Section {
    param([string]$Title)

    Add-Line ""
    Add-Line ("=" * 75)
    Add-Line $Title
    Add-Line ("=" * 75)
}

Add-Line "iePDF MERGE PDF - RUNTIME MODULE IDENTITY AUDIT V8 SAFE"
Add-Line "Started: $(Get-Date)"
Add-Line "Root: $Root"
Add-Line ""
Add-Line "READ ONLY"
Add-Line "NO SOURCE CHANGES"
Add-Line "NO GIT"
Add-Line "NO DEPLOYMENT"

# ============================================================
# 1. EXACT COMPONENT FILE
# ============================================================

Section "1. CANONICAL MERGEWORKSPACE FILE"

$Canonical = Join-Path $Root "components\MergeWorkspace.tsx"

if (Test-Path -LiteralPath $Canonical) {
    $Info = Get-Item -LiteralPath $Canonical

    Add-Line "PASS: Canonical component exists"
    Add-Line "Path: $($Info.FullName)"
    Add-Line "Size: $($Info.Length)"
    Add-Line "LastWrite: $($Info.LastWriteTime)"
}
else {
    Add-Line "FAIL: Canonical component missing"
}

# ============================================================
# 2. ALL POSSIBLE MERGEWORKSPACE FILES
# ============================================================

Section "2. ALL POSSIBLE MERGEWORKSPACE FILES"

$AllFiles = @(
    Get-ChildItem `
        -LiteralPath $Root `
        -Recurse `
        -File `
        -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -like "MergeWorkspace*"
    }
)

Add-Line "Count: $($AllFiles.Count)"

foreach ($Item in $AllFiles) {

    Add-Line ""
    Add-Line "PATH: $($Item.FullName)"
    Add-Line "SIZE: $($Item.Length)"
    Add-Line "LASTWRITE: $($Item.LastWriteTime)"
}

# ============================================================
# 3. MERGE PAGE IMPORT
# ============================================================

Section "3. MERGE PAGE IMPORT"

$Page = Join-Path $Root "app\merge-pdf\page.tsx"

if (-not (Test-Path -LiteralPath $Page)) {

    Add-Line "FAIL: Merge page not found"

}
else {

    Add-Line "PASS: Merge page exists"
    Add-Line "Path: $Page"

    $PageLines = Get-Content -LiteralPath $Page -ErrorAction SilentlyContinue

    if ($null -eq $PageLines) {
        Add-Line "WARNING: Could not read page source"
    }
    else {

        for ($i = 0; $i -lt @($PageLines).Count; $i++) {

            $Line = [string]$PageLines[$i]

            if ($Line -like "*MergeWorkspace*") {
                Add-Line ("Line {0}: {1}" -f ($i + 1), $Line.Trim())
            }
        }
    }
}

# ============================================================
# 4. IMPORT EXACT MATCH
# ============================================================

Section "4. EXACT IMPORT MATCH"

if (Test-Path -LiteralPath $Page) {

    $PageText = Get-Content `
        -Raw `
        -LiteralPath $Page `
        -ErrorAction SilentlyContinue

    if ($null -eq $PageText) {

        Add-Line "WARNING: Page text could not be read"

    }
    elseif ($PageText.Contains("@/components/MergeWorkspace")) {

        Add-Line "PASS: Merge page imports @/components/MergeWorkspace"

    }
    else {

        Add-Line "WARNING: Exact @/components/MergeWorkspace import not found"
    }
}

# ============================================================
# 5. COMPONENT EXPORT
# ============================================================

Section "5. CANONICAL COMPONENT EXPORT"

if (Test-Path -LiteralPath $Canonical) {

    $ComponentLines = Get-Content `
        -LiteralPath $Canonical `
        -ErrorAction SilentlyContinue

    if ($null -eq $ComponentLines) {

        Add-Line "WARNING: Component could not be read"

    }
    else {

        for ($i = 0; $i -lt @($ComponentLines).Count; $i++) {

            $Line = [string]$ComponentLines[$i]

            if (
                $Line.Contains("export default") -or
                $Line.Contains("function MergeWorkspace")
            ) {
                Add-Line ("Line {0}: {1}" -f ($i + 1), $Line.Trim())
            }
        }
    }
}

# ============================================================
# 6. DUPLICATE SOURCE CHECK
# ============================================================

Section "6. DUPLICATE SOURCE CHECK"

$ExactDuplicates = @(
    $AllFiles |
    Where-Object {
        $_.FullName -ne $Canonical -and
        $_.Name -eq "MergeWorkspace.tsx"
    }
)

if ($ExactDuplicates.Count -eq 0) {

    Add-Line "PASS: No second file named exactly MergeWorkspace.tsx"

}
else {

    Add-Line "WARNING: Additional exact MergeWorkspace.tsx files found"

    foreach ($Item in $ExactDuplicates) {
        Add-Line $Item.FullName
    }
}

$OldCopies = @(
    $AllFiles |
    Where-Object {
        $_.Name -ne "MergeWorkspace.tsx"
    }
)

Add-Line ""
Add-Line "Other MergeWorkspace-named files: $($OldCopies.Count)"

foreach ($Item in $OldCopies) {
    Add-Line "  $($Item.FullName)"
}

# ============================================================
# 7. TSCONFIG
# ============================================================

Section "7. TSCONFIG PATH INFORMATION"

$TsConfig = Join-Path $Root "tsconfig.json"

if (Test-Path -LiteralPath $TsConfig) {

    $TsLines = Get-Content `
        -LiteralPath $TsConfig `
        -ErrorAction SilentlyContinue

    if ($null -eq $TsLines) {

        Add-Line "WARNING: Could not read tsconfig"

    }
    else {

        for ($i = 0; $i -lt @($TsLines).Count; $i++) {

            $Line = [string]$TsLines[$i]

            if (
                $Line.Contains("baseUrl") -or
                $Line.Contains("paths") -or
                $Line.Contains("@/*")
            ) {
                Add-Line ("Line {0}: {1}" -f ($i + 1), $Line.Trim())
            }
        }
    }

}
else {

    Add-Line "WARNING: tsconfig.json not found"
}

# ============================================================
# 8. OLD MERGE-PDF SOURCE DIRECTORIES
# ============================================================

Section "8. MERGE-PDF DIRECTORIES"

$Dirs = @(
    Get-ChildItem `
        -LiteralPath $Root `
        -Recurse `
        -Directory `
        -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -eq "merge-pdf"
    }
)

Add-Line "Directory count: $($Dirs.Count)"

foreach ($Dir in $Dirs) {
    Add-Line ""
    Add-Line "DIR: $($Dir.FullName)"

    $Children = Get-ChildItem `
        -LiteralPath $Dir.FullName `
        -File `
        -ErrorAction SilentlyContinue

    foreach ($Child in $Children) {
        Add-Line "  FILE: $($Child.Name)"
    }
}

# ============================================================
# 9. .NEXT STATUS
# ============================================================

Section "9. NEXT BUILD CACHE STATUS"

$Next = Join-Path $Root ".next"

if (Test-Path -LiteralPath $Next) {

    $NextInfo = Get-Item -LiteralPath $Next

    Add-Line "PASS: .next exists"
    Add-Line "LastWrite: $($NextInfo.LastWriteTime)"

    $ServerMerge = Join-Path $Next "server\app\merge-pdf"

    if (Test-Path -LiteralPath $ServerMerge) {
        Add-Line "PASS: .next/server/app/merge-pdf exists"
    }
    else {
        Add-Line "INFO: .next/server/app/merge-pdf not found"
    }

}
else {

    Add-Line ".next does not exist"
}

# ============================================================
# 10. CANONICAL SOURCE SIGNATURE
# ============================================================

Section "10. CANONICAL COMPONENT SIGNATURE"

if (Test-Path -LiteralPath $Canonical) {

    $CanonicalText = Get-Content `
        -Raw `
        -LiteralPath $Canonical `
        -ErrorAction SilentlyContinue

    if ($null -ne $CanonicalText) {

        Add-Line "Contains files.map       : $($CanonicalText.Contains("files.map"))"
        Add-Line "Contains files.length   : $($CanonicalText.Contains("files.length"))"
        Add-Line "Contains onAddFiles     : $($CanonicalText.Contains("onAddFiles"))"
        Add-Line "Contains onReorderFiles : $($CanonicalText.Contains("onReorderFiles"))"
        Add-Line "Contains onUnlockMerge  : $($CanonicalText.Contains("onUnlockMerge"))"
        Add-Line "Contains reorder marker : $($CanonicalText.Contains("application/x-iepdf-reorder"))"
    }
}

# ============================================================
# 11. RESULT
# ============================================================

Section "11. FINAL RESULT"

if (Test-Path -LiteralPath $Canonical) {
    Add-Line "Canonical MergeWorkspace.tsx: PRESENT"
}
else {
    Add-Line "Canonical MergeWorkspace.tsx: MISSING"
}

if (Test-Path -LiteralPath $Page) {
    Add-Line "Merge page: PRESENT"
}
else {
    Add-Line "Merge page: MISSING"
}

if ($ExactDuplicates.Count -eq 0) {
    Add-Line "Exact duplicate component: NONE"
}
else {
    Add-Line "Exact duplicate component: FOUND"
}

Add-Line ""
Add-Line "This audit is READ ONLY."
Add-Line "No source files were changed."
Add-Line "No Git operations were performed."
Add-Line "No deployment was performed."

Add-Line ""
Add-Line "Report: $Report"
Add-Line "Finished: $(Get-Date)"

[System.IO.File]::WriteAllLines(
    $Report,
    $Out,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "============================================================"
Write-Host "V8 SAFE AUDIT COMPLETE"
Write-Host "Report: $Report"
Write-Host "NO SOURCE CHANGES"
Write-Host "NO GIT"
Write-Host "NO DEPLOYMENT"
Write-Host "============================================================"