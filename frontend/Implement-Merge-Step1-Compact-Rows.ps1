$ErrorActionPreference = "Stop"

$file = ".\components\MergeWorkspace.tsx"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " iePDF - MERGE PHASE 1 / STEP 1" -ForegroundColor Cyan
Write-Host " COMPACT PROFESSIONAL FILE ROWS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $file)) {
    throw "MergeWorkspace.tsx not found."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = ".\_ui-backups\MERGE-STEP1-BEFORE-$timestamp"

Write-Host "[1/5] Creating safety backup..." -ForegroundColor Yellow

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $file "$backupDir\MergeWorkspace.tsx" -Force

Write-Host "[OK] Backup: $backupDir" -ForegroundColor Green
Write-Host ""

$text = Get-Content -Raw -Encoding UTF8 $file

Write-Host "[2/5] Locating exact file-list block..." -ForegroundColor Yellow

$startMarker = @'
            {/* =========================
                FILE LIST
            ========================== */}
'@

$endMarker = @'
            {/* =========================
                SUMMARY
            ========================== */}
'@

$start = $text.IndexOf($startMarker, [System.StringComparison]::Ordinal)
$end = $text.IndexOf($endMarker, [System.StringComparison]::Ordinal)

if ($start -lt 0) {
    throw "FILE LIST start marker not found. FILE NOT CHANGED."
}

if ($end -lt 0) {
    throw "SUMMARY marker not found. FILE NOT CHANGED."
}

if ($end -le $start) {
    throw "Invalid FILE LIST block boundaries. FILE NOT CHANGED."
}

Write-Host "[OK] Exact FILE LIST block found." -ForegroundColor Green
Write-Host ""

Write-Host "[3/5] Building compact file-row layout..." -ForegroundColor Yellow

$newBlock = @'
            {/* =========================
                FILE LIST
            ========================== */}

            <div className="min-h-0 overflow-y-auto p-4 lg:col-start-1 lg:row-start-2">

                <div className="space-y-3">

                    {files.map((file, index) => (

                        <div
                            key={file.id}
                            className={`rounded-2xl border bg-white shadow-sm transition ${
                                file.skipped
                                    ? "border-gray-200 opacity-65"
                                    : file.status === "password_required"
                                        ? "border-yellow-200"
                                        : file.status === "corrupted" ||
                                          file.status === "invalid"
                                            ? "border-red-200"
                                            : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                            }`}
                        >

                            {/* COMPACT FILE ROW */}

                            <div className="flex min-w-0 items-center gap-3 px-4 py-3">

                                {/* ORDER */}

                                <div
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-600"
                                    aria-label={`PDF ${index + 1}`}
                                >
                                    {index + 1}
                                </div>

                                {/* THUMBNAIL */}

                                <div className="shrink-0">
                                    <PdfThumbnail
                                        file={file.file}
                                        locked={
                                            file.status ===
                                            "password_required"
                                        }
                                    />
                                </div>

                                {/* FILE INFORMATION */}

                                <div className="min-w-0 flex-1">

                                    <div className="flex min-w-0 items-center gap-2">

                                        <h3 className="min-w-0 truncate text-sm font-semibold text-gray-900">
                                            {file.filename}
                                        </h3>

                                    </div>

                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">

                                        <span>
                                            {file.pages} Pages
                                        </span>

                                        <span aria-hidden="true">
                                            •
                                        </span>

                                        <span>
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </span>

                                    </div>

                                    {file.message && (

                                        <p className="mt-1 truncate text-xs text-red-600">
                                            {file.message}
                                        </p>

                                    )}

                                </div>

                                {/* STATUS */}

                                <div className="hidden shrink-0 sm:block">

                                    {file.skipped && (

                                        <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                                            ⏭ Skipped
                                        </span>

                                    )}

                                    {!file.skipped &&
                                        file.status === "ready" && (

                                        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                                            ✓ Ready
                                        </span>

                                    )}

                                    {!file.skipped &&
                                        file.status === "corrupted" && (

                                        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
                                            ✕ Corrupted
                                        </span>

                                    )}

                                    {!file.skipped &&
                                        file.status === "invalid" && (

                                        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
                                            ✕ Invalid PDF
                                        </span>

                                    )}

                                    {file.status === "password_required" &&
                                        !file.skipped && (

                                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1.5 text-xs font-semibold text-yellow-700">
                                            🔒 Password Required
                                        </span>

                                    )}

                                </div>

                                {/* ACTIONS */}

                                <div className="flex shrink-0 items-center gap-1.5">

                                    {/* SKIP / RESTORE */}

                                    <button
                                        type="button"
                                        onClick={() => onSkipFile(file.id)}
                                        aria-label={
                                            file.skipped
                                                ? "Restore PDF"
                                                : "Skip PDF"
                                        }
                                        title={
                                            file.skipped
                                                ? "Restore PDF"
                                                : "Skip PDF"
                                        }
                                        className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
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
                                                className="h-4.5 w-4.5"
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
                                                className="h-4.5 w-4.5"
                                                aria-hidden="true"
                                            >
                                                <path d="M5 5v14l6-5h8V10h-8L5 5z" />
                                            </svg>

                                        )}

                                        <span className="sr-only">
                                            {file.skipped
                                                ? "Restore PDF"
                                                : "Skip PDF"}
                                        </span>

                                    </button>

                                    {/* REMOVE */}

                                    <button
                                        type="button"
                                        onClick={() => onRemoveFile(file.id)}
                                        aria-label="Remove PDF"
                                        title="Remove PDF"
                                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-700"
                                    >

                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            className="h-4.5 w-4.5"
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

                            </div>

                            {/* MOBILE STATUS */}

                            <div className="px-4 pb-3 sm:hidden">

                                {file.skipped && (

                                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                                        ⏭ Skipped
                                    </span>

                                )}

                                {!file.skipped &&
                                    file.status === "ready" && (

                                    <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                                        ✓ Ready
                                    </span>

                                )}

                                {!file.skipped &&
                                    file.status === "corrupted" && (

                                    <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
                                        ✕ Corrupted
                                    </span>

                                )}

                                {!file.skipped &&
                                    file.status === "invalid" && (

                                    <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
                                        ✕ Invalid PDF
                                    </span>

                                )}

                                {file.status === "password_required" &&
                                    !file.skipped && (

                                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1.5 text-xs font-semibold text-yellow-700">
                                        🔒 Password Required
                                    </span>

                                )}

                            </div>

                            {/* PROTECTED PDF CONTROLS */}

                            {file.status === "password_required" &&
                                !file.skipped && (

                                <div className="border-t border-yellow-100 bg-yellow-50/40 px-4 py-3">

                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">

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
                                            className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                            aria-label="PDF Password"
                                        />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                onTogglePassword(
                                                    file.id
                                                )
                                            }
                                            className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 hover:text-blue-800"
                                        >

                                            👁{" "}
                                            {file.showPassword
                                                ? "Hide Password"
                                                : "Show Password"}

                                        </button>

                                    </div>

                                </div>

                            )}

                        </div>

                    ))}

                </div>

            </div>

'@

Write-Host "[OK] Compact file-row block created." -ForegroundColor Green
Write-Host ""

Write-Host "[4/5] Applying surgical replacement..." -ForegroundColor Yellow

$newText =
    $text.Substring(0, $start) +
    $newBlock +
    $text.Substring($end)

if ($newText -eq $text) {
    throw "Replacement produced no change. FILE NOT WRITTEN."
}

# UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
    (Resolve-Path $file),
    $newText,
    $utf8NoBom
)

Write-Host "[OK] File-list block replaced." -ForegroundColor Green
Write-Host ""

Write-Host "[5/5] Verifying critical handlers remain..." -ForegroundColor Yellow

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

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " STEP 1 COMPACT FILE ROWS APPLIED" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[OK] Compact file rows"
Write-Host "[OK] Protected password section preserved"
Write-Host "[OK] Skip/Restore preserved"
Write-Host "[OK] Remove preserved"
Write-Host "[OK] Status handling preserved"
Write-Host "[OK] Merge handler preserved"
Write-Host "[OK] Validation untouched"
Write-Host "[OK] Processor untouched"
Write-Host "[OK] Right summary untouched"
Write-Host "[OK] Homepage untouched"
Write-Host "[OK] No Git commands"
Write-Host "[OK] No deployment"
Write-Host ""
Write-Host "Backup:"
Write-Host "  $backupDir"
Write-Host ""