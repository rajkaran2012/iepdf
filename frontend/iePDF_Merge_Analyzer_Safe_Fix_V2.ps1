$ErrorActionPreference = "Stop"

# ============================================================
# iePDF Merge - Analyzer Safe Fix V2
# Robust structural patch. No live deployment.
# ============================================================

$Root = "C:\IEPDF\frontend"
$Target = Join-Path $Root "engine\analysis\BrowserPdfAnalyzer.ts"
$BackupRoot = Join-Path $Root "_ui-backups"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $BackupRoot ("merge-analyzer-fix-v2-" + $Stamp)
$Backup = Join-Path $BackupDir "BrowserPdfAnalyzer.ts"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " iePDF Merge - Analyzer Safe Fix V2" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

if (-not (Test-Path $Target)) {
    throw "Target file not found: $Target"
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
Copy-Item -LiteralPath $Target -Destination $Backup -Force
Write-Host "Backup: $Backup" -ForegroundColor Yellow

$content = Get-Content -LiteralPath $Target -Raw

# Locate analyzeMany structurally, independent of indentation/formatting.
$methodPattern = '(?ms)(^[ \t]*async[ \t]+analyzeMany[ \t]*\([ \t]*files[ \t]*:[ \t]*File\[\][ \t]*\)[ \t]*(?::[^{]+)?\{).*?^[ \t]*\}'
$match = [regex]::Match($content, $methodPattern)

if (-not $match.Success) {
    Write-Host ""
    Write-Host "Current BrowserPdfAnalyzer.ts analyzeMany() source:" -ForegroundColor Yellow
    $idx = $content.IndexOf("analyzeMany")
    if ($idx -ge 0) {
        $start = [Math]::Max(0, $idx - 300)
        $len = [Math]::Min(1800, $content.Length - $start)
        Write-Host $content.Substring($start, $len)
    }
    throw "Could not locate analyzeMany() structurally. Backup exists; no source changes made."
}

$oldMethod = $match.Value

$newMethod = @'
  async analyzeMany(files: File[]): Promise<AnalysisResult[]> {
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

$updated = $content.Substring(0, $match.Index) +
           $newMethod +
           $content.Substring($match.Index + $match.Length)

# Safety checks before writing.
if (-not $updated.Contains("async analyzeMany(files: File[]): Promise<AnalysisResult[]>")) {
    throw "Safety check failed: new analyzeMany() not present."
}

if (-not $updated.Contains("const result = await this.analyze(file);")) {
    throw "Safety check failed: per-file analysis call not present."
}

if (-not $updated.Contains("return results;")) {
    throw "Safety check failed: results return not present."
}

[IO.File]::WriteAllText(
    $Target,
    $updated,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Analyzer patch applied." -ForegroundColor Green
Write-Host ""
Write-Host "Patch scope:" -ForegroundColor Cyan
Write-Host " - BrowserPdfAnalyzer.ts only"
Write-Host " - analyzeMany() only"
Write-Host " - Per-file failure isolation"
Write-Host " - No validation/security bypass"
Write-Host " - No LaunchAction changes"
Write-Host " - No file-size limit changes"
Write-Host " - No processor changes"
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
    Write-Host "VALIDATION FAILED - restoring exact backup." -ForegroundColor Red
    Copy-Item -LiteralPath $Backup -Destination $Target -Force
    throw
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " ANALYZER FIX V2 APPLIED AND VERIFIED" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Backup: $Backup"
Write-Host "Live site was NOT deployed or modified."
Write-Host ""
Write-Host "NEXT: Run the local browser Merge regression."
