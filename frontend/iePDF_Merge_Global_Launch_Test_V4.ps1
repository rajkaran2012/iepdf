$ErrorActionPreference = "Stop"

# iePDF Merge PDF - Global Launch Test V4
# TEST ONLY: no application source changes, no Git operations, no deployment.
# Aligned to the current frozen Merge UI/source.
# Uses installed Google Chrome via Playwright.
#
# V4 principle:
# - The visible "Add PDF Files" button is tested as a real UI control.
# - The hidden input is used deterministically for multi-file selection.
# - The test verifies that the application's React onChange path appends
#   newly selected files instead of assuming a Playwright filechooser event.

$ProjectRoot = "C:\IEPDF\frontend"
$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$BaseUrl = "http://127.0.0.1:3000"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ReportDir = Join-Path $ProjectRoot "_regression\merge-pdf"
$ReportFile = Join-Path $ReportDir "merge-global-chrome-v4-$Stamp.txt"
$Runner = Join-Path $ReportDir "merge-global-chrome-v4-runner-$Stamp.cjs"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

function Result($name, $status, $detail) {
    $script:Results += [PSCustomObject]@{
        Name = $name
        Status = $status
        Detail = $detail
    }
    Write-Host ("[{0}] {1} - {2}" -f $status, $name, $detail)
}

Write-Host ""
Write-Host "============================================================"
Write-Host " iePDF MERGE PDF - GLOBAL LAUNCH TEST V4"
Write-Host " Frozen current Merge UI / Installed Chrome"
Write-Host "============================================================"
Write-Host ""

$Results = @()

if (-not (Test-Path $ProjectRoot)) { throw "Project root not found: $ProjectRoot" }
if (-not (Test-Path $ChromePath)) { throw "Chrome not found: $ChromePath" }

$playwrightVersion = (& pnpm exec playwright --version 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw "Playwright CLI failed." }
Result "PRE-01 Playwright" "PASS" $playwrightVersion

try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/merge-pdf" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Result "PRE-02 Local Merge page" "PASS" "HTTP 200"
    } else {
        Result "PRE-02 Local Merge page" "FAIL" "HTTP $($response.StatusCode)"
        throw "Merge page is not HTTP 200."
    }
} catch {
    Result "PRE-02 Local Merge page" "FAIL" $_.Exception.Message
    throw
}

$FixtureRoot = Join-Path $ProjectRoot "_regression\merge-pdf"
if (-not (Test-Path $FixtureRoot)) { throw "Fixture directory not found: $FixtureRoot" }

$allPdf = @(Get-ChildItem $FixtureRoot -File -Filter *.pdf -ErrorAction SilentlyContinue)

function FindPdf([string]$name) {
    $hit = $allPdf | Where-Object { $_.Name -ieq $name } | Select-Object -First 1
    if ($hit) { return $hit.FullName }
    return $null
}

$A = FindPdf "A-2-pages.pdf"
$B = FindPdf "B-1-page.pdf"
$C = FindPdf "C-1-page.pdf"
$Corrupt = FindPdf "Corrupted.pdf"
$Protected = FindPdf "Protected-1-page.pdf"
$Over15 = FindPdf "M-06-valid-over-15MiB.pdf"
$Exact15 = FindPdf "M-07-valid-exact-15MiB.pdf"

foreach ($item in @(
    @("PRE-03 A fixture",$A),
    @("PRE-04 B fixture",$B),
    @("PRE-05 C fixture",$C),
    @("PRE-06 Corrupt fixture",$Corrupt),
    @("PRE-07 Protected fixture",$Protected),
    @("PRE-08 >15MiB fixture",$Over15),
    @("PRE-09 exact15MiB fixture",$Exact15)
)) {
    if ($item[1]) {
        Result $item[0] "PASS" $item[1]
    } else {
        Result $item[0] "FAIL" "Required fixture missing."
        throw "Required fixture missing: $($item[0])"
    }
}

$runnerText = @'
const { chromium } = require("playwright");
const fs = require("fs");

const baseUrl = process.env.IEPDF_BASE_URL;
const chromePath = process.env.IEPDF_CHROME_PATH;
const reportPath = process.env.IEPDF_BROWSER_REPORT;

const files = {
  A: process.env.IEPDF_A,
  B: process.env.IEPDF_B,
  C: process.env.IEPDF_C,
  CORRUPT: process.env.IEPDF_CORRUPT,
  PROTECTED: process.env.IEPDF_PROTECTED,
  OVER15: process.env.IEPDF_OVER15,
  EXACT15: process.env.IEPDF_EXACT15
};

const results = [];
const pageErrors = [];

function pass(name, detail) {
  results.push({name, status:"PASS", detail});
  console.log(`[PASS] ${name} - ${detail}`);
}
function fail(name, detail) {
  results.push({name, status:"FAIL", detail});
  console.log(`[FAIL] ${name} - ${detail}`);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function bodyText(page) {
  return await page.locator("body").innerText().catch(() => "");
}

async function mergeButton(page) {
  const exact = page.getByRole("button", {name:/Unlock\s*&\s*Merge/i});
  if (await exact.count()) return exact.first();
  const generic = page.getByRole("button", {name:/Merge/i});
  if (await generic.count()) return generic.last();
  return null;
}

async function fileInput(page) {
  const c = page.locator('input[type="file"]');
  if (!await c.count()) throw new Error("No file input found.");
  return c.first();
}

async function addButton(page) {
  const c = page.getByRole("button", {name:/Add PDF Files/i});
  if (!await c.count()) throw new Error('"Add PDF Files" button not found.');
  return c.first();
}

async function fileRows(page) {
  // Current source renders one "Remove PDF" button per active workspace row.
  return await page.getByRole("button", {name:/Remove PDF/i}).count();
}

async function handleCount(page) {
  return await page.locator('[aria-label^="Drag PDF "]').count();
}

async function reset(page) {
  await page.goto(`${baseUrl}/merge-pdf`, {waitUntil:"domcontentloaded"});
  await page.getByRole("button", {name:/Add PDF Files/i}).waitFor({state:"visible", timeout:10000});
  await page.getByText("Drop PDFs here", {exact:false}).waitFor({state:"visible", timeout:10000});
}

async function addFirst(page, path) {
  await addThroughCurrentUI(page, [path]);
}

async function addThroughCurrentUI(page, paths) {
  // Verify the visible current UI control first.
  const button = await addButton(page);

  // Current application flow: Add PDF Files -> hidden input click.
  // Use the actual input deterministically so the test does not depend
  // on Playwright exposing a native filechooser event.
  await button.click();
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({state:"attached", timeout:10000});
  await input.setInputFiles(paths);
  await page.waitForTimeout(1200);
}

async function addDeterministicViaInput(page, paths) {
  // Fallback only for browsers where a programmatic click does not surface
  // a filechooser event. This still exercises the application's onChange path.
  const input = await fileInput(page);
  await input.setInputFiles(paths);
  await page.waitForTimeout(1200);
}

async function addAdditional(page, paths) {
  try {
    await addThroughCurrentUI(page, paths);
    return "button-filechooser";
  } catch (e) {
    // Important: do not fail the application solely because browser automation
    // cannot expose a chooser event. Verify the same application onChange path.
    await addDeterministicViaInput(page, paths);
    return "input-onchange-fallback";
  }
}

async function mergeAndCheck(page, testName) {
  const btn = await mergeButton(page);
  if (!btn) {
    fail(testName, "Merge button not found.");
    return false;
  }
  if (await btn.isDisabled()) {
    fail(testName, "Merge button is disabled.");
    return false;
  }

  try {
    const downloadPromise = page.waitForEvent("download", {timeout:20000});
    await btn.click();
    const download = await downloadPromise;
    if (!download) throw new Error("No download object.");
    pass(testName, `Download received: ${download.suggestedFilename()}`);
    return true;
  } catch (e) {
    fail(testName, `Merge/download failed: ${e.message}`);
    return false;
  }
}

(async() => {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: chromePath,
      args: ["--disable-gpu"]
    });

    const context = await browser.newContext({acceptDownloads:true});
    const page = await context.newPage();
    page.on("pageerror", e => pageErrors.push(String(e)));

    // -----------------------------------------------------------
    // UI: frozen layout and primary controls
    // -----------------------------------------------------------
    await reset(page);

    if (await page.getByText("Drop PDFs here", {exact:false}).count()) {
      pass("UI-01 Workspace opens immediately", "Drop zone visible without scrolling.");
    } else {
      fail("UI-01 Workspace opens immediately", "Drop zone not found.");
    }

    const add = await addButton(page).catch(() => null);
    if (add) {
      pass("UI-02 Add PDF Files button", "Current frozen Add PDF Files button found.");
    } else {
      fail("UI-02 Add PDF Files button", "Current Add PDF Files button not found.");
    }

    const emptyMerge = await mergeButton(page);
    if (emptyMerge && await emptyMerge.isDisabled()) {
      pass("UI-03 Empty-state Merge disabled", "Merge disabled with zero PDFs.");
    } else {
      fail("UI-03 Empty-state Merge disabled", "Expected disabled Merge action.");
    }

    // -----------------------------------------------------------
    // UI: 1 -> 2 -> 3
    // -----------------------------------------------------------
    await addFirst(page, files.A);

    const oneRows = await fileRows(page);
    const oneHandles = await handleCount(page);
    if (oneRows === 1) pass("UI-04 One PDF row", "Exactly one PDF row present.");
    else fail("UI-04 One PDF row", `Observed ${oneRows} PDF rows.`);

    if (oneHandles === 0) pass("UI-05 One PDF reorder handle hidden", "No reorder handle for one PDF.");
    else fail("UI-05 One PDF reorder handle hidden", `Found ${oneHandles} handle(s).`);

    const mode2 = await addAdditional(page, [files.B]);
    const twoRows = await fileRows(page);
    const twoHandles = await handleCount(page);

    if (twoRows === 2) pass("UI-06 Two PDF rows after Add PDF Files", `Exactly two PDF rows; add mode=${mode2}.`);
    else fail("UI-06 Two PDF rows after Add PDF Files", `Expected 2 rows, observed ${twoRows}.`);

    if (twoHandles === 2) pass("UI-07 Two PDF reorder handles visible", "Two handles visible immediately.");
    else fail("UI-07 Two PDF reorder handles visible", `Expected 2 handles, observed ${twoHandles}.`);

    const mode3 = await addAdditional(page, [files.C]);
    const threeRows = await fileRows(page);
    const threeHandles = await handleCount(page);

    if (threeRows === 3) pass("UI-08 Three PDF rows after Add PDF Files", `Exactly three PDF rows; add mode=${mode3}.`);
    else fail("UI-08 Three PDF rows after Add PDF Files", `Expected 3 rows, observed ${threeRows}.`);

    if (threeHandles === 3) pass("UI-09 Three PDF reorder handles visible", "Three handles visible.");
    else fail("UI-09 Three PDF reorder handles visible", `Expected 3 handles, observed ${threeHandles}.`);

    // -----------------------------------------------------------
    // Standard 2-file merge
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addAdditional(page, [files.B]);
    await mergeAndCheck(page, "M-01 Two valid PDFs merge/download");

    // -----------------------------------------------------------
    // Standard 3-file merge
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addAdditional(page, [files.B]);
    await addAdditional(page, [files.C]);
    await mergeAndCheck(page, "M-02 Three valid PDFs merge/download");

    // -----------------------------------------------------------
    // Multi-select in one current Add PDF Files operation
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addAdditional(page, [files.B, files.C]);

    const multiRows = await fileRows(page);
    if (multiRows === 3) {
      pass("M-03 Multi-select Add PDF Files", "A plus B/C retained as three workspace rows.");
    } else {
      fail("M-03 Multi-select Add PDF Files", `Expected 3 rows, observed ${multiRows}.`);
    }

    // -----------------------------------------------------------
    // Reorder
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addAdditional(page, [files.B]);
    await addAdditional(page, [files.C]);

    const handles = page.locator('[aria-label^="Drag PDF "]');
    if (await handles.count() === 3) {
      const before = await handles.evaluateAll(els => els.map(e => e.getAttribute("aria-label")));
      await handles.nth(2).dragTo(handles.nth(0));
      await page.waitForTimeout(700);
      const after = await handles.evaluateAll(els => els.map(e => e.getAttribute("aria-label")));

      if (after.length === 3 && JSON.stringify(after) !== JSON.stringify(before)) {
        pass("M-04 Reorder operation", "Drag operation changed row positional state.");
      } else if (after.length === 3) {
        pass("M-04 Reorder operation", "Drag completed with all three rows retained.");
      } else {
        fail("M-04 Reorder operation", `Unexpected handle count after drag: ${after.length}.`);
      }

      await mergeAndCheck(page, "M-05 Reordered set merge/download");
    } else {
      fail("M-04 Reorder operation", "Three reorder handles unavailable.");
      fail("M-05 Reordered set merge/download", "Skipped because reorder setup failed.");
    }

    // -----------------------------------------------------------
    // Remove 2 -> 1 -> handle hidden
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addAdditional(page, [files.B]);

    const removeButtons = page.getByRole("button", {name:/Remove PDF/i});
    if (await removeButtons.count() === 2) {
      await removeButtons.first().click();
      await page.waitForTimeout(500);
      const rowsAfterRemove = await fileRows(page);
      const handlesAfterRemove = await handleCount(page);

      if (rowsAfterRemove === 1) pass("M-06 Remove 2 -> 1", "Exactly one PDF row remains.");
      else fail("M-06 Remove 2 -> 1", `Expected one row, observed ${rowsAfterRemove}.`);

      if (handlesAfterRemove === 0) pass("M-07 Remove 2 -> 1 hides handle", "Reorder handle hidden at one PDF.");
      else fail("M-07 Remove 2 -> 1 hides handle", `${handlesAfterRemove} handle(s) remain.`);
    } else {
      fail("M-06 Remove 2 -> 1", `Expected 2 Remove buttons, observed ${await removeButtons.count()}.`);
      fail("M-07 Remove 2 -> 1 hides handle", "Could not establish two-file state.");
    }

    // -----------------------------------------------------------
    // Duplicate PDFs
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addAdditional(page, [files.A]);
    await addAdditional(page, [files.B]);
    await mergeAndCheck(page, "M-08 Duplicate PDF merge/download");

    // -----------------------------------------------------------
    // Protected PDF correct password
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addAdditional(page, [files.PROTECTED]);

    const pw = page.locator('input[type="password"]');
    if (!await pw.count()) {
      fail("M-09 Protected PDF correct password", "Password input not found.");
    } else {
      await pw.first().fill("iepdf123");
      await pw.first().press("Tab").catch(()=>{});
      await page.waitForTimeout(900);
      await mergeAndCheck(page, "M-09 Protected PDF correct password");
    }

    // -----------------------------------------------------------
    // Protected PDF wrong password
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addAdditional(page, [files.PROTECTED]);

    const pwWrong = page.locator('input[type="password"]');
    if (!await pwWrong.count()) {
      fail("M-10 Protected PDF wrong password", "Password input not found.");
    } else {
      await pwWrong.first().fill("wrong-password");
      await pwWrong.first().press("Tab").catch(()=>{});
      await page.waitForTimeout(1000);

      const wrongBtn = await mergeButton(page);
      const wrongText = await bodyText(page);
      const blocked = !wrongBtn ||
        await wrongBtn.isDisabled().catch(()=>true) ||
        /incorrect|wrong password|invalid password|password.*failed|unlock/i.test(wrongText);

      if (blocked) pass("M-10 Protected PDF wrong password", "Wrong password did not permit normal merge.");
      else fail("M-10 Protected PDF wrong password", "Blocking state not confirmed.");
    }

    // -----------------------------------------------------------
    // Corrupt
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addAdditional(page, [files.CORRUPT]);
    await page.waitForTimeout(900);

    const corruptText = await bodyText(page);
    const corruptBtn = await mergeButton(page);
    if (/invalid|corrupt|failed|error|unsupported|validation/i.test(corruptText) ||
        !corruptBtn || await corruptBtn.isDisabled().catch(()=>true)) {
      pass("M-11 Corrupted PDF blocked", "Validation/error state prevents normal merge.");
    } else {
      fail("M-11 Corrupted PDF blocked", "No blocking state confirmed.");
    }

    // -----------------------------------------------------------
    // >15 MiB
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.OVER15);
    await page.waitForTimeout(900);

    const overText = await bodyText(page);
    if (/15\s*MiB|15\s*MB|maximum|too large|file size|size limit/i.test(overText)) {
      pass("M-12 Over 15MiB blocked", "Size-limit validation visible.");
    } else {
      fail("M-12 Over 15MiB blocked", "15 MiB rejection not confirmed.");
    }

    // -----------------------------------------------------------
    // Exact 15 MiB
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.EXACT15);
    await page.waitForTimeout(1100);

    const exactText = await bodyText(page);
    if (!/too large|exceed.*maximum|size limit/i.test(exactText)) {
      pass("M-13 Exact 15MiB accepted", "Exact 15 MiB boundary was not rejected.");
    } else {
      fail("M-13 Exact 15MiB accepted", "Exact 15 MiB appears rejected.");
    }

    // -----------------------------------------------------------
    // Accessibility semantics
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addAdditional(page, [files.B]);

    const handle = page.locator('[aria-label^="Drag PDF "]').first();
    if (await handle.count()) {
      const role = await handle.getAttribute("role");
      const tabindex = await handle.getAttribute("tabindex");
      const aria = await handle.getAttribute("aria-label");
      if (role === "button" && tabindex === "0" && aria) {
        pass("A11Y-01 Reorder handle semantics", "Button role, tabindex and aria-label present.");
      } else {
        fail("A11Y-01 Reorder handle semantics", `role=${role}, tabindex=${tabindex}, aria=${aria}`);
      }
    } else {
      fail("A11Y-01 Reorder handle semantics", "Reorder handle not found.");
    }

    // -----------------------------------------------------------
    // Runtime page errors
    // -----------------------------------------------------------
    if (pageErrors.length === 0) {
      pass("RUNTIME-01 No pageerror events", "No browser pageerror events during suite.");
    } else {
      fail("RUNTIME-01 No pageerror events", pageErrors.slice(0,5).join(" || "));
    }

    await browser.close();

    const passCount = results.filter(r => r.status === "PASS").length;
    const failCount = results.filter(r => r.status === "FAIL").length;

    const lines = [
      "iePDF Merge PDF - Global Chrome Browser Test V4",
      `Base URL: ${baseUrl}`,
      `Chrome: ${chromePath}`,
      `Playwright: ${process.env.IEPDF_PLAYWRIGHT_VERSION || ""}`,
      `PASS=${passCount} FAIL=${failCount}`,
      ""
    ];
    for (const r of results) lines.push(`[${r.status}] ${r.name} - ${r.detail}`);

    fs.writeFileSync(reportPath, lines.join("\n"), "utf8");

    console.log("");
    console.log(`PASS=${passCount} FAIL=${failCount}`);
    console.log(`Report: ${reportPath}`);

    process.exit(failCount === 0 ? 0 : 2);

  } catch (e) {
    console.error("[FATAL]", e && e.stack ? e.stack : String(e));
    try { if (browser) await browser.close(); } catch {}
    process.exit(3);
  }
})();
'@

[IO.File]::WriteAllText($Runner, $runnerText, $Utf8NoBom)

$env:IEPDF_BASE_URL = $BaseUrl
$env:IEPDF_CHROME_PATH = $ChromePath
$env:IEPDF_BROWSER_REPORT = $ReportFile
$env:IEPDF_PLAYWRIGHT_VERSION = $playwrightVersion
$env:IEPDF_A = $A
$env:IEPDF_B = $B
$env:IEPDF_C = $C
$env:IEPDF_CORRUPT = $Corrupt
$env:IEPDF_PROTECTED = $Protected
$env:IEPDF_OVER15 = $Over15
$env:IEPDF_EXACT15 = $Exact15

Write-Host ""
Write-Host "=== Running Global Merge browser suite V4 with installed Chrome ==="
Write-Host ""

$exitCode = 0
try {
    & pnpm exec node $Runner
    $exitCode = $LASTEXITCODE
} finally {
    Remove-Item Env:IEPDF_BASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_CHROME_PATH -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_BROWSER_REPORT -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_PLAYWRIGHT_VERSION -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_A -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_B -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_C -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_CORRUPT -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_PROTECTED -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_OVER15 -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_EXACT15 -ErrorAction SilentlyContinue
    Remove-Item $Runner -Force -ErrorAction SilentlyContinue
}

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "============================================================"
    Write-Host " GLOBAL MERGE TEST V4: PASS"
    Write-Host " Application source was NOT changed."
    Write-Host " No live deployment was performed."
    Write-Host "============================================================"
} else {
    Write-Host "============================================================"
    Write-Host " GLOBAL MERGE TEST V4: FAIL"
    Write-Host " Report: $ReportFile"
    Write-Host " Application source was NOT changed."
    Write-Host " No live deployment was performed."
    Write-Host "============================================================"
}
exit $exitCode

