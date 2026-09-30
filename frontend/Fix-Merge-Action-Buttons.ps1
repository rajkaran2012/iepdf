$ErrorActionPreference = "Stop"

$path = ".\components\MergeWorkspace.tsx"
$fullPath = (Resolve-Path $path).Path

Write-Host "Applying global-standard PDF action buttons..." -ForegroundColor Cyan

$utf8 = [System.Text.Encoding]::UTF8
$text = [System.IO.File]::ReadAllText($fullPath, $utf8)

# ============================================================
# VERIFY CURRENT ACTION AREA
# ============================================================

if (-not $text.Contains("{/* Common Actions */}")) {
    throw "Common Actions section not found. FILE NOT CHANGED."
}

if (-not $text.Contains("onSkipFile")) {
    throw "onSkipFile handler not found. FILE NOT CHANGED."
}

if (-not $text.Contains("onRemoveFile")) {
    throw "onRemoveFile handler not found. FILE NOT CHANGED."
}

Write-Host "[OK] Common Actions section found" -ForegroundColor Green
Write-Host "[OK] Skip/Restore handler found" -ForegroundColor Green
Write-Host "[OK] Remove handler found" -ForegroundColor Green

# ============================================================
# BACKUP
# ============================================================

$backupDir = ".\_ui-backups\MERGE-ACTION-BUTTONS-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $fullPath "$backupDir\MergeWorkspace.tsx" -Force

# ============================================================
# REPLACE ONLY THE COMMON ACTION BUTTONS
# ============================================================

$pattern = '(?s)\{\s*/\*\s*Common Actions\s*\*/\s*\}\s*<div className="flex gap-2">\s*<button.*?onSkipFile\(.*?</button>\s*<button.*?onRemoveFile\(.*?</button>\s*</div>'

$match = [regex]::Match($text, $pattern)

if (-not $match.Success) {
    throw "Current Common Actions button block could not be safely located. FILE NOT CHANGED."
}

$newBlock = @'
{/* Common Actions */}

<div className="flex items-center gap-2">

    {/* Skip / Restore */}

    <button
        type="button"
        onClick={() => onSkipFile(file.id)}
        aria-label={file.skipped ? "Restore PDF" : "Skip PDF"}
        title={file.skipped ? "Restore PDF" : "Skip PDF"}
        className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
            file.skipped
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
    >
        {file.skipped ? (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
                aria-hidden="true"
            >
                <path d="M9 14l-4-4 4-4" />
                <path d="M5 10h9a4 4 0 0 1 4 4v1" />
            </svg>
        ) : (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
                aria-hidden="true"
            >
                <path d="M5 5v14l6-5h8V10h-8L5 5z" />
            </svg>
        )}

        <span className="sr-only">
            {file.skipped ? "Restore PDF" : "Skip PDF"}
        </span>
    </button>

    {/* Remove */}

    <button
        type="button"
        onClick={() => onRemoveFile(file.id)}
        aria-label="Remove PDF"
        title="Remove PDF"
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-700"
    >
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
            aria-hidden="true"
        >
            <path d="M4 7h16" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M6 7l1 13h10l1-13" />
            <path d="M9 7V4h6v3" />
        </svg>

        <span className="sr-only">
            Remove PDF
        </span>
    </button>

</div>
'@

$text = $text.Remove(
    $match.Index,
    $match.Length
).Insert(
    $match.Index,
    $newBlock
)

# ============================================================
# SAFETY CHECKS
# ============================================================

if (-not $text.Contains("onSkipFile(file.id)")) {
    throw "Skip handler was not preserved. FILE NOT CHANGED."
}

if (-not $text.Contains("onRemoveFile(file.id)")) {
    throw "Remove handler was not preserved. FILE NOT CHANGED."
}

if (-not $text.Contains('aria-label="Remove PDF"')) {
    throw "Remove accessibility label missing. FILE NOT CHANGED."
}

if (-not $text.Contains('title="Remove PDF"')) {
    throw "Remove tooltip missing. FILE NOT CHANGED."
}

if (-not $text.Contains('title={file.skipped ? "Restore PDF" : "Skip PDF"}')) {
    throw "Skip/Restore tooltip missing. FILE NOT CHANGED."
}

if (-not $text.Contains('className="flex h-10 w-10 items-center justify-center')) {
    throw "Compact icon-button layout missing. FILE NOT CHANGED."
}

# Exactly one Common Actions section
$commonCount = (
    [regex]::Matches(
        $text,
        '\{\s*/\*\s*Common Actions\s*\*/\s*\}'
    )
).Count

if ($commonCount -ne 1) {
    throw "Expected exactly one Common Actions section. Found $commonCount. FILE NOT CHANGED."
}

# No fixed/sticky button introduced
if ($text.Contains("fixed bottom-5 left-1/2")) {
    throw "Floating button detected. FILE NOT CHANGED."
}

if ($text.Contains("sticky bottom-0")) {
    throw "Sticky button detected. FILE NOT CHANGED."
}

# ============================================================
# WRITE UTF-8 WITHOUT BOM
# ============================================================

$noBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    $fullPath,
    $text,
    $noBom
)

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host " GLOBAL-STANDARD ACTION BUTTONS APPLIED" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[OK] Skip/Restore converted to compact icon button"
Write-Host "[OK] Remove converted to compact icon button"
Write-Host "[OK] Native hover tooltips added"
Write-Host "[OK] Accessible aria-labels added"
Write-Host "[OK] Screen-reader labels preserved"
Write-Host "[OK] Existing handlers preserved"
Write-Host "[OK] Merge logic untouched"
Write-Host "[OK] Password logic untouched"
Write-Host "[OK] Validation untouched"
Write-Host "[OK] 90% workspace untouched"
Write-Host "[OK] Right panel untouched"
Write-Host "[OK] Homepage untouched"
Write-Host "[OK] No floating button"
Write-Host "[OK] No sticky button"
Write-Host "[OK] No Git commands"
Write-Host "[OK] No deployment"
Write-Host ""
Write-Host "Backup:"
Write-Host $backupDir
Write-Host ""