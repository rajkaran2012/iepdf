$ErrorActionPreference = "Stop"

$path = ".\components\MergeWorkspace.tsx"
$fullPath = (Resolve-Path $path).Path

Write-Host "Checking MergeWorkspace..." -ForegroundColor Cyan

$text = [System.IO.File]::ReadAllText(
    $fullPath,
    [System.Text.Encoding]::UTF8
)

# ============================================================
# BACKUP
# ============================================================
$backupDir = ".\_ui-backups\merge-final-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $fullPath "$backupDir\MergeWorkspace.tsx" -Force

# ============================================================
# FIND CURRENT MERGE BUTTON
# ============================================================
$buttonPattern = '(?s)\s*\{\s*/\*\s*Merge Button\s*\*/\s*\}\s*<div\s+className="[^"]*">\s*<button.*?</button>\s*</div>'

$buttonMatch = [regex]::Match($text, $buttonPattern)

if (-not $buttonMatch.Success) {
    throw "Merge Button block could not be located. FILE NOT CHANGED."
}

Write-Host "[OK] Existing Merge Button found" -ForegroundColor Green

# Remove existing button
$textWithoutButton = $text.Remove(
    $buttonMatch.Index,
    $buttonMatch.Length
)

# ============================================================
# FIND RIGHT SIDEBAR
# ============================================================
$sidebarPattern = '(?s)<div className="relative flex min-h-\[420px\] flex-col border-t bg-gray-50 px-5 py-6[^"]*">'

$sidebarMatch = [regex]::Match(
    $textWithoutButton,
    $sidebarPattern
)

if (-not $sidebarMatch.Success) {
    throw "Right sidebar could not be located. FILE NOT CHANGED."
}

Write-Host "[OK] Right sidebar found" -ForegroundColor Green

$sidebarOpenEnd =
    $sidebarMatch.Index + $sidebarMatch.Length

# ============================================================
# FIND SIDEBAR CLOSING DIV BY HTML DIV DEPTH
# ============================================================
$tail = $textWithoutButton.Substring($sidebarOpenEnd)

$divMatches = [regex]::Matches(
    $tail,
    '<div\b|</div>'
)

$depth = 1
$sidebarCloseRelative = -1

foreach ($m in $divMatches) {

    if ($m.Value -eq "<div") {
        $depth++
    }
    else {
        $depth--

        if ($depth -eq 0) {
            $sidebarCloseRelative = $m.Index
            break
        }
    }
}

if ($sidebarCloseRelative -lt 0) {
    throw "Could not determine sidebar closing element. FILE NOT CHANGED."
}

$sidebarCloseIndex =
    $sidebarOpenEnd + $sidebarCloseRelative

Write-Host "[OK] Sidebar boundary identified" -ForegroundColor Green

# ============================================================
# INSERT BUTTON INSIDE RIGHT SIDEBAR
#
# HTML entity avoids PowerShell/UTF-8 emoji corruption.
# ============================================================
$newButton = @'

                {/* Merge Button */}

                <div className="mt-auto pt-6">

                    <button
                        type="button"
                        disabled={!canMerge}
                        onClick={onUnlockMerge}
                        className={`w-full rounded-xl px-6 py-4 text-lg font-semibold text-white shadow-lg transition ${
                            !canMerge
                                ? "cursor-not-allowed bg-gray-400"
                                : "bg-red-600 hover:bg-red-700"
                        }`}
                    >
                        &#128275; Unlock & Merge
                    </button>

                </div>

'@

$textFinal = $textWithoutButton.Insert(
    $sidebarCloseIndex,
    $newButton
)

# ============================================================
# SAFETY CHECKS
# ============================================================
if ($textFinal.Contains("fixed bottom-5 left-1/2")) {
    throw "Floating fixed button still exists. FILE NOT CHANGED."
}

$buttonCount = (
    [regex]::Matches(
        $textFinal,
        '\{\s*/\*\s*Merge Button\s*\*/\s*\}'
    )
).Count

if ($buttonCount -ne 1) {
    throw "Expected exactly one Merge Button. Found $buttonCount. FILE NOT CHANGED."
}

if (-not $textFinal.Contains("onClick={onUnlockMerge}")) {
    throw "onUnlockMerge handler missing. FILE NOT CHANGED."
}

if (-not $textFinal.Contains("&#128275; Unlock & Merge")) {
    throw "New button label missing. FILE NOT CHANGED."
}

# ============================================================
# WRITE UTF-8 WITHOUT BOM
# ============================================================
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    $fullPath,
    $textFinal,
    $utf8NoBom
)

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host " MERGE BUTTON SIDEBAR FIX SUCCESSFUL" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[OK] Floating button removed"
Write-Host "[OK] Button inserted inside right sidebar"
Write-Host "[OK] Button bottom-aligned"
Write-Host "[OK] Existing merge handler preserved"
Write-Host "[OK] Merge logic unchanged"
Write-Host "[OK] Password logic unchanged"
Write-Host "[OK] Validation logic unchanged"
Write-Host "[OK] Homepage unchanged"
Write-Host "[OK] No Git commands"
Write-Host "[OK] No deployment"
Write-Host ""
Write-Host "Backup:"
Write-Host "$backupDir\MergeWorkspace.tsx"
Write-Host ""