$ErrorActionPreference = "Stop"

$Root = "C:\IEPDF\frontend"
$WsFile = Join-Path $Root "components\MergeWorkspace.tsx"

if (-not (Test-Path $WsFile)) {
    throw "MergeWorkspace.tsx not found: $WsFile"
}

$enc = New-Object System.Text.UTF8Encoding($false)
$text = [IO.File]::ReadAllText((Resolve-Path $WsFile), $enc)
$original = $text

# We intentionally patch the ACTUAL drag-handle element, not the instruction text.
# This keeps all reorder logic, validation, security, drop handling and layout untouched.
$pattern = '(?s)(aria-label=\{`Drag PDF \$\{index \+ 1\} to reorder`\}\s+title="Drag to reorder"\s+className=\{`)(.*?)(`\})'

$m = [regex]::Match($text, $pattern)
if (-not $m.Success) {
    throw "Actual PDF drag-handle element was not found. No source change was made."
}

$oldClass = $m.Groups[2].Value

# Expected current class contains the existing 8x8 handle.
# Do not proceed if the structure is unexpectedly different.
if ($oldClass -notmatch 'h-8\s+w-8' -or $oldClass -notmatch 'cursor-grab') {
    throw "Drag-handle class structure is different from the expected current UI. No source change was made."
}

$newClass = $oldClass `
    -replace 'h-8\s+w-8', 'h-10 w-10' `
    -replace 'text-gray-400', 'text-slate-600' `
    -replace 'rounded-lg', 'rounded-lg border border-slate-300 bg-slate-50' `
    -replace 'cursor-grab', 'cursor-grab select-none' `
    -replace 'hover:bg-gray-100', 'hover:bg-slate-100' `
    -replace 'hover:text-gray-700', 'hover:text-slate-900'

$text = $text.Substring(0, $m.Groups[2].Index) +
        $newClass +
        $text.Substring($m.Groups[2].Index + $m.Groups[2].Length)

# Make the six-dot SVG visibly larger. This is presentation-only.
$svgPattern = '(?s)(aria-label=\{`Drag PDF \$\{index \+ 1\} to reorder`\}.*?<svg\s+viewBox="0 0 24 24".*?className=")h-4 w-4(")'
if (-not [regex]::IsMatch($text, $svgPattern)) {
    throw "Drag-handle SVG marker was not found. No source change was made."
}

$text = [regex]::Replace($text, $svgPattern, '${1}h-5 w-5${2}', 1)

$strokePattern = '(?s)(aria-label=\{`Drag PDF \$\{index \+ 1\} to reorder`\}.*?<svg\s+viewBox="0 0 24 24".*?strokeWidth=")2(")'
if ([regex]::IsMatch($text, $strokePattern)) {
    $text = [regex]::Replace($text, $strokePattern, '${1}2.2${2}', 1)
}

if ($text -eq $original) {
    throw "No change was produced. STOP."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $Root "_ui-backups\merge-drag-handle-ui-v2-$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $WsFile (Join-Path $backupDir "MergeWorkspace.tsx") -Force

[IO.File]::WriteAllText((Resolve-Path $WsFile), $text, $enc)

Write-Host ""
Write-Host "DRAG HANDLE UI V2 APPLIED" -ForegroundColor Green
Write-Host "Backup: $backupDir"
Write-Host ""
Write-Host "Only the existing PDF reorder handle presentation was changed:"
Write-Host "  - larger 40x40 grab area"
Write-Host "  - visible border/background"
Write-Host "  - darker six-dot icon"
Write-Host "  - larger icon"
Write-Host "  - clearer grab cursor"
Write-Host ""
Write-Host "Reorder logic, security validation, external file drop, file processing and Merge layout were not changed."
Write-Host ""

Push-Location $Root
try {
    Write-Host "=== TypeScript ===" -ForegroundColor Cyan
    pnpm exec tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed." }
    Write-Host "TypeScript PASS" -ForegroundColor Green

    Write-Host ""
    Write-Host "=== Production build ===" -ForegroundColor Cyan
    pnpm build
    if ($LASTEXITCODE -ne 0) { throw "Production build failed." }
    Write-Host "Production build PASS" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Restoring original MergeWorkspace.tsx..."
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
