$ErrorActionPreference = "Stop"

$file = ".\components\MergeWorkspace.tsx"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " iePDF - MERGE PHASE 1 / STEP 1.1" -ForegroundColor Cyan
Write-Host " COMPACT PROTECTED-PDF ROW" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $file)) {
    throw "MergeWorkspace.tsx not found."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = ".\_ui-backups\MERGE-STEP1-1-BEFORE-$timestamp"

Write-Host "[1/5] Creating safety backup..." -ForegroundColor Yellow

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $file "$backupDir\MergeWorkspace.tsx" -Force

Write-Host "[OK] Backup: $backupDir" -ForegroundColor Green
Write-Host ""

$text = Get-Content -Raw -Encoding UTF8 $file

Write-Host "[2/5] Locating protected-PDF control section..." -ForegroundColor Yellow

$startMarker = @'
                            {/* PROTECTED PDF CONTROLS */}
'@

$start = $text.IndexOf($startMarker, [System.StringComparison]::Ordinal)

if ($start -lt 0) {
    throw "Protected PDF controls marker not found. FILE NOT CHANGED."
}

$afterStart = $start + $startMarker.Length

$endMarker = @'
                        </div>

                    ))}

'@

$end = $text.IndexOf($endMarker, $afterStart, [System.StringComparison]::Ordinal)

if ($end -lt 0) {
    throw "Protected PDF controls end boundary not found. FILE NOT CHANGED."
}

Write-Host "[OK] Protected-PDF control section located." -ForegroundColor Green
Write-Host ""

Write-Host "[3/5] Building compact protected controls..." -ForegroundColor Yellow

$newBlock = @'

                            {/* PROTECTED PDF CONTROLS */}

                            {file.status === "password_required" &&
                                !file.skipped && (

                                <div className="border-t border-yellow-100 bg-yellow-50/40 px-4 py-2.5">

                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">

                                        <div className="min-w-0 flex-1">

                                            <input
                                                type={
                                                    file.showPassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                value={
                                                    file.password || ""
                                                }
                                                placeholder="Enter password to unlock preview and merge"
                                                autoComplete="off"
                                                spellCheck={false}
                                                onChange={(e) =>
                                                    onPasswordChange(
                                                        file.id,
                                                        e.target.value
                                                    )
                                                }
                                                onBlur={() =>
                                                    onPasswordBlur(
                                                        file.id
                                                    )
                                                }
                                                onKeyDown={(e) => {

                                                    if (
                                                        e.key === "Enter"
                                                    ) {

                                                        e.currentTarget.blur();

                                                    }

                                                }}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                                aria-label="PDF Password"
                                            />

                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                onTogglePassword(
                                                    file.id
                                                )
                                            }
                                            className="shrink-0 self-end rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50 hover:text-blue-800 sm:self-auto"
                                        >

                                            👁{" "}
                                            {file.showPassword
                                                ? "Hide Password"
                                                : "Show Password"}

                                        </button>

                                    </div>

                                </div>

                            )}

'@

Write-Host "[OK] Compact protected controls created." -ForegroundColor Green
Write-Host ""

Write-Host "[4/5] Applying surgical replacement..." -ForegroundColor Yellow

$newText =
    $text.Substring(0, $start) +
    $newBlock +
    $text.Substring($end)

if ($newText -eq $text) {
    throw "Replacement produced no change. FILE NOT WRITTEN."
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    (Resolve-Path $file),
    $newText,
    $utf8NoBom
)

Write-Host "[OK] Protected-PDF controls compacted." -ForegroundColor Green
Write-Host ""

Write-Host "[5/5] Verifying critical handlers..." -ForegroundColor Yellow

$verify = Get-Content -Raw -Encoding UTF8 $file

$required = @(
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

    Write-Host "[OK] $term preserved." -ForegroundColor Green
}

if ($verify.IndexOf("PROTECTED PDF CONTROLS", [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
    throw "Protected controls marker missing after replacement."
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " STEP 1.1 PROTECTED ROW COMPACTION APPLIED" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[OK] Protected row height reduced"
Write-Host "[OK] Password input preserved"
Write-Host "[OK] Show/Hide password preserved"
Write-Host "[OK] Password handlers preserved"
Write-Host "[OK] Skip/Restore preserved"
Write-Host "[OK] Remove preserved"
Write-Host "[OK] Merge handler preserved"
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