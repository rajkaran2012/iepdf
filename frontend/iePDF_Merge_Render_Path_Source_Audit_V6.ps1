# ============================================================
# iePDF Merge PDF - Render Path Source Audit V6
# READ-ONLY DIAGNOSTIC
# NO SOURCE CHANGES
# NO GIT
# NO DEPLOYMENT
# ============================================================

$ErrorActionPreference = "Stop"

$Frontend = "C:\IEPDF\frontend"
$PageFile = Join-Path $Frontend "app\merge-pdf\page.tsx"
$WorkspaceFile = Join-Path $Frontend "components\MergeWorkspace.tsx"
$ReportDir = Join-Path $Frontend "_regression\merge-pdf"

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ReportFile = Join-Path $ReportDir "merge-render-source-audit-v6-$Timestamp.txt"

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$Lines = New-Object System.Collections.Generic.List[string]

function Add-Line {
    param([string]$Text = "")
    $Lines.Add($Text)
    Write-Host $Text
}

function Show-Section {
    param(
        [string]$Title,
        [string]$Text
    )

    Add-Line ""
    Add-Line ("=" * 78)
    Add-Line $Title
    Add-Line ("=" * 78)
    Add-Line $Text
}

function Show-Matches {
    param(
        [string]$FilePath,
        [string[]]$Patterns,
        [string]$Label
    )

    Add-Line ""
    Add-Line "--- $Label ---"

    if (-not (Test-Path $FilePath)) {
        Add-Line "FILE NOT FOUND: $FilePath"
        return
    }

    $Content = Get-Content -Raw -LiteralPath $FilePath

    foreach ($Pattern in $Patterns) {
        Add-Line ""
        Add-Line "PATTERN: $Pattern"

        $Matches = [regex]::Matches(
            $Content,
            $Pattern,
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )

        if ($Matches.Count -eq 0) {
            Add-Line "  NOT FOUND"
        }
        else {
            foreach ($Match in $Matches) {
                $Index = $Match.Index

                $Start = [Math]::Max(0, $Index - 220)
                $Length = [Math]::Min(
                    700,
                    $Content.Length - $Start
                )

                $Snippet = $Content.Substring($Start, $Length)

                Add-Line "  MATCH:"
                Add-Line $Snippet
                Add-Line "  ---"
            }
        }
    }
}

Add-Line "iePDF MERGE PDF - RENDER PATH SOURCE AUDIT V6"
Add-Line "Started: $(Get-Date)"
Add-Line "Frontend: $Frontend"
Add-Line "Page: $PageFile"
Add-Line "Workspace: $WorkspaceFile"
Add-Line ""
Add-Line "IMPORTANT:"
Add-Line "This script is READ-ONLY."
Add-Line "No source files will be modified."
Add-Line "No Git operations will be performed."
Add-Line "No live deployment will be performed."

# ------------------------------------------------------------
# FILE EXISTENCE
# ------------------------------------------------------------

Show-Section "1. FILE EXISTENCE" @"
Page file exists      : $(Test-Path $PageFile)
Workspace file exists : $(Test-Path $WorkspaceFile)
"@

# ------------------------------------------------------------
# PAGE SOURCE AUDIT
# ------------------------------------------------------------

Show-Matches `
    -FilePath $PageFile `
    -Label "2. WORKSPACE STATE / RENDER CONDITIONS" `
    -Patterns @(
        "workspaceFiles",
        "showWorkspace",
        "setShowWorkspace",
        "setWorkspaceFiles",
        "workspaceFiles\.length",
        "workspaceFiles\.map",
        "workspaceFiles\.filter",
        "workspaceFiles\.some"
    )

# ------------------------------------------------------------
# MERGEWORKSPACE CALL SITE
# ------------------------------------------------------------

Show-Matches `
    -FilePath $PageFile `
    -Label "3. MERGEWORKSPACE CALL SITE" `
    -Patterns @(
        "<MergeWorkspace",
        "files=\{workspaceFiles\}",
        "files=\{",
        "onAddFiles=",
        "onReorderFiles=",
        "onUnlockMerge="
    )

# ------------------------------------------------------------
# FILE INPUT / PROCESSING PATH
# ------------------------------------------------------------

Show-Matches `
    -FilePath $PageFile `
    -Label "4. FILE INPUT AND PROCESSING PATH" `
    -Patterns @(
        "fileInputRef",
        "handleSelectFiles",
        "handleFileChange",
        "processSelectedFiles",
        "BrowserPdfAnalyzer",
        "analyzeMany",
        "setWorkspaceFiles"
    )

# ------------------------------------------------------------
# POSSIBLE OLD TWO-STATE FLOW
# ------------------------------------------------------------

Show-Matches `
    -FilePath $PageFile `
    -Label "5. POSSIBLE OLD TWO-STATE WORKSPACE FLOW" `
    -Patterns @(
        "showWorkspace",
        "Select PDF Files",
        "Select PDF",
        "No PDFs",
        "Get started",
        "Add PDF Files"
    )

# ------------------------------------------------------------
# WORKSPACE COMPONENT PROPS
# ------------------------------------------------------------

Show-Matches `
    -FilePath $WorkspaceFile `
    -Label "6. MERGEWORKSPACE PROPS" `
    -Patterns @(
        "interface MergeWorkspaceProps",
        "type MergeWorkspaceProps",
        "files:",
        "onAddFiles",
        "onReorderFiles",
        "onUnlockMerge"
    )

# ------------------------------------------------------------
# WORKSPACE FILE RENDERING
# ------------------------------------------------------------

Show-Matches `
    -FilePath $WorkspaceFile `
    -Label "7. MERGEWORKSPACE FILE RENDERING" `
    -Patterns @(
        "files\.map",
        "files\.length",
        "activeFiles",
        "filteredFiles",
        "workspaceFiles",
        "PDF files",
        "Drag"
    )

# ------------------------------------------------------------
# CONDITIONAL RENDER AUDIT
# ------------------------------------------------------------

Show-Matches `
    -FilePath $PageFile `
    -Label "8. CONDITIONAL RENDERING AROUND MERGEWORKSPACE" `
    -Patterns @(
        "\{showWorkspace\s*&&",
        "\{showWorkspace\s*\?",
        "showWorkspace\s*&&\s*\(",
        "showWorkspace\s*\?"
    )

# ------------------------------------------------------------
# DIRECT FILE SUMMARY
# ------------------------------------------------------------

Add-Line ""
Add-Line ("=" * 78)
Add-Line "9. SIMPLE STATIC INTERPRETATION"
Add-Line ("=" * 78)

$PageContent = Get-Content -Raw -LiteralPath $PageFile
$WorkspaceContent = Get-Content -Raw -LiteralPath $WorkspaceFile

$Checks = [ordered]@{
    "PAGE_HAS_WORKSPACE_FILES" = ($PageContent -match "workspaceFiles")
    "PAGE_HAS_SET_WORKSPACE_FILES" = ($PageContent -match "setWorkspaceFiles")
    "PAGE_HAS_PROCESS_SELECTED_FILES" = ($PageContent -match "processSelectedFiles")
    "PAGE_HAS_ANALYZE_MANY" = ($PageContent -match "analyzeMany")
    "PAGE_HAS_MERGEWORKSPACE" = ($PageContent -match "<MergeWorkspace")
    "PAGE_PASSES_WORKSPACE_FILES" = ($PageContent -match "files=\{workspaceFiles\}")
    "PAGE_HAS_SHOW_WORKSPACE" = ($PageContent -match "showWorkspace")
    "WORKSPACE_HAS_FILES_PROP" = ($WorkspaceContent -match "files:")
    "WORKSPACE_MAPS_FILES" = ($WorkspaceContent -match "files\.map")
    "WORKSPACE_HAS_ON_ADD_FILES" = ($WorkspaceContent -match "onAddFiles")
    "WORKSPACE_HAS_REORDER" = ($WorkspaceContent -match "onReorderFiles")
    "WORKSPACE_HAS_UNLOCK_MERGE" = ($WorkspaceContent -match "onUnlockMerge")
}

foreach ($Key in $Checks.Keys) {
    Add-Line ("{0,-38}: {1}" -f $Key, $Checks[$Key])
}

# ------------------------------------------------------------
# IMPORTANT MISMATCH CHECKS
# ------------------------------------------------------------

Add-Line ""
Add-Line ("=" * 78)
Add-Line "10. IMPORTANT MISMATCH CHECKS"
Add-Line ("=" * 78)

$MismatchCount = 0

if ($PageContent -match "showWorkspace" -and
    $PageContent -match "showWorkspace\s*&&\s*\(") {

    Add-Line "WARNING: MergeWorkspace may still depend on showWorkspace."
    $MismatchCount++
}
else {
    Add-Line "PASS: No obvious showWorkspace && conditional found."
}

if ($PageContent -match "showWorkspace" -and
    $PageContent -notmatch "setShowWorkspace") {

    Add-Line "WARNING: showWorkspace is referenced but no setShowWorkspace was found."
    $MismatchCount++
}
else {
    Add-Line "PASS: showWorkspace setter/reference relationship appears present."
}

if ($PageContent -match "<MergeWorkspace" -and
    $PageContent -notmatch "files=\{workspaceFiles\}") {

    Add-Line "WARNING: MergeWorkspace call site does not visibly pass files={workspaceFiles}."
    $MismatchCount++
}
else {
    Add-Line "PASS: MergeWorkspace appears to receive workspaceFiles."
}

if ($WorkspaceContent -match "files\.map") {
    Add-Line "PASS: MergeWorkspace contains a files.map render path."
}
else {
    Add-Line "WARNING: No files.map render path found."
    $MismatchCount++
}

if ($PageContent -match "analyzeMany") {
    Add-Line "PASS: BrowserPdfAnalyzer.analyzeMany exists in page source."
}
else {
    Add-Line "WARNING: analyzeMany not found."
    $MismatchCount++
}

# ------------------------------------------------------------
# PROCESS FUNCTION SNIPPET
# ------------------------------------------------------------

$ProcessMatch = [regex]::Match(
    $PageContent,
    "(?s)const\s+processSelectedFiles.*?(?=const\s+handleFileChange|function\s+handleFileChange|$)"
)

if ($ProcessMatch.Success) {
    Show-Section "11. EXACT processSelectedFiles SOURCE REGION" $ProcessMatch.Value
}
else {
    Add-Line ""
    Add-Line "11. EXACT processSelectedFiles SOURCE REGION"
    Add-Line "NOT FOUND"
}

# ------------------------------------------------------------
# MERGEWORKSPACE RENDER REGION
# ------------------------------------------------------------

$RenderMatch = [regex]::Match(
    $PageContent,
    "(?s)<MergeWorkspace.*?>"
)

if ($RenderMatch.Success) {
    Show-Section "12. EXACT MERGEWORKSPACE OPENING TAG" $RenderMatch.Value
}
else {
    Add-Line ""
    Add-Line "12. EXACT MERGEWORKSPACE OPENING TAG"
    Add-Line "NOT FOUND"
}

# ------------------------------------------------------------
# FINAL
# ------------------------------------------------------------

Add-Line ""
Add-Line ("=" * 78)
Add-Line "13. FINAL RESULT"
Add-Line ("=" * 78)

if ($MismatchCount -eq 0) {
    Add-Line "SOURCE AUDIT: NO OBVIOUS RENDER-PATH MISMATCH FOUND"
}
else {
    Add-Line "SOURCE AUDIT: $MismatchCount POTENTIAL ISSUE(S) FOUND"
}

Add-Line ""
Add-Line "No source changes were made."
Add-Line "No live deployment was performed."
Add-Line "Report: $ReportFile"
Add-Line "Finished: $(Get-Date)"

[System.IO.File]::WriteAllLines(
    $ReportFile,
    $Lines,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "============================================================"
Write-Host "V6 SOURCE AUDIT COMPLETE"
Write-Host "Report: $ReportFile"
Write-Host "NO SOURCE CHANGES"
Write-Host "NO LIVE DEPLOYMENT"
Write-Host "============================================================"