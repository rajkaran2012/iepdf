$ErrorActionPreference = "Stop"

$Root = "C:\IEPDF\frontend"
$File = Join-Path $Root "app\merge-pdf\page.tsx"
$BackupDir = Join-Path $Root "_ui-backups"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (!(Test-Path -LiteralPath $File)) {
    throw "Target file not found: $File. No file changed."
}

$text = [IO.File]::ReadAllText($File, $Utf8NoBom)
$original = $text

# The previous patch accidentally wrote PowerShell's literal `r`n text
# into TypeScript. Replace ONLY those three malformed guard blocks.
$bad1 = '    if (event.dataTransfer.types.includes("application/x-iepdf-reorder")) {`r`n        return;`r`n    }'
$good1 = @'
    if (event.dataTransfer.types.includes("application/x-iepdf-reorder")) {
        return;
    }
'@

$bad2 = '    if (event.dataTransfer.types.includes("application/x-iepdf-reorder")) {`r`n        event.dataTransfer.dropEffect = "move";`r`n        return;`r`n    }'
$good2 = @'
    if (event.dataTransfer.types.includes("application/x-iepdf-reorder")) {
        event.dataTransfer.dropEffect = "move";
        return;
    }
'@

$bad3 = '    if (event.dataTransfer.types.includes("application/x-iepdf-reorder")) {`r`n        event.stopPropagation();`r`n        return;`r`n    }'
$good3 = @'
    if (event.dataTransfer.types.includes("application/x-iepdf-reorder")) {
        event.stopPropagation();
        return;
    }
'@

$count1 = ([regex]::Matches($text, [regex]::Escape($bad1))).Count
$count2 = ([regex]::Matches($text, [regex]::Escape($bad2))).Count
$count3 = ([regex]::Matches($text, [regex]::Escape($bad3))).Count

if ($count1 -ne 1 -or $count2 -ne 1 -or $count3 -ne 1) {
    throw "Safety check failed. Expected exactly 1 malformed block of each type; found $count1, $count2, $count3. No file changed."
}

$text = $text.Replace($bad1, $good1.TrimEnd("`r","`n"))
$text = $text.Replace($bad2, $good2.TrimEnd("`r","`n"))
$text = $text.Replace($bad3, $good3.TrimEnd("`r","`n"))

# Verify no literal PowerShell newline escape remains in the three guards.
if ($text -match 'application/x-iepdf-reorder"\)\) \{`r`n') {
    throw "Verification failed: malformed literal newline remains. No file changed."
}

foreach ($required in @(
    'application/x-iepdf-reorder',
    'event.dataTransfer.dropEffect = "move";',
    'event.stopPropagation();'
)) {
    if ($text -notmatch [regex]::Escape($required)) {
        throw "Verification failed: [$required] missing. No file changed."
    }
}

if ($text -eq $original) {
    throw "No change required. No file changed."
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $BackupDir "MERGE-REORDER-FIX-MALFORMED-TEXT-BEFORE-$stamp-page.tsx"

Copy-Item -LiteralPath $File -Destination $backup -Force
[IO.File]::WriteAllText($File, $text, $Utf8NoBom)

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " SUCCESS: TYPESCRIPT GUARDS REPAIRED" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Fixed only the 3 malformed reorder-isolation guards in:" -ForegroundColor Cyan
Write-Host "  app\merge-pdf\page.tsx"
Write-Host ""
Write-Host "No validation, security, analyzer, processor, or UI code was changed." -ForegroundColor Green
Write-Host "Backup: $backup" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next command:" -ForegroundColor Cyan
Write-Host "  pnpm exec tsc --noEmit"
