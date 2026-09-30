$ErrorActionPreference = "Stop"

$file = ".\components\MergeWorkspace.tsx"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " iePDF - MERGE ENCODING FINAL CLEANUP" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $file)) {
    throw "MergeWorkspace.tsx not found."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = ".\_ui-backups\MERGE-ENCODING-FINAL-BEFORE-$timestamp"

Write-Host "[1/5] Creating safety backup..." -ForegroundColor Yellow

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $file "$backupDir\MergeWorkspace.tsx" -Force

Write-Host "[OK] Backup created:"
Write-Host "     $backupDir" -ForegroundColor Green
Write-Host ""

$text = Get-Content -Raw -Encoding UTF8 $file

Write-Host "[2/5] Building exact corrupted sequences..." -ForegroundColor Yellow

# Actual source strings confirmed by the user's Select-String output.
# Construct them from Unicode code points so this script remains ASCII-only.

# mojibake: a + check-mark fragments
$badCheck = ([char]0x00E2) + ([char]0x0153) + ([char]0x201C)

# mojibake: a + cross fragments
$badCross = ([char]0x00E2) + ([char]0x0153) + ([char]0x2022)

# mojibake: lock emoji fragments
$badLock = ([char]0x00F0) + ([char]0x0178) + ([char]0x201D) + ([char]0x2019)

# mojibake: eye emoji fragments
$badEye = ([char]0x00F0) + ([char]0x0178) + ([char]0x2011) + ([char]0x0081)

Write-Host "[OK] Corrupted sequences prepared." -ForegroundColor Green
Write-Host ""

Write-Host "[3/5] Replacing exact corrupted symbols..." -ForegroundColor Yellow

$replacementCount = 0

$replacements = @(
    @{
        Name = "READY CHECK"
        Bad = $badCheck
        Good = "&#10003;"
    },
    @{
        Name = "ERROR CROSS"
        Bad = $badCross
        Good = "&#10005;"
    },
    @{
        Name = "LOCK ICON"
        Bad = $badLock
        Good = "&#128274;"
    },
    @{
        Name = "EYE ICON"
        Bad = $badEye
        Good = "&#128065;"
    }
)

foreach ($item in $replacements) {

    $count = ([regex]::Matches(
        $text,
        [regex]::Escape($item.Bad)
    )).Count

    if ($count -gt 0) {

        $text = $text.Replace(
            $item.Bad,
            $item.Good
        )

        Write-Host "[FIX] $($item.Name): $count occurrence(s)" -ForegroundColor Green

        $replacementCount += $count
    }
    else {

        Write-Host "[OK] $($item.Name): no occurrence found"

    }
}

Write-Host ""
Write-Host "Total replacements: $replacementCount"
Write-Host ""

Write-Host "[4/5] Writing UTF-8 without BOM..." -ForegroundColor Yellow

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    (Resolve-Path $file),
    $text,
    $utf8NoBom
)

Write-Host "[OK] Source written." -ForegroundColor Green
Write-Host ""

Write-Host "[5/5] Verifying corrupted sequences..." -ForegroundColor Yellow

$verify = Get-Content -Raw -Encoding UTF8 $file

$remaining = 0

$badSequences = @(
    @{
        Name = "READY CHECK"
        Value = $badCheck
    },
    @{
        Name = "ERROR CROSS"
        Value = $badCross
    },
    @{
        Name = "LOCK ICON"
        Value = $badLock
    },
    @{
        Name = "EYE ICON"
        Value = $badEye
    }
)

foreach ($item in $badSequences) {

    $count = ([regex]::Matches(
        $verify,
        [regex]::Escape($item.Value)
    )).Count

    if ($count -gt 0) {

        Write-Host "[FAIL] $($item.Name): $count remaining" -ForegroundColor Red

        $remaining += $count

    }
    else {

        Write-Host "[OK] $($item.Name): clean" -ForegroundColor Green

    }
}

if ($remaining -gt 0) {
    throw "Encoding verification failed. Corrupted sequences remain."
}

$required = @(
    "onPasswordChange",
    "onPasswordBlur",
    "onTogglePassword",
    "onSkipFile",
    "onRemoveFile",
    "onUnlockMerge",
    "const canMerge",
    "width={76}"
)

foreach ($term in $required) {

    if ($verify.IndexOf(
        $term,
        [System.StringComparison]::OrdinalIgnoreCase
    ) -lt 0) {

        throw "Required source marker missing: $term"

    }

    Write-Host "[OK] Preserved: $term" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " MERGE ENCODING FINAL CLEANUP COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[OK] Encoding defects removed"
Write-Host "[OK] Existing handlers preserved"
Write-Host "[OK] Compact thumbnail preserved"
Write-Host "[OK] Merge logic untouched"
Write-Host "[OK] Password logic untouched"
Write-Host "[OK] Validation untouched"
Write-Host "[OK] Processor untouched"
Write-Host "[OK] Right panel untouched"
Write-Host "[OK] Homepage untouched"
Write-Host "[OK] No Git commands"
Write-Host "[OK] No deployment"
Write-Host ""
Write-Host "Backup:"
Write-Host "  $backupDir"
Write-Host ""