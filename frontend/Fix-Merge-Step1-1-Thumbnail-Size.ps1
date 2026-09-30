$ErrorActionPreference = "Stop"

$file = ".\components\MergeWorkspace.tsx"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " iePDF - MERGE PHASE 1 / STEP 1.1" -ForegroundColor Cyan
Write-Host " COMPACT MERGE THUMBNAIL" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $file)) {
    throw "MergeWorkspace.tsx not found."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = ".\_ui-backups\MERGE-STEP1-1-THUMBNAIL-BEFORE-$timestamp"

Write-Host "[1/6] Creating safety backup..." -ForegroundColor Yellow

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $file "$backupDir\MergeWorkspace.tsx" -Force

Write-Host "[OK] Backup created: $backupDir" -ForegroundColor Green
Write-Host ""

$text = Get-Content -Raw -Encoding UTF8 $file

Write-Host "[2/6] Locating Merge PdfThumbnail..." -ForegroundColor Yellow

$oldThumbnail = @'
                                    <PdfThumbnail
                                        file={file.file}
                                        locked={
                                            file.status ===
                                            "password_required"
                                        }
                                    />
'@

$count = ([regex]::Matches(
    $text,
    [regex]::Escape($oldThumbnail)
)).Count

if ($count -ne 1) {
    throw "Expected exactly one Merge PdfThumbnail block, found $count. FILE NOT CHANGED."
}

Write-Host "[OK] Exact Merge PdfThumbnail found." -ForegroundColor Green
Write-Host ""

Write-Host "[3/6] Applying compact thumbnail width..." -ForegroundColor Yellow

$newThumbnail = @'
                                    <PdfThumbnail
                                        file={file.file}
                                        locked={
                                            file.status ===
                                            "password_required"
                                        }
                                        width={76}
                                    />
'@

$text = $text.Replace($oldThumbnail, $newThumbnail)

Write-Host "[OK] Merge thumbnail width set to 76px." -ForegroundColor Green
Write-Host ""

Write-Host "[4/6] Updating compact row alignment..." -ForegroundColor Yellow

$oldRow = 'className="flex min-w-0 items-center gap-3 px-4 py-3"'
$newRow = 'className="flex min-w-0 items-center gap-3 px-4 py-2.5"'

if ($text.IndexOf($oldRow, [System.StringComparison]::Ordinal) -lt 0) {
    throw "Compact row class not found. FILE NOT CHANGED."
}

$text = $text.Replace($oldRow, $newRow)

Write-Host "[OK] Row vertical padding reduced." -ForegroundColor Green
Write-Host ""

Write-Host "[5/6] Writing UTF-8 without BOM..." -ForegroundColor Yellow

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    (Resolve-Path $file),
    $text,
    $utf8NoBom
)

Write-Host "[OK] File written." -ForegroundColor Green
Write-Host ""

Write-Host "[6/6] Verifying critical functionality..." -ForegroundColor Yellow

$verify = Get-Content -Raw -Encoding UTF8 $file

$required = @(
    "width={76}",
    "onPasswordChange",
    "onPasswordBlur",
    "onTogglePassword",
    "onSkipFile",
    "onRemoveFile",
    "onUnlockMerge",
    "const canMerge"
)

foreach ($term in $required) {

    if ($verify.IndexOf($term, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
        throw "Verification failed: $term is missing."
    }

    Write-Host "[OK] $term" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " STEP 1.1 THUMBNAIL COMPACTION COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[OK] Merge-only thumbnail reduced to 76px"
Write-Host "[OK] Existing PdfThumbnail component unchanged"
Write-Host "[OK] Other tools unaffected"
Write-Host "[OK] Password logic untouched"
Write-Host "[OK] Validation untouched"
Write-Host "[OK] Merge processor untouched"
Write-Host "[OK] Skip/Restore preserved"
Write-Host "[OK] Remove preserved"
Write-Host "[OK] Right panel untouched"
Write-Host "[OK] Homepage untouched"
Write-Host "[OK] No Git commands"
Write-Host "[OK] No deployment"
Write-Host ""
Write-Host "Backup:"
Write-Host "  $backupDir"
Write-Host ""