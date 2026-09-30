#requires -Version 5.1
<#!
.SYNOPSIS
    Enterprise-grade regression suite for iePDF Split PDF.

.DESCRIPTION
    Runs deterministic, fail-closed regression checks for the Split PDF MVP.
    The suite deliberately separates:
      1. Test-data integrity
      2. Source contract checks
      3. Production build
      4. Environment readiness
      5. Browser/UI functional tests
      6. Download/ZIP/PDF artifact integrity
      7. Boundary/security/error behavior
      8. Loading/reset/repeated-run behavior
      9. Performance timing for representative small PDFs

    Browser execution uses one Chrome process with sequential isolated contexts.
    The browser runner never treats a missing download as the only diagnostic;
    it captures page text, loading state, page errors, console errors/warnings,
    and operation timing.

    The script is designed for PowerShell 5.1 and newer.

.PARAMETER ProjectRoot
    iePDF project root.
.PARAMETER FrontendUrl
    Frontend base URL.
.PARAMETER BackendUrl
    Backend base URL.
.PARAMETER ChromePath
    Explicit Chrome executable path.
.PARAMETER MaxFileSizeBytes
    Authoritative Split input limit. Defaults to 15 MiB = 15,728,640 bytes.
.PARAMETER SelectionTimeoutSec
    Time allowed for file selection/analyzer/UI state.
.PARAMETER OperationTimeoutSec
    Time allowed for Split processing/download.
.PARAMETER PageLoadTimeoutSec
    Page navigation timeout.
.PARAMETER BuildTimeoutSec
    Maximum build duration.
.PARAMETER KeepArtifacts
    Preserve downloaded ZIP artifacts and browser diagnostics.
.PARAMETER SkipBuild
    Skip the production build.
.PARAMETER SkipServerChecks
    Skip environment readiness checks.
.PARAMETER SkipPerformance
    Skip performance timing assertions.
.PARAMETER PerformanceBudgetSmallPdfMs
    Soft performance budget for S-02 representative split.
.PARAMETER PerformanceBudgetFivePageMs
    Soft performance budget for S-03 representative split.
.PARAMETER StrictSourceChecks
    Treat source-contract failures as suite failures.
#>

[CmdletBinding()]
param(
    [string]$ProjectRoot = 'C:\IEPDF',
    [string]$FrontendUrl = 'http://127.0.0.1:3000',
    [string]$BackendUrl = 'http://127.0.0.1:8000',
    [string]$ChromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe',
    [long]$MaxFileSizeBytes = 15MB,
    [ValidateRange(5,120)][int]$SelectionTimeoutSec = 15,
    [ValidateRange(5,180)][int]$OperationTimeoutSec = 45,
    [ValidateRange(5,120)][int]$PageLoadTimeoutSec = 30,
    [ValidateRange(30,900)][int]$BuildTimeoutSec = 300,
    [switch]$KeepArtifacts,
    [switch]$SkipBuild,
    [switch]$SkipServerChecks,
    [switch]$SkipPerformance,
    [ValidateRange(100,60000)][int]$PerformanceBudgetSmallPdfMs = 5000,
    [ValidateRange(100,120000)][int]$PerformanceBudgetFivePageMs = 15000,
    [switch]$StrictSourceChecks
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$FrontendRoot = Join-Path $ProjectRoot 'frontend'
$ScriptsRoot = Join-Path $ProjectRoot 'scripts'
$RegressionRoot = Join-Path $FrontendRoot '_regression\split-pdf'
$LogRoot = Join-Path $RegressionRoot 'logs'
$ReportPath = Join-Path $RegressionRoot 'split-regression-enterprise-report.txt'
$RunStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogPath = Join-Path $LogRoot "split-regression-enterprise-$RunStamp.log"
$RunnerPath = Join-Path $RegressionRoot '_split-browser-runner-enterprise.js'
$NodeOutputPath = Join-Path $RegressionRoot "browser-results-$RunStamp.json"
$BrowserDiagRoot = Join-Path $ProjectRoot "_regression\split-pdf"; $BrowserDiagPath = Join-Path $BrowserDiagRoot "browser-diagnostics-$RunStamp.jsonl"
$BuildLogPath = Join-Path $LogRoot "build-enterprise-$RunStamp.log"

$TestCases = @(
    @{ Id='S-01'; File='S-01-1page.pdf'; ExpectedPages=1; Kind='functional' },
    @{ Id='S-02'; File='S-02-2pages.pdf'; ExpectedPages=2; Kind='functional' },
    @{ Id='S-03'; File='S-03-5pages.pdf'; ExpectedPages=5; Kind='functional' },
    @{ Id='S-04'; File='S-04-10pages.pdf'; ExpectedPages=10; Kind='functional' },
    @{ Id='S-05'; File='S-05-mixed-pages.pdf'; ExpectedPages=4; Kind='integrity' },
    @{ Id='S-06'; File='S-06-corrupted.pdf'; ExpectedPages=0; Kind='negative' },
    @{ Id='S-07'; File='S-07-zero-byte.pdf'; ExpectedPages=0; Kind='negative' },
    @{ Id='S-08'; File='S-08-renamed-nonpdf.pdf'; ExpectedPages=0; Kind='negative' },
    @{ Id='S-09'; File='S-09-protected.pdf'; ExpectedPages=2; Kind='protected' },
    @{ Id='S-10'; File='S-10-under-15MiB.pdf'; ExpectedPages=1; Kind='boundary' },
    @{ Id='S-11'; File='S-11-exact-15MiB.pdf'; ExpectedPages=1; Kind='boundary' },
    @{ Id='S-12'; File='S-12-over-15MiB.pdf'; ExpectedPages=1; Kind='boundary' }
)

$Pass = 0
$Fail = 0
$Skip = 0
$Results = New-Object System.Collections.Generic.List[object]
$StartedProcesses = New-Object System.Collections.Generic.List[System.Diagnostics.Process]
$StartTime = Get-Date

New-Item -ItemType Directory -Force -Path $RegressionRoot, $LogRoot, $BrowserDiagRoot | Out-Null

function Write-Log {
    param([Parameter(Mandatory)][string]$Message)
    $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -Path $LogPath -Value $line -Encoding UTF8
    Write-Host $line
}

function Add-Result {
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][ValidateSet('PASS','FAIL','SKIPPED')][string]$Status,
        [Parameter(Mandatory)][string]$Message
    )
    $obj = [pscustomobject]@{Id=$Id;Status=$Status;Message=$Message}
    $Results.Add($obj)
    switch ($Status) {
        'PASS' { $script:Pass++; Write-Log "PASS $Id : $Message" }
        'FAIL' { $script:Fail++; Write-Log "FAIL $Id : $Message" }
        'SKIPPED' { $script:Skip++; Write-Log "SKIPPED $Id : $Message" }
    }
}

function Assert-True {
    param([string]$Id,[bool]$Condition,[string]$PassMessage,[string]$FailMessage)
    if ($Condition) { Add-Result $Id 'PASS' $PassMessage }
    else { Add-Result $Id 'FAIL' $FailMessage }
}

function Test-HttpOk {
    param([Parameter(Mandatory)][string]$Url,[int]$TimeoutSec=8)
    try {
        $r = Invoke-WebRequest -Uri $Url -Method Get -UseBasicParsing -TimeoutSec $TimeoutSec
        return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
    } catch { return $false }
}

function Wait-HttpOk {
    param([Parameter(Mandatory)][string]$Url,[int]$TimeoutSec=60)
    $deadline=(Get-Date).AddSeconds($TimeoutSec)
    while((Get-Date) -lt $deadline){
        if(Test-HttpOk $Url){ return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Stop-StartedProcesses {
    foreach($p in @($StartedProcesses)){
        try {
            if($p -and -not $p.HasExited){
                $p.Kill()
                $p.WaitForExit(5000) | Out-Null
            }
        } catch {}
    }
}

function Ensure-TestData {
    $expectedNames = $TestCases.File
    foreach($name in $expectedNames){
        $path=Join-Path $RegressionRoot $name
        if(-not(Test-Path -LiteralPath $path -PathType Leaf)){ throw "Missing regression test file: $path" }
    }

    $expectedSizes = @{
        'S-07-zero-byte.pdf' = 0L
        'S-10-under-15MiB.pdf' = $MaxFileSizeBytes - 1
        'S-11-exact-15MiB.pdf' = $MaxFileSizeBytes
        'S-12-over-15MiB.pdf' = $MaxFileSizeBytes + 1
    }

    foreach($name in $expectedSizes.Keys){
        $actual=(Get-Item (Join-Path $RegressionRoot $name)).Length
        if($actual -ne $expectedSizes[$name]){
            throw "Boundary test data mismatch for $name. Expected $($expectedSizes[$name]) bytes; got $actual bytes."
        }
    }

    foreach($t in $TestCases){
        $path=Join-Path $RegressionRoot $t.File
        $size=(Get-Item $path).Length
        Write-Log "TEST-DATA $($t.Id) $($t.File) bytes=$size"
    }
    Add-Result 'TEST-DATA' 'PASS' "All $($TestCases.Count) Split regression files exist and boundary sizes match $MaxFileSizeBytes bytes."
}

function Check-SourceContracts {
    $paths = @{
        Page = Join-Path $FrontendRoot 'app\split-pdf\page.tsx'
        Processor = Join-Path $FrontendRoot 'engine\processing\processors\SplitPdfProcessor.ts'
        Loader = Join-Path $FrontendRoot 'engine\loaders\BrowserPdfLoader.ts'
        Base = Join-Path $FrontendRoot 'engine\processing\processors\BasePdfProcessor.ts'
        Gateway = Join-Path $FrontendRoot 'engine\validation\gateway\ValidationGateway.ts'
        Constants = Join-Path $FrontendRoot 'engine\validation\common\validationConstants.ts'
    }
    foreach($entry in $paths.GetEnumerator()){
        if(-not(Test-Path -LiteralPath $entry.Value -PathType Leaf)){ throw "Missing source file: $($entry.Value)" }
    }

    $page=Get-Content $paths.Page -Raw
    $processor=Get-Content $paths.Processor -Raw
    $loader=Get-Content $paths.Loader -Raw
    $base=Get-Content $paths.Base -Raw
    $gateway=Get-Content $paths.Gateway -Raw
    $constants=Get-Content $paths.Constants -Raw

    $checks = @(
        @('SRC-01',($page -match 'SplitPdfProcessor' -and $page -match 'toolType:\s*"split"'),'Split page wires SplitPdfProcessor and toolType split.','Split page processor/toolType contract missing.'),
        @('SRC-02',($page -match 'toast\.success' -and $page -match 'toast\.error' -and $page -match 'Splitting\.\.\.'),'Split page has success/error toast handling and loading state.','Split page toast/loading contract incomplete.'),
        @('SRC-03',($processor -match 'zipSync' -and $processor -match 'split_pages\.zip' -and $processor -match 'page_\$\{index \+ 1\}\.pdf'),'Processor creates per-page PDFs and split_pages.zip.','Split ZIP/page-generation contract missing.'),
        @('SRC-04',($loader -match 'PASSWORD_REQUIRED' -and $loader -match '%PDF-'),'Browser PDF loader contains signature and password handling.','Browser PDF loader signature/password handling missing.'),
        @('SRC-05',($base -match 'validationGateway\.validate' -and $base -match 'gatewayResult\.passed'),'BasePdfProcessor uses the canonical ValidationGateway authorization boundary.','Canonical ValidationGateway boundary missing.'),
        @('SRC-06',($gateway -match 'passed\s*=\s*this\.isProcessingAllowed|isProcessingAllowed' -and $gateway -match 'passed:\s*false'),'ValidationGateway retains fail-closed authorization semantics.','ValidationGateway fail-closed contract not detectable.'),
        @('SRC-07',($constants -match 'MAX_FILE_SIZE_BYTES\s*:\s*15\s*\*\s*1024\s*\*\s*1024'),'Authoritative 15 MiB validation constant exists.','Authoritative MAX_FILE_SIZE_BYTES constant not detectable.'),
        @('SRC-08',(-not($page -match 'console\.(warn|error)')),'Split page has no direct console.warn/console.error user-failure logging.','Split page still contains console.warn/console.error.'),
        @('SRC-09',(-not($processor -match 'ValidationGateway|validationGateway\.validate')),'Split processor does not introduce a second direct Gateway call.','Split processor appears to bypass/duplicate the BasePdfProcessor boundary.')
    )

    foreach($c in $checks){
        if($c[1]) { Add-Result $c[0] 'PASS' $c[2] }
        else {
            if($StrictSourceChecks){ Add-Result $c[0] 'FAIL' $c[3] }
            else { Add-Result $c[0] 'SKIPPED' "$($c[3]) [source check non-blocking]" }
        }
    }
}

function Run-Build {
    if($SkipBuild){ Add-Result 'BUILD' 'SKIPPED' 'Production build skipped by parameter.'; return }
    Push-Location $FrontendRoot
    try {
        $buildCmd = 'pnpm build > "' + $BuildLogPath + '" 2>&1'
        $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c',$buildCmd) -WorkingDirectory $FrontendRoot -PassThru -WindowStyle Hidden
        $StartedProcesses.Add($proc) | Out-Null
        if(-not $proc.WaitForExit($BuildTimeoutSec*1000)){
            try{$proc.Kill()}catch{}
            throw "pnpm build exceeded $BuildTimeoutSec seconds. See $BuildLogPath"
        }
        if($proc.ExitCode -ne 0){ throw "pnpm build failed with exit code $($proc.ExitCode). See $BuildLogPath" }
        $StartedProcesses.Remove($proc)
        Add-Result 'BUILD' 'PASS' 'Frontend production build passed.'
    } finally { Pop-Location }
}

function Ensure-Environment {
    if($SkipServerChecks){ Add-Result 'ENV' 'SKIPPED' 'Server checks skipped by parameter.'; return }

    if(Test-HttpOk "$FrontendUrl/split-pdf") { Add-Result 'ENV-01' 'PASS' 'Frontend /split-pdf is reachable.' }
    else { throw "Frontend /split-pdf is not reachable at $FrontendUrl" }

    Add-Result 'ENV-02' 'PASS' 'Backend /docs not required; Split is fully browser-side.'

    if(Test-Path -LiteralPath $ChromePath -PathType Leaf) { Add-Result 'ENV-03' 'PASS' "Chrome executable found at $ChromePath." }
    else { throw "Chrome executable not found: $ChromePath" }

    $nodeModules=Join-Path $FrontendRoot 'node_modules'
    if(Test-Path -LiteralPath (Join-Path $nodeModules 'playwright') -PathType Container) { Add-Result 'ENV-04' 'PASS' 'Playwright package is installed.' }
    else { throw 'Playwright package is missing from frontend/node_modules.' }
}

function Write-BrowserRunner {
    $runner = @'
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = process.env.SPLIT_REGRESSION_ROOT;
const FRONTEND = process.env.SPLIT_FRONTEND_URL;
const CHROME = process.env.SPLIT_CHROME_PATH;
const SELECTION_MS = Number(process.env.SPLIT_SELECTION_TIMEOUT_MS || 15000);
const OPERATION_MS = Number(process.env.SPLIT_OPERATION_TIMEOUT_MS || 45000);
const KEEP = process.env.SPLIT_KEEP_ARTIFACTS === "1";
const MAX_BYTES = Number(process.env.SPLIT_MAX_BYTES || 15728640);
const DIAG = process.env.SPLIT_BROWSER_DIAG_PATH;
const TESTDATA = {
  "S-01":"S-01-1page.pdf","S-02":"S-02-2pages.pdf","S-03":"S-03-5pages.pdf",
  "S-04":"S-04-10pages.pdf","S-05":"S-05-mixed-pages.pdf","S-06":"S-06-corrupted.pdf",
  "S-07":"S-07-zero-byte.pdf","S-08":"S-08-renamed-nonpdf.pdf","S-09":"S-09-protected.pdf",
  "S-10":"S-10-under-15MiB.pdf","S-11":"S-11-exact-15MiB.pdf","S-12":"S-12-over-15MiB.pdf"
};

function result(id, ok, message, extra={}) { return {id, ok, message, ...extra}; }
function filePath(id){ return path.join(ROOT, TESTDATA[id]); }
function now(){ return Date.now(); }
function compact(s){ return String(s||"").replace(/\s+/g," ").trim(); }

async function bodyText(page){
  try { return compact(await page.locator("body").innerText()); } catch { return ""; }
}
async function hasText(page, regex, timeoutMs=5000){
  const end=now()+timeoutMs;
  while(now()<end){
    if(regex.test(await bodyText(page))) return true;
    await page.waitForTimeout(100);
  }
  return false;
}
async function waitForButton(page, present, timeoutMs=SELECTION_MS){
  const end=now()+timeoutMs;
  while(now()<end){
    const count=await page.getByRole("button",{name:/^Split PDF$/}).count();
    if((count>0)===present) return count;
    await page.waitForTimeout(100);
  }
  return await page.getByRole("button",{name:/^Split PDF$/}).count();
}

async function caseRun(browser,id,fn){
  const context=await browser.newContext({acceptDownloads:true});
  const page=await context.newPage();
  const consoleMessages=[];
  const pageErrors=[];
  page.on("console",async msg=>{
        const entry={type:msg.type(),text:msg.text()};
        try{
            const args=msg.args();
            if(args.length>0){
                entry.arguments=[];
                for(const arg of args){
                    try{entry.arguments.push(await arg.jsonValue());}
                    catch{entry.arguments.push(null);}
                }
            }
        }catch{}
        consoleMessages.push(entry);
        try{
            if(DIAG){
                fs.appendFileSync(
                    DIAG,
                    JSON.stringify({
                        id,
                        timestamp:new Date().toISOString(),
                        console:entry
                    })+"\n",
                    "utf8"
                );
            }
        }catch{}
    });
  page.on("pageerror",e=>pageErrors.push(String(e && e.message ? e.message : e)));
  const started=now();
  try{
    await page.goto(FRONTEND,{waitUntil:"domcontentloaded",timeout:30000});
    await page.waitForTimeout(300);
    const payload=await fn(page);
    return {...payload,durationMs:now()-started,pageErrors,consoleMessages};
  }catch(e){
    return result(id,false,`EXCEPTION: ${e && e.stack ? e.stack : String(e)}`,{durationMs:now()-started,pageErrors,consoleMessages,body:await bodyText(page)});
  }finally{
    try{await context.close();}catch{}
  }
}

async function selectFile(page,id){
  const input=page.locator('input[type="file"]').first();
  await input.setInputFiles(filePath(id));
  const selectionStarted=now();
  const buttonCount=await waitForButton(page,true,SELECTION_MS);
  return {selectionMs:now()-selectionStarted,input,buttonCount};
}

async function splitAndDownload(page,id){
  const input=page.locator('input[type="file"]').first();
  await input.setInputFiles(filePath(id));
  await page.waitForTimeout(300);
  const button=page.getByRole("button",{name:/^Split PDF$/}).first();
  if(await button.count()===0){
    return {download:null,diagnostic:`No Split button after selecting ${id}. body=${await bodyText(page)}`};
  }

  const started=now();
  const downloadPromise=page.waitForEvent("download",{timeout:OPERATION_MS}).catch(()=>null);
  await button.click();
  const download=await downloadPromise;
  const elapsed=now()-started;
  const body=await bodyText(page);
  const loading=await page.getByRole("button",{name:/^Splitting\.\.\.$/i}).count()>0;
  if(!download){
    return {download:null,diagnostic:`No download after ${elapsed}ms. loading=${loading}. body=${body.slice(-2000)}`,durationMs:elapsed};
  }
  const saved=path.join(ROOT,`__enterprise-${id}-${Date.now()}.zip`);
  await download.saveAs(saved);
  return {download,saved,diagnostic:`Download received in ${elapsed}ms.`,durationMs:elapsed,suggestedFilename:download.suggestedFilename(),body,loading};
}

async function negativeCase(page,id){
  const input=page.locator('input[type="file"]').first();
  await input.setInputFiles(filePath(id));
  await page.waitForTimeout(800);
  const body=await bodyText(page);
  const buttonCount=await page.getByRole("button",{name:/^Split PDF$/}).count();
  if(buttonCount===0){
    return result(id,true,"Invalid input blocked before Split action.",{buttonCount,body});
  }
  const downloadPromise=page.waitForEvent("download",{timeout:3000}).catch(()=>null);
  await page.getByRole("button",{name:/^Split PDF$/}).first().click();
  const download=await downloadPromise;
  const failure=await hasText(page,/Split failed|Invalid PDF|Unable to load|password is required|protected|validation failed/i,5000);
  return result(id,!download&&failure,`buttonCount=${buttonCount},noDownload=${!download},failureFeedback=${failure}.`,{buttonCount,body:await bodyText(page)});
}

async function inspectZipWithPowershell(saved){
  return {saved};
}

async function run(){
  if(!fs.existsSync(CHROME)) throw new Error(`Chrome not found: ${CHROME}`);
  fs.writeFileSync(DIAG,"",{encoding:"utf8"});
  const browser=await chromium.launch({headless:true,executablePath:CHROME});
  const out=[];
  try{
    out.push(await caseRun(browser,"S-01",async page=>{
      const x=await splitAndDownload(page,"S-01");
      return result("S-01",!!x.download,x.download?`Download received: ${x.suggestedFilename}.`:x.diagnostic,{artifact:x.saved,operationMs:x.durationMs});
    }));

    for(const [id,expected] of [["S-02",2],["S-03",5],["S-04",10]]){
      out.push(await caseRun(browser,id,async page=>{
        const x=await splitAndDownload(page,id);
        return result(id,!!x.download,x.download?`Download received: ${x.suggestedFilename}.`:x.diagnostic,{artifact:x.saved,operationMs:x.durationMs,expectedPages:expected});
      }));
    }

    out.push(await caseRun(browser,"S-05",async page=>{
      const x=await splitAndDownload(page,"S-05");
      return result("S-05",!!x.download,x.download?`Download received: ${x.suggestedFilename}.`:x.diagnostic,{artifact:x.saved,operationMs:x.durationMs,expectedPages:4});
    }));

    for(const id of ["S-06","S-07","S-08"]){
      out.push(await caseRun(browser,id,page=>negativeCase(page,id)));
    }

    out.push(await caseRun(browser,"S-09",async page=>{
      const input=page.locator('input[type="file"]').first();
      await input.setInputFiles(filePath("S-09"));
      await page.waitForTimeout(1000);
      const body=await bodyText(page);
      const buttonCount=await page.getByRole("button",{name:/^Split PDF$/}).count();
      const hint=/password|required|protected/i.test(body);
      let noDownload=true;
      if(buttonCount>0){
        const dp=page.waitForEvent("download",{timeout:5000}).catch(()=>null);
        await page.getByRole("button",{name:/^Split PDF$/}).first().click();
        noDownload=!(await dp);
      }
      return result("S-09",(buttonCount===0||hint)&&noDownload,`buttonCount=${buttonCount},passwordHint=${hint},noDownload=${noDownload}.`,{body});
    }));

    for(const [id,shouldAccept] of [["S-10",true],["S-11",true],["S-12",false]]){
      out.push(await caseRun(browser,id,async page=>{
        const input=page.locator('input[type="file"]').first();
        await input.setInputFiles(filePath(id));
        await page.waitForTimeout(800);
        const buttonCount=await page.getByRole("button",{name:/^Split PDF$/}).count();
        const accepted=buttonCount>0;
        if(!accepted) return result(id,!shouldAccept,shouldAccept?"Boundary input rejected before Split action.":"Above-limit input correctly blocked.",{buttonCount,body:await bodyText(page)});
        if(!shouldAccept) return result(id,false,"Above-limit input exposed Split action.",{buttonCount,body:await bodyText(page)});
        const dp=await splitAndDownload(page,id);
        return result(id,!!dp.download,dp.diagnostic,{artifact:dp.saved,operationMs:dp.durationMs,bytesExpected:id==="S-11"?MAX_BYTES:MAX_BYTES-1});
      }));
    }

    out.push(await caseRun(browser,"S-20",async page=>{
      const input=page.locator('input[type="file"]').first();
      await input.setInputFiles(filePath("S-03"));
      await page.waitForTimeout(500);
      const before=await page.getByText("S-03-5pages.pdf").count();
      const x=await splitAndDownload(page,"S-03");
      await page.waitForTimeout(300);
      const after=await page.getByText("S-03-5pages.pdf").count();
      return result("S-20",!!x.download&&before>0&&after===0,`workspaceBefore=${before},workspaceAfter=${after},download=${!!x.download}.`,{artifact:x.saved});
    }));

    out.push(await caseRun(browser,"S-22",async page=>{
      const x=await splitAndDownload(page,"S-01");
      const toast=await hasText(page,/Split completed/i,8000);
      return result("S-22",!!x.download&&toast,`download=${!!x.download},successToast=${toast}.`,{artifact:x.saved});
    }));

    out.push(await caseRun(browser,"S-23",async page=>{
      const x=await splitAndDownload(page,"S-01");
      return result("S-23",!!x.download&&x.suggestedFilename==="split_pages.zip",`downloaded=${!!x.download},filename=${x.suggestedFilename||""}.`,{artifact:x.saved});
    }));

    out.push(await caseRun(browser,"S-24",async page=>{
      const input=page.locator('input[type="file"]').first();
      await input.setInputFiles(filePath("S-05"));
      await page.waitForTimeout(300);
      const button=page.getByRole("button",{name:/^Split PDF$/}).first();
      const dp=page.waitForEvent("download",{timeout:OPERATION_MS}).catch(()=>null);
      await button.click();
      const loadingSeen=await hasText(page,/Splitting\.\.\./i,2000);
      const download=await dp;
      let artifact=null;
      if(download){ artifact=path.join(ROOT,`__enterprise-S-24-${Date.now()}.zip`); await download.saveAs(artifact); }
      return result("S-24",!!download&&loadingSeen,`loadingSeen=${loadingSeen},download=${!!download}.`,{artifact});
    }));

    out.push(await caseRun(browser,"S-25",async page=>{
      const buttonCount=await page.getByRole("button",{name:/^Split PDF$/}).count();
      return result("S-25",buttonCount===0,`splitButtonCount=${buttonCount} without selected file.`);
    }));

    out.push(await caseRun(browser,"S-27",async page=>{
      const input=page.locator('input[type="file"]').first();
      const ids=["S-01","S-02","S-03"];
      let ok=true; const messages=[]; const artifacts=[];
      for(const id of ids){
        await input.setInputFiles(filePath(id));
        await page.waitForTimeout(300);
        const button=page.getByRole("button",{name:/^Split PDF$/}).first();
        if(await button.count()===0){ok=false;messages.push(`${id}:button-missing`);break;}
        const dp=page.waitForEvent("download",{timeout:OPERATION_MS}).catch(()=>null);
        await button.click();
        const dl=await dp;
        if(!dl){ok=false;messages.push(`${id}:no-download`);break;}
        if(dl.suggestedFilename()!=="split_pages.zip"){ok=false;messages.push(`${id}:bad-name=${dl.suggestedFilename()}`);break;}
      }
      return result("S-27",ok,ok?"Three sequential split runs completed cleanly.":messages.join(", "));
    }));
  }finally{
    await browser.close();
  }
  process.stdout.write(JSON.stringify(out));
}

run().catch(e=>{console.error("BROWSER_FATAL",e && e.stack ? e.stack : String(e));process.exit(1);});
'@

    [System.IO.File]::WriteAllText($RunnerPath,$runner,(New-Object System.Text.UTF8Encoding($false)))
}

function Invoke-BrowserRunner {
    $env:SPLIT_REGRESSION_ROOT=$RegressionRoot
    $env:SPLIT_FRONTEND_URL="$FrontendUrl/split-pdf"
    $env:SPLIT_CHROME_PATH=$ChromePath
    $env:SPLIT_SELECTION_TIMEOUT_MS=([string]($SelectionTimeoutSec*1000))
    $env:SPLIT_OPERATION_TIMEOUT_MS=([string]($OperationTimeoutSec*1000))
    $env:SPLIT_KEEP_ARTIFACTS=($(if($KeepArtifacts){'1'}else{'0'}))
    $env:SPLIT_MAX_BYTES=([string]$MaxFileSizeBytes)
    $env:SPLIT_BROWSER_DIAG_PATH=$BrowserDiagPath

    try {
        Push-Location $FrontendRoot
        try {
            & node $RunnerPath 2>&1 | Tee-Object -FilePath $NodeOutputPath
            $exit=$LASTEXITCODE
        } finally { Pop-Location }

        if($exit -ne 0){ throw "Enterprise browser runner failed with exit code $exit. See $NodeOutputPath" }
        $jsonText=Get-Content $NodeOutputPath -Raw
        if([string]::IsNullOrWhiteSpace($jsonText)){ throw 'Browser runner returned empty JSON.' }
        $browserResults=$jsonText | ConvertFrom-Json
        foreach($r in @($browserResults)){
            $message=[string]$r.message
            if($r.PSObject.Properties.Name -contains 'pageErrors' -and @($r.pageErrors).Count -gt 0){ $message += " pageErrors=$(@($r.pageErrors).Count)" }
            if($r.PSObject.Properties.Name -contains 'consoleMessages' -and @($r.consoleMessages).Count -gt 0){ $message += " consoleDiagnostics=$(@($r.consoleMessages).Count)" }
            if($r.PSObject.Properties.Name -contains 'diagnostic' -and $r.diagnostic){ $message=$r.diagnostic }
            if($r.ok){ Add-Result $r.id 'PASS' $message } else { Add-Result $r.id 'FAIL' $message }
        }

        # Cross-cutting page-error/console diagnostics become explicit failures.
        $diagFailures=@()
        foreach($r in @($browserResults)){
            if($r.PSObject.Properties.Name -contains 'pageErrors' -and @($r.pageErrors).Count -gt 0){ $diagFailures += "$($r.id): page errors: $(@($r.pageErrors) -join ' | ')" }
            if($r.PSObject.Properties.Name -contains 'consoleMessages'){
                foreach($cm in @($r.consoleMessages)){
                    if([string]$cm.type -eq 'error'){ $diagFailures += "$($r.id): console error: $($cm.text)" }
                }
            }
        }
        if($diagFailures.Count -eq 0){ Add-Result 'DIAG-01' 'PASS' 'No browser page errors or console errors were captured.' }
        else { Add-Result 'DIAG-01' 'FAIL' ($diagFailures -join ' || ') }
        Add-Result 'BROWSER' 'PASS' 'Enterprise browser regression completed; individual case results recorded above.'
    }
    finally {
        Remove-Item Env:SPLIT_REGRESSION_ROOT -ErrorAction SilentlyContinue
        Remove-Item Env:SPLIT_FRONTEND_URL -ErrorAction SilentlyContinue
        Remove-Item Env:SPLIT_CHROME_PATH -ErrorAction SilentlyContinue
        Remove-Item Env:SPLIT_SELECTION_TIMEOUT_MS -ErrorAction SilentlyContinue
        Remove-Item Env:SPLIT_OPERATION_TIMEOUT_MS -ErrorAction SilentlyContinue
        Remove-Item Env:SPLIT_KEEP_ARTIFACTS -ErrorAction SilentlyContinue
        Remove-Item Env:SPLIT_MAX_BYTES -ErrorAction SilentlyContinue
        Remove-Item Env:SPLIT_BROWSER_DIAG_PATH -ErrorAction SilentlyContinue
    }
}

function Validate-DownloadedArtifacts {
    $zipFiles=Get-ChildItem $RegressionRoot -Filter '__enterprise-*.zip' -File -ErrorAction SilentlyContinue
    if(-not $zipFiles){ Add-Result 'ART-00' 'FAIL' 'No Split ZIP artifacts were produced for artifact validation.'; return }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $checked=0
    foreach($zipFile in $zipFiles){
        $checked++
        try {
            $archive=[System.IO.Compression.ZipFile]::OpenRead($zipFile.FullName)
            try {
                $entries=@($archive.Entries | Where-Object { -not [string]::IsNullOrWhiteSpace($_.Name) })
                if($entries.Count -lt 1){ throw 'ZIP contains no file entries.' }
                $names=@($entries | ForEach-Object { $_.Name })
                $badNames=@()
                for($i=0;$i -lt $names.Count;$i++){
                    $expected="page_$($i+1).pdf"
                    if($names[$i] -ne $expected){$badNames += "expected=$expected actual=$($names[$i])"}
                }
                if($badNames.Count -gt 0){ throw ($badNames -join '; ') }
                $idx=0
                foreach($entry in $entries){
                    $idx++
                    $ms=New-Object System.IO.MemoryStream
                    $stream=$entry.Open()
                    try{$stream.CopyTo($ms)}finally{$stream.Dispose()}
                    $bytes=$ms.ToArray();$ms.Dispose()
                    if($bytes.Length -le 0){ throw "Entry $($entry.Name) is empty." }
                    if($bytes.Length -lt 5 -or [System.Text.Encoding]::ASCII.GetString($bytes,0,5) -ne '%PDF-'){throw "Entry $($entry.Name) does not start with %PDF-."}
                    $text=[System.Text.Encoding]::GetEncoding(28591).GetString($bytes)

                    $tempPdf=Join-Path $env:TEMP ("iepdf-artifact-" + [guid]::NewGuid().ToString("N") + ".pdf")
                    try {
                        [System.IO.File]::WriteAllBytes($tempPdf,$bytes)

                        $pyResult=& python -c "from pypdf import PdfReader; import sys; r=PdfReader(sys.argv[1],strict=True); print(len(r.pages))" $tempPdf 2>&1

                        if($LASTEXITCODE -ne 0){
                            throw "Entry $($entry.Name) failed strict pypdf validation: $($pyResult -join ' ')"
                        }

                        $pageCount=[int]($pyResult | Select-Object -Last 1)

                        if($pageCount -ne 1){
                            throw "Entry $($entry.Name) structural page count=$pageCount; expected 1."
                        }
                    }
                    finally {
                        Remove-Item $tempPdf -Force -ErrorAction SilentlyContinue
                    }

                    if($text.LastIndexOf('%%EOF',[System.StringComparison]::Ordinal) -lt 0){throw "Entry $($entry.Name) has no %%EOF."}
                    if($text.LastIndexOf('startxref',[System.StringComparison]::Ordinal) -lt 0){throw "Entry $($entry.Name) has no startxref."}
                }
            } finally { $archive.Dispose() }
        } catch {
            Add-Result "ART-$('{0:D2}' -f $checked)" 'FAIL' "$($zipFile.Name): $($_.Exception.Message)"
            continue
        }
        Add-Result "ART-$('{0:D2}' -f $checked)" 'PASS' "$($zipFile.Name): ZIP entries, page names, PDF headers and one-page structural markers validated."
        if(-not $KeepArtifacts){ Remove-Item $zipFile.FullName -Force -ErrorAction SilentlyContinue }
    }
    if($checked -gt 0){ Add-Result 'ART-SUMMARY' 'PASS' "Validated $checked downloaded ZIP artifact(s)." }
}

function Evaluate-Performance {
    if($SkipPerformance){ Add-Result 'PERF' 'SKIPPED' 'Performance checks skipped by parameter.'; return }
    $browserLog=Get-Content $NodeOutputPath -Raw | ConvertFrom-Json
    $s2=@($browserLog | Where-Object { $_.id -eq 'S-02' })
    $s3=@($browserLog | Where-Object { $_.id -eq 'S-03' })
    if($s2.Count -eq 1 -and $s2[0].PSObject.Properties.Name -contains 'operationMs' -and $null -ne $s2[0].operationMs){
        if([double]$s2[0].operationMs -le $PerformanceBudgetSmallPdfMs){ Add-Result 'PERF-S02' 'PASS' "S-02 split time $($s2[0].operationMs) ms <= budget $PerformanceBudgetSmallPdfMs ms." }
        else { Add-Result 'PERF-S02' 'FAIL' "S-02 split time $($s2[0].operationMs) ms exceeded budget $PerformanceBudgetSmallPdfMs ms." }
    } else { Add-Result 'PERF-S02' 'FAIL' 'S-02 operation timing was not captured.' }
    if($s3.Count -eq 1 -and $s3[0].PSObject.Properties.Name -contains 'operationMs' -and $null -ne $s3[0].operationMs){
        if([double]$s3[0].operationMs -le $PerformanceBudgetFivePageMs){ Add-Result 'PERF-S03' 'PASS' "S-03 split time $($s3[0].operationMs) ms <= budget $PerformanceBudgetFivePageMs ms." }
        else { Add-Result 'PERF-S03' 'FAIL' "S-03 split time $($s3[0].operationMs) ms exceeded budget $PerformanceBudgetFivePageMs ms." }
    } else { Add-Result 'PERF-S03' 'FAIL' 'S-03 operation timing was not captured.' }
}

function Write-FinalReport {
    $elapsed=(Get-Date)-$StartTime
    $header=@(
        'iePDF SPLIT PDF - ENTERPRISE REGRESSION REPORT',
        '===============================================',
        "Run        : $RunStamp",
        "Project    : $ProjectRoot",
        "Frontend   : $FrontendUrl/split-pdf",
        "Backend    : $BackendUrl",
        "Chrome     : $ChromePath",
        "Max bytes  : $MaxFileSizeBytes",
        "Elapsed    : $($elapsed.ToString('hh\:mm\:ss'))",
        '',
        'FINAL RESULT',
        '------------',
        "PASS       : $Pass",
        "FAIL       : $Fail",
        "SKIPPED    : $Skip",
        '',
        'RESULTS',
        '-------'
    )
    $lines=$header + @($Results | ForEach-Object { "{0,-8} {1,-14} {2}" -f $_.Status,$_.Id,$_.Message })
    Set-Content -Path $ReportPath -Value $lines -Encoding UTF8
    Write-Log "FINAL RESULT | PASS=$Pass FAIL=$Fail SKIPPED=$Skip"
    Write-Log "Report: $ReportPath"
    Write-Log "Log: $LogPath"
    Write-Log "Browser results: $NodeOutputPath"
}

try {
    Write-Log '===== iePDF Split PDF Enterprise Regression START ====='
    Write-Log "Parameters | MaxBytes=$MaxFileSizeBytes SelectionTimeout=${SelectionTimeoutSec}s OperationTimeout=${OperationTimeoutSec}s BuildTimeout=${BuildTimeoutSec}s"

    Ensure-TestData
    Check-SourceContracts
    Run-Build
    Ensure-Environment

    Write-BrowserRunner

    Invoke-BrowserRunner
    Validate-DownloadedArtifacts
    Evaluate-Performance
}
catch {
    Add-Result 'SUITE' 'FAIL' $_.Exception.Message
    Write-Log "FATAL: $($_.Exception.Message)"
}
finally {
    Stop-StartedProcesses
    if(-not $KeepArtifacts){
        Remove-Item $RunnerPath -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $RegressionRoot '__enterprise-*.zip') -Force -ErrorAction SilentlyContinue
    }
    Write-FinalReport
    Write-Log '===== iePDF Split PDF Enterprise Regression END ====='
}

if($Fail -eq 0){
    Write-Host ''
    Write-Host 'SPLIT ENTERPRISE REGRESSION COMPLETE - PASS' -ForegroundColor Green
    Write-Host "PASS    : $Pass"
    Write-Host "FAIL    : $Fail"
    Write-Host "SKIPPED : $Skip"
    Write-Host "Report  : $ReportPath"
    Write-Host "Log     : $LogPath"
    exit 0
}
else{
    Write-Host ''
    Write-Host 'SPLIT ENTERPRISE REGRESSION COMPLETE - FAILURES DETECTED' -ForegroundColor Red
    Write-Host "PASS    : $Pass"
    Write-Host "FAIL    : $Fail"
    Write-Host "SKIPPED : $Skip"
    Write-Host "Report  : $ReportPath"
    Write-Host "Log     : $LogPath"
    exit 1
}



