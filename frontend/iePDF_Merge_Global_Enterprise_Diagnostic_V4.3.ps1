$ErrorActionPreference = "Stop"

# ============================================================
# iePDF Merge PDF - GLOBAL ENTERPRISE SOURCE/RUNTIME DIAGNOSTIC V4.3
# ============================================================
# Diagnostic ONLY:
#   - NO application source changes
#   - NO Git operations
#   - NO deployment
#
# V4.3 investigates the proven break:
#   input file -> native change -> processSelectedFiles/analyzer -> workspace
#
# It additionally captures:
#   - unhandled promise rejections
#   - browser exceptions
#   - console errors/warnings
#   - request failures
#   - file input state
#   - DOM/workspace state over time
#   - visible UI chooser behavior
#   - read-only source snippets from the local project
#   - analyzer/import references
#   - exact timing of state transition
# ============================================================

$ProjectRoot = "C:\IEPDF\frontend"
$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$BaseUrl = "http://127.0.0.1:3000"
$Fixture = Join-Path $ProjectRoot "_regression\merge-pdf\A-2-pages.pdf"
$PageSource = Join-Path $ProjectRoot "app\merge-pdf\page.tsx"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ReportDir = Join-Path $ProjectRoot "_regression\merge-pdf"
$RunnerPath = Join-Path $ReportDir "merge-global-enterprise-v4.3-runner-$Stamp.cjs"
$ReportPath = Join-Path $ReportDir "merge-global-enterprise-v4.3-$Stamp.txt"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

foreach ($required in @($ProjectRoot,$ChromePath,$Fixture,$PageSource)) {
    if (-not (Test-Path $required)) {
        throw "Required path not found: $required"
    }
}

# Read-only source evidence.
$pageText = [IO.File]::ReadAllText($PageSource)

$sourceEvidence = @()
foreach ($pattern in @(
    "BrowserPdfAnalyzer",
    "analyzer.analyzeMany(files)",
    "processSelectedFiles",
    "handleFileChange",
    "setWorkspaceFiles((previous) => [...previous, ...workspace])",
    "fileInputRef.current.value = """",
    "await processSelectedFiles(files)"
)) {
    $sourceEvidence += "SOURCE_PATTERN [$pattern] = $($pageText.Contains($pattern))"
}

$startMarker = "const processSelectedFiles"
$endMarker = "const handleFileChange"
$startIndex = $pageText.IndexOf($startMarker)
$endIndex = $pageText.IndexOf($endMarker)

if ($startIndex -ge 0 -and $endIndex -gt $startIndex) {
    $snippetLength = [Math]::Min(9000, $endIndex - $startIndex)
    $processSnippet = $pageText.Substring($startIndex, $snippetLength)
} else {
    $processSnippet = "Unable to isolate processSelectedFiles snippet from current local source."
}

$runnerSource = @'
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = process.env.IEPDF_BASE_URL;
const CHROME = process.env.IEPDF_CHROME_PATH;
const FIXTURE = process.env.IEPDF_FIXTURE;
const REPORT = process.env.IEPDF_REPORT;
const SOURCE_EVIDENCE = process.env.IEPDF_SOURCE_EVIDENCE || "";
const PROCESS_SNIPPET = process.env.IEPDF_PROCESS_SNIPPET || "";

const evidence = [];
const consoleMessages = [];
const pageErrors = [];
const unhandledRejections = [];
const requestFailures = [];
const relevantRequests = [];
const relevantResponses = [];

function log(text) {
  evidence.push(String(text));
  console.log(String(text));
}

async function getDomState(page, label) {
  const state = await page.evaluate(() => {
    const body = document.body.innerText || "";

    const inputs = Array.from(document.querySelectorAll("input")).map(i => ({
      type: i.type,
      multiple: i.multiple,
      accept: i.accept,
      value: i.value,
      files: i.files ? Array.from(i.files).map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
      })) : []
    }));

    const buttons = Array.from(document.querySelectorAll("button")).map(b => ({
      text: (b.innerText || "").trim(),
      aria: b.getAttribute("aria-label"),
      disabled: !!b.disabled,
      visible: !!(b.offsetWidth || b.offsetHeight || b.getClientRects().length)
    })).filter(x => x.text || x.aria);

    const removeCount = Array.from(document.querySelectorAll("button"))
      .filter(b => /remove pdf/i.test((b.innerText || "") + " " + (b.getAttribute("aria-label") || "")))
      .length;

    const dragHandles = Array.from(document.querySelectorAll('[aria-label^="Drag PDF "]'))
      .map(e => ({
        aria: e.getAttribute("aria-label"),
        role: e.getAttribute("role"),
        tabindex: e.getAttribute("tabindex")
      }));

    const mergeButtons = buttons.filter(b => /unlock.*merge/i.test(b.text));

    return {
      inputs,
      buttons,
      removeCount,
      dragHandles,
      mergeButtons,
      bodyTail: body.slice(-5000)
    };
  });

  log(`DOM ${label}: ${JSON.stringify(state)}`);
  return state;
}

(async () => {
  let browser = null;

  try {
    log("============================================================");
    log("iePDF MERGE PDF - GLOBAL ENTERPRISE SOURCE/RUNTIME DIAGNOSTIC V4.3");
    log("============================================================");
    log(`BASE=${BASE}`);
    log(`CHROME=${CHROME}`);
    log(`FIXTURE=${FIXTURE}`);
    log("");

    log("SOURCE EVIDENCE:");
    for (const line of SOURCE_EVIDENCE.split("\n")) {
      if (line) log(line);
    }

    log("");
    log("PROCESS SELECTED FILES SOURCE SNIPPET:");
    log(PROCESS_SNIPPET);

    browser = await chromium.launch({
      headless: true,
      executablePath: CHROME,
      args: [
        "--disable-gpu",
        "--disable-dev-shm-usage"
      ]
    });

    log("ENV-01 Browser launch: PASS");

    const context = await browser.newContext({
      acceptDownloads: true,
      locale: "en-US"
    });

    const page = await context.newPage();

    page.on("console", msg => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
      console.log(`BROWSER CONSOLE: ${text}`);
    });

    page.on("pageerror", err => {
      const text = String(err);
      pageErrors.push(text);
      console.log(`PAGE ERROR: ${text}`);
    });

    page.on("requestfailed", req => {
      const text = `${req.method()} ${req.url()} :: ${req.failure()?.errorText || "unknown"}`;
      requestFailures.push(text);
      console.log(`REQUEST FAILED: ${text}`);
    });

    page.on("request", req => {
      const url = req.url();
      if (url.includes("/api/") || url.includes("merge") || url.includes("_next")) {
        relevantRequests.push(`${req.method()} ${url}`);
      }
    });

    page.on("response", res => {
      const url = res.url();
      if (url.includes("/api/") || url.includes("merge") || url.includes("_next")) {
        relevantResponses.push(`${res.status()} ${url}`);
      }
    });

    // Catch the failure class that pageerror does not necessarily expose:
    // async event-handler promise rejection.
    await page.addInitScript(() => {
      window.__iepdfUnhandledRejections = [];
      window.__iepdfUnhandledExceptions = [];

      window.addEventListener("unhandledrejection", event => {
        const reason = event.reason;
        const text = reason instanceof Error
          ? `${reason.name}: ${reason.message}\n${reason.stack || ""}`
          : String(reason);

        window.__iepdfUnhandledRejections.push(text);
      });

      window.addEventListener("error", event => {
        window.__iepdfUnhandledExceptions.push(
          `${event.message || "error"} @ ${event.filename || ""}:${event.lineno || 0}:${event.colno || 0}`
        );
      });
    });

    const response = await page.goto(`${BASE}/merge-pdf`, {
      waitUntil: "domcontentloaded",
      timeout: 15000
    });

    log(`ENV-02 Route status: ${response ? response.status() : "null"}`);
    log(`ENV-03 Final URL: ${await page.url()}`);
    log(`ENV-04 Title: ${await page.title()}`);

    await page.waitForTimeout(1000);
    await getDomState(page, "initial");

    const input = page.locator('input[type="file"]').first();
    const addButton = page.getByRole("button", {
      name: /Add PDF Files/i
    }).first();

    log(`UI-01 File input count: ${await page.locator('input[type="file"]').count()}`);
    log(`UI-02 Add PDF Files count: ${await page.getByRole("button", {name:/Add PDF Files/i}).count()}`);

    // ----------------------------------------------------------
    // Attempt A: actual visible button.
    // ----------------------------------------------------------
    let chooserWorked = false;

    try {
      const chooserPromise = page.waitForEvent("filechooser", {timeout:7000});
      await addButton.click();
      const chooser = await chooserPromise;
      chooserWorked = true;
      log("UI-03 Visible Add PDF Files -> chooser: PASS");
      await chooser.setFiles(FIXTURE);
      log("UI-04 chooser.setFiles: PASS");
    } catch (e) {
      log(`UI-03 Visible Add PDF Files -> chooser: NOT-CONCLUSIVE (${e.message})`);
    }

    await page.waitForTimeout(1500);
    await getDomState(page, "after-ui-attempt");

    // ----------------------------------------------------------
    // Isolate deterministic input attempt on a fresh page.
    // ----------------------------------------------------------
    await page.goto(`${BASE}/merge-pdf`, {
      waitUntil: "domcontentloaded",
      timeout: 15000
    });

    await page.waitForTimeout(1000);

    const input2 = page.locator('input[type="file"]').first();

    await input2.evaluate(el => {
      el.addEventListener("change", () => {
        window.__iepdfNativeChangeCount =
          (window.__iepdfNativeChangeCount || 0) + 1;
      }, {capture:true});
    });

    await page.evaluate(() => {
      window.__iepdfNativeChangeCount = 0;
    });

    log("");
    log("ATTEMPT B: deterministic real input + native change capture");

    const before = await input2.evaluate(el => ({
      count: el.files ? el.files.length : -1,
      names: el.files ? Array.from(el.files).map(f => f.name) : []
    }));
    log(`B-01 Input BEFORE: ${JSON.stringify(before)}`);

    await input2.setInputFiles(FIXTURE);

    const immediate = await input2.evaluate(el => ({
      count: el.files ? el.files.length : -1,
      names: el.files ? Array.from(el.files).map(f => f.name) : [],
      value: el.value
    }));
    log(`B-02 Input IMMEDIATE: ${JSON.stringify(immediate)}`);

    for (const ms of [100,250,500,1000,2000,4000,8000]) {
      await page.waitForTimeout(ms);

      const changeCount = await page.evaluate(
        () => window.__iepdfNativeChangeCount || 0
      );

      const asyncErrors = await page.evaluate(() => ({
        rejections: window.__iepdfUnhandledRejections || [],
        errors: window.__iepdfUnhandledExceptions || []
      }));

      log(`B-03 change+${ms}ms nativeChangeCount=${changeCount}`);
      log(`B-04 asyncErrors+${ms}ms: ${JSON.stringify(asyncErrors)}`);

      await getDomState(page, `B+${ms}ms`);
    }

    const finalAsyncErrors = await page.evaluate(() => ({
      rejections: window.__iepdfUnhandledRejections || [],
      errors: window.__iepdfUnhandledExceptions || []
    }));

    const finalInput = await input2.evaluate(el => ({
      count: el.files ? el.files.length : -1,
      names: el.files ? Array.from(el.files).map(f => f.name) : [],
      value: el.value
    }));

    log("");
    log("FINAL DIAGNOSTIC EVIDENCE");
    log(`FINAL input=${JSON.stringify(finalInput)}`);
    log(`FINAL nativeChangeCount=${await page.evaluate(() => window.__iepdfNativeChangeCount || 0)}`);
    log(`FINAL asyncErrors=${JSON.stringify(finalAsyncErrors)}`);
    log(`CHOOSER_WORKED=${chooserWorked}`);

    log(`CONSOLE_COUNT=${consoleMessages.length}`);
    for (const msg of consoleMessages) log(`CONSOLE ${msg}`);

    log(`PAGEERROR_COUNT=${pageErrors.length}`);
    for (const err of pageErrors) log(`PAGEERROR ${err}`);

    log(`REQUEST_FAILURE_COUNT=${requestFailures.length}`);
    for (const item of requestFailures) log(`REQUEST_FAILED ${item}`);

    log(`RELEVANT_REQUEST_COUNT=${relevantRequests.length}`);
    for (const item of relevantRequests) log(`REQUEST ${item}`);

    log(`RELEVANT_RESPONSE_COUNT=${relevantResponses.length}`);
    for (const item of relevantResponses) log(`RESPONSE ${item}`);

    log("");
    log("INTERPRETATION:");

    if (finalInput.count === 1 &&
        (await page.evaluate(() => window.__iepdfNativeChangeCount || 0)) > 0 &&
        finalAsyncErrors.rejections.length > 0) {
      log("INTERPRETATION=FILE_INPUT_AND_CHANGE_WORK_BUT_ASYNC_PROCESSING_REJECTED");
    } else if (finalInput.count === 1 &&
               (await page.evaluate(() => window.__iepdfNativeChangeCount || 0)) > 0 &&
               finalAsyncErrors.rejections.length === 0 &&
               finalAsyncErrors.errors.length === 0) {
      log("INTERPRETATION=CHANGE_REACHED_APP_WITHOUT_BROWSER_EXCEPTION;_ANALYZER_OR_STATE_PATH_NEEDS_DIRECT_SOURCE_CORRELATION");
    } else if (finalInput.count === 1 &&
               (await page.evaluate(() => window.__iepdfNativeChangeCount || 0)) === 0) {
      log("INTERPRETATION=FILE_PRESENT_BUT_NATIVE_CHANGE_NOT_OBSERVED");
    } else {
      log("INTERPRETATION=UNRESOLVED");
    }

    await browser.close();
    browser = null;

    fs.writeFileSync(REPORT, evidence.join("\n"), "utf8");

    console.log("");
    console.log("DIAGNOSTIC COMPLETE");
    console.log(`Report: ${REPORT}`);
    console.log("NO SOURCE CHANGES. NO LIVE DEPLOYMENT.");

    process.exit(0);

  } catch (e) {
    console.error("[FATAL]", e && e.stack ? e.stack : String(e));

    try {
      if (browser) await browser.close();
    } catch {}

    try {
      fs.writeFileSync(
        REPORT,
        evidence.join("\n") + "\n[FATAL] " + (e && e.stack ? e.stack : String(e)),
        "utf8"
      );
    } catch {}

    process.exit(3);
  }
})();
'@

[IO.File]::WriteAllText($RunnerPath, $runnerSource, $Utf8NoBom)

$env:IEPDF_BASE_URL = $BaseUrl
$env:IEPDF_CHROME_PATH = $ChromePath
$env:IEPDF_FIXTURE = $Fixture
$env:IEPDF_REPORT = $ReportPath
$env:IEPDF_SOURCE_EVIDENCE = ($sourceEvidence -join "`n")
$env:IEPDF_PROCESS_SNIPPET = $processSnippet

try {
    Write-Host ""
    Write-Host "============================================================"
    Write-Host " iePDF MERGE PDF - GLOBAL ENTERPRISE DIAGNOSTIC V4.3"
    Write-Host " Source + Runtime / No Source Changes"
    Write-Host "============================================================"
    Write-Host ""

    & pnpm exec node $RunnerPath
    $exitCode = $LASTEXITCODE
}
finally {
    Remove-Item Env:IEPDF_BASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_CHROME_PATH -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_FIXTURE -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_REPORT -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_SOURCE_EVIDENCE -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_PROCESS_SNIPPET -ErrorAction SilentlyContinue
    Remove-Item $RunnerPath -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Report: $ReportPath"
Write-Host "NO SOURCE CHANGES. NO LIVE DEPLOYMENT."
exit $exitCode
