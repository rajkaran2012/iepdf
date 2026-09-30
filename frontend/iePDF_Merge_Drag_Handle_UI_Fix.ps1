$ErrorActionPreference = "Stop"

$Root = "C:\IEPDF\frontend"
$WsFile = Join-Path $Root "components\MergeWorkspace.tsx"

if (-not (Test-Path $WsFile)) {
    throw "MergeWorkspace.tsx not found: $WsFile"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $Root "_ui-backups\merge-drag-handle-$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $WsFile (Join-Path $backupDir "MergeWorkspace.tsx") -Force

$text = Get-Content $WsFile -Raw

# Locate the existing drag-handle label and replace only its visual wrapper.
$old = '<span>Drag &amp; drop PDFs here</span>'
$new = '<span className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm" title="Drag to reorder"><span aria-hidden="true" className="text-base leading-none tracking-[-0.15em] text-slate-500">⋮⋮</span><span>Drag to reorder</span></span>'

if ($text.Contains($old)) {
    $text = $text.Replace($old, $new)
} else {
    # Fallback: patch the dedicated instruction text if the exact label has already changed.
    $pattern = '<span[^>]*>Drag\s+(?:&amp;|&)\s*drop PDFs here</span>'
    if ([regex]::IsMatch($text, $pattern)) {
        $text = [regex]::Replace($text, $pattern, $new, 1)
    } else {
        throw "The expected drag instruction marker was not found. No source change was made."
    }
}

# Make the actual draggable row/handle area easier to grab without touching
# reorder logic, validation, security, or workspace drop behavior.
$oldCursor = 'cursor-grab'
if ($text.Contains($oldCursor)) {
    $text = $text.Replace($oldCursor, 'cursor-grab select-none')
}

Set-Content -Path $WsFile -Value $text -Encoding utf8

Write-Host ""
Write-Host "Drag handle UI patch applied." -ForegroundColor Green
Write-Host "Backup: $backupDir"
Write-Host "Changed only drag-handle/instruction presentation."
Write-Host "Reorder logic, validation, security, external file-drop logic, and layout were not intentionally changed."
Write-Host ""
Write-Host "=== TypeScript ==="
Push-Location $Root
try {
    pnpm exec tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed." }
    Write-Host "TypeScript PASS" -ForegroundColor Green

    Write-Host ""
    Write-Host "=== Production build ==="
    pnpm build
    if ($LASTEXITCODE -ne 0) { throw "Production build failed." }
    Write-Host "Production build PASS" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Restoring backup..."
    Copy-Item (Join-Path $backupDir "MergeWorkspace.tsx") $WsFile -Force
    Write-Host "Original file restored. No deployment performed." -ForegroundColor Yellow
    throw
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "FIX COMPLETE" -ForegroundColor Green
Write-Host "Live site was NOT deployed or modified."
