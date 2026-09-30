cd C:\iepdf\frontend

$handoff = Get-ChildItem `
    .\_handoff\IEPDF-CHAT-HANDOFF-*.md |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

$package = ".\_handoff\IEPDF-NEW-CHAT-HANDOFF"

New-Item -ItemType Directory -Path $package -Force | Out-Null

Copy-Item $handoff.FullName `
    (Join-Path $package "IEPDF-CHAT-HANDOFF.md") `
    -Force

Copy-Item `
    .\_regression\compress-pdf\compress-regression-report.txt `
    (Join-Path $package "compress-regression-report.txt") `
    -Force

Copy-Item `
    .\_regression\compress-pdf\logs\compress-regression-20260925-105334.log `
    (Join-Path $package "compress-regression-20260925-105334.log") `
    -Force

Copy-Item `
    .\app\pdfium-c21\page.tsx.C21E-PASS `
    (Join-Path $package "page.tsx.C21E-PASS") `
    -Force

Copy-Item `
    .\app\pdfium-c21\page.tsx.BC-CORPUS-BASE `
    (Join-Path $package "page.tsx.BC-CORPUS-BASE") `
    -Force

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "NEW CHAT HANDOFF PACKAGE READY" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

Get-ChildItem $package |
Select-Object Name, Length, LastWriteTime