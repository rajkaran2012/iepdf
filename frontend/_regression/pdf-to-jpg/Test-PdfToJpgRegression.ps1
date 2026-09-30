#requires -Version 5.1
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot  = "C:\IEPDF"
$FrontendRoot = "$ProjectRoot\frontend"
$Root         = "$FrontendRoot\_regression\pdf-to-jpg"
$FixtureRoot  = "$Root\fixtures"
$ArtifactRoot = "$Root\artifacts"
$LogRoot      = "$Root\logs"
$BrowserRunner= "$Root\run_browser.js"
$ReportRoot   = "$Root\reports"
$ReportPath   = "$ReportRoot\pdf-to-jpg-certification-report.txt"
$ToolUrl      = "http://localhost:3000/pdf-to-jpg"
$MaxBytes     = 15728640

New-Item -ItemType Directory -Force -Path $Root,$FixtureRoot,$ArtifactRoot,$LogRoot,$ReportRoot | Out-Null

$Stamp   = Get-Date -Format "yyyyMMdd-HHmmss"
$LogPath = "$LogRoot\final-$Stamp.log"

$Pass=0
$Fail=0
$Results=New-Object System.Collections.Generic.List[object]

function Log([string]$Message) {
    $line="[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Add-Content -Path $LogPath -Value $line -Encoding UTF8
    Write-Host $line
}

function Add-Result([string]$Id,[string]$Status,[string]$Message) {
    if($Status -eq "PASS"){$script:Pass++}
    elseif($Status -eq "FAIL"){$script:Fail++}
    $script:Results.Add([pscustomobject]@{Id=$Id;Status=$Status;Message=$Message})
    Log "$Status $Id : $Message"
}

Log "===== PDF -> JPG FULL J-SERIES FINAL START ====="

$required=@(
    @("ENV-01","C:\Program Files\Google\Chrome\Application\chrome.exe"),
    @("ENV-02","$FrontendRoot\node_modules\playwright"),
    @("ENV-03","$FrontendRoot\app\pdf-to-jpg\page.tsx"),
    @("ENV-04","$FrontendRoot\engine\processing\processors\PdfToJpgProcessor.ts"),
    @("ENV-05","$FrontendRoot\engine\rendering\PdfiumPageRenderer.ts"),
    @("ENV-06","$FrontendRoot\engine\rendering\JpegEncoder.ts"),
    @("ENV-07",$BrowserRunner)
)

foreach($x in $required) {
    if(Test-Path -LiteralPath $x[1]) {
        Add-Result $x[0] "PASS" "Required path exists."
    } else {
        Add-Result $x[0] "FAIL" "Missing required path: $($x[1])"
    }
}
$PagePath = "$FrontendRoot\app\pdf-to-jpg\page.tsx"
$ProcPath = "$FrontendRoot\engine\processing\processors\PdfToJpgProcessor.ts"
$BasePath = "$FrontendRoot\engine\processing\processors\BasePdfProcessor.ts"
$ConstPath = "$FrontendRoot\engine\validation\common\validationConstants.ts"
$PipePath = "$FrontendRoot\engine\validation\pipeline\ValidationPipeline.ts"

$page = Get-Content $PagePath -Raw
$proc = Get-Content $ProcPath -Raw
$base = Get-Content $BasePath -Raw
$const = Get-Content $ConstPath -Raw
$pipe = Get-Content $PipePath -Raw

Add-Result "SRC-01" $(if($page -match "PdfToJpgProcessor"){"PASS"}else{"FAIL"}) "Processor wiring."
Add-Result "SRC-02" $(if($page -match "ValidationConstants" -and $page -match "MAX_FILE_SIZE_BYTES"){"PASS"}else{"FAIL"}) "Authoritative 15 MiB gate."
Add-Result "SRC-03" $(if($page -match "toast\.success" -and $page -match "toast\.error" -and $page -match "toast\.warning"){"PASS"}else{"FAIL"}) "Centralized notifications."
Add-Result "SRC-04" $(if($page -notmatch "console\.(warn|error)"){"PASS"}else{"FAIL"}) "No handled-error console logging."
Add-Result "SRC-05" $(if($page -notmatch "ValidationGateway"){"PASS"}else{"FAIL"}) "No direct Gateway bypass."
Add-Result "SRC-06" $(if($proc -match "extends BasePdfProcessor"){"PASS"}else{"FAIL"}) "Canonical processor base."
Add-Result "SRC-07" $(if($proc -match "PdfiumPageRenderer" -and $proc -match "JpegEncoder"){"PASS"}else{"FAIL"}) "PDFium + JPEG pipeline."
Add-Result "SRC-08" $(if($proc -match "zipSync" -and $proc -match "jpg_pages\.zip"){"PASS"}else{"FAIL"}) "ZIP output contract."
Add-Result "SRC-09" $(if($proc -match "finally" -and $proc -match "close"){"PASS"}else{"FAIL"}) "Processor resource cleanup."
Add-Result "SRC-10" $(if($base -match "validationGateway\.validate"){"PASS"}else{"FAIL"}) "Canonical validation entry point."
Add-Result "SRC-11" $(if($const -match "MAX_FILE_SIZE_BYTES\s*:\s*15\s*\*\s*1024\s*\*\s*1024"){"PASS"}else{"FAIL"}) "Authoritative size declaration."
Add-Result "SEC-01" $(if($pipe -match "Boundary" -and $pipe -match "Security" -and $pipe -match "Deep"){"PASS"}else{"FAIL"}) "Frozen validation pipeline."
Add-Result "SEC-02" $(if($page -match "MAX_FILE_SIZE_BYTES" -and $base -match "validationGateway\.validate"){"PASS"}else{"FAIL"}) "Boundary and canonical processor enforcement."

Push-Location $FrontendRoot
try {
    & pnpm exec tsc --noEmit
    $tsExit = $LASTEXITCODE
}
finally {
    Pop-Location
}

Add-Result "BUILD-TS" $(if($tsExit -eq 0){"PASS"}else{"FAIL"}) "TypeScript compilation."

Log "Step 2 source/security/build checks complete."
try {
    $html = (Invoke-WebRequest -Uri $ToolUrl -UseBasicParsing -TimeoutSec 20).Content
    Add-Result "ENV-08" "PASS" "PDF -> JPG production page returned HTTP 200."

    $urls = [regex]::Matches($html,'(?:src|href)="([^"]+)"') |
        ForEach-Object { $_.Groups[1].Value } |
        Where-Object { $_ -match '^/_next/' } |
        Sort-Object -Unique

    $assetFailures = @()

    foreach($u in $urls) {
        try {
            $r = Invoke-WebRequest -Uri ("http://localhost:3000" + $u) -UseBasicParsing -TimeoutSec 15
            if($r.StatusCode -ne 200) {
                $assetFailures += "$u -> HTTP $($r.StatusCode)"
            }
        }
        catch {
            $assetFailures += "$u -> request failed"
        }
    }

    if($assetFailures.Count -eq 0) {
        Add-Result "ENV-09" "PASS" "All current PDF -> JPG static assets returned HTTP 200."
    }
    else {
        Add-Result "ENV-09" "FAIL" ("Static asset failures: " + ($assetFailures -join "; "))
    }
}
catch {
    Add-Result "ENV-08" "FAIL" "PDF -> JPG production page unavailable: $($_.Exception.Message)"
    Add-Result "ENV-09" "FAIL" "Static assets could not be verified."
}

$fixtureNames = @(
    "J01-one-page.pdf",
    "J02-two-page.pdf",
    "J03-five-page.pdf",
    "J04-ten-page.pdf",
    "J05-mixed-dimensions.pdf",
    "J06-zero-byte.pdf",
    "J07-fake-pdf.pdf",
    "J08-corrupt.pdf",
    "J09-password.pdf",
    "J10-javascript.pdf",
    "J11-under-15MB.pdf",
    "J12-exact-15MB.pdf",
    "J13-over-15MB.pdf",
    "J16 file with spaces and unicode-टेस्ट.pdf"
)

foreach($name in $fixtureNames) {
    $fp = Join-Path $FixtureRoot $name

    if(Test-Path -LiteralPath $fp) {
        $size = (Get-Item -LiteralPath $fp).Length

        if($name -eq "J12-exact-15MB.pdf") {
            Add-Result "FIX-J12" $(if($size -eq $MaxBytes){"PASS"}else{"FAIL"}) "Exact 15 MiB fixture size=$size."
        }
        elseif($name -eq "J13-over-15MB.pdf") {
            Add-Result "FIX-J13" $(if($size -eq ($MaxBytes + 1)){"PASS"}else{"FAIL"}) "Over-limit fixture size=$size."
        }
        elseif($name -eq "J06-zero-byte.pdf") {
            Add-Result "FIX-J06" $(if($size -eq 0){"PASS"}else{"FAIL"}) "Zero-byte fixture size=$size."
        }
        else {
            Add-Result ("FIX-" + [Math]::Abs($name.GetHashCode())) "PASS" "$name present; size=$size bytes."
        }
    }
    else {
        Add-Result ("FIX-" + [Math]::Abs($name.GetHashCode())) "FAIL" "Missing fixture: $name"
    }
}

Log "Step 3 production asset and fixture checks complete."
# STEP 4 — BROWSER J-SERIES + DEEP ARTIFACT VALIDATION

$DeepPyPath = Join-Path $env:TEMP ("iepdf-pdf-to-jpg-deep-" + $PID + ".py")

if(Test-Path -LiteralPath $DeepPyPath) {
    Remove-Item -LiteralPath $DeepPyPath -Force -ErrorAction SilentlyContinue
}

@"
import sys, os, zipfile, io
from PIL import Image

root = sys.argv[1]

cases = {
    "J-01": 1,
    "J-02": 2,
    "J-03": 5,
    "J-04": 10,
    "J-05": 4,
    "J-11": 2,
    "J-12": 1,
    "J-15": 2,
}

for cid, expected in cases.items():
    folder = os.path.join(root, cid)

    if not os.path.isdir(folder):
        print(f"FAIL|{cid}|artifact directory missing")
        continue

    zips = [
        os.path.join(folder, x)
        for x in os.listdir(folder)
        if x.lower().endswith(".zip")
    ]

    if len(zips) != 1:
        print(f"FAIL|{cid}|expected exactly one ZIP, found {len(zips)}")
        continue

    try:
        with zipfile.ZipFile(zips[0], "r") as z:
            if z.testzip() is not None:
                raise Exception("ZIP integrity check failed")

            names = z.namelist()

            if len(names) != expected:
                raise Exception(
                    f"expected {expected} JPG pages, found {len(names)}"
                )

            for index, name in enumerate(names, 1):
                expected_name = f"page_{index}.jpg"

                if name != expected_name:
                    raise Exception(
                        f"name/order mismatch: {name} != {expected_name}"
                    )

                data = z.read(name)

                if len(data) < 4 or data[:3] != b"\xff\xd8\xff":
                    raise Exception(f"{name} is not a JPEG")

                img = Image.open(io.BytesIO(data))

                if img.format != "JPEG":
                    raise Exception(f"{name} format={img.format}")

                if img.width <= 0 or img.height <= 0:
                    raise Exception(
                        f"{name} invalid dimensions {img.width}x{img.height}"
                    )

                img.verify()

        print(
            f"PASS|{cid}|ZIP integrity, page count, naming/order, "
            f"JPEG signature, decode and dimensions verified"
        )

    except Exception as e:
        print(f"FAIL|{cid}|{e}")
"@ | Set-Content -LiteralPath $DeepPyPath -Encoding UTF8

if(-not (Test-Path -LiteralPath $BrowserRunner)) {
    Add-Result "BROWSER-EXEC" "FAIL" "run_browser.js not found."
}
else {
    Push-Location $Root
    try {
        $BrowserOutput = & node $BrowserRunner 2>&1
        $BrowserExit = $LASTEXITCODE
        $BrowserOutput | ForEach-Object { Write-Host $_ }
    }
    finally {
        Pop-Location
    }

    Add-Result "BROWSER-EXEC" `
        $(if($BrowserExit -eq 0){"PASS"}else{"FAIL"}) `
        "Browser J-Series exit code=$BrowserExit."
}

$BrowserJson = Join-Path $ArtifactRoot "browser-results.json"

if(Test-Path -LiteralPath $BrowserJson) {
    try {
        $BJ = Get-Content -LiteralPath $BrowserJson -Raw | ConvertFrom-Json

        $BrowserPass = @(
            $BJ.results | Where-Object { $_.status -eq "PASS" }
        ).Count

        $BrowserFail = @(
            $BJ.results | Where-Object { $_.status -eq "FAIL" }
        ).Count

        $ConsoleErrors = @($BJ.consoleErrors).Count
        $PageErrors = @($BJ.pageErrors).Count

        Add-Result "BROWSER-RESULTS" `
            $(if($BrowserFail -eq 0){"PASS"}else{"FAIL"}) `
            "Browser J-Series: $BrowserPass PASS, $BrowserFail FAIL."

        Add-Result "BROWSER-CONSOLE" `
            $(if($ConsoleErrors -eq 0){"PASS"}else{"FAIL"}) `
            "Browser console errors=$ConsoleErrors."

        Add-Result "BROWSER-PAGEERROR" `
            $(if($PageErrors -eq 0){"PASS"}else{"FAIL"}) `
            "Browser page errors=$PageErrors."
    }
    catch {
        Add-Result "BROWSER-RESULTS" "FAIL" `
            "browser-results.json parse failure."
    }
}
else {
    Add-Result "BROWSER-RESULTS" "FAIL" `
        "browser-results.json was not produced."
}

$DeepOutput = & python $DeepPyPath $ArtifactRoot 2>&1

foreach($Line in $DeepOutput) {
    $Parts = $Line -split '\|',3

    if($Parts.Count -eq 3) {
        Add-Result ("ART-" + $Parts[1]) `
            $Parts[0] `
            $Parts[2]
    }
}

Remove-Item -LiteralPath $DeepPyPath -Force -ErrorAction SilentlyContinue

# NEGATIVE CASE ARTIFACT CHECK
$NegativeCases = @("J-06","J-07","J-08","J-09","J-10","J-13")
$Unexpected = @()

foreach($ID in $NegativeCases) {
    $Folder = Join-Path $ArtifactRoot $ID

    if(Test-Path -LiteralPath $Folder) {
        $Files = Get-ChildItem -LiteralPath $Folder -File -Recurse `
            -ErrorAction SilentlyContinue

        if(@($Files).Count -gt 0) {
            $Unexpected += "$ID produced $(@($Files).Count) artifact(s)"
        }
    }
}

Add-Result "NEG-ART" `
    $(if($Unexpected.Count -eq 0){"PASS"}else{"FAIL"}) `
    $(if($Unexpected.Count -eq 0) {
        "No artifacts produced for blocked negative cases."
    } else {
        $Unexpected -join "; "
    })

Log "Step 4 browser and deep artifact validation complete."

# FINAL REPORT
$Report = @(
    "iePDF PDF -> JPG FULL J-SERIES FINAL CERTIFICATION REPORT",
    "===========================================================",
    "Run: $Stamp",
    "",
    "FINAL RESULT",
    "------------",
    "PASS    : $Pass",
    "FAIL    : $Fail",
    "SKIPPED : 0",
    "",
    "RELEASE GATE",
    "------------",
    "FAIL must equal 0",
    "SKIPPED must equal 0",
    "",
    "DETAILED RESULTS",
    "----------------"
)

$Report += $Results | ForEach-Object {
    "{0,-8} {1,-20} {2}" -f $_.Status,$_.Id,$_.Message
}

Set-Content -LiteralPath $ReportPath -Value $Report -Encoding UTF8

Write-Host ""
Write-Host "==========================================================="
Write-Host " PDF -> JPG FULL J-SERIES FINAL CERTIFICATION"
Write-Host "==========================================================="
Write-Host "PASS    : $Pass"
Write-Host "FAIL    : $Fail"
Write-Host "SKIPPED : 0"
Write-Host "Report  : $ReportPath"
Write-Host "Log     : $LogPath"
Write-Host "==========================================================="

if($Fail -gt 0) {
    exit 1
}

exit 0


