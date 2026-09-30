param(
    [Parameter(Mandatory=$true)]
    [string]$TargetUrl,

    [int]$Users = 50,
    [int]$WaveSize = 10,
    [int]$WaveDelayMs = 750,
    [int]$PerUserTimeoutMs = 30000,
    [int]$GlobalTimeoutSec = 120
)

$ErrorActionPreference = "Stop"

# Production Gate - Real Internet 50 User Merge Test V1
# IMPORTANT:
# - This script NEVER deploys code.
# - This script NEVER changes source/Git.
# - TargetUrl MUST be a non-local HTTP(S) URL.
# - Browser-side PDF processing is executed by the simulated browser contexts.
# - For a true distributed 50-device test, run equivalent workers from multiple
#   external/cloud regions. This V1 validates the public Internet path from one
#   external test machine.

$root = "C:\IEPDF\frontend"
$reg = Join-Path $root "_regression\merge-pdf"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$report = Join-Path $reg "merge-real-internet-50user-v1-$stamp.txt"
$runner = Join-Path $reg "_merge_real_internet_v1_runner_$stamp.js"

New-Item -ItemType Directory -Force -Path $reg | Out-Null

if ($TargetUrl -match "^(http://127\.0\.0\.1|http://localhost|http://0\.0\.0\.0)") {
    throw "REFUSED: TargetUrl is local. V1 requires a public HTTP(S) URL."
}
if ($TargetUrl -notmatch "^https://") {
    throw "REFUSED: Use the deployed HTTPS URL for the real Internet gate."
}

$chromeCandidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)
$chrome = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw "Google Chrome was not found in the standard installation paths." }

$fixtureA = Join-Path $reg "A-2-pages.pdf"
$fixtureB = Join-Path $reg "B-1-page.pdf"
if (-not (Test-Path $fixtureA)) { throw "Missing fixture: $fixtureA" }
if (-not (Test-Path $fixtureB)) { throw "Missing fixture: $fixtureB" }

$pw = Join-Path $root "node_modules\playwright"
if (-not (Test-Path $pw)) {
    throw "Project-local Playwright package not found: $pw"
}

$fixtureAJs = ($fixtureA -replace "\\","/")
$fixtureBJs = ($fixtureB -replace "\\","/")
$chromeJs = ($chrome -replace "\\","/")
$targetJs = $TargetUrl.Replace("\","/")

$js = @"
const { chromium } = require(${pw.Replace("\","/")});
const fs = require('fs');

const TARGET = ${targetJs@'};
"@
# Rebuild JS safely using JSON encoding.
function J([string]$s) { return ($s | ConvertTo-Json -Compress) }

$js = @"
const { chromium } = require($(J ($pw -replace '\\','/')));
const fs = require('fs');

const TARGET = $(J $TargetUrl);
const CHROME = $(J $chromeJs);
const FIXTURE_A = $(J $fixtureAJs);
const FIXTURE_B = $(J $fixtureBJs);
const USERS = $Users;
const WAVE_SIZE = $WaveSize;
const WAVE_DELAY_MS = $WaveDelayMs;
const USER_TIMEOUT_MS = $PerUserTimeoutMs;
const GLOBAL_TIMEOUT_MS = $($GlobalTimeoutSec * 1000);

const results = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function oneUser(i, browser) {
  const started = Date.now();
  let context, page;
  const r = {
    user: i,
    passed: false,
    elapsedMs: 0,
    stage: "start",
    pageErrors: 0,
    requestFailures: 0,
    consoleErrors: 0,
    downloadedBytes: 0,
    error: null
  };

  const timer = setTimeout(() => {}, USER_TIMEOUT_MS);

  try {
    context = await browser.newContext({ acceptDownloads: true });
    page = await context.newPage();

    page.on('pageerror', () => r.pageErrors++);
    page.on('requestfailed', () => r.requestFailures++);
    page.on('console', m => { if (m.type() === 'error') r.consoleErrors++; });

    const start = Date.now();
    await page.goto(TARGET + (TARGET.endsWith('/') ? 'merge-pdf' : '/merge-pdf'),
      { waitUntil: 'domcontentloaded', timeout: 10000 });
    r.stage = "loaded";

    const input = page.locator('input[type="file"]');
    await input.waitFor({ state: 'attached', timeout: 5000 });

    // Use one input event with both files. This is the same user workflow as
    // selecting multiple PDFs, avoiding repeated input replacement semantics.
    await input.setInputFiles([FIXTURE_A, FIXTURE_B]);
    r.stage = "files-selected";

    const mergeButton = page.getByRole('button', { name: /Unlock & Merge/i });
    await mergeButton.waitFor({ state: 'attached', timeout: 5000 });

    await page.waitForFunction(() => {
      const buttons = [...document.querySelectorAll('button')];
      const b = buttons.find(x => /Unlock & Merge/i.test(x.textContent || ''));
      return !!b && !b.disabled;
    }, { timeout: 12000 });
    r.stage = "ready";

    const before = await page.locator('body').innerText();
    if (!/A-2-pages\.pdf/.test(before) || !/B-1-page\.pdf/.test(before)) {
      throw new Error("Both PDFs were not rendered in the workspace.");
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await mergeButton.click();
    r.stage = "merge-clicked";

    const download = await downloadPromise;
    const path = await download.path();
    if (!path) throw new Error("Download path unavailable.");

    const stat = fs.statSync(path);
    r.downloadedBytes = stat.size;
    if (stat.size < 100) throw new Error("Downloaded PDF is unexpectedly small.");

    r.stage = "download-verified";
    r.passed = true;
  } catch (e) {
    r.error = String(e && e.message ? e.message : e);
  } finally {
    clearTimeout(timer);
    r.elapsedMs = Date.now() - started;
    try { if (context) await context.close(); } catch {}
  }

  return r;
}

(async () => {
  const globalStart = Date.now();
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--disable-dev-shm-usage']
  });

  try {
    for (let base = 1; base <= USERS; base += WAVE_SIZE) {
      const wave = [];
      for (let i = base; i < Math.min(base + WAVE_SIZE, USERS + 1); i++) {
        wave.push(oneUser(i, browser));
      }
      const out = await Promise.all(wave);
      results.push(...out);
      if (base + WAVE_SIZE <= USERS) await sleep(WAVE_DELAY_MS);
      if (Date.now() - globalStart > GLOBAL_TIMEOUT_MS) {
        throw new Error("GLOBAL_WATCHDOG_TIMEOUT");
      }
    }
  } finally {
    await browser.close();
  }

  const passed = results.filter(x => x.passed);
  const failed = results.filter(x => !x.passed);
  const times = results.map(x => x.elapsedMs).sort((a,b) => a-b);
  const p = q => times.length ? times[Math.min(times.length-1, Math.floor(times.length*q))] : 0;

  const summary = {
    users: USERS,
    passed: passed.length,
    failed: failed.length,
    successRatePercent: Number((passed.length / USERS * 100).toFixed(2)),
    totalElapsedMs: Date.now() - globalStart,
    p50Ms: p(.50),
    p95Ms: p(.95),
    p99Ms: p(.99),
    maxMs: times.length ? times[times.length-1] : 0,
    pageErrors: results.reduce((n,x) => n+x.pageErrors,0),
    requestFailures: results.reduce((n,x) => n+x.requestFailures,0),
    consoleErrors: results.reduce((n,x) => n+x.consoleErrors,0),
    downloads: results.filter(x => x.downloadedBytes > 0).length
  };

  console.log("LOAD_SUMMARY|" + JSON.stringify(summary));
  for (const r of results) {
    console.log("USER|" + JSON.stringify(r));
  }

  process.exit(summary.passed === USERS &&
               summary.pageErrors === 0 &&
               summary.requestFailures === 0 &&
               summary.consoleErrors === 0 &&
               summary.downloads === USERS ? 0 : 1);
})().catch(e => {
  console.error("RUNNER_FATAL|" + String(e && e.stack ? e.stack : e));
  process.exit(2);
});
"@

[System.IO.File]::WriteAllText($runner, $js, (New-Object System.Text.UTF8Encoding($false)))

$header = @"
iePDF Merge PDF - Production Gate: Real Internet 50 User V1
Started: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Target: $TargetUrl
Users: $Users
Wave size: $WaveSize
Wave delay: $WaveDelayMs ms
Per-user timeout: $PerUserTimeoutMs ms
Global watchdog: $GlobalTimeoutSec sec

IMPORTANT:
This test targets a public HTTPS deployment. It does NOT deploy or modify source.
This V1 is a public-Internet test from one external test machine, not a
distributed 50-device test. Because Merge is browser-first, client CPU/memory
contention remains specific to the test machine.

Fixture A: $fixtureA
Fixture B: $fixtureB
Chrome: $chrome
Runner: $runner
"@
[System.IO.File]::WriteAllText($report, $header, (New-Object System.Text.UTF8Encoding($false)))

Write-Host $header
Write-Host "Starting public Internet load test..."
Write-Host "NO SOURCE CHANGES. NO GIT OPERATIONS. NO DEPLOYMENT."

$exit = 0
try {
    Push-Location $root
    & node $runner 2>&1 | Tee-Object -FilePath $report -Append
    $exit = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($exit -eq 0) {
    Write-Host ""
    Write-Host "REAL INTERNET 50-USER GATE: PASS" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "REAL INTERNET 50-USER GATE: FAIL" -ForegroundColor Red
    Write-Host "Review USER lines in: $report"
}

Write-Host "Report: $report"
Write-Host "NO SOURCE CHANGES. NO GIT OPERATIONS. NO DEPLOYMENT."
exit $exit
