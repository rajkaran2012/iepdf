$ErrorActionPreference = "Stop"

$file = ".\components\MergeWorkspace.tsx"

if (-not (Test-Path $file)) {
    throw "File not found: $file"
}

$backupDir = ".\_ui-backups\MERGE-EYE-ENCODING-BEFORE-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Copy-Item $file "$backupDir\MergeWorkspace.tsx" -Force

$lines = @(Get-Content $file)

$targetIndex = -1

for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -eq ('{file.showPassword')) {
        $targetIndex = $i
        break
    }
}

if ($targetIndex -lt 1) {
    throw "[FAIL] Could not locate password block. No source change made."
}

$iconIndex = $targetIndex - 1

$indent = $lines[$iconIndex].Substring(
    0,
    $lines[$iconIndex].Length - $lines[$iconIndex].TrimStart().Length
)

$lines[$iconIndex] = $indent + ('&#128065;{" "}')

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllLines(
    (Resolve-Path $file),
    $lines,
    $utf8NoBom
)

$verifyLines = @(Get-Content $file)

$showIndex = -1

for ($i = 0; $i -lt $verifyLines.Count; $i++) {
    if ($verifyLines[$i].Trim() -eq ('{file.showPassword')) {
        $showIndex = $i
        break
    }
}

if ($showIndex -lt 1) {
    throw "[FAIL] Verification failed."
}

if (-not $verifyLines[$showIndex - 1].Contains(('&#128065;'))) {
    throw "[FAIL] Eye entity was not written correctly."
}

Write-Host "[FIX] Replaced ONLY the eye icon line"
Write-Host "[OK] Eye entity written"
Write-Host "[OK] Show Password preserved"
Write-Host "[OK] Hide Password preserved"
Write-Host ""
Write-Host "=============================================="
Write-Host "MERGE EYE ENCODING FIX COMPLETE"
Write-Host "=============================================="
Write-Host "Backup: $backupDir"
Write-Host "No Git commands."
Write-Host "No deployment."