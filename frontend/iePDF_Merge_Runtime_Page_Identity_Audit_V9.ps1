$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$ReportDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $ReportDir "merge-runtime-page-identity-v9-$Stamp.txt"

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$Out = New-Object System.Collections.Generic.List[string]

function Add-Line {
    param([string]$Text = "")
    $Value = [string]$Text
    $Out.Add($Value)
    Write-Host $Value
}

function Section {
    param([string]$Title)

    Add-Line ""
    Add-Line ("=" * 78)
    Add-Line $Title
    Add-Line ("=" * 78)
}

function Read-Safe {
    param([string]$Path)

    try {
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
            return $null
        }

        return [System.IO.File]::ReadAllText($Path)
    }
    catch {
        Add-Line "READ ERROR: $Path"
        Add-Line $_.Exception.Message
        return $null
    }
}

function Check-Text {
    param(
        [string]$Label,
        [string]$Text,
        [string]$Pattern
    )

    if ($null -eq $Text) {
        Add-Line "$Label : NOT AVAILABLE"
        return
    }

    if ($Text.Contains($Pattern)) {
        Add-Line "$Label : PRESENT"
    }
    else {
        Add-Line "$Label : ABSENT"
    }
}

Add-Line "iePDF MERGE PDF - RUNTIME PAGE IDENTITY AUDIT V9"
Add-Line "Started: $(Get-Date)"
Add-Line "Root: $Root"
Add-Line ""
Add-Line "READ ONLY"
Add-Line "NO SOURCE CHANGES"
Add-Line "NO GIT"
Add-Line "NO DEPLOYMENT"
Add-Line "NO CACHE DELETION"

# ============================================================
# 1. SOURCE PAGE IDENTITY
# ============================================================

Section "1. CURRENT APP ROUTER PAGE"

$CurrentPage = Join-Path $Root "app\merge-pdf\page.tsx"

if (Test-Path -LiteralPath $CurrentPage) {

    $Info = Get-Item -LiteralPath $CurrentPage

    Add-Line "PRESENT: $CurrentPage"
    Add-Line "SIZE: $($Info.Length)"
    Add-Line "LAST WRITE: $($Info.LastWriteTime)"

    $CurrentText = Read-Safe $CurrentPage

}
else {

    Add-Line "FAIL: Current App Router page missing"
    $CurrentText = $null
}

# ============================================================
# 2. OLD PAGE
# ============================================================

Section "2. ROOT-LEVEL OLD MERGE PAGE"

$OldPage = Join-Path $Root "merge-pdf\page.tsx"

if (Test-Path -LiteralPath $OldPage) {

    $Info = Get-Item -LiteralPath $OldPage

    Add-Line "PRESENT: $OldPage"
    Add-Line "SIZE: $($Info.Length)"
    Add-Line "LAST WRITE: $($Info.LastWriteTime)"

    $OldText = Read-Safe $OldPage

}
else {

    Add-Line "ABSENT: $OldPage"
    $OldText = $null
}

# ============================================================
# 3. CURRENT SOURCE SIGNATURE
# ============================================================

Section "3. CURRENT PAGE SOURCE SIGNATURE"

Check-Text "Import @/components/MergeWorkspace" `
    $CurrentText `
    "@/components/MergeWorkspace"

Check-Text "workspaceFiles" `
    $CurrentText `
    "workspaceFiles"

Check-Text "setWorkspaceFiles" `
    $CurrentText `
    "setWorkspaceFiles"

Check-Text "BrowserPdfAnalyzer" `
    $CurrentText `
    "BrowserPdfAnalyzer"

Check-Text "processSelectedFiles" `
    $CurrentText `
    "processSelectedFiles"

Check-Text "showWorkspace" `
    $CurrentText `
    "showWorkspace"

Check-Text "files={workspaceFiles}" `
    $CurrentText `
    "files={workspaceFiles}"

# ============================================================
# 4. OLD SOURCE SIGNATURE
# ============================================================

Section "4. OLD PAGE SOURCE SIGNATURE"

if ($null -eq $OldText) {

    Add-Line "Old page unavailable."

}
else {

    Check-Text "Old Select PDF Files" `
        $OldText `
        "Select PDF Files"

    Check-Text "Old showWorkspace false" `
        $OldText `
        "showWorkspace = useState(false)"

    Check-Text "Old BrowserPdfAnalyzer" `
        $OldText `
        "BrowserPdfAnalyzer"

    Check-Text "Old processSelectedFiles" `
        $OldText `
        "processSelectedFiles"

    Check-Text "Old MergeWorkspace" `
        $OldText `
        "MergeWorkspace"
}

# ============================================================
# 5. NEXT DEV RUNTIME PAGE
# ============================================================

Section "5. NEXT DEV RUNTIME PAGE"

$DevPage = Join-Path $Root ".next\dev\server\app\merge-pdf\page.js"

if (Test-Path -LiteralPath $DevPage) {

    $Info = Get-Item -LiteralPath $DevPage

    Add-Line "PRESENT: $DevPage"
    Add-Line "SIZE: $($Info.Length)"
    Add-Line "LAST WRITE: $($Info.LastWriteTime)"

    $DevText = Read-Safe $DevPage

}
else {

    Add-Line "ABSENT: $DevPage"
    $DevText = $null
}

# ============================================================
# 6. NEXT PRODUCTION RUNTIME PAGE
# ============================================================

Section "6. NEXT PRODUCTION RUNTIME PAGE"

$ProdPage = Join-Path $Root ".next\server\app\merge-pdf\page.js"

if (Test-Path -LiteralPath $ProdPage) {

    $Info = Get-Item -LiteralPath $ProdPage

    Add-Line "PRESENT: $ProdPage"
    Add-Line "SIZE: $($Info.Length)"
    Add-Line "LAST WRITE: $($Info.LastWriteTime)"

    $ProdText = Read-Safe $ProdPage

}
else {

    Add-Line "ABSENT: $ProdPage"
    $ProdText = $null
}

# ============================================================
# 7. DEV BUNDLE SIGNATURE
# ============================================================

Section "7. DEV RUNTIME SIGNATURE"

Check-Text "Dev MergeWorkspace" `
    $DevText `
    "MergeWorkspace"

Check-Text "Dev files.map" `
    $DevText `
    "files.map"

Check-Text "Dev Add PDF Files" `
    $DevText `
    "Add PDF Files"

Check-Text "Dev Select PDF Files" `
    $DevText `
    "Select PDF Files"

Check-Text "Dev workspaceFiles" `
    $DevText `
    "workspaceFiles"

Check-Text "Dev BrowserPdfAnalyzer" `
    $DevText `
    "BrowserPdfAnalyzer"

Check-Text "Dev processSelectedFiles" `
    $DevText `
    "processSelectedFiles"

# ============================================================
# 8. PRODUCTION BUNDLE SIGNATURE
# ============================================================

Section "8. PRODUCTION RUNTIME SIGNATURE"

Check-Text "Prod MergeWorkspace" `
    $ProdText `
    "MergeWorkspace"

Check-Text "Prod files.map" `
    $ProdText `
    "files.map"

Check-Text "Prod Add PDF Files" `
    $ProdText `
    "Add PDF Files"

Check-Text "Prod Select PDF Files" `
    $ProdText `
    "Select PDF Files"

Check-Text "Prod workspaceFiles" `
    $ProdText `
    "workspaceFiles"

Check-Text "Prod BrowserPdfAnalyzer" `
    $ProdText `
    "BrowserPdfAnalyzer"

Check-Text "Prod processSelectedFiles" `
    $ProdText `
    "processSelectedFiles"

# ============================================================
# 9. SOURCE MAPS
# ============================================================

Section "9. SOURCE MAPS"

$DevMap = Join-Path $Root ".next\dev\server\app\merge-pdf\page.js.map"
$ProdMap = Join-Path $Root ".next\server\app\merge-pdf\page.js.map"

foreach ($Map in @($DevMap, $ProdMap)) {

    if (Test-Path -LiteralPath $Map) {

        $Info = Get-Item -LiteralPath $Map

        Add-Line ""
        Add-Line "MAP PRESENT: $Map"
        Add-Line "SIZE: $($Info.Length)"
        Add-Line "LAST WRITE: $($Info.LastWriteTime)"

        $MapText = Read-Safe $Map

        Check-Text "  Map MergeWorkspace" `
            $MapText `
            "MergeWorkspace"

        Check-Text "  Map app/merge-pdf/page.tsx" `
            $MapText `
            "app/merge-pdf/page.tsx"

        Check-Text "  Map components/MergeWorkspace.tsx" `
            $MapText `
            "components/MergeWorkspace.tsx"
    }
    else {

        Add-Line "MAP ABSENT: $Map"
    }
}

# ============================================================
# 10. GENERATED FILE REFERENCES
# ============================================================

Section "10. GENERATED RUNTIME REFERENCES"

$GeneratedFiles = @()

$GeneratedRoots = @(
    (Join-Path $Root ".next\dev\server\app\merge-pdf"),
    (Join-Path $Root ".next\server\app\merge-pdf")
)

foreach ($Dir in $GeneratedRoots) {

    if (Test-Path -LiteralPath $Dir) {

        $GeneratedFiles += Get-ChildItem `
            -LiteralPath $Dir `
            -Recurse `
            -File `
            -ErrorAction SilentlyContinue
    }
}

Add-Line "Generated files scanned: $($GeneratedFiles.Count)"

foreach ($File in $GeneratedFiles) {

    $Text = Read-Safe $File.FullName

    if ($null -ne $Text) {

        if (
            $Text.Contains("MergeWorkspace") -or
            $Text.Contains("workspaceFiles") -or
            $Text.Contains("Add PDF Files") -or
            $Text.Contains("Select PDF Files")
        ) {

            Add-Line ""
            Add-Line "MATCH: $($File.FullName)"
            Add-Line "SIZE: $($File.Length)"

            Check-Text "  MergeWorkspace" $Text "MergeWorkspace"
            Check-Text "  workspaceFiles" $Text "workspaceFiles"
            Check-Text "  Add PDF Files" $Text "Add PDF Files"
            Check-Text "  Select PDF Files" $Text "Select PDF Files"
        }
    }
}

# ============================================================
# 11. ROUTE STRUCTURE
# ============================================================

Section "11. ROUTE STRUCTURE"

$AppMergeDir = Join-Path $Root "app\merge-pdf"
$RootMergeDir = Join-Path $Root "merge-pdf"

Add-Line "App Router route:"
if (Test-Path -LiteralPath $AppMergeDir) {
    Add-Line "  PRESENT: $AppMergeDir"
}
else {
    Add-Line "  MISSING"
}

Add-Line "Root-level legacy directory:"
if (Test-Path -LiteralPath $RootMergeDir) {
    Add-Line "  PRESENT: $RootMergeDir"
}
else {
    Add-Line "  ABSENT"
}

# ============================================================
# 12. TIMESTAMP CORRELATION
# ============================================================

Section "12. TIMESTAMP CORRELATION"

if (Test-Path -LiteralPath $CurrentPage) {
    Add-Line "SOURCE page.tsx:"
    Add-Line "  $((Get-Item $CurrentPage).LastWriteTime)"
}

if (Test-Path -LiteralPath $DevPage) {
    Add-Line "DEV runtime page.js:"
    Add-Line "  $((Get-Item $DevPage).LastWriteTime)"
}

if (Test-Path -LiteralPath $ProdPage) {
    Add-Line "PROD runtime page.js:"
    Add-Line "  $((Get-Item $ProdPage).LastWriteTime)"
}

# ============================================================
# 13. FINAL INTERPRETATION
# ============================================================

Section "13. FINAL INTERPRETATION"

Add-Line "The following facts are being reported only."
Add-Line "No automatic cleanup or modification is performed."

if ($null -ne $CurrentText -and
    $CurrentText.Contains("@/components/MergeWorkspace")) {

    Add-Line "CURRENT PAGE IMPORT: CONFIRMED"
}
else {
    Add-Line "CURRENT PAGE IMPORT: NOT CONFIRMED"
}

if ($null -ne $DevText -and
    $DevText.Contains("MergeWorkspace")) {

    Add-Line "DEV BUNDLE MERGEWORKSPACE: CONFIRMED"
}
else {
    Add-Line "DEV BUNDLE MERGEWORKSPACE: NOT CONFIRMED"
}

if ($null -ne $ProdText -and
    $ProdText.Contains("MergeWorkspace")) {

    Add-Line "PRODUCTION BUNDLE MERGEWORKSPACE: CONFIRMED"
}
else {
    Add-Line "PRODUCTION BUNDLE MERGEWORKSPACE: NOT CONFIRMED"
}

if (Test-Path -LiteralPath $RootMergeDir) {
    Add-Line "LEGACY ROOT MERGE-PDF DIRECTORY: PRESENT"
}
else {
    Add-Line "LEGACY ROOT MERGE-PDF DIRECTORY: ABSENT"
}

Add-Line ""
Add-Line "NO SOURCE CHANGES"
Add-Line "NO GIT"
Add-Line "NO DEPLOYMENT"
Add-Line "NO CACHE DELETION"

# ============================================================
# 14. SAVE
# ============================================================

Section "14. REPORT"

Add-Line "Report: $Report"
Add-Line "Finished: $(Get-Date)"

[System.IO.File]::WriteAllLines(
    $Report,
    $Out,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "============================================================"
Write-Host "V9 RUNTIME PAGE IDENTITY AUDIT COMPLETE"
Write-Host "Report: $Report"
Write-Host "NO SOURCE CHANGES"
Write-Host "NO GIT"
Write-Host "NO DEPLOYMENT"
Write-Host "============================================================"