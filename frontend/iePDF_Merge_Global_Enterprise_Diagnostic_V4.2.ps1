$ErrorActionPreference = "Stop"

# ============================================================
# iePDF Merge PDF - GLOBAL ENTERPRISE DIAGNOSTIC V4.2
# ============================================================
# Diagnostic / browser test ONLY.
# NO application source changes.
# NO Git operations.
# NO deployment.
#
# Purpose:
#   Determine exactly where the current Add PDF flow stops:
#   UI -> hidden input -> native change -> React processing ->
#   validation -> workspace state -> rendered row -> Merge state.
#
# Enterprise checks included:
#   - environment/browser
#   - local route availability
#   - source-path sanity (read-only)
#   - hidden input semantics
#   - native change event
#   - UI button -> file chooser
#   - deterministic input injection
#   - processing/validation observation
#   - DOM/state evidence
#   - console/page errors
#   - network activity
#   - timing/timeout behavior
#   - UTF-8 report output
# ============================================================

$ProjectRoot = "C:\IEPDF\frontend"
$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$BaseUrl = "http://127.0.0.1:3000"
$Fixture = Join-Path $ProjectRoot "_regression\merge-pdf\A-2-pages.pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ReportDir = Join-Path $ProjectRoot "_regression\merge-pdf"
$RunnerPath = Join-Path $ReportDir "merge-global-enterprise-v4.2-runner-$Stamp.cjs"
$ReportPath = Join-Path $ReportDir "merge-global-enterprise-v4.2-$Stamp.txt"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

if (-not (Test-Path $ProjectRoot)) { throw "Project root not found: $ProjectRoot" }
if (-not (Test-Path $ChromePath)) { throw "Chrome not found: $ChromePath" }
if (-not (Test-Path $Fixture)) { throw "Fixture not found: $Fixture" }

# Read-only source sanity. This does not alter source.
$PageSource = Join-Path $ProjectRoot "app\merge-pdf\page.tsx"
$WorkspaceSource = Join-Path $ProjectRoot "components\MergeWorkspace.tsx"

$sourceChecks = @()
if (Test-Path $PageSource) {
    $text = [IO.File]::ReadAllText($PageSource)
    foreach ($pattern in @(
        "fileInputRef",
        "handleSelectFiles",
        "handleFileChange",
        "processSelectedFiles",
        "setWorkspaceFiles",
        'type="file"',
        'multiple',
        'accept=".pdf"'
    )) {
        $sourceChecks += [PSCustomObject]@{
            Pattern = $pattern
            Present = $text.Contains($pattern)
        }
    }
}

if (Test-Path $WorkspaceSource) {
    $wtext = [IO.File]::ReadAllText($WorkspaceSource)
    foreach ($pattern in @(
        "onAddFiles",
        "onReorderFiles",
        "onUnlockMerge",
        "application/x-iepdf-reorder",
        "Unlock & Merge",
        "Add PDF Files"
    )) {
        $sourceChecks += [PSCustomObject]@{
            Pattern = $pattern
            Present = $wtext.Contains($pattern)
        }
    }
}

$runnerSource = @'
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = process.env.IEPDF_BASE_URL;
const CHROME = process.env.IEPDF_CHROME_PATH;
const FIXTURE = process.env.IEPDF_FIXTURE;
const REPORT = process.env.IEPDF_REPORT;

const results = [];
const consoleMessages = [];
const pageErrors = [];
const requests = [];
const responses = [];
const changeEvents = [];
const inputSnapshots = [];

function line(text) {
  results.push(String(text));
  console.log(String(text));
}

async function snapshotInput(input, label) {
  const data = await input.evaluate(el => ({
    count: el.files ? el.files.length : -1,
    names: el.files ? Array.from(el.files).map(f => f.name) : [],
    type: el.type,
    multiple: el.multiple,
    accept: el.accept,
    disabled: el.disabled,
    value: el.value
  }));
  inputSnapshots.push({label, data});
  line(`INPUT ${label}: ${JSON.stringify(data)}`);
  return data;
}

async function workspaceEvidence(page, label) {
  const data = await page.evaluate(() => {
    const body = document.body.innerText || "";

    const allButtons = Array.from(document.querySelectorAll("button")).map(b => ({
      text: (b.innerText || "").trim(),
      aria: b.getAttribute("aria-label"),
      title: b.getAttribute("title"),
      disabled: !!b.disabled,
      visible: !!(b.offsetWidth || b.offsetHeight || b.getClientRects().length)
    })).filter(x => x.text || x.aria || x.title);

    const removeButtons = Array.from(document.querySelectorAll("button"))
      .filter(b => /remove pdf/i.test((b.innerText || "") + " " + (b.getAttribute("aria-label") || "")))
      .length;

    const dragHandles = Array.from(document.querySelectorAll('[aria-label^="Drag PDF "]')).map(e => ({
      aria: e.getAttribute("aria-label"),
      role: e.getAttribute("role"),
      tabIndex: e.getAttribute("tabindex")
    }));

    const mergeButtons = allButtons.filter(b => /unlock.*merge/i.test(b.text));

    return {
      bodyTail: body.slice(-4500),
      removeButtons,
      dragHandles,
      mergeButtons,
      buttons: allButtons
    };
  });

  line(`DOM ${label}: ${JSON.stringify(data)}`);
  return data;
}

async function runOneInputAttempt(page, input, label) {
  line(`ATTEMPT ${label}: starting`);

  await snapshotInput(input, `${label}-before`);

  await input.evaluate(el => {
    el.addEventListener("change", () => {
      window.__iepdfDiagnosticChangeCount =
        (window.__iepdfDiagnosticChangeCount || 0) + 1;
      window.__iepdfDiagnosticLastChange =
        Date.now();
    }, {capture: true});
  });

  const beforeChange = await page.evaluate(() => ({
    count: window.__iepdfDiagnosticChangeCount || 0,
    last: window.__iepdfDiagnosticLastChange || null
  }));

  line(`CHANGE ${label}-before: ${JSON.stringify(beforeChange)}`);

  await input.setInputFiles(FIXTURE);
  line(`ATTEMPT ${label}: setInputFiles returned`);

  await snapshotInput(input, `${label}-immediate`);

  for (const ms of [100, 250, 500, 1000, 2000, 4000, 8000]) {
    await page.waitForTimeout(ms);

    const changeState = await page.evaluate(() => ({
      count: window.__iepdfDiagnosticChangeCount || 0,
      last: window.__iepdfDiagnosticLastChange || null
    }));

    line(`CHANGE ${label}+${ms}ms: ${JSON.stringify(changeState)}`);
    await snapshotInput(input, `${label}+${ms}ms`);
    await workspaceEvidence(page, `${label}+${ms}ms`);
  }
}

(async () => {
  let browser = null;

  try {
    line("============================================================");
    line("iePDF MERGE PDF - GLOBAL ENTERPRISE DIAGNOSTIC V4.2");
    line("============================================================");
    line(`BASE=${BASE}`);
    line(`CHROME=${CHROME}`);
    line(`FIXTURE=${FIXTURE}`);
    line("");

    browser = await chromium.launch({
      headless: true,
      executablePath: CHROME,
      args: [
        "--disable-gpu",
        "--disable-dev-shm-usage"
      ]
    });

    line("ENV-01 Browser launch: PASS");

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

    page.on("request", req => {
      const url = req.url();
      if (url.includes("/api/") || url.includes("_next")) {
        requests.push(`${req.method()} ${url}`);
      }
    });

    page.on("response", res => {
      const url = res.url();
      if (url.includes("/api/") || url.includes("_next")) {
        responses.push(`${res.status()} ${url}`);
      }
    });

    const response = await page.goto(`${BASE}/merge-pdf`, {
      waitUntil: "domcontentloaded",
      timeout: 15000
    });

    line(`ENV-02 Route HTTP status: ${response ? response.status() : "null"}`);
    line(`ENV-03 Final URL: ${await page.url()}`);
    line(`ENV-04 Title: ${await page.title()}`);

    await page.waitForTimeout(1200);

    const input = page.locator('input[type="file"]').first();
    const inputCount = await page.locator('input[type="file"]').count();
    line(`UI-01 File input count: ${inputCount}`);

    if (inputCount !== 1) {
      throw new Error(`Expected exactly one file input, found ${inputCount}`);
    }

    const inputInfo = await input.evaluate(el => ({
      tag: el.tagName,
      type: el.type,
      multiple: el.multiple,
      accept: el.accept,
      hiddenClass: el.className,
      disabled: el.disabled
    }));
    line(`UI-02 File input semantics: ${JSON.stringify(inputInfo)}`);

    const addButton = page.getByRole("button", {
      name: /Add PDF Files/i
    }).first();

    line(`UI-03 Add PDF Files count: ${await page.getByRole("button", {name:/Add PDF Files/i}).count()}`);

    if (!await addButton.isVisible()) {
      throw new Error("Add PDF Files button is not visible.");
    }

    line("UI-04 Add PDF Files visible: PASS");

    const initialEvidence = await workspaceEvidence(page, "initial");

    // ----------------------------------------------------------
    // Attempt A: actual UI button -> filechooser
    // ----------------------------------------------------------
    await page.evaluate(() => {
      window.__iepdfDiagnosticChangeCount = 0;
      window.__iepdfDiagnosticLastChange = null;
    });

    let chooserWorked = false;

    try {
      const chooserPromise = page.waitForEvent("filechooser", {
        timeout: 7000
      });

      await addButton.click();

      const chooser = await chooserPromise;
      chooserWorked = true;

      line("UI-05 Visible Add PDF Files -> filechooser: PASS");
      await chooser.setFiles(FIXTURE);
      line("UI-06 Filechooser.setFiles: PASS");

      await page.waitForTimeout(3000);

      const inputAfterChooser = await snapshotInput(
        input,
        "after-ui-filechooser"
      );

      await workspaceEvidence(page, "after-ui-filechooser");

      line(`UI-07 UI chooser input file count: ${inputAfterChooser.count}`);
    } catch (e) {
      line(`UI-05 Visible Add PDF Files -> filechooser: NOT-CONCLUSIVE (${e.message})`);
    }

    // Reset page so Attempt B is isolated.
    await page.goto(`${BASE}/merge-pdf`, {
      waitUntil: "domcontentloaded",
      timeout: 15000
    });
    await page.waitForTimeout(1000);

    const inputB = page.locator('input[type="file"]').first();

    await page.evaluate(() => {
      window.__iepdfDiagnosticChangeCount = 0;
      window.__iepdfDiagnosticLastChange = null;
    });

    // Native capture listener is installed before setInputFiles.
    await inputB.evaluate(el => {
      el.addEventListener("change", () => {
        window.__iepdfDiagnosticChangeCount =
          (window.__iepdfDiagnosticChangeCount || 0) + 1;
        window.__iepdfDiagnosticLastChange =
          Date.now();
      }, {capture:true});
    });

    line("");
    line("ATTEMPT B: deterministic hidden-input setInputFiles");

    await snapshotInput(inputB, "B-before");

    await inputB.setInputFiles(FIXTURE);

    line("B-setInputFiles: returned");
    await snapshotInput(inputB, "B-immediate");

    for (const ms of [100, 250, 500, 1000, 2000, 4000, 8000]) {
      await page.waitForTimeout(ms);

      const changeState = await page.evaluate(() => ({
        count: window.__iepdfDiagnosticChangeCount || 0,
        last: window.__iepdfDiagnosticLastChange || null
      }));

      line(`B-change+${ms}ms: ${JSON.stringify(changeState)}`);
      await snapshotInput(inputB, `B+${ms}ms`);
      await workspaceEvidence(page, `B+${ms}ms`);
    }

    // ----------------------------------------------------------
    // Browser-level source/runtime evidence
    // ----------------------------------------------------------
    line("");
    line("============================================================");
    line("FINAL EVIDENCE");
    line("============================================================");

    const finalInput = await snapshotInput(inputB, "FINAL");
    const finalDom = await workspaceEvidence(page, "FINAL");

    line(`FINAL file input count=${finalInput.count}`);
    line(`FINAL Remove PDF count=${finalDom.removeButtons}`);
    line(`FINAL drag handle count=${finalDom.dragHandles.length}`);
    line(`FINAL Merge buttons=${JSON.stringify(finalDom.mergeButtons)}`);

    line(`CONSOLE COUNT=${consoleMessages.length}`);
    for (const msg of consoleMessages) line(`CONSOLE ${msg}`);

    line(`PAGEERROR COUNT=${pageErrors.length}`);
    for (const err of pageErrors) line(`PAGEERROR ${err}`);

    line(`REQUEST COUNT=${requests.length}`);
    for (const req of requests) line(`REQUEST ${req}`);

    line(`RESPONSE COUNT=${responses.length}`);
    for (const res of responses) line(`RESPONSE ${res}`);

    line("");
    line("DIAGNOSTIC INTERPRETATION DATA:");

    const changeCount = await page.evaluate(
      () => window.__iepdfDiagnosticChangeCount || 0
    );

    line(`NATIVE_CHANGE_EVENT_COUNT=${changeCount}`);
    line(`CHOOSER_WORKED=${chooserWorked}`);

    if (changeCount > 0 && finalInput.count === 1 && finalDom.removeButtons === 0) {
      line("INTERPRETATION=CHANGE_EVENT_REACHED_BROWSER_BUT_NO_WORKSPACE_ROW");
    } else if (changeCount === 0 && finalInput.count === 1) {
      line("INTERPRETATION=INPUT_RECEIVED_FILE_BUT_NO_NATIVE_CHANGE_EVENT_OBSERVED");
    } else if (finalInput.count === 0) {
      line("INTERPRETATION=FILE_DID_NOT_REMAIN_IN_INPUT");
    } else if (finalDom.removeButtons > 0) {
      line("INTERPRETATION=WORKSPACE_ROW_RENDERED");
    } else {
      line("INTERPRETATION=REQUIRES_SOURCE_RUNTIME_CORRELATION");
    }

    await browser.close();
    browser = null;

    fs.writeFileSync(REPORT, output.join("\n"), "utf8");

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
        output.join("\n") + "\n[FATAL] " + String(e),
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

try {
    & pnpm exec node $RunnerPath
    $exitCode = $LASTEXITCODE
}
finally {
    Remove-Item Env:IEPDF_BASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_CHROME_PATH -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_FIXTURE -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_REPORT -ErrorAction SilentlyContinue
    Remove-Item $RunnerPath -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Report: $ReportPath"
Write-Host "NO SOURCE CHANGES. NO LIVE DEPLOYMENT."
exit $exitCode
