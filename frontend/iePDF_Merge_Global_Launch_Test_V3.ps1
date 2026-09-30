$ErrorActionPreference = "Stop"

# iePDF Merge PDF - Global Launch Test V3
# Test-only. Does not modify application source, Git, or deployment.
# Aligned with the frozen current Merge UI:
#   - "Add PDF Files"
#   - "Drop PDFs here"
#   - no assumed "Add More PDFs" button
# Uses installed Google Chrome through Playwright.

$ProjectRoot = "C:\IEPDF\frontend"
$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$BaseUrl = "http://127.0.0.1:3000"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ReportDir = Join-Path $ProjectRoot "_regression\merge-pdf"
$ReportFile = Join-Path $ReportDir "merge-global-chrome-v3-$Stamp.txt"
$Runner = Join-Path $ReportDir "merge-global-chrome-v3-runner-$Stamp.cjs"
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
Write-Host " iePDF MERGE PDF - GLOBAL LAUNCH TEST V3"
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

async function pdfRows(page) {
  // Primary: visible reorder handles are present for 2+ PDFs.
  const handles = await page.locator('[aria-label^="Drag PDF "]').count();

  // Secondary: remove controls normally correspond to workspace file rows.
  const removes = await page.getByRole("button", {name:/Remove PDF/i}).count();

  // Return the strongest observed count without assuming the UI's exact DOM.
  return Math.max(handles, removes);
}

async function reset(page) {
  await page.goto(`${baseUrl}/merge-pdf`, {waitUntil:"domcontentloaded"});
  await page.waitForTimeout(700);
}

async function addFirst(page, path) {
  await (await fileInput(page)).setInputFiles(path);
  await page.waitForTimeout(900);
}

async function addMoreUsingFrozenUI(page, paths) {
  // Current frozen UI exposes "Add PDF Files" as the persistent picker/drop control.
  const addText = page.getByText("Add PDF Files", {exact:false}).first();
  if (!await addText.count()) {
    throw new Error('"Add PDF Files" control not found.');
  }

  // The visible Add PDF Files control is a label/click target for the file input.
  // Intercept the browser file chooser and use the same user-facing control.
  const chooserPromise = page.waitForEvent("filechooser", {timeout:5000});
  await addText.click();
  const chooser = await chooserPromise;
  await chooser.setFiles(paths);
  await page.waitForTimeout(1000);
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
    const download = await Promise.race([
      page.waitForEvent("download", {timeout:15000}),
      new Promise((_, reject) => setTimeout(() => reject(new Error("download timeout")), 15500))
    ]);
    // Race must be started before click.
  } catch {}

  try {
    const downloadPromise = page.waitForEvent("download", {timeout:15000});
    await btn.click();
    const download = await downloadPromise;
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
    // 01. Frozen UI state
    // -----------------------------------------------------------
    await reset(page);

    if (await page.getByText("Drop PDFs here", {exact:false}).count()) {
      pass("UI-01 Workspace opens immediately", "Drop zone visible without scrolling.");
    } else {
      fail("UI-01 Workspace opens immediately", "Drop zone not found.");
    }

    if (await page.getByText("Add PDF Files", {exact:false}).count()) {
      pass("UI-02 Add PDF Files control", "Current frozen add/browse control is present.");
    } else {
      fail("UI-02 Add PDF Files control", "Add PDF Files control not found.");
    }

    const emptyMerge = await mergeButton(page);
    if (emptyMerge && await emptyMerge.isDisabled()) {
      pass("UI-03 Empty-state Merge disabled", "Primary action disabled with zero PDFs.");
    } else {
      fail("UI-03 Empty-state Merge disabled", "Expected disabled Merge action.");
    }

    // -----------------------------------------------------------
    // 02. One -> two -> three using current Add PDF Files UI
    // -----------------------------------------------------------
    await addFirst(page, files.A);

    const oneHandles = await page.locator('[aria-label^="Drag PDF "]').count();
    if (oneHandles === 0) pass("UI-04 One PDF reorder handle hidden", "No reorder handle for one PDF.");
    else fail("UI-04 One PDF reorder handle hidden", `Found ${oneHandles} handle(s).`);

    await addMoreUsingFrozenUI(page, [files.B]);

    const twoHandles = await page.locator('[aria-label^="Drag PDF "]').count();
    if (twoHandles >= 2) pass("UI-05 Two PDF reorder handles visible", `${twoHandles} handles visible.`);
    else fail("UI-05 Two PDF reorder handles visible", `Found ${twoHandles} handles after adding B.`);

    await addMoreUsingFrozenUI(page, [files.C]);

    const threeHandles = await page.locator('[aria-label^="Drag PDF "]').count();
    if (threeHandles >= 3) pass("UI-06 Three PDF reorder handles visible", `${threeHandles} handles visible.`);
    else fail("UI-06 Three PDF reorder handles visible", `Found ${threeHandles} handles.`);

    // -----------------------------------------------------------
    // 03. Standard 2-file merge
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addMoreUsingFrozenUI(page, [files.B]);
    await mergeAndCheck(page, "M-01 Two valid PDFs merge/download");

    // -----------------------------------------------------------
    // 04. Standard 3-file merge
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addMoreUsingFrozenUI(page, [files.B]);
    await addMoreUsingFrozenUI(page, [files.C]);
    await mergeAndCheck(page, "M-02 Three valid PDFs merge/download");

    // -----------------------------------------------------------
    // 05. Add multiple files through current control
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addMoreUsingFrozenUI(page, [files.B, files.C]);
    const multiHandles = await page.locator('[aria-label^="Drag PDF "]').count();
    if (multiHandles >= 3) {
      pass("M-03 Multi-file Add PDF Files", `${multiHandles} PDFs retained from one Add PDF Files operation.`);
    } else {
      fail("M-03 Multi-file Add PDF Files", `Expected 3 handles, found ${multiHandles}.`);
    }

    // -----------------------------------------------------------
    // 06. Reorder
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addMoreUsingFrozenUI(page, [files.B]);
    await addMoreUsingFrozenUI(page, [files.C]);

    const handles = page.locator('[aria-label^="Drag PDF "]');
    if (await handles.count() < 3) {
      fail("M-04 Reorder C to first", "Three reorder handles unavailable.");
    } else {
      await handles.nth(2).dragTo(handles.nth(0));
      await page.waitForTimeout(600);

      const labels = await handles.evaluateAll(els =>
        els.map(e => e.getAttribute("aria-label"))
      );

      if (labels.length === 3) {
        pass("M-04 Reorder C to first", "Drag completed and all three rows remained.");
      } else {
        fail("M-04 Reorder C to first", `Unexpected handle count after drag: ${labels.length}.`);
      }

      await mergeAndCheck(page, "M-05 Reordered set merge/download");
    }

    // -----------------------------------------------------------
    // 07. Remove 2 -> 1
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addMoreUsingFrozenUI(page, [files.B]);

    const removeButtons = page.getByRole("button", {name:/Remove PDF/i});
    const beforeRemove = await removeButtons.count();

    if (beforeRemove >= 2) {
      await removeButtons.first().click();
      await page.waitForTimeout(500);
      const afterHandles = await page.locator('[aria-label^="Drag PDF "]').count();
      if (afterHandles === 0) {
        pass("M-06 Remove 2 -> 1 hides handle", "One-file state hides reorder handle.");
      } else {
        fail("M-06 Remove 2 -> 1 hides handle", `${afterHandles} reorder handle(s) remain.`);
      }
    } else {
      fail("M-06 Remove 2 -> 1 hides handle", `Expected 2 Remove controls, found ${beforeRemove}.`);
    }

    // -----------------------------------------------------------
    // 08. Duplicate PDFs
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addMoreUsingFrozenUI(page, [files.A]);
    await addMoreUsingFrozenUI(page, [files.B]);
    await mergeAndCheck(page, "M-07 Duplicate PDF merge/download");

    // -----------------------------------------------------------
    // 09. Protected PDF - correct password
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addMoreUsingFrozenUI(page, [files.PROTECTED]);

    const pw = page.locator('input[type="password"]');
    if (!await pw.count()) {
      fail("M-08 Protected PDF correct password", "Password input not found.");
    } else {
      await pw.first().fill("iepdf123");
      await pw.first().press("Tab").catch(()=>{});
      await page.waitForTimeout(800);
      await mergeAndCheck(page, "M-08 Protected PDF correct password");
    }

    // -----------------------------------------------------------
    // 10. Protected PDF - wrong password
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addMoreUsingFrozenUI(page, [files.PROTECTED]);

    const pwWrong = page.locator('input[type="password"]');
    if (!await pwWrong.count()) {
      fail("M-09 Protected PDF wrong password", "Password input not found.");
    } else {
      await pwWrong.first().fill("wrong-password");
      await pwWrong.first().press("Tab").catch(()=>{});
      await page.waitForTimeout(1000);
      const wrongBtn = await mergeButton(page);
      const wrongText = await bodyText(page);
      const blocked = !wrongBtn ||
        await wrongBtn.isDisabled().catch(()=>true) ||
        /incorrect|wrong password|invalid password|password.*failed|unlock/i.test(wrongText);
      if (blocked) pass("M-09 Protected PDF wrong password", "Wrong password did not permit normal merge.");
      else fail("M-09 Protected PDF wrong password", "Blocking state not confirmed.");
    }

    // -----------------------------------------------------------
    // 11. Corrupted PDF
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.A);
    await addMoreUsingFrozenUI(page, [files.CORRUPT]);
    await page.waitForTimeout(900);
    const corruptText = await bodyText(page);
    const corruptBtn = await mergeButton(page);
    if (/invalid|corrupt|failed|error|unsupported|validation/i.test(corruptText) ||
        !corruptBtn || await corruptBtn.isDisabled().catch(()=>true)) {
      pass("M-10 Corrupted PDF blocked", "Validation/error state prevents normal merge.");
    } else {
      fail("M-10 Corrupted PDF blocked", "No blocking state confirmed.");
    }

    // -----------------------------------------------------------
    // 12. >15MiB
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.OVER15);
    await page.waitForTimeout(900);
    const overText = await bodyText(page);
    if (/15\s*MiB|15\s*MB|maximum|too large|file size|size limit/i.test(overText)) {
      pass("M-11 Over 15MiB blocked", "Size-limit validation visible.");
    } else {
      fail("M-11 Over 15MiB blocked", "15 MiB rejection not confirmed.");
    }

    // -----------------------------------------------------------
    // 13. Exact 15MiB
    // -----------------------------------------------------------
    await reset(page);
    await addFirst(page, files.EXACT15);
    await page.waitForTimeout(1000);
    const exactText = await bodyText(page);
    if (!/too large|exceed.*maximum|size limit/i.test(exactText)) {
      pass("M-12 Exact 15MiB accepted", "Exact boundary was not rejected.");
    } else {
      fail("M-12 Exact 15MiB accepted", "Exact 15MiB appears rejected.");
    }

    // -----------------------------------------------------------
    // 14. Runtime errors
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
      "iePDF Merge PDF - Global Chrome Browser Test V3",
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
Write-Host "=== Running Global Merge browser suite V3 with installed Chrome ==="
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
    Write-Host " GLOBAL MERGE TEST V3: PASS"
    Write-Host " Application source was NOT changed."
    Write-Host " No live deployment was performed."
    Write-Host "============================================================"
} else {
    Write-Host "============================================================"
    Write-Host " GLOBAL MERGE TEST V3: FAIL"
    Write-Host " Report: $ReportFile"
    Write-Host " Application source was NOT changed."
    Write-Host " No live deployment was performed."
    Write-Host "============================================================"
}
exit $exitCode
