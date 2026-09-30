$ErrorActionPreference = "Stop"

$Frontend = "C:\IEPDF\frontend"
$File = Join-Path $Frontend "components\MergeWorkspace.tsx"
$ReportDir = Join-Path $Frontend "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $ReportDir "merge-render-condition-v7-$Stamp.txt"

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$Out = New-Object System.Collections.Generic.List[string]

function Add-Line {
    param([string]$Text = "")
    $Out.Add($Text)
    Write-Host $Text
}

function Section {
    param(
        [string]$Title,
        [string]$Body
    )

    Add-Line ""
    Add-Line ("=" * 70)
    Add-Line $Title
    Add-Line ("=" * 70)
    Add-Line $Body
}

Add-Line "iePDF MERGE PDF - RENDER CONDITION AUDIT V7"
Add-Line "Started: $(Get-Date)"
Add-Line "File: $File"
Add-Line ""
Add-Line "READ ONLY"
Add-Line "NO SOURCE CHANGES"
Add-Line "NO GIT"
Add-Line "NO DEPLOYMENT"

if (-not (Test-Path -LiteralPath $File)) {
    Add-Line ""
    Add-Line "FATAL: MergeWorkspace.tsx not found."

    [System.IO.File]::WriteAllLines(
        $Report,
        $Out,
        [System.Text.UTF8Encoding]::new($false)
    )

    exit 1
}

$Content = Get-Content -Raw -LiteralPath $File
$Lines = Get-Content -LiteralPath $File

Section "1. FILE SUMMARY" @"
Exists: True
Lines : $($Lines.Count)
Chars : $($Content.Length)
"@

# ------------------------------------------------------------
# SIMPLE EXACT SEARCHES
# ------------------------------------------------------------

$Searches = @(
    "files.map",
    "files.length",
    "files.filter",
    "files.some",
    "activeFiles",
    "filteredFiles",
    "readyFiles",
    "visibleFiles",
    "skipped",
    "password_required",
    "status ===",
    "status !==",
    "hidden",
    "invisible",
    "opacity-0",
    "display: none",
    "visibility: hidden",
    "key={"
)

Add-Line ""
Add-Line ("=" * 70)
Add-Line "2. EXACT SOURCE SEARCH"
Add-Line ("=" * 70)

foreach ($Search in $Searches) {

    Add-Line ""
    Add-Line "SEARCH: $Search"

    $Found = $false

    for ($i = 0; $i -lt $Lines.Count; $i++) {

        if ($Lines[$i].Contains($Search)) {

            $Found = $true
            $LineNumber = $i + 1

            Add-Line ("  Line {0}: {1}" -f $LineNumber, $Lines[$i].Trim())
        }
    }

    if (-not $Found) {
        Add-Line "  NOT FOUND"
    }
}

# ------------------------------------------------------------
# MERGEWORKSPACE OPENING TAG
# ------------------------------------------------------------

Add-Line ""
Add-Line ("=" * 70)
Add-Line "3. MERGEWORKSPACE OPENING TAG"
Add-Line ("=" * 70)

$MergeIndex = -1

for ($i = 0; $i -lt $Lines.Count; $i++) {

    if ($Lines[$i].Contains("<MergeWorkspace")) {
        $MergeIndex = $i
        break
    }
}

if ($MergeIndex -ge 0) {

    $Start = [Math]::Max(0, $MergeIndex - 3)
    $End = [Math]::Min($Lines.Count - 1, $MergeIndex + 30)

    for ($i = $Start; $i -le $End; $i++) {
        Add-Line ("{0,5}: {1}" -f ($i + 1), $Lines[$i])
    }

}
else {
    Add-Line "MergeWorkspace tag NOT FOUND."
}

# ------------------------------------------------------------
# FILES.MAP REGION
# ------------------------------------------------------------

Add-Line ""
Add-Line ("=" * 70)
Add-Line "4. FILES.MAP RENDER REGION"
Add-Line ("=" * 70)

$MapIndex = -1

for ($i = 0; $i -lt $Lines.Count; $i++) {

    if ($Lines[$i].Contains("files.map")) {
        $MapIndex = $i
        break
    }
}

if ($MapIndex -ge 0) {

    $Start = [Math]::Max(0, $MapIndex - 15)
    $End = [Math]::Min($Lines.Count - 1, $MapIndex + 80)

    for ($i = $Start; $i -le $End; $i++) {
        Add-Line ("{0,5}: {1}" -f ($i + 1), $Lines[$i])
    }

}
else {
    Add-Line "files.map NOT FOUND."
}

# ------------------------------------------------------------
# CONDITIONALS AROUND FILES
# ------------------------------------------------------------

Add-Line ""
Add-Line ("=" * 70)
Add-Line "5. CONDITIONS NEAR FILE RENDERING"
Add-Line ("=" * 70)

$ConditionWords = @(
    "files.length",
    "files.filter",
    "activeFiles",
    "filteredFiles",
    "skipped",
    "status ===",
    "status !=="
)

foreach ($Word in $ConditionWords) {

    Add-Line ""
    Add-Line "CONDITION: $Word"

    $Found = $false

    for ($i = 0; $i -lt $Lines.Count; $i++) {

        if ($Lines[$i].Contains($Word)) {

            $Found = $true

            $Start = [Math]::Max(0, $i - 2)
            $End = [Math]::Min($Lines.Count - 1, $i + 2)

            for ($j = $Start; $j -le $End; $j++) {
                Add-Line ("{0,5}: {1}" -f ($j + 1), $Lines[$j])
            }

            Add-Line "---"
        }
    }

    if (-not $Found) {
        Add-Line "NOT FOUND"
    }
}

# ------------------------------------------------------------
# FUNCTION / RETURN REGION
# ------------------------------------------------------------

Add-Line ""
Add-Line ("=" * 70)
Add-Line "6. COMPONENT RETURN REGION"
Add-Line ("=" * 70)

$FunctionIndex = -1

for ($i = 0; $i -lt $Lines.Count; $i++) {

    if ($Lines[$i].Contains("export default function MergeWorkspace")) {
        $FunctionIndex = $i
        break
    }
}

if ($FunctionIndex -ge 0) {

    $Start = $FunctionIndex
    $End = [Math]::Min($Lines.Count - 1, $FunctionIndex + 180)

    for ($i = $Start; $i -le $End; $i++) {
        Add-Line ("{0,5}: {1}" -f ($i + 1), $Lines[$i])
    }

}
else {
    Add-Line "MergeWorkspace function declaration NOT FOUND."
}

# ------------------------------------------------------------
# STATIC RESULT
# ------------------------------------------------------------

Add-Line ""
Add-Line ("=" * 70)
Add-Line "7. STATIC RESULT"
Add-Line ("=" * 70)

$FilesMap = $Content.Contains("files.map")
$FilesLength = $Content.Contains("files.length")
$StatusChecks = $Content.Contains("status ===") -or $Content.Contains("status !==")
$SkippedChecks = $Content.Contains("skipped")
$VisibilityChecks = (
    $Content.Contains("hidden") -or
    $Content.Contains("invisible") -or
    $Content.Contains("opacity-0")
)

Add-Line "files.map present          : $FilesMap"
Add-Line "files.length present      : $FilesLength"
Add-Line "status checks present     : $StatusChecks"
Add-Line "skipped checks present    : $SkippedChecks"
Add-Line "visibility classes present: $VisibilityChecks"

Add-Line ""
Add-Line "INTERPRETATION:"
Add-Line "The above conditions must be correlated with the exact row-rendering block."
Add-Line "This script does not change or repair anything."

Add-Line ""
Add-Line ("=" * 70)
Add-Line "8. SAFETY"
Add-Line ("=" * 70)
Add-Line "NO SOURCE CHANGES"
Add-Line "NO GIT"
Add-Line "NO LIVE DEPLOYMENT"

Add-Line ""
Add-Line "Report: $Report"
Add-Line "Finished: $(Get-Date)"

[System.IO.File]::WriteAllLines(
    $Report,
    $Out,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "============================================================"
Write-Host "V7 AUDIT COMPLETE"
Write-Host "Report: $Report"
Write-Host "NO SOURCE CHANGES"
Write-Host "NO LIVE DEPLOYMENT"
Write-Host "============================================================"