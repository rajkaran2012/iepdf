$ErrorActionPreference = "Stop"

$file = ".\components\MergeWorkspace.tsx"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " iePDF - MERGE ENCODING CLEANUP" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $file)) {
    throw "MergeWorkspace.tsx not found."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = ".\_ui-backups\MERGE-ENCODING-BEFORE-$timestamp"

Write-Host "[1/4] Creating safety backup..." -ForegroundColor Yellow

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $file "$backupDir\MergeWorkspace.tsx" -Force

Write-Host "[OK] Backup created: $backupDir" -ForegroundColor Green
Write-Host ""

$text = Get-Content -Raw -Encoding UTF8 $file

Write-Host "[2/4] Preparing encoding corrections..." -ForegroundColor Yellow

# Build mojibake strings by character code so this script itself
# does not depend on console/file encoding.

$checkBad = ([char]0x00E2) + ([char]0x0153) + ([char]0x2026)
$bulletBad = ([char]0x00E2) + ([char]0x20AC) + ([char]0x00A2)

$restoreBad = ([char]0x00E2) + ([char]0x2020) + ([char]0x2019)
$skipBad = ([char]0x00E2) + ([char]0x008F) + ([char]0x00AD)

$unlockBad = ([char]0x00F0) + ([char]0x0178) + ([char]0x201D)

# Replace with HTML entities / plain safe text.
$replacements = @(
    @{
        Name = "Check mark"
        Old = $checkBad
        New = "&#10003;"
    },
    @{
        Name = "Bullet"
        Old = $bulletBad
        New = "&#8226;"
    },
    @{
        Name = "Restore arrow"
        Old = $restoreBad
        New = "&#8617;"
    },
    @{
        Name = "Skip symbol"
        Old = $skipBad
        New = "&#9654;"
    }
)

$changed = 0

foreach ($item in $replacements) {

    $count = ([regex]::Matches(
        $text,
        [regex]::Escape($item.Old)
    )).Count

    if ($count -gt 0) {
        $text = $text.Replace($item.Old, $item.New)

        Write-Host "[FIX] $($item.Name): $count occurrence(s)" -ForegroundColor Green
        $changed += $count
    }
}

Write-Host ""

# Explicitly remove the common visible mojibake variants if present.
# These are handled using Unicode character construction rather than
# literal corrupted text.

$moreBad = @(
    @{
        Name = "Check mark variant"
        Old = ([char]0x00E2) + ([char]0x0153) + ([char]0x0085)
        New = "&#10003;"
    },
    @{
        Name = "Bullet variant"
        Old = ([char]0x00E2) + ([char]0x20AC) + ([char]0x00A2)
        New = "&#8226;"
    },
    @{
        Name = "Right arrow variant"
        Old = ([char]0x00E2) + ([char]0x2020) + ([char]0x2019)
        New = "&#8594;"
    }
)

foreach ($item in $moreBad) {

    $count = ([regex]::Matches(
        $text,
        [regex]::Escape($item.Old)
    )).Count

    if ($count -gt 0) {
        $text = $text.Replace($item.Old, $item.New)

        Write-Host "[FIX] $($item.Name): $count occurrence(s)" -ForegroundColor Green
        $changed += $count
    }
}

Write-Host "[3/4] Writing corrected source..." -ForegroundColor Yellow

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    (Resolve-Path $file),
    $text,
    $utf8NoBom
)

Write-Host "[OK] MergeWorkspace.tsx written as UTF-8 without BOM." -ForegroundColor Green
Write-Host ""

Write-Host "[4/4] Verifying no requested mojibake remains..." -ForegroundColor Yellow

$verify = Get-Content -Raw -Encoding UTF8 $file

$badPatterns = @(
    $checkBad,
    $bulletBad,
    $restoreBad
)

$remaining = 0

foreach ($bad in $badPatterns) {

    $count = ([regex]::Matches(
        $verify,
        [regex]::Escape($bad)
    )).Count

    if ($count -gt 0) {
        $remaining += $count
    }
}

if ($remaining -gt 0) {
    throw "Verification failed: $remaining mojibake occurrence(s) remain."
}

$required = @(
    "Ready",
    "Skipped",
    "Invalid PDF",
    "Corrupted",
    "Password Required",
    "onUnlockMerge",
    "onRemoveFile",
    "onSkipFile",
    "onPasswordChange"
)

foreach ($term in $required) {

    if ($verify.IndexOf(
        $term,
        [System.StringComparison]::OrdinalIgnoreCase
    ) -lt 0) {
        throw "Verification failed: required text/handler missing: $term"
    }
}

Write-Host "[OK] Requested encoding defects removed." -ForegroundColor Green
Write-Host "[OK] Existing functionality markers preserved." -ForegroundColor Green

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " MERGE ENCODING CLEANUP COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[OK] Ready symbol corrected"
Write-Host "[OK] Bullet separator corrected"
Write-Host "[OK] Arrow/symbol encoding corrected where found"
Write-Host "[OK] No merge logic changed"
Write-Host "[OK] No password logic changed"
Write-Host "[OK] No validation changed"
Write-Host "[OK] No processor changed"
Write-Host "[OK] No layout changed"
Write-Host "[OK] No Git commands"
Write-Host "[OK] No deployment"
Write-Host ""
Write-Host "Backup:"
Write-Host "  $backupDir"
Write-Host ""