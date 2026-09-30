$ErrorActionPreference = "Stop"

$thumbnailFile = ".\components\pdf\PdfThumbnail.tsx"
$mergeFile = ".\components\MergeWorkspace.tsx"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " iePDF - MERGE PHASE 1 / STEP 1.1 FINAL" -ForegroundColor Cyan
Write-Host " LOCKED THUMBNAIL DIMENSION FIX" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $thumbnailFile)) {
    throw "PdfThumbnail.tsx not found."
}

if (-not (Test-Path $mergeFile)) {
    throw "MergeWorkspace.tsx not found."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = ".\_ui-backups\MERGE-STEP1-1-FINAL-BEFORE-$timestamp"

Write-Host "[1/6] Creating safety backup..." -ForegroundColor Yellow

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

Copy-Item $thumbnailFile "$backupDir\PdfThumbnail.tsx" -Force
Copy-Item $mergeFile "$backupDir\MergeWorkspace.tsx" -Force

Write-Host "[OK] Backup created:" -ForegroundColor Green
Write-Host "     $backupDir"
Write-Host ""

Write-Host "[2/6] Reading current thumbnail component..." -ForegroundColor Yellow

$thumbnailText = Get-Content -Raw -Encoding UTF8 $thumbnailFile
$mergeText = Get-Content -Raw -Encoding UTF8 $mergeFile

$oldLockedBlock = @'
            <div
                className={`flex h-48 items-center justify-center rounded-xl border bg-gray-50 text-center shadow-sm ${className}`}
            >
'@

$newLockedBlock = @'
            <div
                style={{
                    width: `${width}px`,
                    aspectRatio: "1 / 1.4142",
                }}
                className={`flex items-center justify-center rounded-xl border bg-gray-50 text-center shadow-sm ${className}`}
            >
'@

$count = ([regex]::Matches(
    $thumbnailText,
    [regex]::Escape($oldLockedBlock)
)).Count

if ($count -ne 1) {
    throw "Expected exactly one locked thumbnail block, found $count. FILES NOT CHANGED."
}

Write-Host "[OK] Exact hard-coded h-48 locked preview found." -ForegroundColor Green
Write-Host ""

Write-Host "[3/6] Replacing hard-coded locked height..." -ForegroundColor Yellow

$thumbnailText = $thumbnailText.Replace(
    $oldLockedBlock,
    $newLockedBlock
)

Write-Host "[OK] Locked preview now follows width prop." -ForegroundColor Green
Write-Host ""

Write-Host "[4/6] Verifying Merge compact width..." -ForegroundColor Yellow

$mergeWidthPattern = 'width={76}'

if ($mergeText.IndexOf(
    $mergeWidthPattern,
    [System.StringComparison]::Ordinal
) -lt 0) {
    throw "Merge compact thumbnail width={76} was not found. FILES NOT CHANGED."
}

Write-Host "[OK] Merge uses width={76}." -ForegroundColor Green
Write-Host ""

Write-Host "[5/6] Writing UTF-8 without BOM..." -ForegroundColor Yellow

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    (Resolve-Path $thumbnailFile),
    $thumbnailText,
    $utf8NoBom
)

Write-Host "[OK] PdfThumbnail.tsx written." -ForegroundColor Green
Write-Host ""

Write-Host "[6/6] Verifying critical source..." -ForegroundColor Yellow

$verifyThumbnail = Get-Content -Raw -Encoding UTF8 $thumbnailFile
$verifyMerge = Get-Content -Raw -Encoding UTF8 $mergeFile

$thumbnailRequired = @(
    'width: `${width}px`',
    'aspectRatio: "1 / 1.4142"',
    'locked = false',
    'file'
)

foreach ($term in $thumbnailRequired) {

    if ($verifyThumbnail.IndexOf(
        $term,
        [System.StringComparison]::Ordinal
    ) -lt 0) {
        throw "Verification failed in PdfThumbnail.tsx: $term"
    }

    Write-Host "[OK] PdfThumbnail: $term" -ForegroundColor Green
}

$mergeRequired = @(
    'width={76}',
    'onPasswordChange',
    'onPasswordBlur',
    'onTogglePassword',
    'onSkipFile',
    'onRemoveFile',
    'onUnlockMerge',
    'const canMerge'
)

foreach ($term in $mergeRequired) {

    if ($verifyMerge.IndexOf(
        $term,
        [System.StringComparison]::OrdinalIgnoreCase
    ) -lt 0) {
        throw "Verification failed in MergeWorkspace.tsx: $term"
    }

    Write-Host "[OK] MergeWorkspace: $term" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " STEP 1.1 FINAL THUMBNAIL FIX COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[OK] Locked preview no longer uses fixed h-48"
Write-Host "[OK] Locked preview follows width prop"
Write-Host "[OK] A4-like portrait ratio applied"
Write-Host "[OK] Merge compact width preserved"
Write-Host "[OK] Normal PDF thumbnail behavior unchanged"
Write-Host "[OK] Password logic untouched"
Write-Host "[OK] Validation untouched"
Write-Host "[OK] Merge processor untouched"
Write-Host "[OK] Right panel untouched"
Write-Host "[OK] Homepage untouched"
Write-Host "[OK] No Git commands"
Write-Host "[OK] No deployment"
Write-Host ""
Write-Host "Backup:"
Write-Host "  $backupDir"
Write-Host ""