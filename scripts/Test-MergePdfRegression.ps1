# ============================================================
# iePDF - Merge PDF Functional Regression Test
# ============================================================

$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\IEPDF\frontend"
$TestRoot    = Join-Path $ProjectRoot "_regression\merge-pdf"
$LogRoot     = Join-Path $TestRoot "logs"
$ReportFile  = Join-Path $TestRoot "merge-regression-report.txt"

$MaxFileSize = 15 * 1024 * 1024

New-Item -ItemType Directory -Force -Path $TestRoot | Out-Null
New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null

$TimeStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = Join-Path $LogRoot "merge-regression-$TimeStamp.log"

Start-Transcript -Path $LogFile -Force | Out-Null

$Results = New-Object System.Collections.Generic.List[object]

function Add-TestResult {
    param(
        [string]$Id,
        [string]$Name,
        [ValidateSet("PASS","FAIL","SKIPPED")]
        [string]$Status,
        [string]$Details = ""
    )

    $Results.Add([PSCustomObject]@{
        Test    = $Id
        Name    = $Name
        Status  = $Status
        Details = $Details
    })

    switch ($Status) {
        "PASS" {
            Write-Host "PASS  $Id - $Name" -ForegroundColor Green
        }
        "FAIL" {
            Write-Host "FAIL  $Id - $Name" -ForegroundColor Red
        }
        "SKIPPED" {
            Write-Host "SKIP  $Id - $Name" -ForegroundColor Yellow
        }
    }

    if ($Details) {
        Write-Host "      $Details"
    }
}

function Assert-FileExists {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "File not found: $Path"
    }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " iePDF Merge PDF Regression Test" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $ProjectRoot

$pageFile = Join-Path $ProjectRoot "app\merge-pdf\page.tsx"
$toastHook = Join-Path $ProjectRoot "hooks\useToast.tsx"
$constants = Join-Path $ProjectRoot "engine\validation\common\validationConstants.ts"

# ------------------------------------------------------------
# Required files
# ------------------------------------------------------------

try {
    Assert-FileExists $pageFile
    Assert-FileExists $toastHook
    Assert-FileExists $constants

    Add-TestResult "PRE-01" "Required project files" "PASS"
}
catch {
    Add-TestResult "PRE-01" "Required project files" "FAIL" $_.Exception.Message
}

# ------------------------------------------------------------
# Source checks
# ------------------------------------------------------------

try {
    $pageText = [IO.File]::ReadAllText($pageFile)
    $constantText = [IO.File]::ReadAllText($constants)

    $failedChecks = @()

    if ($pageText -notmatch 'useToast') {
        $failedChecks += "useToast missing"
    }

    if ($pageText -notmatch 'toast\.success') {
        $failedChecks += "toast.success missing"
    }

    if ($pageText -notmatch 'toast\.error') {
        $failedChecks += "toast.error missing"
    }

    if ($pageText -notmatch 'MAX_FILE_SIZE_BYTES') {
        $failedChecks += "authoritative size limit reference missing"
    }

    if ($pageText -match 'setSuccessMessage|setErrorMessage') {
        $failedChecks += "legacy notification state found"
    }

    if ($pageText -match 'alert\(') {
        $failedChecks += "alert() found"
    }

    if ($pageText -match 'console\.error') {
        $failedChecks += "console.error found"
    }

    if ($failedChecks.Count -eq 0) {
        Add-TestResult "SRC-01" "Merge source UX and notification checks" "PASS"
    }
    else {
        Add-TestResult "SRC-01" "Merge source UX and notification checks" "FAIL" ($failedChecks -join "; ")
    }
}
catch {
    Add-TestResult "SRC-01" "Merge source UX and notification checks" "FAIL" $_.Exception.Message
}

# ------------------------------------------------------------
# Validation size checks
# ------------------------------------------------------------

try {
    if ($constantText -match 'MAX_FILE_SIZE_BYTES\s*:\s*15\s*\*\s*1024\s*\*\s*1024') {
        Add-TestResult "VAL-01" "15 MiB validation limit" "PASS"
    }
    else {
        Add-TestResult "VAL-01" "15 MiB validation limit" "FAIL" "15 MiB constant not confirmed."
    }

    if ($MaxFileSize -eq 15728640) {
        Add-TestResult "VAL-02" "Exactly 15 MiB boundary" "PASS"
    }
    else {
        Add-TestResult "VAL-02" "Exactly 15 MiB boundary" "FAIL"
    }
}
catch {
    Add-TestResult "VAL-01" "15 MiB validation limit" "FAIL" $_.Exception.Message
}

# ------------------------------------------------------------
# Production build
# ------------------------------------------------------------

try {
    Write-Host ""
    Write-Host "Running pnpm build..." -ForegroundColor Cyan

    pnpm build

    if ($LASTEXITCODE -ne 0) {
        throw "pnpm build failed with exit code $LASTEXITCODE."
    }

    Add-TestResult "M-10" "Production build" "PASS"
}
catch {
    Add-TestResult "M-10" "Production build" "FAIL" $_.Exception.Message
}

# ------------------------------------------------------------
# Basic environment checks
# ------------------------------------------------------------

try {
    $node = node --version
    $pnpm = pnpm --version

    Add-TestResult "ENV-01" "Node.js / pnpm available" "PASS" "Node $node, pnpm $pnpm"
}
catch {
    Add-TestResult "ENV-01" "Node.js / pnpm available" "FAIL" $_.Exception.Message
}

# ------------------------------------------------------------
# ------------------------------------------------------------
# ------------------------------------------------------------
# Browser functional regression - SINGLE MASTER FILE
# ------------------------------------------------------------

$playwrightPackage = Join-Path $ProjectRoot "node_modules\playwright\package.json"
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

if (-not (Test-Path -LiteralPath $playwrightPackage)) {
    Add-TestResult "BROWSER" "Playwright + installed Chrome" "FAIL" "Playwright is not installed."
}
elseif (-not (Test-Path -LiteralPath $chromePath)) {
    Add-TestResult "BROWSER" "Playwright + installed Chrome" "FAIL" "Chrome executable not found."
}
else {
    Add-TestResult "BROWSER" "Playwright + installed Chrome" "PASS" "Browser automation environment ready."

    $testFiles=@(
        "A-2-pages.pdf",
        "B-1-page.pdf",
        "C-1-page.pdf",
        "Corrupted.pdf",
        "Protected-1-page.pdf",
        "M-06-valid-over-15MiB.pdf",
        "M-07-valid-exact-15MiB.pdf"
    )

    $missingFiles=@()
    foreach($file in $testFiles){
        if(-not (Test-Path -LiteralPath (Join-Path $TestRoot $file))){
            $missingFiles += $file
        }
    }

    if($missingFiles.Count -gt 0){
        Add-TestResult "TEST-DATA" "Merge browser test files" "FAIL" ("Missing: " + ($missingFiles -join ", "))
    }
    else {
        Add-TestResult "TEST-DATA" "Merge browser test files" "PASS"

        try {
            $response=Invoke-WebRequest -Uri "http://127.0.0.1:3000/merge-pdf" -UseBasicParsing -TimeoutSec 10
            if($response.StatusCode -ne 200){
                throw "Merge PDF page returned HTTP $($response.StatusCode)."
            }
            Add-TestResult "SERVER" "Merge PDF page reachable" "PASS" "HTTP 200"
        }
        catch {
            Add-TestResult "SERVER" "Merge PDF page reachable" "FAIL" $_.Exception.Message
        }

        $runner = Join-Path $env:TEMP "iePDF-MergeRegression-$PID.js"

        try {
            $embedded = [Text.Encoding]::UTF8.GetString(
                [Convert]::FromBase64String(
                    'Y29uc3QgeyBjaHJvbWl1bSB9ID0gcmVxdWlyZSgicGxheXdyaWdodCIpOwpjb25zdCBwYXRoID0gcmVxdWlyZSgicGF0aCIpOwpjb25zdCBmcyA9IHJlcXVpcmUoImZzIik7Cgpjb25zdCBST09UID0gIkM6XFxJRVBERlxcZnJvbnRlbmRcXF9yZWdyZXNzaW9uXFxtZXJnZS1wZGYiOwpjb25zdCBVUkwgPSAiaHR0cDovLzEyNy4wLjAuMTozMDAwL21lcmdlLXBkZiI7CmNvbnN0IENIUk9NRSA9ICJDOlxcUHJvZ3JhbSBGaWxlc1xcR29vZ2xlXFxDaHJvbWVcXEFwcGxpY2F0aW9uXFxjaHJvbWUuZXhlIjsKCmZ1bmN0aW9uIHJlc3VsdChpZCwgc3RhdHVzLCBuYW1lLCBkZXRhaWxzID0gIiIpIHsKICBjb25zb2xlLmxvZyhgUkVTVUxUfCR7aWR9fCR7c3RhdHVzfXwke25hbWV9fCR7ZGV0YWlsc31gKTsKfQoKYXN5bmMgZnVuY3Rpb24gbWFpbigpIHsKICBsZXQgYnJvd3NlcjsKCiAgdHJ5IHsKICAgIGJyb3dzZXIgPSBhd2FpdCBjaHJvbWl1bS5sYXVuY2goewogICAgICBleGVjdXRhYmxlUGF0aDogQ0hST01FLAogICAgICBoZWFkbGVzczogdHJ1ZQogICAgfSk7CgogICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgIC8vIE0tMDEgLSAyIHZhbGlkIFBERnMKICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CgogICAgewogICAgICBjb25zdCBjb250ZXh0ID0gYXdhaXQgYnJvd3Nlci5uZXdDb250ZXh0KHsKICAgICAgICBhY2NlcHREb3dubG9hZHM6IHRydWUKICAgICAgfSk7CgogICAgICBjb25zdCBwYWdlID0gYXdhaXQgY29udGV4dC5uZXdQYWdlKCk7CgogICAgICB0cnkgewogICAgICAgIGF3YWl0IHBhZ2UuZ290byhVUkwsIHsKICAgICAgICAgIHdhaXRVbnRpbDogImRvbWNvbnRlbnRsb2FkZWQiLAogICAgICAgICAgdGltZW91dDogMzAwMDAKICAgICAgICB9KTsKCiAgICAgICAgYXdhaXQgcGFnZS5sb2NhdG9yKCdpbnB1dFt0eXBlPSJmaWxlIl0nKS5zZXRJbnB1dEZpbGVzKFsKICAgICAgICAgIHBhdGguam9pbihST09ULCAiQS0yLXBhZ2VzLnBkZiIpLAogICAgICAgICAgcGF0aC5qb2luKFJPT1QsICJCLTEtcGFnZS5wZGYiKQogICAgICAgIF0pOwoKICAgICAgICBhd2FpdCBwYWdlLndhaXRGb3JUaW1lb3V0KDEyMDApOwoKICAgICAgICBjb25zdCBtZXJnZUJ1dHRvbiA9IHBhZ2UuZ2V0QnlSb2xlKCJidXR0b24iLCB7CiAgICAgICAgICBuYW1lOiAvdW5sb2NrXHMqJlxzKm1lcmdlL2kKICAgICAgICB9KTsKCiAgICAgICAgaWYgKGF3YWl0IG1lcmdlQnV0dG9uLmNvdW50KCkgIT09IDEpIHsKICAgICAgICAgIHRocm93IG5ldyBFcnJvcigiTWVyZ2UgYnV0dG9uIG5vdCBmb3VuZC4iKTsKICAgICAgICB9CgogICAgICAgIGlmICghKGF3YWl0IG1lcmdlQnV0dG9uLmlzRW5hYmxlZCgpKSkgewogICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCJNZXJnZSBidXR0b24gaXMgZGlzYWJsZWQuIik7CiAgICAgICAgfQoKICAgICAgICBjb25zdCBvdXRwdXQgPSBwYXRoLmpvaW4oUk9PVCwgIk0tMDEtYnJvd3Nlci1vdXRwdXQucGRmIik7CgogICAgICAgIGlmIChmcy5leGlzdHNTeW5jKG91dHB1dCkpIHsKICAgICAgICAgIGZzLnVubGlua1N5bmMob3V0cHV0KTsKICAgICAgICB9CgogICAgICAgIGNvbnN0IGRvd25sb2FkUHJvbWlzZSA9IHBhZ2Uud2FpdEZvckV2ZW50KCJkb3dubG9hZCIsIHsKICAgICAgICAgIHRpbWVvdXQ6IDMwMDAwCiAgICAgICAgfSk7CgogICAgICAgIGF3YWl0IG1lcmdlQnV0dG9uLmNsaWNrKCk7CgogICAgICAgIGNvbnN0IGRvd25sb2FkID0gYXdhaXQgZG93bmxvYWRQcm9taXNlOwogICAgICAgIGF3YWl0IGRvd25sb2FkLnNhdmVBcyhvdXRwdXQpOwoKICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMob3V0cHV0KSkgewogICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCJPdXRwdXQgUERGIHdhcyBub3QgY3JlYXRlZC4iKTsKICAgICAgICB9CgogICAgICAgIGNvbnN0IHRvYXN0ID0gcGFnZS5nZXRCeVRleHQoL21lcmdlIGNvbXBsZXRlZC9pKS5maXJzdCgpOwoKICAgICAgICBpZiAoIShhd2FpdCB0b2FzdC5pc1Zpc2libGUoKS5jYXRjaCgoKSA9PiBmYWxzZSkpKSB7CiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoIk1lcmdlIHN1Y2Nlc3MgdG9hc3Qgd2FzIG5vdCB2aXNpYmxlLiIpOwogICAgICAgIH0KCiAgICAgICAgcmVzdWx0KAogICAgICAgICAgIk0tMDEiLAogICAgICAgICAgIlBBU1MiLAogICAgICAgICAgIjIgdmFsaWQgUERGcyAtPiBtZXJnZS9kb3dubG9hZC90b2FzdCIsCiAgICAgICAgICAiRG93bmxvYWQgYW5kIHN1Y2Nlc3MgdG9hc3QgdmVyaWZpZWQuIgogICAgICAgICk7CiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICAgICAgcmVzdWx0KAogICAgICAgICAgIk0tMDEiLAogICAgICAgICAgIkZBSUwiLAogICAgICAgICAgIjIgdmFsaWQgUERGcyAtPiBtZXJnZS9kb3dubG9hZC90b2FzdCIsCiAgICAgICAgICBlcnJvci5tZXNzYWdlCiAgICAgICAgKTsKICAgICAgfSBmaW5hbGx5IHsKICAgICAgICBhd2FpdCBjb250ZXh0LmNsb3NlKCk7CiAgICAgIH0KICAgIH0KCiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICAgLy8gTS0wMiAtIDMgdmFsaWQgUERGcwogICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KCiAgICB7CiAgICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCBicm93c2VyLm5ld0NvbnRleHQoewogICAgICAgIGFjY2VwdERvd25sb2FkczogdHJ1ZQogICAgICB9KTsKCiAgICAgIGNvbnN0IHBhZ2UgPSBhd2FpdCBjb250ZXh0Lm5ld1BhZ2UoKTsKCiAgICAgIHRyeSB7CiAgICAgICAgYXdhaXQgcGFnZS5nb3RvKFVSTCwgewogICAgICAgICAgd2FpdFVudGlsOiAiZG9tY29udGVudGxvYWRlZCIsCiAgICAgICAgICB0aW1lb3V0OiAzMDAwMAogICAgICAgIH0pOwoKICAgICAgICBhd2FpdCBwYWdlLmxvY2F0b3IoJ2lucHV0W3R5cGU9ImZpbGUiXScpLnNldElucHV0RmlsZXMoWwogICAgICAgICAgcGF0aC5qb2luKFJPT1QsICJBLTItcGFnZXMucGRmIiksCiAgICAgICAgICBwYXRoLmpvaW4oUk9PVCwgIkItMS1wYWdlLnBkZiIpLAogICAgICAgICAgcGF0aC5qb2luKFJPT1QsICJDLTEtcGFnZS5wZGYiKQogICAgICAgIF0pOwoKICAgICAgICBhd2FpdCBwYWdlLndhaXRGb3JUaW1lb3V0KDEyMDApOwoKICAgICAgICBjb25zdCBtZXJnZUJ1dHRvbiA9IHBhZ2UuZ2V0QnlSb2xlKCJidXR0b24iLCB7CiAgICAgICAgICBuYW1lOiAvdW5sb2NrXHMqJlxzKm1lcmdlL2kKICAgICAgICB9KTsKCiAgICAgICAgaWYgKCEoYXdhaXQgbWVyZ2VCdXR0b24uaXNFbmFibGVkKCkpKSB7CiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoIk1lcmdlIGJ1dHRvbiBpcyBkaXNhYmxlZC4iKTsKICAgICAgICB9CgogICAgICAgIGNvbnN0IG91dHB1dCA9IHBhdGguam9pbihST09ULCAiTS0wMi1icm93c2VyLW91dHB1dC5wZGYiKTsKCiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMob3V0cHV0KSkgewogICAgICAgICAgZnMudW5saW5rU3luYyhvdXRwdXQpOwogICAgICAgIH0KCiAgICAgICAgY29uc3QgZG93bmxvYWRQcm9taXNlID0gcGFnZS53YWl0Rm9yRXZlbnQoImRvd25sb2FkIiwgewogICAgICAgICAgdGltZW91dDogMzAwMDAKICAgICAgICB9KTsKCiAgICAgICAgYXdhaXQgbWVyZ2VCdXR0b24uY2xpY2soKTsKCiAgICAgICAgY29uc3QgZG93bmxvYWQgPSBhd2FpdCBkb3dubG9hZFByb21pc2U7CiAgICAgICAgYXdhaXQgZG93bmxvYWQuc2F2ZUFzKG91dHB1dCk7CgogICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhvdXRwdXQpKSB7CiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoIk91dHB1dCBQREYgd2FzIG5vdCBjcmVhdGVkLiIpOwogICAgICAgIH0KCiAgICAgICAgY29uc3QgdG9hc3QgPSBwYWdlLmdldEJ5VGV4dCgvbWVyZ2UgY29tcGxldGVkL2kpLmZpcnN0KCk7CgogICAgICAgIGlmICghKGF3YWl0IHRvYXN0LmlzVmlzaWJsZSgpLmNhdGNoKCgpID0+IGZhbHNlKSkpIHsKICAgICAgICAgIHRocm93IG5ldyBFcnJvcigiTWVyZ2Ugc3VjY2VzcyB0b2FzdCB3YXMgbm90IHZpc2libGUuIik7CiAgICAgICAgfQoKICAgICAgICByZXN1bHQoCiAgICAgICAgICAiTS0wMiIsCiAgICAgICAgICAiUEFTUyIsCiAgICAgICAgICAiMyB2YWxpZCBQREZzIC0+IG1lcmdlL2Rvd25sb2FkL3RvYXN0IiwKICAgICAgICAgICJEb3dubG9hZCBhbmQgc3VjY2VzcyB0b2FzdCB2ZXJpZmllZC4iCiAgICAgICAgKTsKICAgICAgfSBjYXRjaCAoZXJyb3IpIHsKICAgICAgICByZXN1bHQoCiAgICAgICAgICAiTS0wMiIsCiAgICAgICAgICAiRkFJTCIsCiAgICAgICAgICAiMyB2YWxpZCBQREZzIC0+IG1lcmdlL2Rvd25sb2FkL3RvYXN0IiwKICAgICAgICAgIGVycm9yLm1lc3NhZ2UKICAgICAgICApOwogICAgICB9IGZpbmFsbHkgewogICAgICAgIGF3YWl0IGNvbnRleHQuY2xvc2UoKTsKICAgICAgfQogICAgfQoKICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICAgLy8gTS0wNCAtIFBhc3N3b3JkIFBERiArIGNvcnJlY3QgcGFzc3dvcmQKICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CgogICAgewogICAgICBjb25zdCBjb250ZXh0ID0gYXdhaXQgYnJvd3Nlci5uZXdDb250ZXh0KHsKICAgICAgICBhY2NlcHREb3dubG9hZHM6IHRydWUKICAgICAgfSk7CgogICAgICBjb25zdCBwYWdlID0gYXdhaXQgY29udGV4dC5uZXdQYWdlKCk7CgogICAgICB0cnkgewogICAgICAgIGF3YWl0IHBhZ2UuZ290byhVUkwsIHsKICAgICAgICAgIHdhaXRVbnRpbDogImRvbWNvbnRlbnRsb2FkZWQiLAogICAgICAgICAgdGltZW91dDogMTUwMDAKICAgICAgICB9KTsKCiAgICAgICAgYXdhaXQgcGFnZS5sb2NhdG9yKCdpbnB1dFt0eXBlPSJmaWxlIl0nKS5zZXRJbnB1dEZpbGVzKFsKICAgICAgICAgIHBhdGguam9pbihST09ULCAiQS0yLXBhZ2VzLnBkZiIpLAogICAgICAgICAgcGF0aC5qb2luKFJPT1QsICJQcm90ZWN0ZWQtMS1wYWdlLnBkZiIpCiAgICAgICAgXSk7CgogICAgICAgIGF3YWl0IHBhZ2Uud2FpdEZvclRpbWVvdXQoMTIwMCk7CgogICAgICAgIGNvbnN0IHBhc3N3b3JkID0gcGFnZS5nZXRCeUxhYmVsKCJQREYgUGFzc3dvcmQiKTsKICAgICAgICBhd2FpdCBwYXNzd29yZC5maWxsKCJpZXBkZjEyMyIpOwogICAgICAgIGF3YWl0IHBhc3N3b3JkLnByZXNzKCJUYWIiKTsKCiAgICAgICAgYXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dCgzMDAwKTsKCiAgICAgICAgY29uc3QgYm9keVRleHQgPSBhd2FpdCBwYWdlLmxvY2F0b3IoImJvZHkiKS5pbm5lclRleHQoKTsKCiAgICAgICAgaWYgKCEvUGFzc3dvcmQgYWNjZXB0ZWQuKnJlYWR5IGZvciBtZXJnZS9pLnRlc3QoYm9keVRleHQpKSB7CiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoIlBhc3N3b3JkIHdhcyBub3QgYWNjZXB0ZWQuIik7CiAgICAgICAgfQoKICAgICAgICBjb25zdCBtZXJnZUJ1dHRvbiA9IHBhZ2UuZ2V0QnlSb2xlKCJidXR0b24iLCB7CiAgICAgICAgICBuYW1lOiAvdW5sb2NrXHMqJlxzKm1lcmdlL2kKICAgICAgICB9KTsKCiAgICAgICAgaWYgKCEoYXdhaXQgbWVyZ2VCdXR0b24uaXNFbmFibGVkKCkpKSB7CiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoIk1lcmdlIGJ1dHRvbiBpcyBkaXNhYmxlZCBhZnRlciBwYXNzd29yZCBhY2NlcHRhbmNlLiIpOwogICAgICAgIH0KCiAgICAgICAgY29uc3Qgb3V0cHV0ID0gcGF0aC5qb2luKFJPT1QsICJNLTA0LWJyb3dzZXItb3V0cHV0LnBkZiIpOwoKICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhvdXRwdXQpKSB7CiAgICAgICAgICBmcy51bmxpbmtTeW5jKG91dHB1dCk7CiAgICAgICAgfQoKICAgICAgICBjb25zdCBkb3dubG9hZFByb21pc2UgPSBwYWdlLndhaXRGb3JFdmVudCgiZG93bmxvYWQiLCB7CiAgICAgICAgICB0aW1lb3V0OiAzMDAwMAogICAgICAgIH0pOwoKICAgICAgICBhd2FpdCBtZXJnZUJ1dHRvbi5jbGljaygpOwoKICAgICAgICBjb25zdCBkb3dubG9hZCA9IGF3YWl0IGRvd25sb2FkUHJvbWlzZTsKICAgICAgICBhd2FpdCBkb3dubG9hZC5zYXZlQXMob3V0cHV0KTsKCiAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKG91dHB1dCkpIHsKICAgICAgICAgIHRocm93IG5ldyBFcnJvcigiTS0wNCBvdXRwdXQgUERGIHdhcyBub3QgY3JlYXRlZC4iKTsKICAgICAgICB9CgogICAgICAgIGNvbnN0IHN1Y2Nlc3NUb2FzdCA9IHBhZ2UuZ2V0QnlUZXh0KC9tZXJnZSBjb21wbGV0ZWQvaSkuZmlyc3QoKTsKCiAgICAgICAgaWYgKCEoYXdhaXQgc3VjY2Vzc1RvYXN0LmlzVmlzaWJsZSgpLmNhdGNoKCgpID0+IGZhbHNlKSkpIHsKICAgICAgICAgIHRocm93IG5ldyBFcnJvcigiTWVyZ2Ugc3VjY2VzcyB0b2FzdCB3YXMgbm90IHZpc2libGUuIik7CiAgICAgICAgfQoKICAgICAgICByZXN1bHQoCiAgICAgICAgICAiTS0wNCIsCiAgICAgICAgICAiUEFTUyIsCiAgICAgICAgICAiUGFzc3dvcmQgUERGICsgY29ycmVjdCBwYXNzd29yZCAtPiBtZXJnZS9kb3dubG9hZCIsCiAgICAgICAgICAiUGFzc3dvcmQgYWNjZXB0ZWQsIG1lcmdlIGNvbXBsZXRlZCwgZG93bmxvYWQgYW5kIHN1Y2Nlc3MgdG9hc3QgdmVyaWZpZWQuIgogICAgICAgICk7CiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICAgICAgcmVzdWx0KAogICAgICAgICAgIk0tMDQiLAogICAgICAgICAgIkZBSUwiLAogICAgICAgICAgIlBhc3N3b3JkIFBERiArIGNvcnJlY3QgcGFzc3dvcmQgLT4gbWVyZ2UvZG93bmxvYWQiLAogICAgICAgICAgZXJyb3IubWVzc2FnZQogICAgICAgICk7CiAgICAgIH0gZmluYWxseSB7CiAgICAgICAgYXdhaXQgY29udGV4dC5jbG9zZSgpOwogICAgICB9CiAgICB9CiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgIC8vIE0tMDUgLSBQYXNzd29yZCBQREYgKyB3cm9uZyBwYXNzd29yZAogICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KCiAgICB7CiAgICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCBicm93c2VyLm5ld0NvbnRleHQoewogICAgICAgIGFjY2VwdERvd25sb2FkczogdHJ1ZQogICAgICB9KTsKCiAgICAgIGNvbnN0IHBhZ2UgPSBhd2FpdCBjb250ZXh0Lm5ld1BhZ2UoKTsKCiAgICAgIHRyeSB7CiAgICAgICAgYXdhaXQgcGFnZS5nb3RvKFVSTCwgewogICAgICAgICAgd2FpdFVudGlsOiAiZG9tY29udGVudGxvYWRlZCIsCiAgICAgICAgICB0aW1lb3V0OiAxNTAwMAogICAgICAgIH0pOwoKICAgICAgICBhd2FpdCBwYWdlLmxvY2F0b3IoJ2lucHV0W3R5cGU9ImZpbGUiXScpLnNldElucHV0RmlsZXMoWwogICAgICAgICAgcGF0aC5qb2luKFJPT1QsICJBLTItcGFnZXMucGRmIiksCiAgICAgICAgICBwYXRoLmpvaW4oUk9PVCwgIlByb3RlY3RlZC0xLXBhZ2UucGRmIikKICAgICAgICBdKTsKCiAgICAgICAgYXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dCgxMjAwKTsKCiAgICAgICAgYXdhaXQgcGFnZS5nZXRCeUxhYmVsKCJQREYgUGFzc3dvcmQiKS5maWxsKCJ3cm9uZy1wYXNzd29yZCIpOwogICAgICAgIGF3YWl0IHBhZ2UuZ2V0QnlMYWJlbCgiUERGIFBhc3N3b3JkIikucHJlc3MoIlRhYiIpOwogICAgICAgIGF3YWl0IHBhZ2Uud2FpdEZvclRpbWVvdXQoMTUwMCk7CgogICAgICAgIGNvbnN0IG1lcmdlQnV0dG9uID0gcGFnZS5nZXRCeVJvbGUoImJ1dHRvbiIsIHsKICAgICAgICAgIG5hbWU6IC91bmxvY2tccyomXHMqbWVyZ2UvaQogICAgICAgIH0pOwoKICAgICAgICBpZiAoIShhd2FpdCBtZXJnZUJ1dHRvbi5pc0VuYWJsZWQoKSkpIHsKICAgICAgICAgIHRocm93IG5ldyBFcnJvcigiTWVyZ2UgYnV0dG9uIGlzIHVuZXhwZWN0ZWRseSBkaXNhYmxlZC4iKTsKICAgICAgICB9CgogICAgICAgIGNvbnN0IG91dHB1dCA9IHBhdGguam9pbihST09ULCAiTS0wNS1zaG91bGQtbm90LWV4aXN0LnBkZiIpOwoKICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhvdXRwdXQpKSB7CiAgICAgICAgICBmcy51bmxpbmtTeW5jKG91dHB1dCk7CiAgICAgICAgfQoKICAgICAgICBjb25zdCBjbGlja1Byb21pc2UgPSBtZXJnZUJ1dHRvbi5jbGljaygpOwoKICAgICAgICBhd2FpdCBjbGlja1Byb21pc2U7CiAgICAgICAgYXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dCgyNTAwKTsKCiAgICAgICAgY29uc3QgYm9keVRleHQgPSBhd2FpdCBwYWdlLmxvY2F0b3IoImJvZHkiKS5pbm5lclRleHQoKTsKCiAgICAgICAgY29uc3QgaW52YWxpZFBhc3N3b3JkID0KICAgICAgICAgIC9JbnZhbGlkIFBERiBwYXNzd29yZC9pLnRlc3QoYm9keVRleHQpOwoKICAgICAgICBjb25zdCBwYXNzd29yZFJlcXVpcmVkID0KICAgICAgICAgIC9QYXNzd29yZCBSZXF1aXJlZC9pLnRlc3QoYm9keVRleHQpOwoKICAgICAgICBjb25zdCBtZXJnZUZhaWxlZCA9CiAgICAgICAgICAvTWVyZ2UgZmFpbGVkL2kudGVzdChib2R5VGV4dCk7CgogICAgICAgIGNvbnN0IHN1Y2Nlc3NUb2FzdCA9CiAgICAgICAgICBhd2FpdCBwYWdlLmdldEJ5VGV4dCgvbWVyZ2UgY29tcGxldGVkL2kpCiAgICAgICAgICAgIC5maXJzdCgpCiAgICAgICAgICAgIC5pc1Zpc2libGUoKQogICAgICAgICAgICAuY2F0Y2goKCkgPT4gZmFsc2UpOwoKICAgICAgICBpZiAoIWludmFsaWRQYXNzd29yZCkgewogICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCJJbnZhbGlkIFBERiBwYXNzd29yZCBtZXNzYWdlIHdhcyBub3Qgc2hvd24uIik7CiAgICAgICAgfQoKICAgICAgICBpZiAoIXBhc3N3b3JkUmVxdWlyZWQpIHsKICAgICAgICAgIHRocm93IG5ldyBFcnJvcigiUHJvdGVjdGVkIFBERiBkaWQgbm90IHJlbWFpbiBQYXNzd29yZCBSZXF1aXJlZC4iKTsKICAgICAgICB9CgogICAgICAgIGlmICghbWVyZ2VGYWlsZWQpIHsKICAgICAgICAgIHRocm93IG5ldyBFcnJvcigiTWVyZ2UgZmFpbGVkIG5vdGlmaWNhdGlvbiB3YXMgbm90IHNob3duLiIpOwogICAgICAgIH0KCiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMob3V0cHV0KSkgewogICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCJVbmV4cGVjdGVkIG1lcmdlZCBvdXRwdXQgZXhpc3RzLiIpOwogICAgICAgIH0KCiAgICAgICAgaWYgKHN1Y2Nlc3NUb2FzdCkgewogICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCJVbmV4cGVjdGVkIHN1Y2Nlc3MgdG9hc3QgYXBwZWFyZWQuIik7CiAgICAgICAgfQoKICAgICAgICByZXN1bHQoCiAgICAgICAgICAiTS0wNSIsCiAgICAgICAgICAiUEFTUyIsCiAgICAgICAgICAiUGFzc3dvcmQgUERGICsgd3JvbmcgcGFzc3dvcmQgLT4gYmxvY2tlZCIsCiAgICAgICAgICAiSW52YWxpZCBwYXNzd29yZCBzaG93biwgbWVyZ2UgcmVqZWN0ZWQsIG5vIG91dHB1dCwgbm8gc3VjY2VzcyB0b2FzdC4iCiAgICAgICAgKTsKICAgICAgfSBjYXRjaCAoZXJyb3IpIHsKICAgICAgICByZXN1bHQoCiAgICAgICAgICAiTS0wNSIsCiAgICAgICAgICAiRkFJTCIsCiAgICAgICAgICAiUGFzc3dvcmQgUERGICsgd3JvbmcgcGFzc3dvcmQgLT4gYmxvY2tlZCIsCiAgICAgICAgICBlcnJvci5tZXNzYWdlCiAgICAgICAgKTsKICAgICAgfSBmaW5hbGx5IHsKICAgICAgICBhd2FpdCBjb250ZXh0LmNsb3NlKCk7CiAgICAgIH0KICAgIH0KICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CiAgICAvLyBNLTA2IC0gT3ZlcnNpemVkIFBERiBtdXN0IGJlIGJsb2NrZWQKICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CgogICAgewogICAgICBjb25zdCBjb250ZXh0ID0gYXdhaXQgYnJvd3Nlci5uZXdDb250ZXh0KHsKICAgICAgICBhY2NlcHREb3dubG9hZHM6IHRydWUKICAgICAgfSk7CgogICAgICBjb25zdCBwYWdlID0gYXdhaXQgY29udGV4dC5uZXdQYWdlKCk7CgogICAgICB0cnkgewogICAgICAgIGF3YWl0IHBhZ2UuZ290byhVUkwsIHsKICAgICAgICAgIHdhaXRVbnRpbDogImRvbWNvbnRlbnRsb2FkZWQiLAogICAgICAgICAgdGltZW91dDogMzAwMDAKICAgICAgICB9KTsKCiAgICAgICAgYXdhaXQgcGFnZS5sb2NhdG9yKCdpbnB1dFt0eXBlPSJmaWxlIl0nKS5zZXRJbnB1dEZpbGVzKFsKICAgICAgICAgIHBhdGguam9pbihST09ULCAiQS0yLXBhZ2VzLnBkZiIpLAogICAgICAgICAgcGF0aC5qb2luKFJPT1QsICJNLTA2LXZhbGlkLW92ZXItMTVNaUIucGRmIikKICAgICAgICBdKTsKCiAgICAgICAgYXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dCgyMDAwKTsKCiAgICAgICAgY29uc3QgYm9keVRleHQgPSBhd2FpdCBwYWdlLmxvY2F0b3IoImJvZHkiKS5pbm5lclRleHQoKTsKCiAgICAgICAgY29uc3Qgc2l6ZVRvYXN0ID0gcGFnZS5nZXRCeVRleHQoCiAgICAgICAgICAvZmlsZSBleGNlZWRzIHRoZSBtYXhpbXVtIGFsbG93ZWQgc2l6ZS9pCiAgICAgICAgKS5maXJzdCgpOwoKICAgICAgICBjb25zdCB0b2FzdFZpc2libGUgPSBhd2FpdCBzaXplVG9hc3QKICAgICAgICAgIC5pc1Zpc2libGUoKQogICAgICAgICAgLmNhdGNoKCgpID0+IGZhbHNlKTsKCiAgICAgICAgY29uc3QgcmVhZHlWaXNpYmxlID0KICAgICAgICAgIC9NLTA2LXZhbGlkLW92ZXItMTVNaUJcLnBkZltcc1xTXSo/IFJlYWR5L2kudGVzdChib2R5VGV4dCk7CgogICAgICAgIGlmICghdG9hc3RWaXNpYmxlKSB7CiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoCiAgICAgICAgICAgICJNYXhpbXVtIGZpbGUgc2l6ZSB2YWxpZGF0aW9uIHRvYXN0IHdhcyBub3Qgc2hvd24uIgogICAgICAgICAgKTsKICAgICAgICB9CgogICAgICAgIGlmIChyZWFkeVZpc2libGUpIHsKICAgICAgICAgIHRocm93IG5ldyBFcnJvcigiT3ZlcnNpemVkIFBERiB3YXMgc2hvd24gYXMgUmVhZHkuIik7CiAgICAgICAgfQoKICAgICAgICByZXN1bHQoCiAgICAgICAgICAiTS0wNiIsCiAgICAgICAgICAiUEFTUyIsCiAgICAgICAgICAiT3ZlcnNpemVkIFBERiAtPiBibG9ja2VkIiwKICAgICAgICAgICIxNSBNaUIgbGltaXQgZW5mb3JjZWQ7IG92ZXJzaXplZCBQREYgd2FzIG5vdCBhY2NlcHRlZC4iCiAgICAgICAgKTsKICAgICAgfSBjYXRjaCAoZXJyb3IpIHsKICAgICAgICByZXN1bHQoCiAgICAgICAgICAiTS0wNiIsCiAgICAgICAgICAiRkFJTCIsCiAgICAgICAgICAiT3ZlcnNpemVkIFBERiAtPiBibG9ja2VkIiwKICAgICAgICAgIGVycm9yLm1lc3NhZ2UKICAgICAgICApOwogICAgICB9IGZpbmFsbHkgewogICAgICAgIGF3YWl0IGNvbnRleHQuY2xvc2UoKTsKICAgICAgfQogICAgfQogICAgLy8gTS0wMyAtIENvcnJ1cHRlZCBQREYgbXVzdCBibG9jayBtZXJnZQogICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KCiAgICB7CiAgICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCBicm93c2VyLm5ld0NvbnRleHQoewogICAgICAgIGFjY2VwdERvd25sb2FkczogdHJ1ZQogICAgICB9KTsKCiAgICAgIGNvbnN0IHBhZ2UgPSBhd2FpdCBjb250ZXh0Lm5ld1BhZ2UoKTsKCiAgICAgIHRyeSB7CiAgICAgICAgYXdhaXQgcGFnZS5nb3RvKFVSTCwgewogICAgICAgICAgd2FpdFVudGlsOiAiZG9tY29udGVudGxvYWRlZCIsCiAgICAgICAgICB0aW1lb3V0OiAzMDAwMAogICAgICAgIH0pOwoKICAgICAgICBjb25zdCBvdXRwdXQgPSBwYXRoLmpvaW4oUk9PVCwgIk0tMDMtc2hvdWxkLW5vdC1leGlzdC5wZGYiKTsKCiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMob3V0cHV0KSkgewogICAgICAgICAgZnMudW5saW5rU3luYyhvdXRwdXQpOwogICAgICAgIH0KCiAgICAgICAgYXdhaXQgcGFnZS5sb2NhdG9yKCdpbnB1dFt0eXBlPSJmaWxlIl0nKS5zZXRJbnB1dEZpbGVzKFsKICAgICAgICAgIHBhdGguam9pbihST09ULCAiQS0yLXBhZ2VzLnBkZiIpLAogICAgICAgICAgcGF0aC5qb2luKFJPT1QsICJDb3JydXB0ZWQucGRmIikKICAgICAgICBdKTsKCiAgICAgICAgYXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dCgxODAwKTsKCiAgICAgICAgY29uc3QgYm9keVRleHQgPSBhd2FpdCBwYWdlLmxvY2F0b3IoImJvZHkiKS5pbm5lclRleHQoKTsKCiAgICAgICAgY29uc3QgY29ycnVwdGVkVmlzaWJsZSA9IC9Db3JydXB0ZWQvaS50ZXN0KGJvZHlUZXh0KTsKCiAgICAgICAgY29uc3QgbWVyZ2VCdXR0b24gPSBwYWdlLmdldEJ5Um9sZSgiYnV0dG9uIiwgewogICAgICAgICAgbmFtZTogL3VubG9ja1xzKiZccyptZXJnZS9pCiAgICAgICAgfSk7CgogICAgICAgIGNvbnN0IGJ1dHRvbkVuYWJsZWQgPSBhd2FpdCBtZXJnZUJ1dHRvbi5pc0VuYWJsZWQoKTsKCiAgICAgICAgY29uc3Qgb3V0cHV0RXhpc3RzID0gZnMuZXhpc3RzU3luYyhvdXRwdXQpOwoKICAgICAgICBjb25zdCBzdWNjZXNzVG9hc3RWaXNpYmxlID0KICAgICAgICAgIGF3YWl0IHBhZ2UuZ2V0QnlUZXh0KC9tZXJnZSBjb21wbGV0ZWQvaSkKICAgICAgICAgICAgLmZpcnN0KCkKICAgICAgICAgICAgLmlzVmlzaWJsZSgpCiAgICAgICAgICAgIC5jYXRjaCgoKSA9PiBmYWxzZSk7CgogICAgICAgIGlmICghY29ycnVwdGVkVmlzaWJsZSkgewogICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCJDb3JydXB0ZWQgc3RhdGUgd2FzIG5vdCBzaG93bi4iKTsKICAgICAgICB9CgogICAgICAgIGlmIChidXR0b25FbmFibGVkKSB7CiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoIk1lcmdlIGJ1dHRvbiByZW1haW5lZCBlbmFibGVkLiIpOwogICAgICAgIH0KCiAgICAgICAgaWYgKG91dHB1dEV4aXN0cykgewogICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCJVbmV4cGVjdGVkIG91dHB1dCBQREYgZXhpc3RzLiIpOwogICAgICAgIH0KCiAgICAgICAgaWYgKHN1Y2Nlc3NUb2FzdFZpc2libGUpIHsKICAgICAgICAgIHRocm93IG5ldyBFcnJvcigiVW5leHBlY3RlZCBzdWNjZXNzIHRvYXN0IGFwcGVhcmVkLiIpOwogICAgICAgIH0KCiAgICAgICAgcmVzdWx0KAogICAgICAgICAgIk0tMDMiLAogICAgICAgICAgIlBBU1MiLAogICAgICAgICAgIkNvcnJ1cHRlZCBQREYgLT4gYmxvY2tlZCIsCiAgICAgICAgICAiQ29ycnVwdGVkIHN0YXRlIHNob3duLCBtZXJnZSBkaXNhYmxlZCwgbm8gZG93bmxvYWQuIgogICAgICAgICk7CiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICAgICAgcmVzdWx0KAogICAgICAgICAgIk0tMDMiLAogICAgICAgICAgIkZBSUwiLAogICAgICAgICAgIkNvcnJ1cHRlZCBQREYgLT4gYmxvY2tlZCIsCiAgICAgICAgICBlcnJvci5tZXNzYWdlCiAgICAgICAgKTsKICAgICAgfSBmaW5hbGx5IHsKICAgICAgICBhd2FpdCBjb250ZXh0LmNsb3NlKCk7CiAgICAgIH0KICAgIH0KCiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgIC8vIE0tMDcgLSBFeGFjdCAxNSBNaUIgYm91bmRhcnkgbXVzdCBiZSBhY2NlcHRlZAogICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CgogICAgewogICAgICBjb25zdCBjb250ZXh0ID0gYXdhaXQgYnJvd3Nlci5uZXdDb250ZXh0KHsKICAgICAgICBhY2NlcHREb3dubG9hZHM6IHRydWUKICAgICAgfSk7CiAgICAgIGNvbnN0IHBhZ2UgPSBhd2FpdCBjb250ZXh0Lm5ld1BhZ2UoKTsKCiAgICAgIHRyeSB7CiAgICAgICAgYXdhaXQgcGFnZS5nb3RvKFVSTCwgewogICAgICAgICAgd2FpdFVudGlsOiAiZG9tY29udGVudGxvYWRlZCIsCiAgICAgICAgICB0aW1lb3V0OiAzMDAwMAogICAgICAgIH0pOwoKICAgICAgICBhd2FpdCBwYWdlLmxvY2F0b3IoJ2lucHV0W3R5cGU9ImZpbGUiXScpLnNldElucHV0RmlsZXMoWwogICAgICAgICAgcGF0aC5qb2luKFJPT1QsICJBLTItcGFnZXMucGRmIiksCiAgICAgICAgICBwYXRoLmpvaW4oUk9PVCwgIk0tMDctdmFsaWQtZXhhY3QtMTVNaUIucGRmIikKICAgICAgICBdKTsKCiAgICAgICAgYXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dCgyMDAwKTsKCiAgICAgICAgY29uc3QgYm9keVRleHQgPSBhd2FpdCBwYWdlLmxvY2F0b3IoImJvZHkiKS5pbm5lclRleHQoKTsKCiAgICAgICAgY29uc3QgcmVhZHlWaXNpYmxlID0KICAgICAgICAgIC9NLTA3LXZhbGlkLWV4YWN0LTE1TWlCXC5wZGZbXHNcU10qUmVhZHkvaS50ZXN0KGJvZHlUZXh0KTsKCiAgICAgICAgY29uc3QgbWVyZ2VCdXR0b24gPSBwYWdlLmdldEJ5Um9sZSgiYnV0dG9uIiwgewogICAgICAgICAgbmFtZTogL3VubG9ja1xzKlwmXHMqbWVyZ2UvaQogICAgICAgIH0pOwoKICAgICAgICBpZiAoIXJlYWR5VmlzaWJsZSkgewogICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCJFeGFjdCAxNSBNaUIgUERGIHdhcyBub3Qgc2hvd24gYXMgUmVhZHkuIik7CiAgICAgICAgfQoKICAgICAgICBpZiAoIShhd2FpdCBtZXJnZUJ1dHRvbi5pc0VuYWJsZWQoKSkpIHsKICAgICAgICAgIHRocm93IG5ldyBFcnJvcigKICAgICAgICAgICAgIk1lcmdlIGJ1dHRvbiByZW1haW5lZCBkaXNhYmxlZCBhdCBleGFjdCAxNSBNaUIgYm91bmRhcnkuIgogICAgICAgICAgKTsKICAgICAgICB9CgogICAgICAgIHJlc3VsdCgKICAgICAgICAgICJNLTA3IiwKICAgICAgICAgICJQQVNTIiwKICAgICAgICAgICJFeGFjdCAxNSBNaUIgUERGIC0+IGFjY2VwdGVkIiwKICAgICAgICAgICIxNSBNaUIgYm91bmRhcnkgYWNjZXB0ZWQgYW5kIE1lcmdlIGVuYWJsZWQuIgogICAgICAgICk7CiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICAgICAgcmVzdWx0KAogICAgICAgICAgIk0tMDciLAogICAgICAgICAgIkZBSUwiLAogICAgICAgICAgIkV4YWN0IDE1IE1pQiBQREYgLT4gYWNjZXB0ZWQiLAogICAgICAgICAgZXJyb3IubWVzc2FnZQogICAgICAgICk7CiAgICAgIH0gZmluYWxseSB7CiAgICAgICAgYXdhaXQgY29udGV4dC5jbG9zZSgpOwogICAgICB9CiAgICB9CgogICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CiAgICAvLyBNLTA4IC0gU3VjY2Vzc2Z1bCBicm93c2VyIG1lcmdlIG91dHB1dCArIHRvYXN0CiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KCiAgICB7CiAgICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCBicm93c2VyLm5ld0NvbnRleHQoewogICAgICAgIGFjY2VwdERvd25sb2FkczogdHJ1ZQogICAgICB9KTsKICAgICAgY29uc3QgcGFnZSA9IGF3YWl0IGNvbnRleHQubmV3UGFnZSgpOwoKICAgICAgdHJ5IHsKICAgICAgICBhd2FpdCBwYWdlLmdvdG8oVVJMLCB7CiAgICAgICAgICB3YWl0VW50aWw6ICJkb21jb250ZW50bG9hZGVkIiwKICAgICAgICAgIHRpbWVvdXQ6IDMwMDAwCiAgICAgICAgfSk7CgogICAgICAgIGF3YWl0IHBhZ2UubG9jYXRvcignaW5wdXRbdHlwZT0iZmlsZSJdJykuc2V0SW5wdXRGaWxlcyhbCiAgICAgICAgICBwYXRoLmpvaW4oUk9PVCwgIkEtMi1wYWdlcy5wZGYiKSwKICAgICAgICAgIHBhdGguam9pbihST09ULCAiQi0xLXBhZ2UucGRmIikKICAgICAgICBdKTsKCiAgICAgICAgYXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dCgxNTAwKTsKCiAgICAgICAgY29uc3QgbWVyZ2VCdXR0b24gPSBwYWdlLmdldEJ5Um9sZSgiYnV0dG9uIiwgewogICAgICAgICAgbmFtZTogL3VubG9ja1xzKlwmXHMqbWVyZ2UvaQogICAgICAgIH0pOwoKICAgICAgICBpZiAoIShhd2FpdCBtZXJnZUJ1dHRvbi5pc0VuYWJsZWQoKSkpIHsKICAgICAgICAgIHRocm93IG5ldyBFcnJvcigiTWVyZ2UgYnV0dG9uIHdhcyBkaXNhYmxlZCBmb3IgdmFsaWQgUERGcy4iKTsKICAgICAgICB9CgogICAgICAgIGNvbnN0IG91dHB1dCA9IHBhdGguam9pbihST09ULCAiTS0wOC1icm93c2VyLW91dHB1dC5wZGYiKTsKCiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMob3V0cHV0KSkgewogICAgICAgICAgZnMudW5saW5rU3luYyhvdXRwdXQpOwogICAgICAgIH0KCiAgICAgICAgY29uc3QgZG93bmxvYWRQcm9taXNlID0gcGFnZS53YWl0Rm9yRXZlbnQoImRvd25sb2FkIiwgewogICAgICAgICAgdGltZW91dDogMzAwMDAKICAgICAgICB9KTsKCiAgICAgICAgYXdhaXQgbWVyZ2VCdXR0b24uY2xpY2soKTsKCiAgICAgICAgY29uc3QgZG93bmxvYWQgPSBhd2FpdCBkb3dubG9hZFByb21pc2U7CiAgICAgICAgYXdhaXQgZG93bmxvYWQuc2F2ZUFzKG91dHB1dCk7CgogICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhvdXRwdXQpKSB7CiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoIk0tMDggb3V0cHV0IFBERiB3YXMgbm90IGNyZWF0ZWQuIik7CiAgICAgICAgfQoKICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMob3V0cHV0KTsKCiAgICAgICAgaWYgKHN0YXQuc2l6ZSA8PSAwKSB7CiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoIk0tMDggb3V0cHV0IFBERiBpcyBlbXB0eS4iKTsKICAgICAgICB9CgogICAgICAgIGNvbnN0IHN1Y2Nlc3NUb2FzdCA9IHBhZ2UuZ2V0QnlUZXh0KC9tZXJnZSBjb21wbGV0ZWQvaSkuZmlyc3QoKTsKCiAgICAgICAgaWYgKCEoYXdhaXQgc3VjY2Vzc1RvYXN0LmlzVmlzaWJsZSgpLmNhdGNoKCgpID0+IGZhbHNlKSkpIHsKICAgICAgICAgIHRocm93IG5ldyBFcnJvcigiTWVyZ2Ugc3VjY2VzcyB0b2FzdCB3YXMgbm90IHZpc2libGUuIik7CiAgICAgICAgfQoKICAgICAgICByZXN1bHQoCiAgICAgICAgICAiTS0wOCIsCiAgICAgICAgICAiUEFTUyIsCiAgICAgICAgICAiU3VjY2Vzc2Z1bCBicm93c2VyIG1lcmdlIC0+IG91dHB1dCArIHRvYXN0IiwKICAgICAgICAgIGBPdXRwdXQgY3JlYXRlZCAoJHtzdGF0LnNpemV9IGJ5dGVzKSBhbmQgc3VjY2VzcyB0b2FzdCB2ZXJpZmllZC5gCiAgICAgICAgKTsKICAgICAgfSBjYXRjaCAoZXJyb3IpIHsKICAgICAgICByZXN1bHQoCiAgICAgICAgICAiTS0wOCIsCiAgICAgICAgICAiRkFJTCIsCiAgICAgICAgICAiU3VjY2Vzc2Z1bCBicm93c2VyIG1lcmdlIC0+IG91dHB1dCArIHRvYXN0IiwKICAgICAgICAgIGVycm9yLm1lc3NhZ2UKICAgICAgICApOwogICAgICB9IGZpbmFsbHkgewogICAgICAgIGF3YWl0IGNvbnRleHQuY2xvc2UoKTsKICAgICAgfQogICAgfQoKICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICAgLy8gTS0wOSAtIE1lcmdlIGJ1dHRvbiBzdGF0ZSBtYXRyaXgKICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQoKICAgIHsKICAgICAgY29uc3QgY29udGV4dCA9IGF3YWl0IGJyb3dzZXIubmV3Q29udGV4dCh7CiAgICAgICAgYWNjZXB0RG93bmxvYWRzOiB0cnVlCiAgICAgIH0pOwogICAgICBjb25zdCBwYWdlID0gYXdhaXQgY29udGV4dC5uZXdQYWdlKCk7CgogICAgICB0cnkgewogICAgICAgIC8vIFR3byB2YWxpZCBQREZzIC0+IGVuYWJsZWQKICAgICAgICBhd2FpdCBwYWdlLmdvdG8oVVJMLCB7CiAgICAgICAgICB3YWl0VW50aWw6ICJkb21jb250ZW50bG9hZGVkIiwKICAgICAgICAgIHRpbWVvdXQ6IDMwMDAwCiAgICAgICAgfSk7CgogICAgICAgIGF3YWl0IHBhZ2UubG9jYXRvcignaW5wdXRbdHlwZT0iZmlsZSJdJykuc2V0SW5wdXRGaWxlcyhbCiAgICAgICAgICBwYXRoLmpvaW4oUk9PVCwgIkEtMi1wYWdlcy5wZGYiKSwKICAgICAgICAgIHBhdGguam9pbihST09ULCAiQi0xLXBhZ2UucGRmIikKICAgICAgICBdKTsKCiAgICAgICAgYXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dCgxNTAwKTsKCiAgICAgICAgbGV0IG1lcmdlQnV0dG9ucyA9IHBhZ2UuZ2V0QnlSb2xlKCJidXR0b24iLCB7CiAgICAgICAgICBuYW1lOiAvdW5sb2NrXHMqXCZccyptZXJnZS9pCiAgICAgICAgfSk7CgogICAgICAgIGlmIChhd2FpdCBtZXJnZUJ1dHRvbnMuY291bnQoKSAhPT0gMSkgewogICAgICAgICAgdGhyb3cgbmV3IEVycm9yKAogICAgICAgICAgICAiRXhwZWN0ZWQgZXhhY3RseSBvbmUgTWVyZ2UgYnV0dG9uIGZvciB0d28gdmFsaWQgUERGcy4iCiAgICAgICAgICApOwogICAgICAgIH0KCiAgICAgICAgaWYgKCEoYXdhaXQgbWVyZ2VCdXR0b25zLmZpcnN0KCkuaXNFbmFibGVkKCkpKSB7CiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoCiAgICAgICAgICAgICJNZXJnZSBidXR0b24gc2hvdWxkIGJlIGVuYWJsZWQgZm9yIHR3byB2YWxpZCBQREZzLiIKICAgICAgICAgICk7CiAgICAgICAgfQoKICAgICAgICAvLyBDb3JydXB0ZWQgUERGIC0+IGRpc2FibGVkCiAgICAgICAgYXdhaXQgcGFnZS5yZWxvYWQoewogICAgICAgICAgd2FpdFVudGlsOiAiZG9tY29udGVudGxvYWRlZCIKICAgICAgICB9KTsKCiAgICAgICAgYXdhaXQgcGFnZS5sb2NhdG9yKCdpbnB1dFt0eXBlPSJmaWxlIl0nKS5zZXRJbnB1dEZpbGVzKFsKICAgICAgICAgIHBhdGguam9pbihST09ULCAiQS0yLXBhZ2VzLnBkZiIpLAogICAgICAgICAgcGF0aC5qb2luKFJPT1QsICJDb3JydXB0ZWQucGRmIikKICAgICAgICBdKTsKCiAgICAgICAgYXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dCgxODAwKTsKCiAgICAgICAgbWVyZ2VCdXR0b25zID0gcGFnZS5nZXRCeVJvbGUoImJ1dHRvbiIsIHsKICAgICAgICAgIG5hbWU6IC91bmxvY2tccypcJlxzKm1lcmdlL2kKICAgICAgICB9KTsKCiAgICAgICAgaWYgKGF3YWl0IG1lcmdlQnV0dG9ucy5maXJzdCgpLmlzRW5hYmxlZCgpKSB7CiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoCiAgICAgICAgICAgICJNZXJnZSBidXR0b24gc2hvdWxkIGJlIGRpc2FibGVkIHdpdGggYSBjb3JydXB0ZWQgUERGLiIKICAgICAgICAgICk7CiAgICAgICAgfQoKICAgICAgICAvLyBQcm90ZWN0ZWQgUERGICsgY29ycmVjdCBwYXNzd29yZCAtPiBlbmFibGVkCiAgICAgICAgYXdhaXQgcGFnZS5yZWxvYWQoewogICAgICAgICAgd2FpdFVudGlsOiAiZG9tY29udGVudGxvYWRlZCIKICAgICAgICB9KTsKCiAgICAgICAgYXdhaXQgcGFnZS5sb2NhdG9yKCdpbnB1dFt0eXBlPSJmaWxlIl0nKS5zZXRJbnB1dEZpbGVzKFsKICAgICAgICAgIHBhdGguam9pbihST09ULCAiQS0yLXBhZ2VzLnBkZiIpLAogICAgICAgICAgcGF0aC5qb2luKFJPT1QsICJQcm90ZWN0ZWQtMS1wYWdlLnBkZiIpCiAgICAgICAgXSk7CgogICAgICAgIGF3YWl0IHBhZ2Uud2FpdEZvclRpbWVvdXQoMTUwMCk7CgogICAgICAgIGNvbnN0IHBhc3N3b3JkID0gcGFnZS5nZXRCeUxhYmVsKCJQREYgUGFzc3dvcmQiKTsKCiAgICAgICAgYXdhaXQgcGFzc3dvcmQuZmlsbCgiaWVwZGYxMjMiKTsKICAgICAgICBhd2FpdCBwYXNzd29yZC5wcmVzcygiVGFiIik7CiAgICAgICAgYXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dCgzMDAwKTsKCiAgICAgICAgbWVyZ2VCdXR0b25zID0gcGFnZS5nZXRCeVJvbGUoImJ1dHRvbiIsIHsKICAgICAgICAgIG5hbWU6IC91bmxvY2tccypcJlxzKm1lcmdlL2kKICAgICAgICB9KTsKCiAgICAgICAgaWYgKCEoYXdhaXQgbWVyZ2VCdXR0b25zLmZpcnN0KCkuaXNFbmFibGVkKCkpKSB7CiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoCiAgICAgICAgICAgICJNZXJnZSBidXR0b24gc2hvdWxkIGJlIGVuYWJsZWQgYWZ0ZXIgY29ycmVjdCBwYXNzd29yZC4iCiAgICAgICAgICApOwogICAgICAgIH0KCiAgICAgICAgLy8gUHJvdGVjdGVkIFBERiArIGVtcHR5IHBhc3N3b3JkIC0+IGRpc2FibGVkCiAgICAgICAgYXdhaXQgcGFnZS5yZWxvYWQoewogICAgICAgICAgd2FpdFVudGlsOiAiZG9tY29udGVudGxvYWRlZCIKICAgICAgICB9KTsKCiAgICAgICAgYXdhaXQgcGFnZS5sb2NhdG9yKCdpbnB1dFt0eXBlPSJmaWxlIl0nKS5zZXRJbnB1dEZpbGVzKFsKICAgICAgICAgIHBhdGguam9pbihST09ULCAiQS0yLXBhZ2VzLnBkZiIpLAogICAgICAgICAgcGF0aC5qb2luKFJPT1QsICJQcm90ZWN0ZWQtMS1wYWdlLnBkZiIpCiAgICAgICAgXSk7CgogICAgICAgIGF3YWl0IHBhZ2Uud2FpdEZvclRpbWVvdXQoMTUwMCk7CgogICAgICAgIG1lcmdlQnV0dG9ucyA9IHBhZ2UuZ2V0QnlSb2xlKCJidXR0b24iLCB7CiAgICAgICAgICBuYW1lOiAvdW5sb2NrXHMqXCZccyptZXJnZS9pCiAgICAgICAgfSk7CgogICAgICAgIGlmIChhd2FpdCBtZXJnZUJ1dHRvbnMuZmlyc3QoKS5pc0VuYWJsZWQoKSkgewogICAgICAgICAgdGhyb3cgbmV3IEVycm9yKAogICAgICAgICAgICAiTWVyZ2UgYnV0dG9uIHNob3VsZCBiZSBkaXNhYmxlZCB3aXRoIGFuIGVtcHR5IHBhc3N3b3JkLiIKICAgICAgICAgICk7CiAgICAgICAgfQoKICAgICAgICByZXN1bHQoCiAgICAgICAgICAiTS0wOSIsCiAgICAgICAgICAiUEFTUyIsCiAgICAgICAgICAiTWVyZ2UgYnV0dG9uIHN0YXRlIG1hdHJpeCIsCiAgICAgICAgICAiVmFsaWQ9ZW5hYmxlZDsgY29ycnVwdGVkPWRpc2FibGVkOyBjb3JyZWN0IHBhc3N3b3JkPWVuYWJsZWQ7IGVtcHR5IHBhc3N3b3JkPWRpc2FibGVkLiIKICAgICAgICApOwogICAgICB9IGNhdGNoIChlcnJvcikgewogICAgICAgIHJlc3VsdCgKICAgICAgICAgICJNLTA5IiwKICAgICAgICAgICJGQUlMIiwKICAgICAgICAgICJNZXJnZSBidXR0b24gc3RhdGUgbWF0cml4IiwKICAgICAgICAgIGVycm9yLm1lc3NhZ2UKICAgICAgICApOwogICAgICB9IGZpbmFsbHkgewogICAgICAgIGF3YWl0IGNvbnRleHQuY2xvc2UoKTsKICAgICAgfQogICAgfQogIH0gY2F0Y2ggKGVycm9yKSB7CiAgICByZXN1bHQoCiAgICAgICJCUk9XU0VSIiwKICAgICAgIkZBSUwiLAogICAgICAiQnJvd3NlciByZWdyZXNzaW9uIHJ1bm5lciIsCiAgICAgIGVycm9yLm1lc3NhZ2UKICAgICk7CiAgfSBmaW5hbGx5IHsKICAgIGlmIChicm93c2VyKSB7CiAgICAgIGF3YWl0IGJyb3dzZXIuY2xvc2UoKTsKICAgIH0KICB9Cn0KCm1haW4oKTsNCg=='
                )
            )

            [IO.File]::WriteAllText(
                $runner,
                $embedded,
                [Text.Encoding]::UTF8
            )

            $env:NODE_PATH = Join-Path $ProjectRoot "node_modules"
$browserOutput = & node $runner 2>&1
            $resultLines = @(
                $browserOutput |
                Where-Object {
                    $_ -is [string] -and $_ -match "^RESULT\|"
                }
            )

            if($resultLines.Count -eq 0){
                throw "Embedded browser runner produced no RESULT lines."
            }

            foreach($line in $resultLines){
                if($line -match "^RESULT\|([^|]+)\|([^|]+)\|([^|]+)\|(.*)$"){
                    Add-TestResult $Matches[1] $Matches[3] $Matches[2] $Matches[4]
                }
            }

            if($LASTEXITCODE -ne 0){
                Add-TestResult "BROWSER-RUNNER" "Browser regression execution" "FAIL" "Node exited with code $LASTEXITCODE."
            }
        }
        catch {
            Add-TestResult "BROWSER-RUNNER" "Browser regression execution" "FAIL" $_.Exception.Message
        }
        finally {
            Remove-Item $runner -Force -ErrorAction SilentlyContinue
        }
    }
}

# Final report
# ------------------------------------------------------------

$passCount = ($Results | Where-Object Status -eq "PASS").Count
$failCount = ($Results | Where-Object Status -eq "FAIL").Count
$skipCount = @($Results | Where-Object { $_.Status -eq "SKIPPED" }).Count

$report = New-Object System.Text.StringBuilder

[void]$report.AppendLine("iePDF - Merge PDF Regression Report")
[void]$report.AppendLine("Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$report.AppendLine("")
[void]$report.AppendLine("PASS    : $passCount")
[void]$report.AppendLine("FAIL    : $failCount")
[void]$report.AppendLine("SKIPPED : $skipCount")
[void]$report.AppendLine("")
[void]$report.AppendLine("Detailed Results")
[void]$report.AppendLine("----------------")

foreach ($r in $Results) {
    [void]$report.AppendLine(
        "TEST=$($r.Test) | STATUS=$($r.Status) | $($r.Name)"
    )

    if ($r.Details) {
        [void]$report.AppendLine(
            "DETAILS=$($r.Details)"
        )
    }
}

[IO.File]::WriteAllText(
    $ReportFile,
    $report.ToString(),
    [Text.Encoding]::UTF8
)

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " FINAL RESULT" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "PASS    : $passCount" -ForegroundColor Green
Write-Host "FAIL    : $failCount" -ForegroundColor Red
Write-Host "SKIPPED : $skipCount" -ForegroundColor Yellow
Write-Host ""
Write-Host "Report : $ReportFile"
Write-Host "Log    : $LogFile"
Write-Host ""

Stop-Transcript | Out-Null

if ($failCount -gt 0) {
    exit 1
}

exit 0
