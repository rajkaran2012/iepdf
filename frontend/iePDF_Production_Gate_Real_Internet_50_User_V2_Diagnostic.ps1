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
$report = Join-Path $reg "merge-real-internet-50user-v2-diagnostic-$stamp.txt"
$runner = Join-Path $reg "_merge_real_internet_v2_diagnostic_runner_$stamp.js"

function Log([string]$s) {
  Add-Content -LiteralPath $report -Value $s -Encoding UTF8
  Write-Host $s
}

Log "============================================================"
Log "iePDF Merge PDF - Production Gate: Real Internet 50 User V2 Diagnostic"
Log "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Log "Target: $TargetUrl"
Log "Users: $Users"
Log "Wave size: $WaveSize"
Log "Wave delay: $WaveDelayMs ms"
Log "Per-user HARD SLA: $UserSlaMs ms"
Log "Global watchdog: $GlobalWatchdogMs ms"
Log ""
Log "PURPOSE:"
Log "Determine whether slow users actually complete within the existing 30s SLA."
Log "This version does NOT fail merely because the Merge button is not ready after 5s."
Log "It records each milestone and continues observing the same user until the 30s SLA."
Log ""
Log "NO SOURCE CHANGES. NO GIT. NO DEPLOYMENT."
Log ""

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { throw "Chrome not found: $chrome" }
Log "PRE-01 Chrome: PASS - $chrome"

$pwPkg = Join-Path $root "node_modules\playwright"
if (-not (Test-Path $pwPkg)) { throw "Project-local Playwright package not found: $pwPkg" }
Log "PRE-02 Playwright: PASS - project-local package"

$aCandidates = @(
  (Join-Path $reg "A-2-pages.pdf")
)
$bCandidates = @(
  (Join-Path $reg "B-1-page.pdf")
)

$fixtureA = $aCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$fixtureB = $bCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $fixtureA) { throw "Fixture A not found." }
if (-not $fixtureB) { throw "Fixture B not found." }

Log "PRE-03 Fixture A: PASS - $fixtureA"
Log "PRE-04 Fixture B: PASS - $fixtureB"
Log ""

$js = @'
const { chromium } = require("C:\\IEPDF\\frontend\\node_modules\\playwright");
const fs = require("fs");

const TARGET = process.argv[2];
const CHROME = process.argv[3];
const FIXTURE_A = process.argv[4];
const FIXTURE_B = process.argv[5];
const USERS = Number(process.argv[6]);
const WAVE_SIZE = Number(process.argv[7]);
const WAVE_DELAY = Number(process.argv[8]);
const SLA = Number(process.argv[9]);
const GLOBAL_WATCHDOG = Number(process.argv[10]);

const now = () => Date.now();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function visible(locator) {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}

async function countVisible(locator) {
  try {
    const n = await locator.count();
    let c = 0;
    for (let i = 0; i < n; i++) {
      if (await locator.nth(i).isVisible().catch(() => false)) c++;
    }
    return c;
  } catch {
    return 0;
  }
}

async function userRun(id) {
  const started = now();
  const milestones = {};
  const pageErrors = [];
  const requestFailures = [];
  const consoleErrors = [];
  let downloadedBytes = 0;
  let stage = "launch";
  let error = null;

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: [
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--no-first-run"
    ]
  });

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  page.on("pageerror", e => pageErrors.push(String(e)));
  page.on("requestfailed", r => requestFailures.push({
    url: r.url(),
    error: r.failure()?.errorText || "unknown"
  }));
  page.on("console", m => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  const mark = name => {
    milestones[name] = now() - started;
  };

  const remaining = () => Math.max(0, SLA - (now() - started));

  try {
    stage = "navigation";
    await page.goto(TARGET + "/merge-pdf", {
      waitUntil: "domcontentloaded",
      timeout: Math.min(10000, remaining())
    });
    mark("navigationMs");

    if (remaining() <= 0) throw new Error("30s SLA exhausted during navigation");

    const input = page.locator('input[type="file"][accept=".pdf"]').first();
    await input.waitFor({ state: "attached", timeout: Math.min(5000, remaining()) });
    mark("inputAttachedMs");

    stage = "files-selected";
    await input.setInputFiles([FIXTURE_A, FIXTURE_B]);
    mark("filesSelectedMs");

    const aText = page.getByText("A-2-pages.pdf", { exact: true }).first();
    const bText = page.getByText("B-1-page.pdf", { exact: true }).first();

    stage = "rows-rendering";
    await aText.waitFor({ state: "visible", timeout: Math.min(10000, remaining()) });
    mark("aRenderedMs");
    await bText.waitFor({ state: "visible", timeout: Math.min(10000, remaining()) });
    mark("bRenderedMs");

    const merge = page.getByRole("button", { name: /Unlock & Merge/i }).first();

    stage = "ready";
    const readyDeadline = now() + remaining();
    while (now() < readyDeadline) {
      if (await visible(merge) && !(await merge.isDisabled().catch(() => true))) {
        mark("mergeEnabledMs");
        break;
      }
      await sleep(100);
    }

    if (!milestones.mergeEnabledMs) {
      throw new Error("Merge button did not become enabled within 30s SLA");
    }

    stage = "merge";
    const downloadPromise = page.waitForEvent("download", {
      timeout: Math.min(10000, remaining())
    });
    await merge.click();
    mark("mergeClickedMs");

    const download = await downloadPromise;
    mark("downloadEventMs");

    const tempPath = await download.path();
    if (!tempPath) throw new Error("Download event occurred but no download path was available");

    const stat = fs.statSync(tempPath);
    downloadedBytes = stat.size;
    if (downloadedBytes <= 0) throw new Error("Downloaded PDF is empty");

    mark("downloadVerifiedMs");

    return {
      id,
      ok: true,
      elapsedMs: now() - started,
      stage: "download-verified",
      milestones,
      downloadedBytes,
      pageErrors: pageErrors.length,
      requestFailures: requestFailures.length,
      consoleErrors: consoleErrors.length,
      error: null
    };
  } catch (e) {
    error = String(e?.message || e);
    return {
      id,
      ok: false,
      elapsedMs: now() - started,
      stage,
      milestones,
      downloadedBytes,
      pageErrors: pageErrors.length,
      requestFailures: requestFailures.length,
      consoleErrors: consoleErrors.length,
      error
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

(async () => {
  const globalStart = now();
  const results = [];
  let aborted = false;

  for (let base = 1; base <= USERS; base += WAVE_SIZE) {
    if (now() - globalStart >= GLOBAL_WATCHDOG) {
      aborted = true;
      break;
    }

    const ids = [];
    for (let i = base; i < Math.min(base + WAVE_SIZE, USERS + 1); i++) ids.push(i);

    const wave = await Promise.all(ids.map(id => userRun(id)));
    results.push(...wave);

    if (base + WAVE_SIZE <= USERS) await sleep(WAVE_DELAY);
  }

  const passed = results.filter(x => x.ok).length;
  const failed = results.length - passed;
  const times = results.map(x => x.elapsedMs).sort((a,b) => a-b);
  const pct = results.length ? (passed / results.length) * 100 : 0;
  const percentile = p => times.length ? times[Math.min(times.length - 1, Math.ceil(times.length * p) - 1)] : null;

  const summary = {
    users: USERS,
    completedByRunner: results.length,
    passed,
    failed,
    successRatePercent: Number(pct.toFixed(2)),
    totalElapsedMs: now() - globalStart,
    p50Ms: percentile(0.50),
    p95Ms: percentile(0.95),
    maxMs: times.length ? times[times.length - 1] : null,
    pageErrors: results.reduce((s,x)=>s+x.pageErrors,0),
    requestFailures: results.reduce((s,x)=>s+x.requestFailures,0),
    consoleErrors: results.reduce((s,x)=>s+x.consoleErrors,0),
    downloads: results.filter(x=>x.downloadedBytes>0).length,
    globalWatchdogTriggered: aborted
  };

  console.log("LOAD_SUMMARY|" + JSON.stringify(summary));

  for (const r of results.sort((a,b)=>a.id-b.id)) {
    console.log("USER|" + JSON.stringify(r));
  }

  console.log("DIAGNOSTIC_END");
})().catch(e => {
  console.error("RUNNER_FATAL|" + String(e?.stack || e));
  process.exit(2);
});
'@

Set-Content -LiteralPath $runner -Value $js -Encoding UTF8
Log "Runner: $runner"
Log "Starting V2 diagnostic..."
Log ""

$node = (Get-Command node.exe -ErrorAction Stop).Source
$args = @(
  $runner, $TargetUrl, $chrome, $fixtureA, $fixtureB,
  $Users, $WaveSize, $WaveDelayMs, $UserSlaMs, $GlobalWatchdogMs
)

$raw = & $node @args 2>&1
$exitCode = $LASTEXITCODE
$raw | ForEach-Object { Log ([string]$_) }

if ($exitCode -ne 0) {
  Log ""
  Log "V2 DIAGNOSTIC RUNNER: FAILED TO COMPLETE (runner exit code $exitCode)"
  Log "This is a runner failure, not an application verdict."
  Log "Report: $report"
  exit $exitCode
}

Log ""
Log "============================================================"
Log "INTERPRETATION"
Log "============================================================"
Log "Use USER lines to distinguish:"
Log "1) normal slow completion: milestones continue and download is verified before 30s;"
Log "2) application hang/slowdown: milestones stop at a specific stage until the 30s SLA;"
Log "3) test failure: browser/request/console errors or runner infrastructure errors."
Log ""
Log "The 30-second user SLA was NOT increased."
Log "NO SOURCE CHANGES. NO GIT OPERATIONS. NO DEPLOYMENT."
Log "Report: $report"
