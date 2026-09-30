# iePDF Merge PDF - 50 User Merge-Processing Forensic Gate v5
# TEST HARNESS ONLY
# - No application source changes
# - No UI changes
# - No Git operations
# - No deployment
# - Hard 30-second SLA is NOT increased
#
# Default target: local production server http://127.0.0.1:3000
# Keep `pnpm start` running in another PowerShell window.

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
$report = Join-Path $reportDir "merge-50user-merge-processing-forensic-v5-$stamp.txt"
$nodeScript = Join-Path $root "_regression\merge-pdf\iepdf-merge-forensic-v5-$stamp.js"

function Write-Report([string]$line) {
    $line | Tee-Object -FilePath $report -Append
}

foreach ($p in @($FixtureA,$FixtureB)) {
    if (-not (Test-Path -LiteralPath $p -PathType Leaf)) {
        throw "Fixture missing: $p"
    }
}

Write-Report "============================================================"
Write-Report "iePDF Merge PDF - 50 User Merge-Processing Forensic Gate v4"
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

$mergeUrl = $TargetUrl.TrimEnd("/") + "/merge-pdf"
try {
    $probe = Invoke-WebRequest -Uri $mergeUrl -UseBasicParsing -TimeoutSec 15
    Write-Report "PRECHECK HTTP_STATUS $($probe.StatusCode)"
} catch {
    Write-Report "PRECHECK FAIL: $($_.Exception.Message)"
    throw
}

# Verify Node and Playwright before creating the runner.
$nodeVersion = & node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Node.js unavailable."
}
Write-Report "NODE_VERSION $($nodeVersion -join ' ')"

$playwrightCheck = & node -e "require('playwright'); console.log('PLAYWRIGHT_REQUIRE_PASS')" 2>&1
$pwExit = $LASTEXITCODE
foreach ($line in $playwrightCheck) {
    Write-Report "PLAYWRIGHT_CHECK $line"
}
if ($pwExit -ne 0) {
    throw "Node can start, but require('playwright') failed."
}

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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
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

    page.on("pageerror", () => r.pageErrors++);
    page.on("requestfailed", () => r.requestFailures++);
    page.on("console", m => { if (m.type() === "error") r.consoleErrors++; });

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

    const suggested = download.suggestedFilename();
    if (!suggested || !/\.pdf$/i.test(suggested)) {
      throw new Error("Download filename is not a PDF");
    }

    const tmp = path.join(
      os.tmpdir(),
      `iepdf-forensic-v5-${process.pid}-${id}-${Date.now()}.pdf`
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
    r.error = String(e && e.stack ? e.stack : e);
    r.elapsedMs = now() - t0;
  } finally {
    if (context) await context.close().catch(() => {});
  }

  return r;
}

async function main() {
  let watchdogTriggered = false;
  const started = now();

  const watchdog = setTimeout(() => {
    watchdogTriggered = true;
  }, globalWatchdogMs);

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    });

    const results = [];

    for (let start = 0; start < users && !watchdogTriggered; start += waveSize) {
      const end = Math.min(start + waveSize, users);
      const batch = [];

      for (let id = start + 1; id <= end; id++) {
        batch.push(runUser(browser, id));
      }

      const got = await Promise.all(batch);
      results.push(...got);

      if (end < users && !watchdogTriggered) {
        await sleep(waveDelayMs);
      }
    }

    const elapsed = now() - started;

    function sorted(stage) {
      return results
        .map(x => x.stages[stage])
        .filter(v => Number.isFinite(v))
        .sort((a,b) => a-b);
    }

    function percentile(a, p) {
      if (!a.length) return null;
      const i = (a.length - 1) * p;
      const lo = Math.floor(i);
      const hi = Math.ceil(i);
      if (lo === hi) return a[lo];
      return Math.round(a[lo] + (a[hi] - a[lo]) * (i - lo));
    }

    function stats(stage) {
      const a = sorted(stage);
      return {
        n: a.length,
        p50: percentile(a, .50),
        p95: percentile(a, .95),
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
        p50: percentile(a, .50),
        p95: percentile(a, .95),
        max: a.length ? a[a.length - 1] : null
      };
    }

    const passed = results.filter(x => x.status === "PASS").length;
    const failed = results.length - passed;

    out("LOAD_SUMMARY", {
      users,
      completedByRunner: results.length,
      passed,
      failed,
      successRatePercent: Math.round(passed * 10000 / users) / 100,
      totalElapsedMs: elapsed,
      downloads: results.filter(x => x.download).length,
      pageErrors: results.reduce((n,x) => n + x.pageErrors, 0),
      requestFailures: results.reduce((n,x) => n + x.requestFailures, 0),
      consoleErrors: results.reduce((n,x) => n + x.consoleErrors, 0),
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
        clickToDownloadEventMs: deltaStats("mergeClicked", "downloadEvent"),
        clickToDownloadSavedMs: deltaStats("mergeClicked", "downloadSaved"),
        clickToDownloadVerifiedMs: deltaStats("mergeClicked", "downloadVerified")
      }
    });

    for (const r of results.sort((a,b) => a.user-b.user)) {
      out("USER", r);
    }

    process.exitCode =
      results.length === users &&
      passed > 0 &&
      !watchdogTriggered ? 0 : 1;
  } finally {
    clearTimeout(watchdog);
    if (browser) await browser.close().catch(() => {});
  }
}

main().catch(e => {
  out("FATAL", String(e && e.stack ? e.stack : e));
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
Write-Report "Runner location: $nodeScript"
Write-Report "Playwright resolution is project-local; no package installation is performed."
Write-Report "Hard SLA remains $HardSlaMs ms."
Write-Report "No timeout extension is used."
Write-Report "Node stderr/stdout will be captured without PowerShell NativeCommandError masking."

Push-Location $root
try {
    # Redirect stdout and stderr to files so the complete Node diagnostic is preserved.
    $stdoutFile = Join-Path $env:TEMP "iepdf-forensic-v5-$stamp.stdout.txt"
    $stderrFile = Join-Path $env:TEMP "iepdf-forensic-v5-$stamp.stderr.txt"

    $proc = Start-Process -FilePath "node.exe" `
        -ArgumentList @($nodeScript) `
        -WorkingDirectory $root `
        -NoNewWindow `
        -Wait `
        -PassThru `
        -RedirectStandardOutput $stdoutFile `
        -RedirectStandardError $stderrFile

    if (Test-Path $stdoutFile) {
        Get-Content -LiteralPath $stdoutFile | ForEach-Object {
            Write-Report $_
        }
    }

    if (Test-Path $stderrFile) {
        Get-Content -LiteralPath $stderrFile | ForEach-Object {
            Write-Report "NODE_STDERR|$_"
        }
    }

    $exitCode = $proc.ExitCode

    Remove-Item $stdoutFile,$stderrFile -Force -ErrorAction SilentlyContinue
} finally {
    Pop-Location
    Remove-Item Env:IEPDF_FORENSIC_CONFIG -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $nodeScript -Force -ErrorAction SilentlyContinue
}

Write-Report "============================================================"
Write-Report "FORENSIC GATE RESULT"
switch ($exitCode) {
    0 { Write-Report "PASS - forensic runner completed and at least one user verified a PDF download." }
    1 { Write-Report "FAIL - one or more users failed the hard-SLA/functional gate." }
    default { Write-Report "FAIL - test harness/runtime failure. See NODE_STDERR lines above." }
}
Write-Report "Report: $report"
Write-Report "NO SOURCE CHANGES"
Write-Report "NO UI CHANGES"
Write-Report "NO GIT OPERATIONS"
Write-Report "NO LIVE DEPLOYMENT"
Write-Report "============================================================"

exit $exitCode
