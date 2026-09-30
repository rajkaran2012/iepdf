# iePDF Merge PDF - Performance Optimization Gate 1
# Safe, source-aware patch. No UI/security/validation changes.
$ErrorActionPreference = "Stop"

$root = "C:\IEPDF\frontend"
$target = Join-Path $root "app\merge-pdf\page.tsx"

Write-Host "============================================================"
Write-Host "iePDF Merge PDF - Performance Optimization Gate 1"
Write-Host "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Target: $target"
Write-Host "============================================================"
Write-Host "Optimization: defer heavy PDF modules until actually needed."
Write-Host "UI changes: NONE"
Write-Host "Security/validation changes: NONE"
Write-Host "SLA: 30000 ms HARD - unchanged"
Write-Host ""

if (!(Test-Path -LiteralPath $target)) {
    throw "Target file not found: $target"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $root "_ui-backups\merge-performance-gate1-$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$backup = Join-Path $backupDir "page.tsx"
Copy-Item -LiteralPath $target -Destination $backup -Force

$original = [System.IO.File]::ReadAllText($target)
$source = $original

try {
    # Exact static imports that must exist before patching.
    $imports = @(
        'import { BrowserPdfAnalyzer } from "@/engine/analysis/BrowserPdfAnalyzer";',
        'import { BrowserMergeProcessor } from "@/engine/processing/processors/BrowserMergeProcessor";',
        'import { BrowserPdfUnlockService } from "@/engine/unlock/BrowserPdfUnlockService";'
    )

    foreach ($imp in $imports) {
        if (!$source.Contains($imp)) {
            throw "Safe abort: expected static import not found: $imp"
        }
    }

    # Remove each heavy static import independently. This deliberately avoids
    # brittle assumptions about blank lines/formatting.
    foreach ($imp in $imports) {
        $source = $source.Replace($imp + "`r`n", "")
        $source = $source.Replace($imp + "`n", "")
        $source = $source.Replace($imp, "")
    }

    # Replace constructor call sites with awaited on-demand imports.
    $unlockOld = @'
      const unlockService =
        new BrowserPdfUnlockService();
'@
    $unlockNew = @'
      const { BrowserPdfUnlockService } = await import(
        "@/engine/unlock/BrowserPdfUnlockService"
      );

      const unlockService =
        new BrowserPdfUnlockService();
'@

    if (!$source.Contains($unlockOld)) {
        throw "Safe abort: BrowserPdfUnlockService call site not found."
    }
    $source = $source.Replace($unlockOld, $unlockNew)

    $mergeOld = @'
        const processor =
            new BrowserMergeProcessor();
'@
    $mergeNew = @'
        const { BrowserMergeProcessor } = await import(
            "@/engine/processing/processors/BrowserMergeProcessor"
        );

        const processor =
            new BrowserMergeProcessor();
'@

    if (!$source.Contains($mergeOld)) {
        throw "Safe abort: BrowserMergeProcessor call site not found."
    }
    $source = $source.Replace($mergeOld, $mergeNew)

    $analyzerOld = @'
    const analyzer = new BrowserPdfAnalyzer();
'@
    $analyzerNew = @'
    const { BrowserPdfAnalyzer } = await import(
        "@/engine/analysis/BrowserPdfAnalyzer"
    );

    const analyzer = new BrowserPdfAnalyzer();
'@

    if (!$source.Contains($analyzerOld)) {
        throw "Safe abort: BrowserPdfAnalyzer call site not found."
    }
    $source = $source.Replace($analyzerOld, $analyzerNew)

    # Post-patch invariants.
    foreach ($imp in $imports) {
        if ($source.Contains($imp)) {
            throw "Safe abort: static heavy import still present: $imp"
        }
    }

    $requiredDynamic = @(
        'await import("@/engine/analysis/BrowserPdfAnalyzer")',
        'await import("@/engine/processing/processors/BrowserMergeProcessor")',
        'await import("@/engine/unlock/BrowserPdfUnlockService")'
    )

    foreach ($dyn in $requiredDynamic) {
        if (!$source.Contains($dyn)) {
            throw "Safe abort: expected dynamic import missing: $dyn"
        }
    }

    # Guard against accidental changes to the frozen validation boundary and UI
    # surface in this optimization gate.
    if ($source -notmatch 'ValidationConstants\.BOUNDARY_VALIDATION\.MAX_FILE_SIZE_BYTES') {
        throw "Safe abort: authoritative MAX_FILE_SIZE validation reference changed."
    }
    if ($source -notmatch 'MergeWorkspace') {
        throw "Safe abort: MergeWorkspace reference disappeared."
    }
    if ($source -notmatch 'onUnlockMerge=\{handleUnlockMerge\}') {
        throw "Safe abort: merge action wiring changed."
    }

    [System.IO.File]::WriteAllText(
        $target,
        $source,
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host "PATCH APPLIED: heavy PDF modules now load on demand."
    Write-Host "Backup: $backup"

    Push-Location $root
    try {
        Write-Host ""
        Write-Host "Running TypeScript check..."
        & pnpm exec tsc --noEmit
        if ($LASTEXITCODE -ne 0) {
            throw "TypeScript check failed."
        }
        Write-Host "TYPECHECK PASS"

        Write-Host ""
        Write-Host "Running production build..."
        & pnpm build
        if ($LASTEXITCODE -ne 0) {
            throw "Production build failed."
        }
        Write-Host "BUILD PASS"
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "GATE 1 PATCH RESULT: PASS"
    Write-Host "UI unchanged"
    Write-Host "Security/validation unchanged"
    Write-Host "30-second SLA unchanged"
    Write-Host "Live site NOT deployed or modified"
    Write-Host "NO GIT OPERATIONS"
    Write-Host "Backup: $backup"
    Write-Host "============================================================"
}
catch {
    [System.IO.File]::WriteAllText(
        $target,
        $original,
        [System.Text.UTF8Encoding]::new($false)
    )
    Write-Host ""
    Write-Host "SAFE ABORT: source restored."
    Write-Host "Reason: $($_.Exception.Message)"
    Write-Host "Backup retained: $backup"
    throw
}
