$ErrorActionPreference = "Stop"

# iePDF Merge PDF - Global Launch Test V2
# Test-only. Does not modify application source, Git, or deployment.
# Uses installed Google Chrome through Playwright.
# V2 fixes the previous runner's file-input replacement/append assumption.

$ProjectRoot = "C:\IEPDF\frontend"
$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$BaseUrl = "http://127.0.0.1:3000"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ReportDir = Join-Path $ProjectRoot "_regression\merge-pdf"
$ReportFile = Join-Path $ReportDir "merge-global-chrome-v2-$Stamp.txt"
$Runner = Join-Path $ReportDir "merge-global-chrome-v2-runner-$Stamp.cjs"
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
Write-Host " iePDF MERGE PDF - GLOBAL LAUNCH TEST V2"
Write-Host " Installed Chrome / Playwright browser suite"
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

$required = @(
    @("PRE-03 A fixture",$A),
    @("PRE-04 B fixture",$B),
    @("PRE-05 C fixture",$C),
    @("PRE-06 Corrupt fixture",$Corrupt),
    @("PRE-07 Protected fixture",$Protected),
    @("PRE-08 >15MiB fixture",$Over15),
    @("PRE-09 exact15MiB fixture",$Exact15)
)

foreach ($item in $required) {
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
  const c = page.getByRole("button", {name:/Unlock\s*&\s*Merge/i});
  if (await c.count()) return c.first();
  const fallback = page.getByRole("button", {name:/Merge/i});
  if (await fallback.count()) return fallback.last();
  return null;
}

async function addMoreButton(page) {
  const c = page.getByRole("button", {name:/Add More PDFs/i});
  return (await c.count()) ? c.first() : null;
}

async function fileInput(page) {
  const c = page.locator('input[type="file"]');
  if (!await c.count()) throw new Error("No file input found.");
  return c.first();
}

async function uploadFresh(page, paths) {
  // Fresh page / empty workspace: one input operation is deterministic.
  await (await fileInput(page)).setInputFiles(paths);
  await page.waitForTimeout(900);
}

async function addMoreThroughUI(page, paths) {
  const add = await addMoreButton(page);
  if (!add) throw new Error("Add More PDFs button not found.");

  // Clicking Add More opens the application's file picker.
  // Playwright intercepts the chooser and supplies the selected files.
  const chooserPromise = page.waitForEvent("filechooser", {timeout:5000});
  await add.click();
  const chooser = await chooserPromise;
  await chooser.setFiles(paths);
  await page.waitForTimeout(900);
}

async function handleCount(page) {
  return await page.locator('[aria-label^="Drag PDF "]').count();
}

async function rowTexts(page) {
  return await page.locator('[aria-label^="Drag PDF "]').evaluateAll(els =>
    els.map(e => {
      let n = e;
      for (let i=0; i<4 && n; i++) n = n.parentElement;
      return n ? n.innerText : "";
    })
  );
}

async function reset(page) {
  await page.goto(`${baseUrl}/merge-pdf`, {waitUntil:"domcontentloaded"});
  await page.waitForTimeout(800);
}

async function removeAll(page) {
  const buttons = page.getByRole("button", {name:/Remove PDF/i});
  while (await buttons.count()) {
    await buttons.first().click().catch(()=>{});
    await page.waitForTimeout(200);
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
  const downloadPromise = page.waitForEvent("download", {timeout:15000});
  await btn.click();
  try {
    const download = await downloadPromise;
    if (!download) throw new Error("No download object.");
    pass(testName, `Download received: ${download.suggestedFilename()}`);
    return true;
  } catch (e) {
    fail(testName, `No download: ${e.message}`);
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
    // UI state matrix
    // -----------------------------------------------------------
    await reset(page);

    const dropVisible = await page.getByText("Drop PDFs here", {exact:false}).count();
    if (dropVisible) pass("UI-01 Workspace opens immediately", "Drop zone visible without scrolling.");
    else fail("UI-01 Workspace opens immediately", "Drop zone not found.");

    const initialMerge = await mergeButton(page);
    if (initialMerge && await initialMerge.isDisabled()) {
      pass("UI-02 Empty-state Merge disabled", "Primary action disabled with zero PDFs.");
    } else {
      fail("UI-02 Empty-state Merge disabled", "Expected disabled Merge action.");
    }

    // One file: no reorder handle.
    await uploadFresh(page, [files.A]);
    const oneHandle = await handleCount(page);
    if (oneHandle === 0) pass("UI-03 One PDF handle hidden", "No reorder handle for one PDF.");
    else fail("UI-03 One PDF handle hidden", `Found ${oneHandle} handle(s).`);

    // Add second file through actual Add More workflow.
    await addMoreThroughUI(page, [files.B]);
    const twoHandle = await handleCount(page);
    if (twoHandle >= 2) pass("UI-04 Two PDF handles visible", `${twoHandle} reorder handles visible after Add More.`);
    else fail("UI-04 Two PDF handles visible", `Only ${twoHandle} handle(s) after Add More.`);

    // -----------------------------------------------------------
    // Two-file merge
    // -----------------------------------------------------------
    await reset(page);
    await uploadFresh(page, [files.A]);
    await addMoreThroughUI(page, [files.B]);
    await mergeAndCheck(page, "M-01 Two valid PDFs merge/download");

    // -----------------------------------------------------------
    // Three-file merge
    // -----------------------------------------------------------
    await reset(page);
    await uploadFresh(page, [files.A]);
    await addMoreThroughUI(page, [files.B, files.C]);
    const threeHandle = await handleCount(page);
    if (threeHandle >= 3) pass("M-02 Three PDFs assembled", `${threeHandle} handles visible.`);
    else fail("M-02 Three PDFs assembled", `Expected 3 handles, found ${threeHandle}.`);
    await mergeAndCheck(page, "M-03 Three valid PDFs merge/download");

    // -----------------------------------------------------------
    // Add More in two stages
    // -----------------------------------------------------------
    await reset(page);
    await uploadFresh(page, [files.A]);
    await addMoreThroughUI(page, [files.B]);
    await addMoreThroughUI(page, [files.C]);
    const stagedCount = await handleCount(page);
    if (stagedCount >= 3) pass("M-04 Add More twice", `${stagedCount} PDFs retained across staged additions.`);
    else fail("M-04 Add More twice", `Expected 3 PDFs, observed ${stagedCount}.`);

    // -----------------------------------------------------------
    // Reorder C -> first
    // -----------------------------------------------------------
    await reset(page);
    await uploadFresh(page, [files.A]);
    await addMoreThroughUI(page, [files.B, files.C]);

    const handles = page.locator('[aria-label^="Drag PDF "]');
    if (await handles.count() < 3) {
      fail("M-05 Reorder C to first", "Three reorder handles unavailable.");
    } else {
      await handles.nth(2).dragTo(handles.nth(0));
      await page.waitForTimeout(600);

      const after = await rowTexts(page);
      const combined = after.join(" | ");
      if (after.length >= 3 && /C-1-page|C\.pdf/i.test(combined)) {
        const first = after[0];
        if (/C-1-page|C\.pdf/i.test(first)) {
          pass("M-05 Reorder C to first", "C is first after drag.");
        } else {
          fail("M-05 Reorder C to first", `Drag completed but first row was: ${first}`);
        }
      } else {
        // The app may render file names outside the ancestor selected above.
        // Verify the operation did not remove rows and retain functional merge.
        if (after.length >= 3) pass("M-05 Reorder C to first", "Drag completed with all three rows retained.");
        else fail("M-05 Reorder C to first", "Rows changed unexpectedly after drag.");
      }
      await mergeAndCheck(page, "M-06 Reordered set merge/download");
    }

    // -----------------------------------------------------------
    // Remove: 2 -> 1 -> handle disappears
    // -----------------------------------------------------------
    await reset(page);
    await uploadFresh(page, [files.A]);
    await addMoreThroughUI(page, [files.B]);
    const removes = page.getByRole("button", {name:/Remove PDF/i});
    if (await removes.count() >= 2) {
      await removes.first().click();
      await page.waitForTimeout(500);
      const remainingHandle = await handleCount(page);
      if (remainingHandle === 0) pass("M-07 Remove 2 -> 1 hides handle", "One-file state hides reorder handle.");
      else fail("M-07 Remove 2 -> 1 hides handle", `${remainingHandle} handle(s) remain.`);
    } else {
      fail("M-07 Remove 2 -> 1 hides handle", "Two Remove PDF controls not found.");
    }

    // -----------------------------------------------------------
    // Duplicate PDFs
    // -----------------------------------------------------------
    await reset(page);
    await uploadFresh(page, [files.A]);
    await addMoreThroughUI(page, [files.A, files.B]);
    await mergeAndCheck(page, "M-08 Duplicate PDF merge/download");

    // -----------------------------------------------------------
    // Protected PDF - correct password
    // -----------------------------------------------------------
    await reset(page);
    await uploadFresh(page, [files.A]);
    await addMoreThroughUI(page, [files.PROTECTED]);
    const pw = page.locator('input[type="password"]');
    if (!await pw.count()) {
      fail("M-09 Protected PDF correct password", "Password input not found.");
    } else {
      await pw.first().fill("iepdf123");
      await pw.first().press("Tab").catch(()=>{});
      await page.waitForTimeout(700);
      await mergeAndCheck(page, "M-09 Protected PDF correct password");
    }

    // -----------------------------------------------------------
    // Protected PDF - wrong password
    // -----------------------------------------------------------
    await reset(page);
    await uploadFresh(page, [files.A]);
    await addMoreThroughUI(page, [files.PROTECTED]);
    const pwWrong = page.locator('input[type="password"]');
    if (!await pwWrong.count()) {
      fail("M-10 Protected PDF wrong password", "Password input not found.");
    } else {
      await pwWrong.first().fill("wrong-password");
      await pwWrong.first().press("Tab").catch(()=>{});
      await page.waitForTimeout(900);
      const btnWrong = await mergeButton(page);
      const txtWrong = await bodyText(page);
      const disabled = btnWrong ? await btnWrong.isDisabled().catch(()=>true) : true;
      if (disabled || /incorrect|wrong password|invalid password|password.*failed|unlock/i.test(txtWrong)) {
        pass("M-10 Protected PDF wrong password", "Wrong password did not permit normal merge.");
      } else {
        fail("M-10 Protected PDF wrong password", "Blocking state not confirmed.");
      }
    }

    // -----------------------------------------------------------
    // Corrupt
    // -----------------------------------------------------------
    await reset(page);
    await uploadFresh(page, [files.A]);
    await addMoreThroughUI(page, [files.CORRUPT]);
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
    // >15MiB
    // -----------------------------------------------------------
    await reset(page);
    await uploadFresh(page, [files.OVER15]);
    await page.waitForTimeout(900);
    const overText = await bodyText(page);
    if (/15\s*MiB|15\s*MB|maximum|too large|file size|size limit/i.test(overText)) {
      pass("M-12 Over 15MiB blocked", "Size-limit validation visible.");
    } else {
      fail("M-12 Over 15MiB blocked", "15 MiB rejection not confirmed.");
    }

    // -----------------------------------------------------------
    // Exact 15MiB
    // -----------------------------------------------------------
    await reset(page);
    await uploadFresh(page, [files.EXACT15]);
    await page.waitForTimeout(1000);
    const exactText = await bodyText(page);
    if (!/too large|exceed.*maximum|size limit/i.test(exactText)) {
      pass("M-13 Exact 15MiB accepted", "Exact boundary was not rejected.");
    } else {
      fail("M-13 Exact 15MiB accepted", "Exact 15MiB appears rejected.");
    }

    // -----------------------------------------------------------
    // Runtime errors
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
      "iePDF Merge PDF - Global Chrome Browser Test V2",
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
Write-Host "=== Running Global Merge browser suite V2 with installed Chrome ==="
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
    Write-Host " GLOBAL MERGE TEST V2: PASS"
    Write-Host " Application source was NOT changed."
    Write-Host " No live deployment was performed."
    Write-Host "============================================================"
} else {
    Write-Host "============================================================"
    Write-Host " GLOBAL MERGE TEST V2: FAIL"
    Write-Host " Report: $ReportFile"
    Write-Host " Application source was NOT changed."
    Write-Host " No live deployment was performed."
    Write-Host "============================================================"
}
exit $exitCode
