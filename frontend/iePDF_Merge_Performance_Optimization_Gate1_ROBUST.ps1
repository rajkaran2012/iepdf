# iePDF Merge PDF - Performance Optimization Gate 1 (ROBUST)
# Changes ONLY module loading in app/merge-pdf/page.tsx.
# UI, validation, security logic, and 30s SLA remain unchanged.
$ErrorActionPreference = "Stop"

$root = "C:\IEPDF\frontend"
$target = Join-Path $root "app\merge-pdf\page.tsx"

Write-Host "============================================================"
Write-Host "iePDF Merge PDF - Performance Optimization Gate 1 (ROBUST)"
Write-Host "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "============================================================"

if (!(Test-Path -LiteralPath $target)) {
    throw "Target not found: $target"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $root "_ui-backups\merge-performance-gate1-robust-$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$backup = Join-Path $backupDir "page.tsx"
Copy-Item -LiteralPath $target -Destination $backup -Force

$original = [IO.File]::ReadAllText($target)
$source = $original

try {
    # 1. Remove exactly these three static imports.
    $staticImports = @(
        'import\s*\{\s*BrowserPdfAnalyzer\s*\}\s*from\s*"@/engine/analysis/BrowserPdfAnalyzer"\s*;',
        'import\s*\{\s*BrowserMergeProcessor\s*\}\s*from\s*"@/engine/processing/processors/BrowserMergeProcessor"\s*;',
        'import\s*\{\s*BrowserPdfUnlockService\s*\}\s*from\s*"@/engine/unlock/BrowserPdfUnlockService"\s*;'
    )

    foreach ($p in $staticImports) {
        if ($source -notmatch $p) {
            throw "Safe abort: expected static import missing: $p"
        }
    }

    foreach ($p in $staticImports) {
        $source = [regex]::Replace($source, "(?m)^[ \t]*$p[ \t]*\r?$", "")
    }

    # 2. Replace only the known constructor expressions by adding a local
    # dynamic import immediately before each constructor.
    $unlockPattern = '(?s)(?<indent>[ \t]*)const\s+unlockService\s*=\s*new\s+BrowserPdfUnlockService\s*\(\s*\)\s*;'
    $mergePattern  = '(?s)(?<indent>[ \t]*)const\s+processor\s*=\s*new\s+BrowserMergeProcessor\s*\(\s*\)\s*;'
    $analyzerPattern = '(?s)(?<indent>[ \t]*)const\s+analyzer\s*=\s*new\s+BrowserPdfAnalyzer\s*\(\s*\)\s*;'

    if ([regex]::Matches($source, $unlockPattern).Count -ne 1) {
        throw "Safe abort: expected one unlock assignment."
    }
    if ([regex]::Matches($source, $mergePattern).Count -ne 1) {
        throw "Safe abort: expected one merge processor assignment."
    }
    if ([regex]::Matches($source, $analyzerPattern).Count -ne 1) {
        throw "Safe abort: expected one analyzer assignment."
    }

    $unlockReplacement = @'
      const { BrowserPdfUnlockService } = await import(
        "@/engine/unlock/BrowserPdfUnlockService"
      );

      const unlockService =
        new BrowserPdfUnlockService();
'@

    $mergeReplacement = @'
        const { BrowserMergeProcessor } = await import(
            "@/engine/processing/processors/BrowserMergeProcessor"
        );

        const processor =
            new BrowserMergeProcessor();
'@

    $analyzerReplacement = @'
    const { BrowserPdfAnalyzer } = await import(
        "@/engine/analysis/BrowserPdfAnalyzer"
    );

    const analyzer = new BrowserPdfAnalyzer();
'@

    $source = [regex]::Replace($source, $unlockPattern, $unlockReplacement.TrimEnd(), 1)
    $source = [regex]::Replace($source, $mergePattern, $mergeReplacement.TrimEnd(), 1)
    $source = [regex]::Replace($source, $analyzerPattern, $analyzerReplacement.TrimEnd(), 1)

    # 3. Verification uses multiline-safe expressions. It does NOT require
    # import() and its module path to occupy one physical line.
    foreach ($p in $staticImports) {
        if ($source -match $p) {
            throw "Safe abort: static import remains."
        }
    }

    $dynamicChecks = @(
        'const\s*\{\s*BrowserPdfUnlockService\s*\}\s*=\s*await\s+import\s*\(\s*"@/engine/unlock/BrowserPdfUnlockService"\s*\)',
        'const\s*\{\s*BrowserMergeProcessor\s*\}\s*=\s*await\s+import\s*\(\s*"@/engine/processing/processors/BrowserMergeProcessor"\s*\)',
        'const\s*\{\s*BrowserPdfAnalyzer\s*\}\s*=\s*await\s+import\s*\(\s*"@/engine/analysis/BrowserPdfAnalyzer"\s*\)'
    )
    foreach ($p in $dynamicChecks) {
        if ($source -notmatch "(?s)$p") {
            throw "Safe abort: dynamic import verification failed."
        }
    }

    # Preserve important frozen application invariants.
    if ($source -notmatch 'ValidationConstants\.BOUNDARY_VALIDATION\.MAX_FILE_SIZE_BYTES') {
        throw "Safe abort: MAX_FILE_SIZE validation reference changed."
    }
    if ($source -notmatch 'MergeWorkspace') {
        throw "Safe abort: MergeWorkspace reference changed."
    }
    if ($source -notmatch 'onUnlockMerge=\{handleUnlockMerge\}') {
        throw "Safe abort: merge action wiring changed."
    }

    [IO.File]::WriteAllText($target, $source, [Text.UTF8Encoding]::new($false))

    Write-Host "PATCH APPLIED"
    Write-Host "Backup: $backup"

    Push-Location $root
    try {
        Write-Host "Running TypeScript check..."
        & pnpm exec tsc --noEmit
        if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed." }
        Write-Host "TYPECHECK PASS"

        Write-Host "Running production build..."
        & pnpm build
        if ($LASTEXITCODE -ne 0) { throw "Production build failed." }
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
    [IO.File]::WriteAllText($target, $original, [Text.UTF8Encoding]::new($false))
    Write-Host ""
    Write-Host "SAFE ABORT: source restored."
    Write-Host "Reason: $($_.Exception.Message)"
    Write-Host "Backup retained: $backup"
    throw
}
