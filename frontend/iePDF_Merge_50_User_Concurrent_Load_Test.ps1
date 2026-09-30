$ErrorActionPreference = "Stop"

# iePDF Merge PDF - 50 User Concurrent Load Test
# SAFE DEFAULT: targets LOCAL 127.0.0.1:3000 only.
# No deployment, Git mutation, or production-domain traffic.
# Requires: project-local Playwright package and installed Google Chrome.

$ProjectRoot = "C:\IEPDF\frontend"
$BaseUrl = "http://127.0.0.1:3000"
$Users = 50
$PerUserTimeoutMs = 30000
$GlobalTimeoutSec = 90
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ReportDir = Join-Path $ProjectRoot "_regression\merge-pdf"
$Report = Join-Path $ReportDir "merge-50-user-load-$Stamp.txt"
$Runner = Join-Path $ReportDir "_merge_50user_runner_$Stamp.js"

New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null

function Write-Report([string]$line) {
    $line | Tee-Object -FilePath $Report -Append
}

Write-Report "iePDF Merge PDF - 50 User Concurrent Load Test"
Write-Report "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Report "Target: $BaseUrl"
Write-Report "Users: $Users"
Write-Report "Per-user timeout: $PerUserTimeoutMs ms"
Write-Report "Global watchdog: $GlobalTimeoutSec sec"
Write-Report ""

# ---------- Preconditions ----------
if (-not (Test-Path "$ProjectRoot\package.json")) { throw "Project not found: $ProjectRoot" }

$chromeCandidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)
$Chrome = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Chrome) { throw "Google Chrome not found in standard installation paths." }

$playwrightPkg = Join-Path $ProjectRoot "node_modules\playwright"
if (-not (Test-Path $playwrightPkg)) { throw "Project-local Playwright package not found: $playwrightPkg" }

$fixtureNames = @("A-2-pages.pdf", "B-1-page.pdf")
$fixtures = foreach ($name in $fixtureNames) {
    $found = Get-ChildItem "$ProjectRoot\_regression" -Recurse -File -Filter $name -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $found) { throw "Required fixture not found: $name" }
    $found.FullName
}

Write-Report "PRE-01 Chrome: PASS"
Write-Report "PRE-02 Playwright package: PASS"
Write-Report "PRE-03 Fixture A: $($fixtures[0])"
Write-Report "PRE-04 Fixture B: $($fixtures[1])"

# Refuse accidental production target.
if ($BaseUrl -notmatch "^http://127\.0\.0\.1:3000$") {
    throw "Safety stop: load test target is not local 127.0.0.1:3000."
}

$js = @'
const { chromium } = require("__PLAYWRIGHT__");

const BASE = "__BASE__";
const A = "__A__";
const B = "__B__";
const USERS = 50;
const PER_USER_TIMEOUT = 30000;
const GLOBAL_TIMEOUT = 90000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function userRun(browser, id) {
  const started = Date.now();
  const result = {
    id,
    ok: false,
    elapsedMs: null,
    errors: [],
    requestsFailed: 0,
    pageErrors: 0,
    consoleErrors: 0,
    download: false
  };

  let context;
  try {
    context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    page.on("requestfailed", req => {
      result.requestsFailed++;
      const f = req.failure();
      if (result.errors.length < 5) result.errors.push("requestfailed: " + req.url() + " " + (f?.errorText || ""));
    });
    page.on("pageerror", err => {
      result.pageErrors++;
      if (result.errors.length < 5) result.errors.push("pageerror: " + err.message);
    });
    page.on("console", msg => {
      if (msg.type() === "error") {
        result.consoleErrors++;
        if (result.errors.length < 5) result.errors.push("console: " + msg.text());
      }
    });

    await page.goto(BASE + "/merge-pdf", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });

    const input = page.locator('input[type="file"]').first();
    await input.waitFor({ state: "attached", timeout: 5000 });

    // One user gets one independent browser context.
    await input.setInputFiles([A, B]);

    await page.locator('text=A-2-pages.pdf').first().waitFor({
      state: "attached",
      timeout: 10000
    });
    await page.locator('text=B-1-page.pdf').first().waitFor({
      state: "attached",
      timeout: 10000
    });

    const merge = page.getByRole("button", { name: /Unlock & Merge/i }).first();

    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (!(await merge.isDisabled())) break;
      await sleep(100);
    }

    if (await merge.isDisabled()) {
      throw new Error("Merge button remained disabled");
    }

    const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
    await merge.click();
    const download = await downloadPromise;

    const suggested = download.suggestedFilename();
    if (!suggested || !/\.pdf$/i.test(suggested)) {
      throw new Error("Merge download was not a PDF: " + suggested);
    }

    result.download = true;
    result.ok = true;
    result.elapsedMs = Date.now() - started;
  } catch (e) {
    result.errors.push(String(e?.message || e));
    result.elapsedMs = Date.now() - started;
  } finally {
    if (context) {
      try { await context.close(); } catch {}
    }
  }
  return result;
}

(async () => {
  const hardStop = setTimeout(() => {
    console.error("GLOBAL_WATCHDOG_TIMEOUT");
    process.exit(124);
  }, GLOBAL_TIMEOUT);

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: "__CHROME__"
    });

    const started = Date.now();
    const jobs = [];
    for (let i = 1; i <= USERS; i++) {
      jobs.push(userRun(browser, i));
    }

    const results = await Promise.all(jobs);
    const elapsed = Date.now() - started;

    const passed = results.filter(r => r.ok).length;
    const failed = results.length - passed;
    const times = results.filter(r => r.elapsedMs != null).map(r => r.elapsedMs).sort((a,b)=>a-b);
    const p95 = times.length ? times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)] : null;
    const avg = times.length ? Math.round(times.reduce((a,b)=>a+b,0) / times.length) : null;
    const max = times.length ? Math.max(...times) : null;

    console.log("LOAD_SUMMARY|" + JSON.stringify({
      users: USERS, passed, failed, totalElapsedMs: elapsed,
      avgMs: avg, p95Ms: p95, maxMs: max,
      pageErrors: results.reduce((n,r)=>n+r.pageErrors,0),
      requestFailures: results.reduce((n,r)=>n+r.requestsFailed,0),
      consoleErrors: results.reduce((n,r)=>n+r.consoleErrors,0),
      downloads: results.filter(r=>r.download).length
    }));

    for (const r of results) {
      console.log("USER|" + JSON.stringify(r));
    }

    if (passed !== USERS || results.some(r => r.pageErrors || r.requestsFailed || r.consoleErrors)) {
      process.exitCode = 2;
    } else {
      process.exitCode = 0;
    }
  } catch (e) {
    console.error("RUNNER_FATAL|" + String(e?.stack || e));
    process.exitCode = 3;
  } finally {
    clearTimeout(hardStop);
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
})();
'@

$js = $js.Replace("__PLAYWRIGHT__", (Join-Path $playwrightPkg "index.js").Replace("\","/"))
$js = $js.Replace("__BASE__", $BaseUrl)
$js = $js.Replace("__A__", $fixtures[0].Replace("\","/"))
$js = $js.Replace("__B__", $fixtures[1].Replace("\","/"))
$js = $js.Replace("__CHROME__", $Chrome.Replace("\","/"))

[IO.File]::WriteAllText($Runner, $js, (New-Object Text.UTF8Encoding($false)))

Write-Report ""
Write-Report "Starting 50 independent browser contexts..."
Write-Report "Hard watchdog is $GlobalTimeoutSec seconds."

$stdout = Join-Path $ReportDir "_merge_50user_stdout_$Stamp.txt"
$stderr = Join-Path $ReportDir "_merge_50user_stderr_$Stamp.txt"

$proc = Start-Process -FilePath "node.exe" `
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
    Write-Report "WATCHDOG: runner exceeded $GlobalTimeoutSec seconds. Stopping runner PID $($proc.Id)."
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    Write-Report "RESULT: FAIL - runner watchdog timeout"
    Write-Report "Runner PID stopped: $($proc.Id)"
    Write-Report "No application source was modified."
    Write-Report "No Git operations performed."
    Write-Report "No production/live URL was contacted."
    exit 2
}

$outText = if (Test-Path $stdout) { Get-Content $stdout -Raw } else { "" }
$errText = if (Test-Path $stderr) { Get-Content $stderr -Raw } else { "" }

if ($outText) { $outText | Add-Content -Path $Report }
if ($errText) {
    Write-Report ""
    Write-Report "STDERR:"
    $errText | Add-Content -Path $Report
}

$summaryLine = ($outText -split "`r?`n" | Where-Object { $_ -like "LOAD_SUMMARY|*" } | Select-Object -First 1)

if ($summaryLine) {
    Write-Report ""
    Write-Report $summaryLine
    $payload = $summaryLine.Substring("LOAD_SUMMARY|".Length) | ConvertFrom-Json

    if ($payload.passed -eq $Users -and
        $payload.failed -eq 0 -and
        $payload.pageErrors -eq 0 -and
        $payload.requestFailures -eq 0 -and
        $payload.consoleErrors -eq 0 -and
        $payload.downloads -eq $Users) {
        Write-Report "50-USER LOAD TEST: PASS"
        Write-Report "All 50 independent browser sessions completed Merge + PDF download successfully."
        Write-Report "Report: $Report"
        exit 0
    }
}

Write-Report "50-USER LOAD TEST: FAIL"
Write-Report "Report: $Report"
exit 2
