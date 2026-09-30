# iePDF Merge PDF - 50 User Merge-Processing Forensic Gate
# Purpose:
#   Measure the post-click merge path under the same 50-user / 30-second SLA.
#   This is a TEST HARNESS ONLY. It does not modify application source, UI, Git, or deployment.
#
# IMPORTANT:
#   Default target is LOCAL production server so the current local Gate-1 code can be tested.
#   Start the production server separately with:
#       cd C:\IEPDF\frontend
#       pnpm start
#   Expected local URL:
#       http://127.0.0.1:3000/merge-pdf
#
#   To test another target explicitly:
#       .\iePDF_Merge_50User_MergeProcessing_Forensic_Gate.ps1 -TargetUrl "https://www.iepdf.com"
#
# Requirements:
#   - Node.js + Playwright package available in the frontend project
#   - Existing real fixtures:
#       A = C:\IEPDF\frontend\_regression\merge-pdf\A-2-pages.pdf
#       B = C:\IEPDF\frontend\_regression\merge-pdf\B-1-page.pdf
#
# Hard limits:
#   Users = 50
#   Wave size = 10
#   Wave delay = 750 ms
#   Per-user hard SLA = 30,000 ms
#   Global watchdog = 120,000 ms
#
# No timeout is increased to hide a failure.

[CmdletBinding()]
param(
    [string]$TargetUrl = "http://127.0.0.1:3000",
    [int]$Users = 50,
    [int]$WaveSize = 10,
    [int]$WaveDelayMs = 750,
    [int]$HardSlaMs = 30000,
    [int]$GlobalWatchdogMs = 120000,
    [string]$FixtureA = "C:\IEPDF\frontend\_regression\merge-pdf\A-2-pages.pdf",
    [string]$FixtureB = "C:\IEPDF\frontend\_regression\merge-pdf\B-1-page.pdf"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = "C:\IEPDF\frontend"
$reportDir = Join-Path $root "_regression\merge-pdf"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$report = Join-Path $reportDir "merge-50user-merge-processing-forensic-$stamp.txt"

function Write-Report([string]$line) {
    $line | Tee-Object -FilePath $report -Append
}

Write-Report "============================================================"
Write-Report "iePDF Merge PDF - 50 User Merge-Processing Forensic Gate"
Write-Report "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Report "Target: $TargetUrl"
Write-Report "Users: $Users"
Write-Report "Wave size: $WaveSize"
Write-Report "Wave delay: $WaveDelayMs ms"
Write-Report "Per-user HARD SLA: $HardSlaMs ms"
Write-Report "Global watchdog: $GlobalWatchdogMs ms"
Write-Report "Fixture A: $FixtureA"
Write-Report "Fixture B: $FixtureB"
Write-Report "============================================================"

foreach ($p in @($FixtureA,$FixtureB)) {
    if (-not (Test-Path -LiteralPath $p -PathType Leaf)) {
        throw "Fixture missing: $p"
    }
}

# Verify that the target responds before starting the load.
$mergeUrl = $TargetUrl.TrimEnd("/") + "/merge-pdf"
try {
    $probe = Invoke-WebRequest -Uri $mergeUrl -UseBasicParsing -TimeoutSec 15
    Write-Report "PRECHECK HTTP_STATUS $($probe.StatusCode)"
} catch {
    Write-Report "PRECHECK FAIL: $($_.Exception.Message)"
    throw
}

$nodeScript = Join-Path $env:TEMP "iepdf-merge-forensic-$stamp.js"

$node = @'
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const cfg = JSON.parse(process.env.IEPDF_FORENSIC_CONFIG);

const target = cfg.target.replace(/\/+$/, "") + "/merge-pdf";
const users = cfg.users;
const waveSize = cfg.waveSize;
const waveDelayMs = cfg.waveDelayMs;
const hardSlaMs = cfg.hardSlaMs;
const globalWatchdogMs = cfg.globalWatchdogMs;
const fixtureA = cfg.fixtureA;
const fixtureB = cfg.fixtureB;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function now() {
  return Number(process.hrtime.bigint() / 1000000n);
}

function q(obj) {
  return JSON.stringify(obj);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const started = now();
  const results = [];
  let stop = false;

  const watchdog = setTimeout(() => {
    stop = true;
  }, globalWatchdogMs);

  async function oneUser(id) {
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

    const ctx = await browser.newContext({ acceptDownloads: true });
    const page = await ctx.newPage();

    const t0 = now();
    const mark = name => {
      r.stages[name] = now() - t0;
    };

    page.on("pageerror", () => r.pageErrors++);
    page.on("requestfailed", () => r.requestFailures++);
    page.on("console", m => {
      if (m.type() === "error") r.consoleErrors++;
    });

    try {
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: Math.min(10000, hardSlaMs) });
      mark("navigation");

      if (now() - t0 > hardSlaMs) throw new Error("HARD_SLA exceeded after navigation");

      const input = page.locator('input[type="file"][accept*="pdf"]').first();
      await input.waitFor({ state: "attached", timeout: 5000 });
      mark("inputAttached");

      if (now() - t0 > hardSlaMs) throw new Error("HARD_SLA exceeded after inputAttached");

      await input.setInputFiles([fixtureA, fixtureB]);
      mark("filesSelected");

      // The app analyzes PDFs locally. Wait for both rows.
      await page.getByText(path.basename(fixtureA), { exact: true }).waitFor({ state: "visible", timeout: 10000 });
      await page.getByText(path.basename(fixtureB), { exact: true }).waitFor({ state: "visible", timeout: 10000 });
      mark("rowsRendered");

      if (now() - t0 > hardSlaMs) throw new Error("HARD_SLA exceeded after rowsRendered");

      const mergeButton = page.getByRole("button", { name: /Unlock & Merge/i }).first();
      await mergeButton.waitFor({ state: "visible", timeout: 5000 });
      await page.waitForFunction(() => {
        const b = [...document.querySelectorAll("button")]
          .find(x => /Unlock\s*&\s*Merge/i.test(x.textContent || ""));
        return !!b && !b.disabled;
      }, null, { timeout: 5000 });
      mark("mergeEnabled");

      if (now() - t0 > hardSlaMs) throw new Error("HARD_SLA exceeded before merge click");

      let downloadPromise = page.waitForEvent("download", { timeout: hardSlaMs });

      mark("mergeClicked");
      await mergeButton.click();

      // This isolates the post-click interval:
      // mergeClicked -> downloadEvent
      let download;
      try {
        download = await downloadPromise;
      } catch (e) {
        throw new Error("No download event within remaining hard SLA");
      }

      mark("downloadEvent");
      r.download = true;

      const suggested = download.suggestedFilename();
      if (!suggested || !/\.pdf$/i.test(suggested)) {
        throw new Error("Download filename is not a PDF");
      }

      // Save to a per-user temporary file, then verify non-zero PDF bytes.
      const tmp = path.join(
        require("os").tmpdir(),
        `iepdf-forensic-${process.pid}-${id}-${Date.now()}.pdf`
      );
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
      r.status = "PASS";
      r.elapsedMs = now() - t0;
      try { fs.unlinkSync(tmp); } catch {}
    } catch (e) {
      r.error = String(e && e.message ? e.message : e);
      r.elapsedMs = now() - t0;
    } finally {
      await ctx.close().catch(() => {});
    }

    return r;
  }

  for (let start = 0; start < users && !stop; start += waveSize) {
    const end = Math.min(start + waveSize, users);
    const batch = [];
    for (let id = start + 1; id <= end; id++) {
      batch.push(oneUser(id));
    }
    const got = await Promise.all(batch);
    results.push(...got);

    if (end < users && !stop) await sleep(waveDelayMs);
  }

  clearTimeout(watchdog);
  await browser.close();

  const elapsed = now() - started;

  function vals(stage) {
    return results
      .map(x => x.stages[stage])
      .filter(v => Number.isFinite(v))
      .sort((a,b) => a-b);
  }

  function pct(a, p) {
    if (!a.length) return null;
    const i = (a.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    if (lo === hi) return a[lo];
    return Math.round(a[lo] + (a[hi] - a[lo]) * (i - lo));
  }

  function stats(stage) {
    const a = vals(stage);
    return {
      n: a.length,
      p50: pct(a, .50),
      p95: pct(a, .95),
      max: a.length ? a[a.length - 1] : null
    };
  }

  function deltaStats(from, to) {
    const a = results
      .filter(x => Number.isFinite(x.stages[from]) && Number.isFinite(x.stages[to]))
      .map(x => x.stages[to] - x.stages[from])
      .sort((a,b) => a-b);
    return {
      n: a.length,
      p50: pct(a, .50),
      p95: pct(a, .95),
      max: a.length ? a[a.length - 1] : null
    };
  }

  const pass = results.filter(x => x.status === "PASS").length;
  const fail = results.length - pass;
  const downloads = results.filter(x => x.download).length;
  const pageErrors = results.reduce((n,x) => n + x.pageErrors, 0);
  const requestFailures = results.reduce((n,x) => n + x.requestFailures, 0);
  const consoleErrors = results.reduce((n,x) => n + x.consoleErrors, 0);

  console.log("LOAD_SUMMARY|" + q({
    users,
    completedByRunner: results.length,
    passed: pass,
    failed: fail,
    successRatePercent: Math.round(pass * 10000 / users) / 100,
    totalElapsedMs: elapsed,
    downloads,
    pageErrors,
    requestFailures,
    consoleErrors,
    globalWatchdogTriggered: stop,
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
      clickToDownloadEventMs: deltaStats("mergeClicked", "downloadEvent"),
      clickToDownloadSavedMs: deltaStats("mergeClicked", "downloadSaved"),
      clickToDownloadVerifiedMs: deltaStats("mergeClicked", "downloadVerified")
    }
  }));

  for (const r of results.sort((a,b) => a.user-b.user)) {
    console.log("USER|" + q(r));
  }

  process.exitCode = (results.length === users && pass > 0 && !stop) ? 0 : 1;
}

main().catch(e => {
  console.error("FATAL|" + (e && e.stack ? e.stack : e));
  process.exitCode = 2;
});
'@

Set-Content -LiteralPath $nodeScript -Value $node -Encoding UTF8

$config = @{
    target = $TargetUrl
    users = $Users
    waveSize = $WaveSize
    waveDelayMs = $WaveDelayMs
    hardSlaMs = $HardSlaMs
    globalWatchdogMs = $GlobalWatchdogMs
    fixtureA = $FixtureA
    fixtureB = $FixtureB
} | ConvertTo-Json -Compress

$env:IEPDF_FORENSIC_CONFIG = $config

Write-Report "RUN START"
Write-Report "The 30-second per-user SLA is a hard limit."
Write-Report "No timeout extension is used."

Push-Location $root
try {
    $output = & node $nodeScript 2>&1
    $exitCode = $LASTEXITCODE
    foreach ($line in $output) {
        Write-Report ([string]$line)
    }
} finally {
    Pop-Location
    Remove-Item Env:IEPDF_FORENSIC_CONFIG -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $nodeScript -Force -ErrorAction SilentlyContinue
}

Write-Report "============================================================"
Write-Report "FORENSIC GATE RESULT"
if ($exitCode -eq 0) {
    Write-Report "PASS - runner completed without global watchdog failure and at least one user verified a PDF download."
} elseif ($exitCode -eq 1) {
    Write-Report "FAIL - one or more users failed the hard-SLA/functional gate."
} else {
    Write-Report "FAIL - test harness/runtime failure."
}
Write-Report "Report: $report"
Write-Report "NO SOURCE CHANGES"
Write-Report "NO UI CHANGES"
Write-Report "NO GIT OPERATIONS"
Write-Report "NO LIVE DEPLOYMENT"
Write-Report "============================================================"

exit $exitCode
