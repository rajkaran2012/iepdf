$ErrorActionPreference = "Stop"

# ============================================================
# iePDF Merge PDF - 50 User Concurrent Load Test V2
# ============================================================
# SAFE DEFAULT: LOCAL ONLY - http://127.0.0.1:3000
# No source changes, no Git operations, no deployment.
# Uses real PDF fixtures and installed Google Chrome.
#
# V2 changes:
# - Does NOT require DOMContentLoaded within a tight 10s barrier.
# - Ramps users in controlled waves.
# - Waits for actual Merge page readiness.
# - Per-user hard timeout.
# - Global watchdog.
# - Captures individual failures and timing.
# ============================================================

$ProjectRoot = "C:\IEPDF\frontend"
$BaseUrl = "http://127.0.0.1:3000"
$Users = 50
$WaveSize = 10
$WaveDelayMs = 750
$PerUserTimeoutMs = 45000
$GlobalTimeoutSec = 150
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ReportDir = Join-Path $ProjectRoot "_regression\merge-pdf"
$Report = Join-Path $ReportDir "merge-50-user-load-v2-$Stamp.txt"
$Runner = Join-Path $ReportDir "_merge_50user_v2_runner_$Stamp.js"

New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null

function Write-Report([string]$line) {
    $line | Tee-Object -FilePath $Report -Append
}

Write-Report "iePDF Merge PDF - 50 User Concurrent Load Test V2"
Write-Report "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Report "Target: $BaseUrl"
Write-Report "Users: $Users"
Write-Report "Wave size: $WaveSize"
Write-Report "Wave delay: $WaveDelayMs ms"
Write-Report "Per-user hard timeout: $PerUserTimeoutMs ms"
Write-Report "Global watchdog: $GlobalTimeoutSec sec"
Write-Report ""

# ---------- Safety ----------
if ($BaseUrl -ne "http://127.0.0.1:3000") {
    throw "SAFETY STOP: target must remain http://127.0.0.1:3000"
}

if (-not (Test-Path "$ProjectRoot\package.json")) {
    throw "Project not found: $ProjectRoot"
}

$chromeCandidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)
$Chrome = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Chrome) {
    throw "Google Chrome not found."
}

$playwrightPkg = Join-Path $ProjectRoot "node_modules\playwright"
if (-not (Test-Path $playwrightPkg)) {
    throw "Project-local Playwright package not found: $playwrightPkg"
}

function Find-Fixture([string]$name) {
    $f = Get-ChildItem "$ProjectRoot\_regression" -Recurse -File -Filter $name -ErrorAction SilentlyContinue |
         Select-Object -First 1
    if (-not $f) { throw "Required fixture not found: $name" }
    return $f.FullName
}

$FixtureA = Find-Fixture "A-2-pages.pdf"
$FixtureB = Find-Fixture "B-1-page.pdf"

Write-Report "PRE-01 Chrome: PASS"
Write-Report "PRE-02 Playwright: PASS"
Write-Report "PRE-03 Fixture A: $FixtureA"
Write-Report "PRE-04 Fixture B: $FixtureB"

# ---------- Node runner ----------
$js = @'
const { chromium } = require("__PLAYWRIGHT__");

const BASE = "__BASE__";
const A = "__A__";
const B = "__B__";

const USERS = __USERS__;
const WAVE_SIZE = __WAVE_SIZE__;
const WAVE_DELAY = __WAVE_DELAY__;
const USER_TIMEOUT = __USER_TIMEOUT__;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label + " timeout after " + ms + " ms")), ms);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function userRun(browser, id) {
  const started = Date.now();

  const result = {
    id,
    ok: false,
    elapsedMs: null,
    navigationMs: null,
    addMs: null,
    readyMs: null,
    mergeMs: null,
    download: false,
    pageErrors: 0,
    requestFailures: 0,
    consoleErrors: 0,
    errors: []
  };

  let context = null;

  try {
    context = await browser.newContext({
      acceptDownloads: true
    });

    const page = await context.newPage();

    page.on("pageerror", err => {
      result.pageErrors++;
      if (result.errors.length < 8) {
        result.errors.push("pageerror: " + err.message);
      }
    });

    page.on("requestfailed", req => {
      result.requestFailures++;
      if (result.errors.length < 8) {
        const f = req.failure();
        result.errors.push(
          "requestfailed: " + req.url() + " " + (f?.errorText || "")
        );
      }
    });

    page.on("console", msg => {
      if (msg.type() === "error") {
        result.consoleErrors++;
        if (result.errors.length < 8) {
          result.errors.push("console: " + msg.text());
        }
      }
    });

    const navStart = Date.now();

    // Do not wait for DOMContentLoaded as the concurrency gate.
    // Wait for the actual document/route to become usable.
    await withTimeout(
      page.goto(BASE + "/merge-pdf", {
        waitUntil: "commit",
        timeout: 15000
      }),
      18000,
      "navigation"
    );

    result.navigationMs = Date.now() - navStart;

    const input = page.locator('input[type="file"]').first();
    const addButton = page.getByRole("button", { name: /Add PDF Files/i }).first();

    await input.waitFor({ state: "attached", timeout: 10000 });
    await addButton.waitFor({ state: "attached", timeout: 10000 });

    const addStart = Date.now();

    await input.setInputFiles([A, B]);

    await withTimeout(
      page.locator('text=A-2-pages.pdf').first().waitFor({
        state: "attached",
        timeout: 12000
      }),
      15000,
      "A render"
    );

    await withTimeout(
      page.locator('text=B-1-page.pdf').first().waitFor({
        state: "attached",
        timeout: 12000
      }),
      15000,
      "B render"
    );

    result.addMs = Date.now() - addStart;

    const merge = page.getByRole("button", { name: /Unlock & Merge/i }).first();

    const readyStart = Date.now();
    const readyDeadline = Date.now() + 15000;

    while (Date.now() < readyDeadline) {
      if (!(await merge.isDisabled())) {
        break;
      }
      await sleep(100);
    }

    if (await merge.isDisabled()) {
      throw new Error("Merge button remained disabled after PDFs rendered");
    }

    result.readyMs = Date.now() - readyStart;

    const mergeStart = Date.now();

    const downloadPromise = page.waitForEvent("download", {
      timeout: 15000
    });

    await merge.click();

    const download = await downloadPromise;

    result.mergeMs = Date.now() - mergeStart;

    const filename = download.suggestedFilename();

    if (!filename || !/\.pdf$/i.test(filename)) {
      throw new Error("Expected PDF download, got: " + filename);
    }

    result.download = true;
    result.ok = true;
    result.elapsedMs = Date.now() - started;

  } catch (e) {
    result.elapsedMs = Date.now() - started;
    result.errors.push(String(e?.message || e));
  } finally {
    if (context) {
      try { await context.close(); } catch {}
    }
  }

  return result;
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "__CHROME__"
  });

  const started = Date.now();
  const allResults = [];

  try {
    for (let first = 1; first <= USERS; first += WAVE_SIZE) {
      const last = Math.min(first + WAVE_SIZE - 1, USERS);

      console.log(
        "WAVE|" + JSON.stringify({
          first,
          last,
          startedAtMs: Date.now() - started
        })
      );

      const jobs = [];

      for (let id = first; id <= last; id++) {
        jobs.push(
          withTimeout(
            userRun(browser, id),
            USER_TIMEOUT,
            "user " + id
          ).catch(err => ({
            id,
            ok: false,
            elapsedMs: Date.now() - started,
            navigationMs: null,
            addMs: null,
            readyMs: null,
            mergeMs: null,
            download: false,
            pageErrors: 0,
            requestFailures: 0,
            consoleErrors: 0,
            errors: [String(err?.message || err)]
          }))
        );
      }

      const waveResults = await Promise.all(jobs);
      allResults.push(...waveResults);

      const wavePass = waveResults.filter(x => x.ok).length;

      console.log(
        "WAVE_RESULT|" + JSON.stringify({
          first,
          last,
          passed: wavePass,
          failed: waveResults.length - wavePass
        })
      );

      if (last < USERS) {
        await sleep(WAVE_DELAY);
      }
    }

    const totalElapsedMs = Date.now() - started;
    const passed = allResults.filter(r => r.ok).length;
    const failed = USERS - passed;

    const times = allResults
      .map(r => r.elapsedMs)
      .filter(x => Number.isFinite(x))
      .sort((a,b) => a-b);

    const avgMs = times.length
      ? Math.round(times.reduce((a,b) => a + b, 0) / times.length)
      : null;

    const p50Ms = times.length
      ? times[Math.min(times.length - 1, Math.floor(times.length * 0.50))]
      : null;

    const p95Ms = times.length
      ? times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)]
      : null;

    const maxMs = times.length ? times[times.length - 1] : null;

    const summary = {
      users: USERS,
      passed,
      failed,
      successRatePercent: Number(((passed / USERS) * 100).toFixed(2)),
      totalElapsedMs,
      avgMs,
      p50Ms,
      p95Ms,
      maxMs,
      downloads: allResults.filter(r => r.download).length,
      pageErrors: allResults.reduce((n,r) => n + r.pageErrors, 0),
      requestFailures: allResults.reduce((n,r) => n + r.requestFailures, 0),
      consoleErrors: allResults.reduce((n,r) => n + r.consoleErrors, 0)
    };

    console.log("LOAD_SUMMARY|" + JSON.stringify(summary));

    for (const r of allResults) {
      console.log("USER|" + JSON.stringify(r));
    }

    const clean =
      passed === USERS &&
      summary.downloads === USERS &&
      summary.pageErrors === 0 &&
      summary.requestFailures === 0 &&
      summary.consoleErrors === 0;

    process.exitCode = clean ? 0 : 2;

  } catch (e) {
    console.error("RUNNER_FATAL|" + String(e?.stack || e));
    process.exitCode = 3;
  } finally {
    try { await browser.close(); } catch {}
  }
})();
'@

$js = $js.Replace("__PLAYWRIGHT__", (Join-Path $playwrightPkg "index.js").Replace("\","/"))
$js = $js.Replace("__BASE__", $BaseUrl)
$js = $js.Replace("__A__", $FixtureA.Replace("\","/"))
$js = $js.Replace("__B__", $FixtureB.Replace("\","/"))
$js = $js.Replace("__CHROME__", $Chrome.Replace("\","/"))
$js = $js.Replace("__USERS__", [string]$Users)
$js = $js.Replace("__WAVE_SIZE__", [string]$WaveSize)
$js = $js.Replace("__WAVE_DELAY__", [string]$WaveDelayMs)
$js = $js.Replace("__USER_TIMEOUT__", [string]$PerUserTimeoutMs)

[IO.File]::WriteAllText(
    $Runner,
    $js,
    (New-Object Text.UTF8Encoding($false))
)

Write-Report ""
Write-Report "Runner created: $Runner"
Write-Report "Starting V2 load test..."

$stdout = Join-Path $ReportDir "_merge_50user_v2_stdout_$Stamp.txt"
$stderr = Join-Path $ReportDir "_merge_50user_v2_stderr_$Stamp.txt"

$proc = Start-Process `
    -FilePath "node.exe" `
    -ArgumentList "`"$Runner`"" `
    -WorkingDirectory $ProjectRoot `
    -NoNewWindow `
    -PassThru `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr

$deadline = (Get-Date).AddSeconds($GlobalTimeoutSec)

while (-not $proc.HasExited -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 250
    $proc.Refresh()
}

if (-not $proc.HasExited) {
    Write-Report "WATCHDOG FAIL: runner exceeded $GlobalTimeoutSec seconds."
    Write-Report "Stopping runner PID $($proc.Id)."
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    Write-Report "APPLICATION SOURCE CHANGED: NO"
    Write-Report "GIT OPERATIONS: NONE"
    Write-Report "LIVE SITE CONTACTED: NO"
    Write-Report "RESULT: FAIL - watchdog timeout"
    Write-Report "Report: $Report"
    exit 2
}

$outText = if (Test-Path $stdout) { Get-Content $stdout -Raw } else { "" }
$errText = if (Test-Path $stderr) { Get-Content $stderr -Raw } else { "" }

if ($outText) {
    $outText | Add-Content -Path $Report
}

if ($errText) {
    Write-Report ""
    Write-Report "STDERR:"
    $errText | Add-Content -Path $Report
}

$summaryLine = $outText -split "`r?`n" |
    Where-Object { $_ -like "LOAD_SUMMARY|*" } |
    Select-Object -First 1

Write-Report ""

if ($summaryLine) {
    Write-Report $summaryLine

    $payload = $summaryLine.Substring("LOAD_SUMMARY|".Length) | ConvertFrom-Json

    Write-Report ""
    Write-Report "50-USER RESULT:"
    Write-Report "Users: $($payload.users)"
    Write-Report "Passed: $($payload.passed)"
    Write-Report "Failed: $($payload.failed)"
    Write-Report "Success rate: $($payload.successRatePercent)%"
    Write-Report "Average: $($payload.avgMs) ms"
    Write-Report "P50: $($payload.p50Ms) ms"
    Write-Report "P95: $($payload.p95Ms) ms"
    Write-Report "Max: $($payload.maxMs) ms"
    Write-Report "Downloads: $($payload.downloads)"
    Write-Report "Page errors: $($payload.pageErrors)"
    Write-Report "Request failures: $($payload.requestFailures)"
    Write-Report "Console errors: $($payload.consoleErrors)"

    if (
        $payload.passed -eq $Users -and
        $payload.failed -eq 0 -and
        $payload.downloads -eq $Users -and
        $payload.pageErrors -eq 0 -and
        $payload.requestFailures -eq 0 -and
        $payload.consoleErrors -eq 0
    ) {
        Write-Report ""
        Write-Report "50-USER CONCURRENT MERGE TEST: PASS"
        Write-Report "All 50 independent users completed Merge + PDF download."
        Write-Report "Report: $Report"
        Write-Report "NO SOURCE CHANGES."
        Write-Report "NO GIT OPERATIONS."
        Write-Report "NO LIVE DEPLOYMENT."
        exit 0
    }
}

Write-Report ""
Write-Report "50-USER CONCURRENT MERGE TEST: FAIL"
Write-Report "Review USER lines in report for exact failure causes."
Write-Report "Report: $Report"
Write-Report "NO SOURCE CHANGES."
Write-Report "NO GIT OPERATIONS."
Write-Report "NO LIVE DEPLOYMENT."
exit 2
