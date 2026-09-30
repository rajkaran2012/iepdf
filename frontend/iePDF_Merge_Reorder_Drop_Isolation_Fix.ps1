$ErrorActionPreference = "Stop"

$Root = "C:\IEPDF\frontend"
$File = Join-Path $Root "components\MergeWorkspace.tsx"

if (-not (Test-Path -LiteralPath $File)) {
    throw "Target file not found: $File"
}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Text = [System.IO.File]::ReadAllText($File, $Utf8NoBom)

# Required markers. If any are missing, stop before writing anything.
$required = @(
'event.dataTransfer.setData(
             "text/plain",
             id
         );',
'if (event.dataTransfer.types.includes("Files")) {
         setIsWorkspaceDragOver(true);
     }',
'if (event.dataTransfer.types.includes("Files")) {
         event.dataTransfer.dropEffect = "copy";
         setIsWorkspaceDragOver(true);
     }',
'const files = Array.from(
         event.dataTransfer.files ?? []
     );',
'event.preventDefault();

         const draggedId ='
)

foreach ($m in $required) {
    if (-not $Text.Contains($m)) {
        throw "Expected marker not found. No file was changed."
    }
}

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $Root "_ui-backups"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$Backup = Join-Path $BackupDir "MERGE-REORDER-DROP-FIX-BEFORE-$Stamp-MergeWorkspace.tsx"
Copy-Item -LiteralPath $File -Destination $Backup -Force

# 1. Mark internal reorder drags.
$old = @'
event.dataTransfer.setData(
             "text/plain",
             id
         );
'@
$new = @'
event.dataTransfer.setData(
             "text/plain",
             id
         );
         event.dataTransfer.setData(
             "application/x-iepdf-reorder",
             id
         );
'@
$Text = $Text.Replace($old, $new)

# 2. Outer workspace drag-enter ignores internal reorder.
$old = @'
if (event.dataTransfer.types.includes("Files")) {
         setIsWorkspaceDragOver(true);
     }
'@
$new = @'
if (event.dataTransfer.types.includes("application/x-iepdf-reorder")) {
         return;
     }

     if (event.dataTransfer.types.includes("Files")) {
         setIsWorkspaceDragOver(true);
     }
'@
$Text = $Text.Replace($old, $new)

# 3. Outer workspace drag-over ignores internal reorder.
$old = @'
if (event.dataTransfer.types.includes("Files")) {
         event.dataTransfer.dropEffect = "copy";
         setIsWorkspaceDragOver(true);
     }
'@
$new = @'
if (event.dataTransfer.types.includes("application/x-iepdf-reorder")) {
         event.dataTransfer.dropEffect = "move";
         return;
     }

     if (event.dataTransfer.types.includes("Files")) {
         event.dataTransfer.dropEffect = "copy";
         setIsWorkspaceDragOver(true);
     }
'@
$Text = $Text.Replace($old, $new)

# 4. Outer workspace drop ignores internal reorder.
$old = @'
event.preventDefault();

     setIsWorkspaceDragOver(false);

     const files = Array.from(
         event.dataTransfer.files ?? []
     );
'@
$new = @'
event.preventDefault();

     if (event.dataTransfer.types.includes("application/x-iepdf-reorder")) {
         return;
     }

     setIsWorkspaceDragOver(false);

     const files = Array.from(
         event.dataTransfer.files ?? []
     );
'@
$Text = $Text.Replace($old, $new)

# 5. Internal reorder drop does not bubble to outer file-drop zone.
$old = @'
event.preventDefault();

         const draggedId =
'@
$new = @'
event.preventDefault();
         event.stopPropagation();

         const draggedId =
'@
$Text = $Text.Replace($old, $new)

[System.IO.File]::WriteAllText($File, $Text, $Utf8NoBom)

Write-Host ""
Write-Host "[SUCCESS] Reorder/file-drop isolation fix applied." -ForegroundColor Green
Write-Host "Backup: $Backup" -ForegroundColor Cyan
Write-Host ""
Write-Host "Validation/Security code was NOT changed." -ForegroundColor Yellow
Write-Host "UI layout/width/labels were NOT changed." -ForegroundColor Yellow
Write-Host ""
Write-Host "Next:"
Write-Host "  cd C:\IEPDF\frontend"
Write-Host "  pnpm exec tsc --noEmit"
Write-Host "  pnpm build"
