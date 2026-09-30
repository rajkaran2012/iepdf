# iePDF Merge PDF - Performance Optimization Gate 1
# Purpose: defer heavy PDF engine modules until they are actually needed.
# UI is unchanged. Security/validation logic is unchanged.
# 30-second SLA is unchanged.
# No Git operations. No deployment.
#
# Target:
#   C:\IEPDF\frontend\app\merge-pdf\page.tsx
#
# Optimization:
#   BrowserPdfAnalyzer        -> loaded only when PDFs are selected
#   BrowserMergeProcessor     -> loaded only when Merge is clicked
#   BrowserPdfUnlockService   -> loaded only when a protected PDF password is checked
#
# The script is deliberately fail-closed:
#   - exact source patterns must exist
#   - creates a timestamped backup before editing
#   - runs TypeScript and production build after the patch
#   - restores the source automatically if validation/build fails
#   - never deploys

$ErrorActionPreference = "Stop"

$Root = "C:\IEPDF\frontend"
$Page = Join-Path $Root "app\merge-pdf\page.tsx"
$BackupRoot = Join-Path $Root "_ui-backups"
$ReportDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $BackupRoot "merge-performance-gate1-$Stamp"
$BackupPage = Join-Path $BackupDir "page.tsx"
$Report = Join-Path $ReportDir "merge-performance-gate1-$Stamp.txt"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

if (-not (Test-Path -LiteralPath $Page)) {
    throw "Merge page not found: $Page"
}

Copy-Item -LiteralPath $Page -Destination $BackupPage -Force

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-ReportLine {
    param([string]$Text)
    Add-Content -LiteralPath $Report -Value $Text -Encoding UTF8
    Write-Host $Text
}

Write-ReportLine "============================================================"
Write-ReportLine "iePDF Merge PDF - Performance Optimization Gate 1"
Write-ReportLine "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-ReportLine "Target: $Page"
Write-ReportLine "============================================================"
Write-ReportLine "Optimization: defer heavy PDF modules until needed."
Write-ReportLine "UI changes: NONE"
Write-ReportLine "Security/validation changes: NONE"
Write-ReportLine "SLA: 30000 ms HARD - unchanged"
Write-ReportLine ""

$original = [System.IO.File]::ReadAllText($Page, [System.Text.Encoding]::UTF8)

# Refuse to stack the optimization twice.
if ($original.Contains("IEPDF_PERF_GATE1_DYNAMIC_IMPORTS")) {
    throw "Gate 1 marker already exists. Refusing to patch twice."
}

$patched = $original

# 1) Remove the three heavy static imports and replace with a source marker.
# Remove the three heavy static imports individually.
# This is intentionally tolerant of blank-line/formatting differences.
$heavyImports = @(
    'import { BrowserPdfAnalyzer } from "@/engine/analysis/BrowserPdfAnalyzer";',
    'import { BrowserMergeProcessor } from "@/engine/processing/processors/BrowserMergeProcessor";',
    'import { BrowserPdfUnlockService } from "@/engine/unlock/BrowserPdfUnlockService";'
)

$removedImports = 0
foreach ($importLine in $heavyImports) {
    if ($patched.Contains($importLine)) {
        $patched = $patched.Replace($importLine + "`r`n", "")
        $patched = $patched.Replace($importLine + "`n", "")
        $patched = $patched.Replace($importLine, "")
        $removedImports++
    }
}

if ($removedImports -ne 3) {
    Copy-Item -LiteralPath $BackupPage -Destination $Page -Force
    throw "Safe abort: expected 3 heavy static imports, found $removedImports. Source restored."
}

# Add a non-executable source marker so the patch is easy to audit.
$firstImport = 'import { useRef, useState } from "react";'
if (-not $patched.Contains($firstImport)) {
    Copy-Item -LiteralPath $BackupPage -Destination $Page -Force
    throw "Safe abort: React import anchor not found. Source restored."
}

$patched = $patched.Replace(
    $firstImport,
    $firstImport + "`r`n`r`n// IEPDF_PERF_GATE1_DYNAMIC_IMPORTS`r`n// Heavy PDF modules are loaded on-demand to reduce initial /merge-pdf startup cost."
)

# 2) Password unlock: import only when a protected PDF is actually being unlocked.
$oldUnlock = @'
      const unlockService =
        new BrowserPdfUnlockService();
'@

$newUnlock = @'
      const { BrowserPdfUnlockService } =
        await import("@/engine/unlock/BrowserPdfUnlockService");

      const unlockService =
        new BrowserPdfUnlockService();
'@

if (-not $patched.Contains($oldUnlock)) {
    Copy-Item -LiteralPath $BackupPage -Destination $Page -Force
    throw "Safe abort: BrowserPdfUnlockService construction block not found. Source restored."
}

$patched = $patched.Replace($oldUnlock, $newUnlock)

# 3) Merge processing: import only after the user clicks Merge.
$oldMerge = @'
        const processor =
            new BrowserMergeProcessor();
'@

$newMerge = @'
        const { BrowserMergeProcessor } =
            await import("@/engine/processing/processors/BrowserMergeProcessor");

        const processor =
            new BrowserMergeProcessor();
'@

if (-not $patched.Contains($oldMerge)) {
    Copy-Item -LiteralPath $BackupPage -Destination $Page -Force
    throw "Safe abort: BrowserMergeProcessor construction block not found. Source restored."
}

$patched = $patched.Replace($oldMerge, $newMerge)

# 4) PDF analysis: import only after the user selects/drops PDFs.
$oldAnalyzer = @'
    const analyzer = new BrowserPdfAnalyzer();

    const analysis =
        await analyzer.analyzeMany(files);
'@

$newAnalyzer = @'
    const { BrowserPdfAnalyzer } =
        await import("@/engine/analysis/BrowserPdfAnalyzer");

    const analyzer = new BrowserPdfAnalyzer();

    const analysis =
        await analyzer.analyzeMany(files);
'@

if (-not $patched.Contains($oldAnalyzer)) {
    Copy-Item -LiteralPath $BackupPage -Destination $Page -Force
    throw "Safe abort: BrowserPdfAnalyzer construction block not found. Source restored."
}

$patched = $patched.Replace($oldAnalyzer, $newAnalyzer)

# Verify the patch is exactly what we intended.
$required = @(
    "IEPDF_PERF_GATE1_DYNAMIC_IMPORTS",
    'await import("@/engine/analysis/BrowserPdfAnalyzer")',
    'await import("@/engine/processing/processors/BrowserMergeProcessor")',
    'await import("@/engine/unlock/BrowserPdfUnlockService")'
)

foreach ($marker in $required) {
    if (-not $patched.Contains($marker)) {
        Copy-Item -LiteralPath $BackupPage -Destination $Page -Force
        throw "Safe abort: expected optimization marker missing: $marker. Source restored."
    }
}

# Ensure the old static imports are gone.
$forbidden = @(
    'import { BrowserPdfAnalyzer } from "@/engine/analysis/BrowserPdfAnalyzer";',
    'import { BrowserMergeProcessor } from "@/engine/processing/processors/BrowserMergeProcessor";',
    'import { BrowserPdfUnlockService } from "@/engine/unlock/BrowserPdfUnlockService";'
)

foreach ($old in $forbidden) {
    if ($patched.Contains($old)) {
        Copy-Item -LiteralPath $BackupPage -Destination $Page -Force
        throw "Safe abort: old static import still present. Source restored."
    }
}

[System.IO.File]::WriteAllText($Page, $patched, $utf8NoBom)
Write-ReportLine "PATCH APPLIED: on-demand PDF module loading"
Write-ReportLine "Backup: $BackupPage"
Write-ReportLine ""

# TypeScript gate.
Write-ReportLine "=== TYPECHECK ==="
Push-Location $Root
try {
    $tscLog = Join-Path $env:TEMP "iepdf-merge-gate1-tsc-$Stamp.txt"
    & pnpm exec tsc --noEmit *> $tscLog
    $tscExit = $LASTEXITCODE

    if ($tscExit -ne 0) {
        Write-ReportLine "TYPECHECK FAIL"
        Get-Content -LiteralPath $tscLog | ForEach-Object { Write-ReportLine $_ }
        Copy-Item -LiteralPath $BackupPage -Destination $Page -Force
        throw "TypeScript failed. Original Merge page restored."
    }

    Write-ReportLine "TYPECHECK PASS"
}
finally {
    Pop-Location
}

# Production build gate.
Write-ReportLine ""
Write-ReportLine "=== PRODUCTION BUILD ==="
Push-Location $Root
try {
    $buildLog = Join-Path $env:TEMP "iepdf-merge-gate1-build-$Stamp.txt"
    $buildStart = [System.Diagnostics.Stopwatch]::StartNew()

    & pnpm build *> $buildLog
    $buildExit = $LASTEXITCODE

    $buildStart.Stop()
    Write-ReportLine ("BUILD_ELAPSED_MS={0}" -f $buildStart.ElapsedMilliseconds)

    if ($buildExit -ne 0) {
        Write-ReportLine "BUILD FAIL"
        Get-Content -LiteralPath $buildLog | ForEach-Object { Write-ReportLine $_ }
        Copy-Item -LiteralPath $BackupPage -Destination $Page -Force
        throw "Production build failed. Original Merge page restored."
    }

    Write-ReportLine "BUILD PASS"
}
finally {
    Pop-Location
}

# Bundle-size evidence. This is evidence only; it does not decide pass/fail.
Write-ReportLine ""
Write-ReportLine "=== CLIENT CHUNK SIZE SNAPSHOT ==="

$staticDir = Join-Path $Root ".next\static"
if (Test-Path -LiteralPath $staticDir) {
    $jsFiles = Get-ChildItem -LiteralPath $staticDir -Recurse -File -Filter *.js
    $totalBytes = ($jsFiles | Measure-Object -Property Length -Sum).Sum
    $largest = $jsFiles |
        Sort-Object Length -Descending |
        Select-Object -First 10

    Write-ReportLine ("TOTAL_STATIC_JS_BYTES={0}" -f [int64]$totalBytes)
    Write-ReportLine "TOP_10_STATIC_JS:"
    foreach ($f in $largest) {
        Write-ReportLine ("{0}`t{1}" -f $f.Length, $f.FullName.Substring($Root.Length + 1))
    }
}
else {
    Write-ReportLine "STATIC_DIR_NOT_FOUND"
}

Write-ReportLine ""
Write-ReportLine "============================================================"
Write-ReportLine "GATE 1 PATCH RESULT: PASS"
Write-ReportLine "Heavy PDF modules now load only when required."
Write-ReportLine "UI unchanged."
Write-ReportLine "Validation/security logic unchanged."
Write-ReportLine "30-second SLA unchanged."
Write-ReportLine "Live site NOT deployed or modified."
Write-ReportLine "NO GIT OPERATIONS."
Write-ReportLine "Report: $Report"
Write-ReportLine "Backup: $BackupPage"
Write-ReportLine "============================================================"
