# iePDF Merge PDF - Performance Optimization Gate 1 (FINAL V2)
# Purpose: defer heavy PDF modules until actually needed.
# UI/security/validation/SLA unchanged. Automatic restore on any failure.

$ErrorActionPreference = "Stop"

$root = "C:\IEPDF\frontend"
$target = Join-Path $root "app\merge-pdf\page.tsx"

Write-Host "============================================================"
Write-Host "iePDF Merge PDF - Performance Optimization Gate 1 (FINAL V2)"
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
$backupDir = Join-Path $root "_ui-backups\merge-performance-gate1-v2-$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$backup = Join-Path $backupDir "page.tsx"
Copy-Item -LiteralPath $target -Destination $backup -Force

$original = [System.IO.File]::ReadAllText($target)
$source = $original

try {
    # Require all three original static imports.
    $importPatterns = @(
        'import\s*\{\s*BrowserPdfAnalyzer\s*\}\s*from\s*"@/engine/analysis/BrowserPdfAnalyzer"\s*;',
        'import\s*\{\s*BrowserMergeProcessor\s*\}\s*from\s*"@/engine/processing/processors/BrowserMergeProcessor"\s*;',
        'import\s*\{\s*BrowserPdfUnlockService\s*\}\s*from\s*"@/engine/unlock/BrowserPdfUnlockService"\s*;'
    )

    foreach ($pattern in $importPatterns) {
        if ($source -notmatch $pattern) {
            throw "Safe abort: expected static import not found: $pattern"
        }
    }

    # Remove static imports, tolerating CRLF/LF and indentation.
    foreach ($pattern in $importPatterns) {
        $source = [regex]::Replace(
            $source,
            "(?m)^[\t ]*" + $pattern + "[\t ]*(?:\r?\n|$)",
            "",
            1
        )
    }

    # Replace constructor expressions directly. This intentionally matches
    # whitespace/newline variation instead of a fragile multiline block.
    $unlockCtor = 'new\s+BrowserPdfUnlockService\s*\(\s*\)'
    $unlockMatches = [regex]::Matches($source, $unlockCtor)
    if ($unlockMatches.Count -ne 1) {
        throw "Safe abort: expected exactly 1 BrowserPdfUnlockService constructor, found $($unlockMatches.Count)."
    }

    $unlockReplacement = @'
(await import("@/engine/unlock/BrowserPdfUnlockService")).BrowserPdfUnlockService
'@
    # Use a local class binding so the existing construction semantics remain clear.
    $unlockBinding = @'
      const { BrowserPdfUnlockService } = await import(
        "@/engine/unlock/BrowserPdfUnlockService"
      );

      const unlockService =
        new BrowserPdfUnlockService();
'@

    # Replace the complete existing constructor statement if present; otherwise
    # replace the constructor expression in-place.
    $unlockStatementPattern = '(?ms)(?<indent>[\t ]*)const\s+unlockService\s*=\s*new\s+BrowserPdfUnlockService\s*\(\s*\)\s*;'
    if ($source -match $unlockStatementPattern) {
        $source = [regex]::Replace($source, $unlockStatementPattern, $unlockBinding.TrimEnd(), 1)
    }
    else {
        # Handles formatting where "const unlockService" and constructor are
        # separated differently. Replace only the constructor expression with
        # an awaited dynamic module binding is not safe, so abort instead.
        throw "Safe abort: BrowserPdfUnlockService constructor exists but its assignment shape is unexpected."
    }

    # Merge processor.
    $mergeCtor = 'new\s+BrowserMergeProcessor\s*\(\s*\)'
    $mergeMatches = [regex]::Matches($source, $mergeCtor)
    if ($mergeMatches.Count -ne 1) {
        throw "Safe abort: expected exactly 1 BrowserMergeProcessor constructor, found $($mergeMatches.Count)."
    }

    $mergeStatementPattern = '(?ms)(?<indent>[\t ]*)const\s+processor\s*=\s*new\s+BrowserMergeProcessor\s*\(\s*\)\s*;'
    if ($source -notmatch $mergeStatementPattern) {
        throw "Safe abort: BrowserMergeProcessor assignment shape is unexpected."
    }

    $mergeReplacement = @'
        const { BrowserMergeProcessor } = await import(
            "@/engine/processing/processors/BrowserMergeProcessor"
        );

        const processor =
            new BrowserMergeProcessor();
'@
    $source = [regex]::Replace($source, $mergeStatementPattern, $mergeReplacement.TrimEnd(), 1)

    # Analyzer.
    $analyzerCtor = 'new\s+BrowserPdfAnalyzer\s*\(\s*\)'
    $analyzerMatches = [regex]::Matches($source, $analyzerCtor)
    if ($analyzerMatches.Count -ne 1) {
        throw "Safe abort: expected exactly 1 BrowserPdfAnalyzer constructor, found $($analyzerMatches.Count)."
    }

    $analyzerStatementPattern = '(?ms)(?<indent>[\t ]*)const\s+analyzer\s*=\s*new\s+BrowserPdfAnalyzer\s*\(\s*\)\s*;'
    if ($source -notmatch $analyzerStatementPattern) {
        throw "Safe abort: BrowserPdfAnalyzer assignment shape is unexpected."
    }

    $analyzerReplacement = @'
    const { BrowserPdfAnalyzer } = await import(
        "@/engine/analysis/BrowserPdfAnalyzer"
    );

    const analyzer = new BrowserPdfAnalyzer();
'@
    $source = [regex]::Replace($source, $analyzerStatementPattern, $analyzerReplacement.TrimEnd(), 1)

    # Critical postconditions.
    foreach ($pattern in $importPatterns) {
        if ($source -match $pattern) {
            throw "Safe abort: static heavy import remains."
        }
    }

    $dynamicImports = @(
        '@/engine/unlock/BrowserPdfUnlockService',
        '@/engine/processing/processors/BrowserMergeProcessor',
        '@/engine/analysis/BrowserPdfAnalyzer'
    )
    foreach ($path in $dynamicImports) {
        if ($source -notmatch [regex]::Escape("await import(") + '.*' + [regex]::Escape($path)) {
            throw "Safe abort: required dynamic import missing: $path"
        }
    }

    if ($source -notmatch 'ValidationConstants\.BOUNDARY_VALIDATION\.MAX_FILE_SIZE_BYTES') {
        throw "Safe abort: authoritative MAX_FILE_SIZE reference changed."
    }
    if ($source -notmatch 'MergeWorkspace') {
        throw "Safe abort: MergeWorkspace reference changed."
    }
    if ($source -notmatch 'onUnlockMerge=\{handleUnlockMerge\}') {
        throw "Safe abort: merge action wiring changed."
    }

    # Verify the three constructors still exist exactly once after insertion.
    if ([regex]::Matches($source, 'new\s+BrowserPdfUnlockService\s*\(\s*\)').Count -ne 1) {
        throw "Safe abort: unlock constructor postcondition failed."
    }
    if ([regex]::Matches($source, 'new\s+BrowserMergeProcessor\s*\(\s*\)').Count -ne 1) {
        throw "Safe abort: merge constructor postcondition failed."
    }
    if ([regex]::Matches($source, 'new\s+BrowserPdfAnalyzer\s*\(\s*\)').Count -ne 1) {
        throw "Safe abort: analyzer constructor postcondition failed."
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
        if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed." }
        Write-Host "TYPECHECK PASS"

        Write-Host ""
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
