param(
    [string]$TargetUrl = "https://www.iepdf.com",
    [int]$Users = 50,
    [int]$WaveSize = 10,
    [int]$WaveDelayMs = 750,
    [int]$UserSlaMs = 30000,
    [int]$GlobalWatchdogMs = 120000
)

$ErrorActionPreference = "Stop"
$root = "C:\IEPDF\frontend"
$reg = Join-Path $root "_regression\merge-pdf"
New-Item -ItemType Directory -Force -Path $reg | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$report = Join-Path $reg "merge-50user-performance-profile-$stamp.txt"
$runner = Join-Path $reg "_merge_50user_profile_runner_$stamp.js"

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (!(Test-Path $chrome)) { throw "Chrome not found: $chrome" }

$playwrightPkg = Join-Path $root "node_modules\playwright"
if (!(Test-Path $playwrightPkg)) { throw "Project-local Playwright not found: $playwrightPkg" }

$fixtureA = Join-Path $reg "A-2-pages.pdf"
$fixtureB = Join-Path $reg "B-1-page.pdf"
if (!(Test-Path $fixtureA)) {
    $fixtureA = Get-ChildItem (Join-Path $root "_regression") -Recurse -Filter "A-2-pages.pdf" -File |
        Select-Object -First 1 -ExpandProperty FullName
}
if (!(Test-Path $fixtureB)) {
    $fixtureB = Get-ChildItem (Join-Path $root "_regression") -Recurse -Filter "B-1-page.pdf" -File |
        Select-Object -First 1 -ExpandProperty FullName
}
if (!$fixtureA -or !$fixtureB) { throw "Real merge fixtures A/B not found." }

function Add-Line([string]$line) {
    Add-Content -LiteralPath $report -Value $line -Encoding UTF8
    Write-Host $line
}

@"
============================================================
iePDF Merge PDF - 50 User Performance Bottleneck Profile
Started: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Target: $TargetUrl
Users: $Users
Wave size: $WaveSize
Wave delay: $WaveDelayMs ms
Per-user HARD SLA: $UserSlaMs ms
Global watchdog: $GlobalWatchdogMs ms
============================================================

OBJECTIVE
Measure where time is spent under concurrent load.
This test does NOT increase the SLA and does NOT modify application source.

Stages:
NAVIGATION
INPUT ATTACHED
FILES SELECTED
A RENDERED
B RENDERED
MERGE ENABLED
MERGE CLICKED
DOWNLOAD EVENT
DOWNLOAD VERIFIED

The report separates:
- page/network startup time
- client-side PDF analysis/render readiness
- merge processing/download time
- true failures vs observation timeouts
- browser/page/request/console errors

NO SOURCE CHANGES
NO GIT OPERATIONS
NO DEPLOYMENT
"@ | Set-Content -LiteralPath $report -Encoding UTF8

$runnerText = @'
const { chromium } = require(process.env.IEPDF_PLAYWRIGHT);

const target = process.env.IEPDF_TARGET;
const fixtureA = process.env.IEPDF_FIXTURE_A;
const fixtureB = process.env.IEPDF_FIXTURE_B;
const users = Number(process.env.IEPDF_USERS || 50);
const waveSize = Number(process.env.IEPDF_WAVE_SIZE || 10);
const waveDelayMs = Number(process.env.IEPDF_WAVE_DELAY || 750);
const sla = Number(process.env.IEPDF_SLA || 30000);
const watchdogMs = Number(process.env.IEPDF_WATCHDOG || 120000);

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function oneUser(browser, id) {
  const t0 = Date.now();
  const m = {};
  const errors = [];
  const requestFailures = [];
  const pageErrors = [];
  const consoleErrors = [];
  let downloadBytes = 0;
  let stage = "create-context";

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  page.on("pageerror", e => pageErrors.push(String(e)));
  page.on("requestfailed", r => requestFailures.push({
    url: r.url(), error: r.failure()?.errorText || "unknown"
  }));
  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const mark = name => { m[name] = Date.now() - t0; };

  try {
    stage = "navigation";
    await page.goto(`${target}/merge-pdf`, {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    mark("navigationMs");

    stage = "input-attached";
    await page.locator('input[type="file"]').first().waitFor({
      state: "attached", timeout: 5000
    });
    mark("inputAttachedMs");

    stage = "files-selected";
    await page.locator('input[type="file"]').first().setInputFiles([fixtureA, fixtureB]);
    mark("filesSelectedMs");

    stage = "rows-rendering";
    await page.getByText("A-2-pages.pdf", { exact: true }).first().waitFor({
      state: "visible", timeout: 10000
    });
    mark("aRenderedMs");

    await page.getByText("B-1-page.pdf", { exact: true }).first().waitFor({
      state: "visible", timeout: 10000
    });
    mark("bRenderedMs");

    stage = "merge-readiness";
    const merge = page.getByRole("button", { name: /Unlock & Merge/i }).first();
    const readyDeadline = Date.now() + 5000;
    while (Date.now() < readyDeadline) {
      if (!(await merge.isDisabled())) break;
      await sleep(50);
    }
    if (await merge.isDisabled()) throw new Error("Merge button did not become enabled.");
    mark("mergeEnabledMs");

    stage = "merge-processing";
    const dlPromise = page.waitForEvent("download", { timeout: Math.max(1000, sla - (Date.now()-t0)) });
    await merge.click();
    mark("mergeClickedMs");

    const dl = await dlPromise;
    mark("downloadEventMs");

    const path = await dl.path();
    if (!path) throw new Error("Download path unavailable.");
    const fs = require("fs");
    downloadBytes = fs.statSync(path).size;
    if (downloadBytes <= 0) throw new Error("Downloaded file is empty.");
    mark("downloadVerifiedMs");

    return {
      id, ok:true, stage:"download-verified", elapsedMs:Date.now()-t0,
      milestones:m, downloadedBytes:downloadBytes,
      pageErrors:pageErrors.length, requestFailures:requestFailures.length,
      consoleErrors:consoleErrors.length, errors:[]
    };
  } catch (e) {
    errors.push(String(e?.message || e));
    return {
      id, ok:false, stage, elapsedMs:Date.now()-t0,
      milestones:m, downloadedBytes:downloadBytes,
      pageErrors:pageErrors.length, requestFailures:requestFailures.length,
      consoleErrors:consoleErrors.length, errors
    };
  } finally {
    await context.close().catch(()=>{});
  }
}

(async()=>{
  const browser = await chromium.launch({
    headless:true,
    executablePath: process.env.IEPDF_CHROME,
    args:["--disable-background-networking","--disable-component-update"]
  });

  const started = Date.now();
  const results = [];
  let active = [];

  for (let start=1; start<=users; start+=waveSize) {
    const end = Math.min(users, start + waveSize - 1);
    const batch = [];
    for (let id=start; id<=end; id++) batch.push(oneUser(browser,id));
    const settled = await Promise.all(batch);
    results.push(...settled);
    if (end < users) await sleep(waveDelayMs);
  }

  await browser.close();

  const byStage = {};
  for (const r of results) {
    byStage[r.stage] = (byStage[r.stage] || 0) + 1;
  }

  const completed = results.filter(r=>r.ok);
  const failed = results.filter(r=>!r.ok);

  const successfulTimes = completed.map(r=>r.elapsedMs).sort((a,b)=>a-b);
  const pct = (p) => successfulTimes.length
    ? successfulTimes[Math.min(successfulTimes.length-1, Math.floor((p/100)*successfulTimes.length))]
    : null;

  const stageStats = {};
  for (const key of [
    "navigationMs","inputAttachedMs","filesSelectedMs",
    "aRenderedMs","bRenderedMs","mergeEnabledMs",
    "mergeClickedMs","downloadEventMs","downloadVerifiedMs"
  ]) {
    const vals = results.map(r=>r.milestones[key]).filter(v=>Number.isFinite(v)).sort((a,b)=>a-b);
    stageStats[key] = vals.length ? {
      n:vals.length, p50:vals[Math.floor(vals.length*.50)],
      p95:vals[Math.min(vals.length-1,Math.floor(vals.length*.95))],
      max:vals[vals.length-1]
    } : null;
  }

  const summary = {
    users, completedByRunner:results.length, passed:completed.length,
    failed:failed.length,
    successRatePercent:Number((completed.length/users*100).toFixed(1)),
    totalElapsedMs:Date.now()-started,
    successP50Ms:pct(50), successP95Ms:pct(95), successMaxMs:successfulTimes.at(-1)||null,
    downloads:completed.filter(r=>r.downloadedBytes>0).length,
    pageErrors:results.reduce((n,r)=>n+r.pageErrors,0),
    requestFailures:results.reduce((n,r)=>n+r.requestFailures,0),
    consoleErrors:results.reduce((n,r)=>n+r.consoleErrors,0),
    stageCounts:byStage,
    stageStats,
    globalWatchdogTriggered:(Date.now()-started)>watchdogMs
  };

  console.log("LOAD_SUMMARY|"+JSON.stringify(summary));
  for (const r of results.sort((a,b)=>a.id-b.id)) console.log("USER|"+JSON.stringify(r));
})();
'@

Set-Content -LiteralPath $runner -Value $runnerText -Encoding UTF8

$env:IEPDF_PLAYWRIGHT = $playwrightPkg
$env:IEPDF_TARGET = $TargetUrl
$env:IEPDF_FIXTURE_A = $fixtureA
$env:IEPDF_FIXTURE_B = $fixtureB
$env:IEPDF_USERS = "$Users"
$env:IEPDF_WAVE_SIZE = "$WaveSize"
$env:IEPDF_WAVE_DELAY = "$WaveDelayMs"
$env:IEPDF_SLA = "$UserSlaMs"
$env:IEPDF_WATCHDOG = "$GlobalWatchdogMs"
$env:IEPDF_CHROME = $chrome

try {
    $output = & node $runner 2>&1
    $output | ForEach-Object {
        $_ | Tee-Object -FilePath $report -Append
    }
} finally {
    Remove-Item Env:IEPDF_PLAYWRIGHT -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_TARGET -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_FIXTURE_A -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_FIXTURE_B -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_USERS -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_WAVE_SIZE -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_WAVE_DELAY -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_SLA -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_WATCHDOG -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_CHROME -ErrorAction SilentlyContinue
}

Add-Line ""
Add-Line "============================================================"
Add-Line "INTERPRETATION GUIDE"
Add-Line "============================================================"
Add-Line "1. NAVIGATION dominates -> investigate initial page/network critical path."
Add-Line "2. FILES_SELECTED -> A/B_RENDERED dominates -> investigate client PDF analysis/rendering."
Add-Line "3. MERGE_CLICKED -> DOWNLOAD_VERIFIED dominates -> investigate merge/download processing."
Add-Line "4. Same stage fails with zero browser/request/console errors -> investigate client CPU/main-thread contention."
Add-Line "5. Browser/request/console errors -> classify as infrastructure/network/application error before source changes."
Add-Line ""
Add-Line "The 30-second SLA was NOT increased."
Add-Line "NO SOURCE CHANGES. NO GIT OPERATIONS. NO DEPLOYMENT."
Add-Line "Report: $report"
Write-Host ""
Write-Host "PERFORMANCE PROFILE COMPLETE"
Write-Host "Report: $report"
