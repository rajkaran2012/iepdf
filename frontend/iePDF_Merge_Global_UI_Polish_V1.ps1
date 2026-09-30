#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Root='C:\IEPDF\frontend'; $Workspace=Join-Path $Root 'components\MergeWorkspace.tsx'; $BackupRoot=Join-Path $Root '_ui-backups'
function Fail([string]$m){Write-Host "[ERROR] $m" -ForegroundColor Red; Write-Host 'NO SOURCE CHANGE WAS PERFORMED BY THIS CHECK.' -ForegroundColor Yellow; exit 1}
function Require([string]$t,[string]$n,[string]$l){if(-not $t.Contains($n)){Fail "Missing expected marker: $l"}}
function Replace-Once([string]$t,[string]$o,[string]$n,[string]$l){$c=([regex]::Matches($t,[regex]::Escape($o))).Count;if($c-ne 1){Fail "$l expected exactly 1 occurrence, found $c. No write performed."};return $t.Replace($o,$n)}
if(-not(Test-Path -LiteralPath $Workspace -PathType Leaf)){Fail "MergeWorkspace.tsx not found: $Workspace"}
$text=[IO.File]::ReadAllText((Resolve-Path $Workspace)); $original=$text
$required=@('onAddFiles','onPasswordChange','onPasswordBlur','onTogglePassword','onSkipFile','onRemoveFile','onReorderFiles','onUnlockMerge','event.dataTransfer.setData("application/x-iepdf-reorder", "1");','disabled={!canMerge}','Drop PDFs here','Add PDF Files','Files never leave your device.','lg:grid-cols-[minmax(0,1fr)_320px]','w-full max-w-none')
foreach($m in $required){Require $text $m $m}
Require $text 'min-h-[150px] w-full flex-col' 'current 150px drop-zone'
Require $text 'rounded-2xl border bg-white shadow-sm transition' 'current PDF row'
Require $text 'bg-red-600 text-white transition hover:bg-red-700' 'current remove button'
Require $text 'rounded-xl px-5 py-3.5 text-base font-semibold text-white shadow-lg transition' 'current merge button'
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss';$BackupDir=Join-Path $BackupRoot "MERGE-UI-POLISH-V1-BEFORE-$stamp";New-Item -ItemType Directory -Path $BackupDir -Force|Out-Null;Copy-Item $Workspace (Join-Path $BackupDir 'MergeWorkspace.tsx') -Force
# Visual-only replacements; functional handlers/logic are untouched.
$text=Replace-Once $text '${files.length > 1 ? "" : "invisible pointer-events-none"}flex h-10 w-10 shrink-0 cursor-grab select-none items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:cursor-grab select-nonebing ${' '${files.length > 1 ? "" : "invisible pointer-events-none"} flex h-10 w-10 shrink-0 cursor-grab select-none items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 active:cursor-grabbing ${' 'drag-handle malformed class'
$text=Replace-Once $text 'relative mt-2 grid h-[calc(100vh-205px)] min-h-[560px] w-full max-w-none grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white shadow-sm lg:grid-cols-[minmax(0,1fr)_320px]' 'relative mt-2 grid h-[calc(100vh-205px)] min-h-[560px] w-full max-w-none grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(0,1fr)_320px]' 'outer workspace shell'
$text=Replace-Once $text 'flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-dashed border-slate-300 p-4 lg:col-start-1 lg:row-start-1' 'flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-slate-200 bg-slate-50/30 p-4 lg:col-start-1 lg:row-start-1' 'left pane'
$text=Replace-Once $text 'group flex min-h-[150px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-5 text-center transition hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2' 'group flex min-h-[126px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-5 py-4 text-center transition hover:border-blue-400 hover:bg-blue-50/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2' 'drop zone'
$text=Replace-Once $text 'className="mb-2 h-9 w-9 text-slate-500 transition group-hover:text-blue-600"' 'className="mb-1.5 h-8 w-8 text-slate-500 transition group-hover:text-blue-600"' 'drop icon'
$text=Replace-Once $text 'className="mb-1 text-sm font-semibold text-slate-700"' 'className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500"' 'drop label'
$text=Replace-Once $text 'className="text-xl font-semibold text-slate-800"' 'className="text-lg font-semibold tracking-tight text-slate-900"' 'drop headline'
$text=Replace-Once $text 'mt-3 flex items-center justify-between border-b border-dashed border-slate-200 pb-2' 'mt-3 flex items-center justify-between border-b border-slate-200 pb-2.5' 'file list header'
$text=Replace-Once $text 'text-sm font-semibold text-slate-800' 'text-sm font-semibold tracking-tight text-slate-900' 'file list title'
$text=Replace-Once $text 'text-xs text-slate-500' 'text-[11px] font-medium text-slate-400' 'reorder hint'
$text=Replace-Once $text 'rounded-2xl border bg-white shadow-sm transition ${' 'rounded-xl border bg-white shadow-none transition ${' 'PDF row shell'
$text=Replace-Once $text 'border-gray-200 hover:border-gray-300 hover:shadow-md' 'border-slate-200 hover:border-slate-300 hover:shadow-sm' 'PDF row hover'
$text=Replace-Once $text 'flex min-w-0 items-center gap-3 px-4 py-2.5' 'flex min-w-0 items-center gap-3 px-3.5 py-2.5' 'PDF row spacing'
$text=Replace-Once $text 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-600' 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600' 'order badge'
$text=Replace-Once $text 'min-w-0 truncate text-sm font-semibold text-gray-900' 'min-w-0 truncate text-sm font-medium text-slate-900' 'filename'
$text=Replace-Once $text 'mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500' 'mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500' 'metadata'
$text=Replace-Once $text 'rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600' 'rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600' 'skipped badge'
$text=Replace-Once $text 'rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700' 'rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200' 'ready badge'
$text=Replace-Once $text 'rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700' 'rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-200' 'error badge'
$text=Replace-Once $text 'rounded-full bg-yellow-100 px-3 py-1.5 text-xs font-semibold text-yellow-700' 'rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200' 'protected badge'
$text=Replace-Once $text 'flex h-9 w-9 items-center justify-center rounded-lg transition ${' 'flex h-9 w-9 items-center justify-center rounded-lg border border-transparent transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${' 'skip action'
$text=Replace-Once $text 'bg-gray-100 text-gray-700 hover:bg-gray-200' 'bg-slate-100 text-slate-600 hover:border-slate-200 hover:bg-slate-200 hover:text-slate-800' 'skip state'
$text=Replace-Once $text 'bg-green-100 text-green-700 hover:bg-green-200' 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' 'restore state'
$text=Replace-Once $text 'flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-700' 'flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1' 'remove action'
$text=Replace-Once $text 'border-t border-yellow-100 bg-yellow-50/40 px-4 py-2.5' 'border-t border-amber-100 bg-amber-50/50 px-4 py-2.5' 'protected panel'
$text=Replace-Once $text 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200' 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100' 'password input'
$text=Replace-Once $text 'flex min-h-0 flex-col overflow-hidden p-5 lg:col-start-2 lg:row-start-1' 'flex min-h-0 flex-col overflow-hidden bg-white p-5 lg:col-start-2 lg:row-start-1' 'right pane'
$text=Replace-Once $text 'text-sm leading-5 text-slate-600' 'text-[13px] leading-5 text-slate-500' 'instruction'
$text=Replace-Once $text 'mt-4 text-sm font-semibold text-slate-800' 'mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500' 'summary heading'
$text=Replace-Once $text 'grid grid-cols-2 gap-2' 'mt-2 grid grid-cols-2 gap-2' 'summary grid'
$text=Replace-Once $text 'rounded-xl border border-dashed border-slate-200 bg-white p-3 text-center' 'rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-center transition' 'summary cards'
$text=Replace-Once $text 'text-2xl font-bold' 'text-xl font-semibold tracking-tight text-slate-900' 'total value'
$text=Replace-Once $text 'text-2xl font-bold text-green-600' 'text-xl font-semibold tracking-tight text-emerald-600' 'ready value'
$text=Replace-Once $text 'text-2xl font-bold text-amber-600' 'text-xl font-semibold tracking-tight text-amber-600' 'protected value'
$text=Replace-Once $text 'text-2xl font-bold text-blue-600' 'text-xl font-semibold tracking-tight text-blue-600' 'skipped value'
$text=Replace-Once $text 'text-2xl font-bold text-red-600' 'text-xl font-semibold tracking-tight text-red-600' 'error value'
$text=Replace-Once $text 'mt-auto border-t border-dashed border-slate-200 pt-4' 'mt-auto border-t border-slate-200 pt-4' 'CTA divider'
$text=Replace-Once $text 'w-full rounded-xl px-5 py-3.5 text-base font-semibold text-white shadow-lg transition ${' 'w-full rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${' 'CTA shell'
$text=Replace-Once $text '"cursor-not-allowed bg-gray-400"' '"cursor-not-allowed bg-slate-300 text-slate-500 shadow-none"' 'CTA disabled'
$text=Replace-Once $text '"bg-red-600 hover:bg-red-700"' '"bg-blue-600 hover:bg-blue-700 active:bg-blue-800"' 'CTA enabled'
$text=Replace-Once $text 'mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500' 'mt-3 flex items-start gap-2 text-[11px] leading-5 text-slate-400' 'privacy note'
$enc=New-Object System.Text.UTF8Encoding($false);[IO.File]::WriteAllText($Workspace,$text,$enc)
$after=[IO.File]::ReadAllText((Resolve-Path $Workspace));foreach($m in $required){Require $after $m "post-write: $m"};if($after.Contains('select-nonebing')){Fail 'Malformed class remains'};Require $after 'h-[calc(100vh-205px)] min-h-[560px] w-full max-w-none' 'frozen geometry';Require $after 'lg:grid-cols-[minmax(0,1fr)_320px]' 'frozen layout'
function Remove-ClassNames([string]$s){[regex]::Replace($s,'(?s)\bclassName="[^"]*"','className=""')};if((Remove-ClassNames $original) -ne (Remove-ClassNames $after)){Fail 'Non-className source content changed. Safety stop.'}
Set-Location $Root;& pnpm exec tsc --noEmit;if($LASTEXITCODE-ne 0){Fail 'TypeScript failed'};& pnpm build;if($LASTEXITCODE-ne 0){Fail 'Production build failed'}
Write-Host '';Write-Host 'MERGE PDF GLOBAL UI POLISH V1 — PASS' -ForegroundColor Green;Write-Host "Backup: $BackupDir";Write-Host 'NO GIT OPERATIONS';Write-Host 'NO LIVE DEPLOYMENT';Write-Host 'NEXT: inspect the local Merge PDF page visually.' -ForegroundColor Cyan
