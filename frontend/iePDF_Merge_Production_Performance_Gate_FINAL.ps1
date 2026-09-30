# iePDF Merge PDF - Production Performance Gate
# READ-ONLY: build + local production server + browser measurements.
# No source edits, no git, no deployment, no cache deletion.

$ErrorActionPreference = "Stop"
$Root = "C:\IEPDF\frontend"
$ReportDir = Join-Path $Root "_regression\merge-pdf"
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $ReportDir "merge-performance-gate-$Stamp.txt"

function Log($s) { $s | Tee-Object -FilePath $Report -Append }

Log "============================================================"
Log "iePDF MERGE PDF - PRODUCTION PERFORMANCE GATE"
Log "============================================================"
Log "Started: $(Get-Date -Format o)"
Log "NO SOURCE CHANGES / NO GIT / NO DEPLOYMENT / NO CACHE DELETION"

Set-Location $Root

$ChromeCandidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)
$Chrome = $ChromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Chrome) { throw "Google Chrome executable not found." }
Log "Chrome: $Chrome"

Log ""
Log "=== PRODUCTION BUILD ==="
$sw = [Diagnostics.Stopwatch]::StartNew()
cmd /c "pnpm build" 2>&1 | Tee-Object -FilePath $Report -Append
if ($LASTEXITCODE -ne 0) { throw "Production build failed." }
$sw.Stop()
Log ("BUILD_TIME_MS={0}" -f $sw.ElapsedMilliseconds)

Log ""
Log "=== START LOCAL PRODUCTION SERVER ==="
$ServerLog = Join-Path $ReportDir "merge-perf-server-$Stamp.log"
$Server = Start-Process cmd.exe `
  -ArgumentList "/c pnpm start > `"$ServerLog`" 2>&1" `
  -WorkingDirectory $Root -PassThru -WindowStyle Hidden

try {
    $ready = $false
    for ($i=0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $r = Invoke-WebRequest "http://localhost:3000/merge-pdf" -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200) { $ready = $true; break }
        } catch {}
    }
    if (-not $ready) { throw "Production server did not become ready." }
    Log "SERVER_READY=PASS"

    $Runner = Join-Path $env:TEMP "iepdf-merge-performance-$Stamp.js"

    @'
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  const chrome = process.env.IEPDF_CHROME;
  const root = process.env.IEPDF_ROOT;
  const url = "http://localhost:3000/merge-pdf";

  const browser = await chromium.launch({headless:true, executablePath:chrome});
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  const failed = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push("PAGEERROR: " + e.message));
  page.on("requestfailed", r => failed.push({
    url:r.url(), error:r.failure()?.errorText || ""
  }));

  const results = [];
  function pass(name, value="") {
    results.push({name,ok:true,value});
    console.log("PASS " + name + (value!=="" ? " = " + value : ""));
  }
  function fail(name, value="") {
    results.push({name,ok:false,value});
    console.log("FAIL " + name + (value!=="" ? " = " + value : ""));
  }
  function ms(t) { return Math.round(performance.now()-t); }

  function collect(dir, out=[]) {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
      const p=path.join(dir,e.name);
      if (e.isDirectory()) collect(p,out);
      else if (/\.pdf$/i.test(e.name)) out.push(p);
    }
    return out;
  }

  const roots=[
    path.join(root,"_regression"),
    path.join(root,"public"),
    path.join(root,"test-fixtures")
  ];
  const pdfs=[...new Set(roots.flatMap(x=>collect(x)))];
  if (pdfs.length<3) {
    fail("FIXTURES","Need at least 3 PDFs under _regression/public/test-fixtures");
    await browser.close(); process.exit(2);
  }

  // Deterministic fixture selection by filename when available.
  function pick(patterns, fallbackIndex) {
    for (const re of patterns) {
      const f=pdfs.find(x=>re.test(path.basename(x)));
      if (f) return f;
    }
    return pdfs[fallbackIndex];
  }
  const A=pick([/^A[-_]/i,/A-2-pages/i],0);
  const B=pick([/^B[-_]/i,/B-1-page/i],1);
  const C=pick([/^C[-_]/i,/C-1-page/i],2);

  console.log("FIXTURE_A",A);
  console.log("FIXTURE_B",B);
  console.log("FIXTURE_C",C);

  let t=performance.now();
  await page.goto(url,{waitUntil:"domcontentloaded"});
  await page.locator('input[type="file"]').waitFor();
  pass("PAGE_DOM_READY_MS",ms(t));

  t=performance.now();
  await page.reload({waitUntil:"load"});
  pass("PAGE_LOAD_EVENT_MS",ms(t));

  const input=page.locator('input[type="file"]');
  const merge=page.getByRole("button",{name:/Unlock & Merge/i});
  const handles=page.locator('[aria-label^="Drag PDF "]');

  if (await handles.count()===0) pass("INITIAL_ROWS",0);
  else fail("INITIAL_ROWS",await handles.count());

  if (await merge.isDisabled()) pass("INITIAL_MERGE_DISABLED");
  else fail("INITIAL_MERGE_DISABLED","button enabled");

  // A
  t=performance.now();
  await input.setInputFiles(A);
  await page.waitForFunction(
    n => document.body.innerText.includes(n),
    path.basename(A)
  );
  pass("UPLOAD_A_MS",ms(t));

  // B+C through the same frozen Add PDF Files input.
  t=performance.now();
  await input.setInputFiles([B,C]);
  await page.waitForFunction(
    () => document.querySelectorAll('[aria-label^="Drag PDF "]').length===3
  );
  pass("UPLOAD_BC_MS",ms(t));

  const names=[path.basename(A),path.basename(B),path.basename(C)];
  const body=()=>page.locator("body").innerText();

  const initial=await body();
  const ia=initial.indexOf(names[0]), ib=initial.indexOf(names[1]), ic=initial.indexOf(names[2]);
  if(ia>=0 && ib>=0 && ic>=0 && ia<ib && ib<ic) pass("ORDER_INITIAL_A_B_C");
  else fail("ORDER_INITIAL_A_B_C",`A=${ia},B=${ib},C=${ic}`);

  if(await handles.count()===3) pass("THREE_ROWS",3);
  else fail("THREE_ROWS",await handles.count());

  if(!(await merge.isDisabled())) pass("MERGE_ENABLED_3");
  else fail("MERGE_ENABLED_3");

  // Exact handle mapping.
  for(let i=1;i<=3;i++){
    const h=page.locator(`[aria-label="Drag PDF ${i} to reorder"]`);
    if(await h.count()===1 && await h.getAttribute("draggable")==="true") pass(`HANDLE_${i}_MAPPED`);
    else fail(`HANDLE_${i}_MAPPED`);
  }

  // C -> A, using exact accessible handles.
  t=performance.now();
  await page.locator('[aria-label="Drag PDF 3 to reorder"]')
    .dragTo(page.locator('[aria-label="Drag PDF 1 to reorder"]'));
  await page.waitForTimeout(250);

  let s=await body();
  let pc=s.indexOf(names[2]), pa=s.indexOf(names[0]), pb=s.indexOf(names[1]);
  if(pc>=0 && pa>=0 && pb>=0 && pc<pa && pa<pb) pass("REORDER_C_TO_A",`C=${pc},A=${pa},B=${pb}`);
  else fail("REORDER_C_TO_A",`C=${pc},A=${pa},B=${pb}`);
  pass("REORDER_C_TO_A_MS",ms(t));

  // Measure repeated add/reload cycles. These are browser-side UI measurements,
  // not a claim about all client hardware.
  const repeats=[];
  for(let i=1;i<=3;i++){
    await page.goto(url,{waitUntil:"load"});
    const inp=page.locator('input[type="file"]');
    t=performance.now();
    await inp.setInputFiles([A,B,C]);
    await page.waitForFunction(
      () => document.querySelectorAll('[aria-label^="Drag PDF "]').length===3
    );
    repeats.push(ms(t));
    console.log(`REPEAT_${i}_ABC_MS=${repeats[repeats.length-1]}`);
  }
  pass("REPEAT_3X_UPLOAD_COMPLETED",repeats.join(","));

  const nav=await page.evaluate(()=>{
    const n=performance.getEntriesByType("navigation")[0];
    return {
      domContentLoaded:Math.round(n.domContentLoadedEventEnd),
      loadEvent:Math.round(n.loadEventEnd),
      transferSize:n.transferSize,
      encodedBodySize:n.encodedBodySize,
      resources:performance.getEntriesByType("resource").length
    };
  });
  console.log("BROWSER_NAVIGATION",JSON.stringify(nav));

  const nonWorker=failed.filter(x=>!(/pdf\.worker|min\.mjs/i.test(x.url)));
  const worker=failed.filter(x=>/pdf\.worker|min\.mjs/i.test(x.url));

  if(nonWorker.length===0) pass("NON_WORKER_FAILED_REQUESTS",0);
  else fail("NON_WORKER_FAILED_REQUESTS",JSON.stringify(nonWorker));

  if(worker.length===0) pass("WORKER_FAILED_REQUESTS",0);
  else fail("WORKER_FAILED_REQUESTS",JSON.stringify(worker));

  if(errors.length===0) pass("CONSOLE_PAGE_ERRORS",0);
  else fail("CONSOLE_PAGE_ERRORS",JSON.stringify(errors));

  // Browser heap is available in Chromium in many environments; report only.
  const heap=await page.evaluate(()=>{
    const m=performance.memory;
    return m ? {
      usedJSHeapSize:m.usedJSHeapSize,
      totalJSHeapSize:m.totalJSHeapSize,
      jsHeapSizeLimit:m.jsHeapSizeLimit
    } : null;
  });
  console.log("BROWSER_HEAP",JSON.stringify(heap));

  console.log("FINAL_RESULTS",JSON.stringify(results));
  await browser.close();

  const bad=results.filter(x=>!x.ok);
  process.exit(bad.length?1:0);
})().catch(e=>{
  console.error("FATAL",e.stack||String(e));
  process.exit(3);
});
'@ | Set-Content -Path $Runner -Encoding UTF8

    $env:IEPDF_CHROME=$Chrome
    $env:IEPDF_ROOT=$Root

    Log ""
    Log "=== BROWSER PERFORMANCE TEST ==="
    cmd /c "node `"$Runner`"" 2>&1 | Tee-Object -FilePath $Report -Append
    $BrowserExit=$LASTEXITCODE

    Remove-Item $Runner -Force -ErrorAction SilentlyContinue

    Log ""
    Log "=== FINAL ==="
    if($BrowserExit -eq 0) {
        Log "PRODUCTION PERFORMANCE GATE: PASS"
    } else {
        Log "PRODUCTION PERFORMANCE GATE: FAIL"
        Log "Do NOT deploy until failures are reviewed."
    }
    Log "Report: $Report"
    Log "Server log: $ServerLog"
}
finally {
    if($Server -and -not $Server.HasExited) {
        Stop-Process -Id $Server.Id -Force -ErrorAction SilentlyContinue
    }
    Remove-Item Env:IEPDF_CHROME -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_ROOT -ErrorAction SilentlyContinue
}
