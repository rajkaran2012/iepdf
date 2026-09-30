$ErrorActionPreference = "Stop"

$root = "C:\IEPDF\frontend"
$page = Join-Path $root "app\merge-pdf\page.tsx"
$reg = Join-Path $root "_regression\merge-pdf"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $root "_ui-backups\merge-internal-forensic-v3-$stamp"
$backupPage = Join-Path $backupDir "page.tsx"
$runner = Join-Path $reg "iepdf-merge-internal-forensic-v3-$stamp.cjs"
$report = Join-Path $reg "merge-internal-processing-forensic-v3-$stamp.txt"

Write-Host "============================================================"
Write-Host "iePDF Merge PDF - Internal Merge Processing Forensic Gate V3"
Write-Host "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Target: http://127.0.0.1:3000"
Write-Host "Users: 50 (concurrent)"
Write-Host "Per-user HARD SLA: 30000 ms"
Write-Host "Global watchdog: 120000 ms"
Write-Host "============================================================"

if (-not (Test-Path $page)) { throw "SAFETY STOP: page.tsx not found." }
New-Item -ItemType Directory -Force -Path $backupDir,$reg | Out-Null
Copy-Item $page $backupPage -Force
Write-Host "BACKUP $backupPage"

$original = Get-Content -LiteralPath $page -Raw -Encoding UTF8

# Exact semantic anchors from the current uploaded page.tsx.
$processPattern = '(?s)(const result\s*=\s*await processor\.process\(\{\s*files:\s*workspaceFiles,\s*toolType:\s*"merge",\s*\}\s*\);)'
$blobPattern    = '(?s)(const url\s*=\s*URL\.createObjectURL\(result\.outputFile\);)'
$clickPattern   = '(\blink\.click\(\);)'

if ([regex]::Matches($original,$processPattern).Count -ne 1) {
    throw "SAFETY STOP: expected exactly one processor.process call."
}
if ([regex]::Matches($original,$blobPattern).Count -ne 1) {
    throw "SAFETY STOP: expected exactly one createObjectURL call."
}
if ([regex]::Matches($original,$clickPattern).Count -ne 1) {
    throw "SAFETY STOP: expected exactly one link.click call."
}

$instrumented = $original

$processReplacement = @'
console.info("[IEPDF_FORENSIC_V3] PROCESS_START|" + performance.now().toFixed(3));
$1
console.info("[IEPDF_FORENSIC_V3] PROCESS_END|" + performance.now().toFixed(3));
'@
$instrumented = [regex]::Replace($instrumented,$processPattern,$processReplacement,1)

$blobReplacement = @'
console.info("[IEPDF_FORENSIC_V3] BLOB_START|" + performance.now().toFixed(3));
$1
console.info("[IEPDF_FORENSIC_V3] BLOB_END|" + performance.now().toFixed(3));
'@
$instrumented = [regex]::Replace($instrumented,$blobPattern,$blobReplacement,1)

$clickReplacement = @'
console.info("[IEPDF_FORENSIC_V3] DOWNLOAD_CLICK|" + performance.now().toFixed(3));
$1
'@
$instrumented = [regex]::Replace($instrumented,$clickPattern,$clickReplacement,1)

Set-Content -LiteralPath $page -Value $instrumented -Encoding UTF8
Write-Host "INSTRUMENTATION APPLIED"
Write-Host "NO UI DESIGN CODE CHANGED"

try {
    Write-Host "TYPECHECK START"
    & pnpm exec tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw "TypeScript failed." }
    Write-Host "TYPECHECK PASS"

    Write-Host "BUILD START"
    & pnpm build
    if ($LASTEXITCODE -ne 0) { throw "Production build failed." }
    Write-Host "BUILD PASS"

    $runnerText = @'
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const TARGET = "http://127.0.0.1:3000/merge-pdf";
const USERS = 50;
const SLA = 30000;
const WATCHDOG = 120000;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const root = process.cwd();
const A = path.join(root, "_regression", "merge-pdf", "A-2-pages.pdf");
const B = path.join(root, "_regression", "merge-pdf", "B-1-page.pdf");

const stamp = new Date().toISOString().replace(/[:.]/g,"-");
const report = path.join(root, "_regression", "merge-pdf", `merge-internal-processing-forensic-v3-runtime-${stamp}.txt`);

function now(){ return Date.now(); }
function pct(a,p){
  if(!a.length) return null;
  const i=Math.min(a.length-1,Math.max(0,Math.ceil(a.length*p)-1));
  return Math.round(a[i]);
}
function stats(a){
  const v=a.filter(Number.isFinite).sort((x,y)=>x-y);
  return {n:v.length,p50:pct(v,.50),p95:pct(v,.95),max:v.length?v[v.length-1]:null};
}
function emit(line){
  console.log(line);
  fs.appendFileSync(report,line+"\n");
}
function remaining(start){
  return Math.max(1,SLA-(now()-start));
}
function stage(obj,key,ts){
  obj[key]=ts;
}

async function runUser(browser,id){
  const started=now();
  const forensic = {};
  const result = {id,status:"FAIL",elapsedMs:null,forensic,errors:[],pageErrors:0,requestFailures:0,consoleErrors:0,download:false};

  let context=null, page=null;
  try{
    context=await browser.newContext({acceptDownloads:true});
    page=await context.newPage();

    page.on("pageerror",e=>{ result.pageErrors++; result.errors.push("PAGE:"+String(e)); });
    page.on("requestfailed",r=>{ result.requestFailures++; result.errors.push("REQ:"+String(r.failure()?.errorText||"failed")); });
    page.on("console",m=>{ if(m.type()==="error") result.consoleErrors++; });

    stage(result,"navigationStart",now());
    await page.goto(TARGET,{waitUntil:"domcontentloaded",timeout:remaining(started)});
    stage(result,"navigation",now());

    const input=page.locator('input[type="file"][accept=".pdf"]');
    await input.waitFor({state:"attached",timeout:remaining(started)});
    stage(result,"inputAttached",now());

    const downloadPromise=page.waitForEvent("download",{timeout:remaining(started)}).catch(()=>null);

    await input.setInputFiles([A,B]);
    stage(result,"filesSelected",now());

    await page.getByText("A-2-pages.pdf",{exact:false}).first().waitFor({state:"visible",timeout:remaining(started)});
    await page.getByText("B-1-page.pdf",{exact:false}).first().waitFor({state:"visible",timeout:remaining(started)});
    stage(result,"rowsRendered",now());

    const mergeButton=page.getByRole("button",{name:/Unlock & Merge/i});
    await mergeButton.waitFor({state:"visible",timeout:remaining(started)});
    await page.waitForFunction(
      () => {
        const b=[...document.querySelectorAll("button")].find(x=>/Unlock\s*&\s*Merge/i.test(x.textContent||""));
        return !!b && !b.disabled;
      },
      null,
      {timeout:remaining(started)}
    );
    stage(result,"mergeEnabled",now());

    await mergeButton.click();
    stage(result,"mergeClicked",now());

    const dl=await downloadPromise;
    if(!dl) throw new Error("download event timeout");
    stage(result,"downloadEvent",now());
    result.download=true;

    const savePath=path.join(root,"_regression","merge-pdf",`_forensic-v3-u${id}-${Date.now()}.pdf`);
    await dl.saveAs(savePath);
    stage(result,"downloadSaved",now());

    const size=fs.statSync(savePath).size;
    if(size<=0) throw new Error("downloaded PDF is empty");
    result.downloadBytes=size;
    fs.unlinkSync(savePath);
    stage(result,"downloadVerified",now());

    result.status=(now()-started<=SLA)?"PASS":"FAIL_SLA";
  }catch(e){
    result.errors.push(String(e));
  }finally{
    result.elapsedMs=now()-started;
    if(context) await context.close().catch(()=>{});
  }
  return result;
}

(async()=>{
  fs.writeFileSync(report,"iePDF Merge PDF - Internal Merge Processing Forensic Gate V3\n");
  emit(`Target|${TARGET}`);
  emit(`Users|${USERS}`);
  emit(`HardSLAms|${SLA}`);
  emit(`WatchdogMs|${WATCHDOG}`);
  emit(`Fixtures|${A}|${B}`);

  if(!fs.existsSync(A)||!fs.existsSync(B)) throw new Error("Required real PDF fixtures are missing.");

  const browser=await chromium.launch({headless:true,executablePath:CHROME,args:["--disable-gpu"]});
  const all=Array.from({length:USERS},(_,i)=>runUser(browser,i+1));

  let results;
  try{
    results=await Promise.race([
      Promise.all(all),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error("GLOBAL WATCHDOG TIMEOUT")),WATCHDOG))
    ]);
  }catch(e){
    emit("FATAL|"+String(e));
    await browser.close().catch(()=>{});
    process.exit(2);
  }

  await browser.close();

  const passed=results.filter(x=>x.status==="PASS").length;
  const slaFails=results.filter(x=>x.status==="FAIL_SLA").length;
  const failed=results.length-passed;

  for(const r of results){
    if(Number.isFinite(r.processStart)&&Number.isFinite(r.processEnd))
      r.processorDurationMs=r.processEnd-r.processStart;
    if(Number.isFinite(r.blobStart)&&Number.isFinite(r.blobEnd))
      r.blobDurationMs=r.blobEnd-r.blobStart;
    if(Number.isFinite(r.mergeClicked)&&Number.isFinite(r.processStart))
      r.clickToProcessStartMs=r.processStart-r.mergeClicked;
    if(Number.isFinite(r.processEnd)&&Number.isFinite(r.blobStart))
      r.processToBlobStartMs=r.blobStart-r.processEnd;
    if(Number.isFinite(r.mergeClicked)&&Number.isFinite(r.downloadEvent))
      r.clickToDownloadEventMs=r.downloadEvent-r.mergeClicked;
  }

  const summary={
    users:USERS,
    completed:results.length,
    passed,
    failed,
    slaFails,
    successRatePercent:Number((passed/USERS*100).toFixed(1)),
    totalElapsedMs:stats(results.map(r=>r.elapsedMs)),
    processorDurationMs:stats(results.map(r=>r.processorDurationMs)),
    blobDurationMs:stats(results.map(r=>r.blobDurationMs)),
    clickToProcessStartMs:stats(results.map(r=>r.clickToProcessStartMs)),
    processToBlobStartMs:stats(results.map(r=>r.processToBlobStartMs)),
    clickToDownloadEventMs:stats(results.map(r=>r.clickToDownloadEventMs)),
    downloadVerifiedElapsedMs:stats(results.filter(r=>r.status==="PASS").map(r=>r.elapsedMs)),
    pageErrors:results.reduce((n,r)=>n+r.pageErrors,0),
    requestFailures:results.reduce((n,r)=>n+r.requestFailures,0),
    consoleErrors:results.reduce((n,r)=>n+r.consoleErrors,0)
  };

  emit("LOAD_SUMMARY|"+JSON.stringify(summary));
  for(const r of results){
    emit("USER|"+JSON.stringify(r));
  }

  emit("RESULT|"+(failed===0?"PASS":"FAIL"));
  emit("REPORT|"+report);
})().catch(e=>{
  emit("FATAL|"+String(e));
  process.exit(2);
});
'@

    Set-Content -LiteralPath $runner -Value $runnerText -Encoding UTF8

    Write-Host "RUN START"
    node $runner
    $exitCode=$LASTEXITCODE

    if($exitCode -ne 0){ throw "Forensic runner failed with exit code $exitCode." }

    Write-Host "RUN PASS"
}
finally {
    Copy-Item $backupPage $page -Force
    Write-Host "SOURCE RESTORED FROM BACKUP"
}

Write-Host "============================================================"
Write-Host "FORENSIC V3 COMPLETE"
Write-Host "Report: $report"
Write-Host "Backup: $backupPage"
Write-Host "APPLICATION SOURCE RESTORED"
Write-Host "NO LIVE DEPLOYMENT"
Write-Host "NO GIT OPERATIONS"
Write-Host "NO UI CHANGES"
Write-Host "============================================================"
