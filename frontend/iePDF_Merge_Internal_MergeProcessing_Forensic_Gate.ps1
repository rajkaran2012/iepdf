# iePDF Merge PDF - Internal Merge Processing Forensic Gate
# LOCAL TEST HARNESS + TEMPORARY TEST INSTRUMENTATION
#
# Purpose:
#   Identify where the post-click merge latency is spent:
#   Merge click -> processor/validation -> PDF merge -> Blob -> download.
#
# Safety:
#   - LOCAL ONLY by default: http://127.0.0.1:3000
#   - No deployment
#   - No Git operations
#   - No UI changes
#   - Timestamped backups
#   - Application source is restored automatically in finally
#   - 50 users / 10-user waves / 750ms / HARD 30s SLA
#
# IMPORTANT:
#   This script temporarily inserts console timing markers into the local
#   Merge PDF page only. It does not change production/live files.
#
# Prerequisite:
#   pnpm start must already be running on http://127.0.0.1:3000

[CmdletBinding()]
param(
    [string]$TargetUrl = "http://127.0.0.1:3000",
    [int]$Users = 50,
    [int]$WaveSize = 10,
    [int]$WaveDelayMs = 750,
    [int]$HardSlaMs = 30000,
    [int]$GlobalWatchdogMs = 120000
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = "C:\IEPDF\frontend"
$page = Join-Path $root "app\merge-pdf\page.tsx"
$backupRoot = Join-Path $root "_ui-backups"
$reportDir = Join-Path $root "_regression\merge-pdf"
New-Item -ItemType Directory -Force -Path $backupRoot,$reportDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $backupRoot "merge-internal-forensic-$stamp"
$backupPage = Join-Path $backupDir "page.tsx"
$report = Join-Path $reportDir "merge-internal-processing-forensic-$stamp.txt"
$runner = Join-Path $reportDir "iepdf-merge-internal-forensic-$stamp.js"

function W([string]$s) { $s | Tee-Object -FilePath $report -Append }

W "============================================================"
W "iePDF Merge PDF - Internal Merge Processing Forensic Gate"
W "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
W "Target: $TargetUrl"
W "Users: $Users"
W "Wave size: $WaveSize"
W "Wave delay: $WaveDelayMs ms"
W "Per-user HARD SLA: $HardSlaMs ms"
W "Global watchdog: $GlobalWatchdogMs ms"
W "============================================================"

if (-not (Test-Path $page -PathType Leaf)) {
    throw "Merge page source not found: $page"
}

# Refuse to run against a remote target. This gate is deliberately local.
if ($TargetUrl -notmatch '^https?://127\.0\.0\.1:3000/?$' -and
    $TargetUrl -notmatch '^http://localhost:3000/?$') {
    throw "SAFETY STOP: internal instrumentation gate only permits local port 3000."
}

# Make a timestamped source backup.
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Copy-Item -LiteralPath $page -Destination $backupPage -Force
W "BACKUP $backupPage"

$original = Get-Content -LiteralPath $page -Raw

# Instrument exact current merge handler call sites. Fail closed if the source differs.
$processAnchor = 'const result =\s*await processor\.process\(\{\s*files:\s*workspaceFiles,\s*toolType:\s*"merge",\s*\}\s*\);'
$objectAnchor  = 'const url =\s*URL\.createObjectURL\(result\.outputFile\);'
$clickAnchor   = 'link\.click\(\);'

if ([regex]::Matches($original,$processAnchor).Count -ne 1) {
    throw "SAFETY STOP: expected exactly one processor.process call."
}
if ([regex]::Matches($original,$objectAnchor).Count -ne 1) {
    throw "SAFETY STOP: expected exactly one createObjectURL call."
}
if ([regex]::Matches($original,$clickAnchor).Count -ne 1) {
    throw "SAFETY STOP: expected exactly one link.click call."
}

$instrumented = [regex]::Replace(
    $original,
    $processAnchor,
    'console.info("[IEPDF_FORENSIC] PROCESS_START|" + performance.now().toFixed(3)); $& console.info("[IEPDF_FORENSIC] PROCESS_END|" + performance.now().toFixed(3));',
    1
)
$instrumented = [regex]::Replace(
    $instrumented,
    $objectAnchor,
    'console.info("[IEPDF_FORENSIC] BLOB_START|" + performance.now().toFixed(3)); $& console.info("[IEPDF_FORENSIC] BLOB_END|" + performance.now().toFixed(3));',
    1
)
$instrumented = [regex]::Replace(
    $instrumented,
    $clickAnchor,
    'console.info("[IEPDF_FORENSIC] DOWNLOAD_CLICK|" + performance.now().toFixed(3)); $&',
    1
)

Set-Content -LiteralPath $page -Value $instrumented -Encoding UTF8
W "INSTRUMENTATION APPLIED - exact current source anchors"
W "PROCESS_START/END, BLOB_START/END, DOWNLOAD_CLICK markers added"
W "NO UI CODE CHANGED"

try {
    Push-Location $root

    # Typecheck before browser test.
    W "TYPECHECK START"
    $tcOut = & pnpm exec tsc --noEmit 2>&1
    $tcExit = $LASTEXITCODE
    foreach ($x in $tcOut) { W "TSC|$x" }
    if ($tcExit -ne 0) { throw "TypeScript failed after temporary instrumentation." }
    W "TYPECHECK PASS"

    # Build local production output.
    W "BUILD START"
    $buildOut = & pnpm build 2>&1
    $buildExit = $LASTEXITCODE
    foreach ($x in $buildOut) { W "BUILD|$x" }
    if ($buildExit -ne 0) { throw "Production build failed after temporary instrumentation." }
    W "BUILD PASS"

    $node = @'
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const os = require("os");

const cfg = JSON.parse(process.env.IEPDF_FORENSIC_CONFIG);
const target = cfg.target.replace(/\/+$/, "") + "/merge-pdf";
const users = cfg.users;
const waveSize = cfg.waveSize;
const waveDelayMs = cfg.waveDelayMs;
const hardSlaMs = cfg.hardSlaMs;
const globalWatchdogMs = cfg.globalWatchdogMs;
const fixtureA = cfg.fixtureA;
const fixtureB = cfg.fixtureB;
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => Number(process.hrtime.bigint() / 1000000n);
const out = (tag, value) => process.stdout.write(tag + "|" + JSON.stringify(value) + "\n");

async function runUser(browser, id) {
  const r = {
    user: id,
    status: "FAILED",
    error: null,
    pageErrors: 0,
    requestFailures: 0,
    consoleErrors: 0,
    download: false,
    stages: {},
    elapsedMs: null
  };

  const t0 = now();
  const mark = name => { r.stages[name] = now() - t0; };
  const remaining = () => Math.max(1, hardSlaMs - (now() - t0));

  let context;
  try {
    context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    const forensic = {};
    page.on("console", m => {
      if (m.type() === "error") r.consoleErrors++;
      const txt = m.text();
      const prefix = "[IEPDF_FORENSIC] ";
      if (txt.startsWith(prefix)) {
        const key = txt.substring(prefix.length);
        forensic[key] = now() - t0;
      }
    });
    page.on("pageerror", () => r.pageErrors++);
    page.on("requestfailed", () => r.requestFailures++);

    await page.goto(target, {
      waitUntil: "domcontentloaded",
      timeout: Math.min(10000, remaining())
    });
    mark("navigation");

    const input = page.locator('input[type="file"][accept*="pdf"]').first();
    await input.waitFor({ state: "attached", timeout: Math.min(5000, remaining()) });
    mark("inputAttached");

    await input.setInputFiles([fixtureA, fixtureB]);
    mark("filesSelected");

    await page.getByText(path.basename(fixtureA), { exact: true })
      .waitFor({ state: "visible", timeout: Math.min(10000, remaining()) });
    await page.getByText(path.basename(fixtureB), { exact: true })
      .waitFor({ state: "visible", timeout: Math.min(10000, remaining()) });
    mark("rowsRendered");

    const mergeButton = page.getByRole("button", { name: /Unlock & Merge/i }).first();
    await mergeButton.waitFor({ state: "visible", timeout: Math.min(5000, remaining()) });
    await page.waitForFunction(() => {
      const b = [...document.querySelectorAll("button")]
        .find(x => /Unlock\s*&\s*Merge/i.test(x.textContent || ""));
      return !!b && !b.disabled;
    }, null, { timeout: Math.min(5000, remaining()) });
    mark("mergeEnabled");

    if (remaining() <= 1) throw new Error("HARD_SLA reached before merge click");

    const downloadPromise = page.waitForEvent("download", {
      timeout: remaining()
    });

    mark("mergeClicked");
    await mergeButton.click();

    const download = await downloadPromise;
    mark("downloadEvent");
    r.download = true;

    const tmp = path.join(os.tmpdir(), `iepdf-internal-${process.pid}-${id}-${Date.now()}.pdf`);
    await download.saveAs(tmp);
    mark("downloadSaved");

    const stat = fs.statSync(tmp);
    if (stat.size <= 0) throw new Error("Downloaded PDF is empty");

    const fd = fs.openSync(tmp, "r");
    const buf = Buffer.alloc(Math.min(8, stat.size));
    fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    if (buf.toString("ascii").indexOf("%PDF-") !== 0) {
      throw new Error("Downloaded file does not begin with %PDF-");
    }

    mark("downloadVerified");
    r.forensic = forensic;
    r.status = "PASS";
    r.elapsedMs = now() - t0;
    try { fs.unlinkSync(tmp); } catch {}
  } catch (e) {
    r.forensic = forensic;
    r.error = String(e && e.stack ? e.stack : e);
    r.elapsedMs = now() - t0;
  } finally {
    if (context) await context.close().catch(() => {});
  }

  r.forensic = forensic;
  return r;
}

async function main() {
  let watchdogTriggered = false;
  const started = now();
  const watchdog = setTimeout(() => { watchdogTriggered = true; }, globalWatchdogMs);

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: chromePath
    });

    const results = [];

    for (let start = 0; start < users && !watchdogTriggered; start += waveSize) {
      const end = Math.min(start + waveSize, users);
      const batch = [];
      for (let id = start + 1; id <= end; id++) {
        batch.push(runUser(browser, id));
      }
      results.push(...await Promise.all(batch));
      if (end < users && !watchdogTriggered) await sleep(waveDelayMs);
    }

    const elapsed = now() - started;

    function arr(stage) {
      return results.map(x => x.stages[stage]).filter(Number.isFinite).sort((a,b) => a-b);
    }
    function pct(a,p) {
      if (!a.length) return null;
      const i=(a.length-1)*p, lo=Math.floor(i), hi=Math.ceil(i);
      return lo===hi ? a[lo] : Math.round(a[lo]+(a[hi]-a[lo])*(i-lo));
    }
    function stats(stage) {
      const a=arr(stage);
      return {n:a.length,p50:pct(a,.5),p95:pct(a,.95),max:a.length?a[a.length-1]:null};
    }
    function delta(from,to) {
      const a=results.filter(x=>Number.isFinite(x.stages[from])&&Number.isFinite(x.stages[to]))
        .map(x=>x.stages[to]-x.stages[from]).sort((a,b)=>a-b);
      return {n:a.length,p50:pct(a,.5),p95:pct(a,.95),max:a.length?a[a.length-1]:null};
    }
    function forensicStats(key) {
      const a=results.map(x=>x.forensic?.[key]?.runnerMs).filter(Number.isFinite).sort((a,b)=>a-b);
      return {n:a.length,p50:pct(a,.5),p95:pct(a,.95),max:a.length?a[a.length-1]:null};
    }

    const passed=results.filter(x=>x.status==="PASS").length;

    for (const r of results) {
      const ps=r.forensic?.PROCESS_START?.runnerMs;
      const pe=r.forensic?.PROCESS_END?.runnerMs;
      const bs=r.forensic?.BLOB_START?.runnerMs;
      const be=r.forensic?.BLOB_END?.runnerMs;
      const dc=r.forensic?.DOWNLOAD_CLICK?.runnerMs;
      if (Number.isFinite(ps) && Number.isFinite(pe)) r.processorDurationMs=pe-ps;
      if (Number.isFinite(bs) && Number.isFinite(be)) r.blobDurationMs=be-bs;
      if (Number.isFinite(dc) && Number.isFinite(ps)) r.clickToProcessStartMs=ps-dc;
      if (Number.isFinite(pe) && Number.isFinite(bs)) r.processToBlobStartMs=bs-pe;
    }

    function derivedStats(prop) {
      const a=results.map(x=>x[prop]).filter(Number.isFinite).sort((a,b)=>a-b);
      return {n:a.length,p50:pct(a,.5),p95:pct(a,.95),max:a.length?a[a.length-1]:null};
    }

    out("LOAD_SUMMARY", {
      users,
      completedByRunner: results.length,
      passed,
      failed: results.length-passed,
      successRatePercent: Math.round(passed*10000/users)/100,
      totalElapsedMs: elapsed,
      downloads: results.filter(x=>x.download).length,
      pageErrors: results.reduce((n,x)=>n+x.pageErrors,0),
      requestFailures: results.reduce((n,x)=>n+x.requestFailures,0),
      consoleErrors: results.reduce((n,x)=>n+x.consoleErrors,0),
      globalWatchdogTriggered: watchdogTriggered,
      stageStats: {
        navigationMs: stats("navigation"),
        inputAttachedMs: stats("inputAttached"),
        filesSelectedMs: stats("filesSelected"),
        rowsRenderedMs: stats("rowsRendered"),
        mergeEnabledMs: stats("mergeEnabled"),
        mergeClickedMs: stats("mergeClicked"),
        downloadEventMs: stats("downloadEvent"),
        downloadSavedMs: stats("downloadSaved"),
        downloadVerifiedMs: stats("downloadVerified")
      },
      postClickIntervals: {
        clickToDownloadEventMs: delta("mergeClicked","downloadEvent"),
        clickToDownloadSavedMs: delta("mergeClicked","downloadSaved"),
        clickToDownloadVerifiedMs: delta("mergeClicked","downloadVerified")
      },
      derivedIntervalsMs: {
        processorDuration: derivedStats("processorDurationMs"),
        blobDuration: derivedStats("blobDurationMs"),
        clickToProcessStart: derivedStats("clickToProcessStartMs"),
        processToBlobStart: derivedStats("processToBlobStartMs")
      },
      forensicMarkersMs: {
        processStart: forensicStats("PROCESS_START"),
        processEnd: forensicStats("PROCESS_END"),
        blobStart: forensicStats("BLOB_START"),
        blobEnd: forensicStats("BLOB_END"),
        downloadClick: forensicStats("DOWNLOAD_CLICK")
      }
    });

    for (const r of results.sort((a,b)=>a.user-b.user)) out("USER",r);

    process.exitCode = results.length===users && passed>0 && !watchdogTriggered ? 0 : 1;
  } finally {
    clearTimeout(watchdog);
    if (browser) await browser.close().catch(()=>{});
  }
}

main().catch(e => {
  out("FATAL", String(e && e.stack ? e.stack : e));
  process.exitCode=2;
});
'@

    Set-Content -LiteralPath $runner -Value $node -Encoding UTF8

    $env:IEPDF_FORENSIC_CONFIG = @{
        target = $TargetUrl
        users = $Users
        waveSize = $WaveSize
        waveDelayMs = $WaveDelayMs
        hardSlaMs = $HardSlaMs
        globalWatchdogMs = $GlobalWatchdogMs
        fixtureA = "C:\IEPDF\frontend\_regression\merge-pdf\A-2-pages.pdf"
        fixtureB = "C:\IEPDF\frontend\_regression\merge-pdf\B-1-page.pdf"
    } | ConvertTo-Json -Compress

    $stdout = Join-Path $env:TEMP "iepdf-internal-forensic-$stamp.stdout.txt"
    $stderr = Join-Path $env:TEMP "iepdf-internal-forensic-$stamp.stderr.txt"

    W "RUN START"
    $proc = Start-Process -FilePath "node.exe" `
        -ArgumentList @($runner) `
        -WorkingDirectory $root `
        -NoNewWindow -Wait -PassThru `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr

    if (Test-Path $stdout) { Get-Content $stdout | ForEach-Object { W $_ } }
    if (Test-Path $stderr) { Get-Content $stderr | ForEach-Object { W "NODE_STDERR|$_" } }

    $exitCode = $proc.ExitCode
    Remove-Item $stdout,$stderr -Force -ErrorAction SilentlyContinue

} finally {
    Pop-Location
    Remove-Item Env:IEPDF_FORENSIC_CONFIG -ErrorAction SilentlyContinue

    # Always restore original application source.
    if (Test-Path $backupPage -PathType Leaf) {
        Copy-Item -LiteralPath $backupPage -Destination $page -Force
        W "SOURCE RESTORED FROM BACKUP"
    }

    if (Test-Path $runner) {
        Remove-Item -LiteralPath $runner -Force -ErrorAction SilentlyContinue
    }
}

W "============================================================"
W "FORENSIC GATE RESULT"
if ($exitCode -eq 0) {
    W "PASS - runner completed with verified download(s)."
} elseif ($exitCode -eq 1) {
    W "FAIL - one or more users failed the hard-SLA/functional gate."
} else {
    W "FAIL - test harness/runtime failure."
}
W "Report: $report"
W "Backup: $backupPage"
W "APPLICATION SOURCE RESTORED"
W "NO LIVE DEPLOYMENT"
W "NO GIT OPERATIONS"
W "NO UI CHANGES"
W "============================================================"

exit $exitCode
