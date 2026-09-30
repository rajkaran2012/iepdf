$ErrorActionPreference = "Stop"

$Root = "C:\IEPDF\frontend"
$Target = Join-Path $Root "engine\analysis\BrowserPdfAnalyzer.ts"
$BackupRoot = Join-Path $Root "_ui-backups"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $BackupRoot ("merge-analyzer-fix-" + $Stamp)
$Backup = Join-Path $BackupDir "BrowserPdfAnalyzer.ts"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " iePDF Merge - Safe Analyzer Fix" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

if (-not (Test-Path $Root)) {
    throw "Frontend root not found: $Root"
}

if (-not (Test-Path $Target)) {
    throw "Target file not found: $Target"
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
Copy-Item -LiteralPath $Target -Destination $Backup -Force

Write-Host "Backup: $Backup" -ForegroundColor Yellow

$content = Get-Content -LiteralPath $Target -Raw

$oldAnalyzeMany = @'
  async analyzeMany(files: File[]) {
    return Promise.all(files.map(file => this.analyze(file)));
  }
'@

$newAnalyzeMany = @'
  async analyzeMany(files: File[]) {
    const results: AnalysisResult[] = [];

    for (const file of files) {
      try {
        const result = await this.analyze(file);
        results.push(result);
      } catch (error) {
        results.push({
          id: crypto.randomUUID(),
          filename: file.name,
          extension: "pdf",
          size: file.size,
          pages: 0,
          encrypted: false,
          corrupted: true,
          status: "corrupted",
          error:
            error instanceof Error
              ? error.message
              : "Unable to analyze PDF.",
        });
      }
    }

    return results;
  }
'@

if (-not $content.Contains($oldAnalyzeMany)) {
    throw "Expected analyzeMany block was not found. No source changes made."
}

$updated = $content.Replace($oldAnalyzeMany, $newAnalyzeMany)

if ($updated -eq $content) {
    throw "Analyzer replacement produced no change."
}

[System.IO.File]::WriteAllText(
    $Target,
    $updated,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Analyzer updated: analyzeMany now isolates per-file analysis failures." -ForegroundColor Green
Write-Host ""
Write-Host "Security boundary preserved:" -ForegroundColor Cyan
Write-Host " - No validation bypass"
Write-Host " - No LaunchAction detector bypass"
Write-Host " - No file-size limit change"
Write-Host " - No processor change"
Write-Host " - Encrypted/corrupt status handling preserved"
Write-Host ""

Push-Location $Root
try {
    Write-Host "===== TypeScript =====" -ForegroundColor Cyan
    & pnpm exec tsc --noEmit
    if ($LASTEXITCODE -ne 0) {
        throw "TypeScript validation failed."
    }
    Write-Host "TypeScript PASS" -ForegroundColor Green

    Write-Host ""
    Write-Host "===== Production Build =====" -ForegroundColor Cyan
    & pnpm build
    if ($LASTEXITCODE -ne 0) {
        throw "Production build failed."
    }
    Write-Host "Production build PASS" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "VALIDATION FAILED - restoring backup." -ForegroundColor Red
    Copy-Item -LiteralPath $Backup -Destination $Target -Force
    throw
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " FIX APPLIED AND VERIFIED LOCALLY" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Backup: $Backup"
Write-Host "Live site was NOT deployed or modified."
Write-Host ""
Write-Host "NEXT: Run the browser diagnostic/regression against local Merge PDF."
