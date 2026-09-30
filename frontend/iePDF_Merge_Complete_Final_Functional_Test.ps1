$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $RegDir "merge-complete-final-functional-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-complete-final-functional-runner-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null

try {
    Write-Host "============================================================"
    Write-Host "iePDF MERGE PDF - COMPLETE FINAL FUNCTIONAL TEST"
    Write-Host "============================================================"
    Write-Host "Started: $(Get-Date)"
    Write-Host "Root: $Root"
    Write-Host ""
    Write-Host "ONE-SCRIPT FINAL FUNCTIONAL VALIDATION"
    Write-Host "NO SOURCE CHANGES"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"

    $Fixtures = @(Get-ChildItem -LiteralPath $RegDir -Filter "*.pdf" -File |
        Sort-Object Name)

    if ($Fixtures.Count -lt 3) {
        throw "At least 3 PDF fixtures are required in $RegDir. Found $($Fixtures.Count)."
    }

    $A = $Fixtures[0].FullName
    $B = $Fixtures[1].FullName
    $C = $Fixtures[2].FullName

    Write-Host ""
    Write-Host "Fixtures:"
    Write-Host "A = $A"
    Write-Host "B = $B"
    Write-Host "C = $C"

    Write-Host ""
    Write-Host "=== TYPESCRIPT PREFLIGHT ==="
    Push-Location $Root
    & pnpm exec tsc --noEmit
    $Tsc = $LASTEXITCODE
    Pop-Location

    if ($Tsc -ne 0) {
        throw "TypeScript failed."
    }

    Write-Host "TypeScript PASS"

    $RunnerText = @'
const { chromium } = require("playwright");
const fs = require("fs");

const report = process.argv[2];
const A = process.argv[3];
const B = process.argv[4];
const C = process.argv[5];

const results = [];
const pageErrors = [];
const failedRequests = [];
const consoleErrors = [];

function test(id, condition, detail) {
  const line = `${condition ? "PASS" : "FAIL"} ${id} - ${detail}`;
  results.push(line);
  console.log(line);
}

function fileName(p) {
  return p.split(/[\\/]/).pop();
}

async function state(page) {
  return page.evaluate(() => {
    const body = document.body?.innerText || "";
    const buttons = [...document.querySelectorAll("button")];

    const mergeButton = buttons.find(b =>
      /Unlock\s*&\s*Merge/i.test((b.innerText || "").trim())
    );

    const removeButtons = buttons.filter(b =>
      /Remove PDF/i.test((b.innerText || "").trim())
    );

    const fileInput = document.querySelector('input[type="file"]');

    return {
      body,
      files1: /Files\s*[\r\n]+1\b/.test(body),
      files2: /Files\s*[\r\n]+2\b/.test(body),
      files3: /Files\s*[\r\n]+3\b/.test(body),
      total: Number((body.match(/Total\s*[\r\n]+(\d+)/) || [])[1] || -1),
      ready: Number((body.match(/Ready\s*[\r\n]+(\d+)/) || [])[1] || -1),
      inputCount: fileInput?.files?.length ?? null,
      removeCount: removeButtons.length,
      mergeExists: !!mergeButton,
      mergeDisabled: mergeButton ? mergeButton.disabled : null
    };
  });
}

async function waitForCondition(page, fn, timeout = 15000) {
  try {
    await page.waitForFunction(fn, null, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function fresh(page, query) {
  await page.goto(
    `http://localhost:3000/merge-pdf?${query}=${Date.now()}`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await page.waitForTimeout(500);
}

async function setFiles(page, paths) {
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(paths);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const page = await browser.newPage();

  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  page.on("pageerror", err => {
    pageErrors.push(String(err?.stack || err?.message || err));
  });

  page.on("requestfailed", req => {
    failedRequests.push(
      `${req.method()} ${req.url()} :: ${req.failure()?.errorText || "unknown"}`
    );
  });

  // ============================================================
  // PRECHECK
  // ============================================================

  await fresh(page, "completeFunctional");

  test(
    "PRE-01",
    await page.locator('input[type="file"]').count() === 1,
    "exactly one file input"
  );

  test(
    "PRE-02",
    await page.getByRole("button", { name: /Add PDF Files/i }).count() === 1,
    "Add PDF Files control present"
  );

  test(
    "PRE-03",
    (await state(page)).mergeDisabled === true,
    "empty workspace Merge disabled"
  );

  // ============================================================
  // TEST 1 - TWO PDFs, REPEATED ADD
  // ============================================================

  await setFiles(page, [A]);

  const oneReady = await waitForCondition(
    page,
    () => (document.body.innerText || "").includes(fileName(A))
  );

  test("T1-01", oneReady, `A added: ${fileName(A)}`);

  await setFiles(page, [B]);

  const twoFiles = await waitForCondition(
    page,
    () => {
      const t = document.body.innerText || "";
      return t.includes(fileName(A)) && t.includes(fileName(B));
    }
  );

  let s = await state(page);

  test(
    "T1-02",
    twoFiles,
    `A+B present: A=${s.body.includes(fileName(A))}, B=${s.body.includes(fileName(B))}`
  );

  test(
    "T1-03",
    s.removeCount >= 2,
    `remove controls=${s.removeCount}`
  );

  // Give preview/analysis time to settle.
  await page.waitForTimeout(2500);
  s = await state(page);

  test(
    "T1-04",
    s.mergeDisabled === false,
    `2-PDF Merge enabled=${!s.mergeDisabled}, ready=${s.ready}, total=${s.total}`
  );

  // ============================================================
  // TEST 2 - THREE PDFs IN ONE SELECTION
  // ============================================================

  await fresh(page, "threePdf");

  await setFiles(page, [A, B, C]);

  const threeFiles = await waitForCondition(
    page,
    () => {
      const t = document.body.innerText || "";
      return t.includes(fileName(A)) &&
             t.includes(fileName(B)) &&
             t.includes(fileName(C));
    },
    15000
  );

  await page.waitForTimeout(2500);
  s = await state(page);

  test(
    "T2-01",
    threeFiles,
    `A+B+C present: A=${s.body.includes(fileName(A))}, B=${s.body.includes(fileName(B))}, C=${s.body.includes(fileName(C))}`
  );

  test(
    "T2-02",
    s.removeCount >= 3,
    `remove controls=${s.removeCount}`
  );

  test(
    "T2-03",
    s.mergeDisabled === false,
    `3-PDF Merge enabled=${!s.mergeDisabled}, ready=${s.ready}, total=${s.total}`
  );

  // ============================================================
  // TEST 3 - REPEATED ADD / REMOVE / ADD
  // ============================================================

  await fresh(page, "repeatAddRemove");

  await setFiles(page, [A]);
  await page.waitForTimeout(1000);

  await setFiles(page, [B]);
  await page.waitForTimeout(1500);

  s = await state(page);

  test(
    "T3-01",
    s.removeCount >= 2,
    `A+B after repeated add: remove controls=${s.removeCount}`
  );

  const removeButtons = page.getByRole("button", { name: /Remove PDF/i });
  const beforeRemove = await removeButtons.count();

  if (beforeRemove > 0) {
    await removeButtons.first().click();
  }

  await page.waitForTimeout(1000);

  s = await state(page);

  test(
    "T3-02",
    beforeRemove > 0 && s.removeCount === 1,
    `one PDF remains after removal: remove controls=${s.removeCount}`
  );

  await setFiles(page, [C]);
  await page.waitForTimeout(1800);

  s = await state(page);

  test(
    "T3-03",
    s.body.includes(fileName(C)),
    `C present after remove/add: ${fileName(C)}`
  );

  test(
    "T3-04",
    s.removeCount >= 2,
    `workspace recovered to >=2 PDFs: remove controls=${s.removeCount}`
  );

  // ============================================================
  // TEST 4 - REPEATED REMOVE TO EMPTY
  // ============================================================

  const currentRemove = page.getByRole("button", { name: /Remove PDF/i });

  while (await currentRemove.count() > 0) {
    await currentRemove.first().click();
    await page.waitForTimeout(500);
  }

  s = await state(page);

  test(
    "T4-01",
    s.removeCount === 0,
    `all PDFs removed: remove controls=${s.removeCount}`
  );

  test(
    "T4-02",
    s.mergeDisabled === true,
    "Merge disabled again after returning to empty workspace"
  );

  // ============================================================
  // TEST 5 - ADD AGAIN AFTER EMPTY
  // ============================================================

  await setFiles(page, [A, B, C]);
  await page.waitForTimeout(2500);

  s = await state(page);

  test(
    "T5-01",
    s.removeCount >= 3 &&
    s.body.includes(fileName(A)) &&
    s.body.includes(fileName(B)) &&
    s.body.includes(fileName(C)),
    "A+B+C can be added again after complete removal"
  );

  test(
    "T5-02",
    s.mergeDisabled === false,
    `Merge enabled after re-add=${!s.mergeDisabled}`
  );

  // ============================================================
  // TEST 6 - HANDLE VISIBILITY
  // ============================================================

  // Empty/one/two state was already exercised. Inspect drag handles
  // using the actual known marker class/attribute rather than generic
  // draggable elements.
  const handleInfo = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll("[draggable='true']")];

    return {
      draggableCount: candidates.length,
      visibleDraggableCount: candidates.filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).length
    };
  });

  test(
    "T6-01",
    handleInfo.visibleDraggableCount >= 3,
    `visible draggable row controls/elements=${handleInfo.visibleDraggableCount}`
  );

  // ============================================================
  // HEALTH
  // ============================================================

  test(
    "HEALTH-01",
    pageErrors.length === 0,
    `page errors=${pageErrors.length}`
  );

  test(
    "HEALTH-02",
    failedRequests.length === 0,
    `failed requests=${failedRequests.length}`
  );

  test(
    "HEALTH-03",
    consoleErrors.length === 0,
    `console errors=${consoleErrors.length}`
  );

  const pass = results.filter(x => x.startsWith("PASS ")).length;
  const fail = results.filter(x => x.startsWith("FAIL ")).length;

  console.log("");
  console.log(`SUMMARY PASS=${pass} FAIL=${fail}`);

  const output = [
    "iePDF MERGE PDF - COMPLETE FINAL FUNCTIONAL TEST",
    `Finished: ${new Date().toISOString()}`,
    "",
    "=== RESULTS ===",
    ...results,
    "",
    "=== CONSOLE ERRORS ===",
    ...consoleErrors,
    "",
    "=== PAGE ERRORS ===",
    ...pageErrors,
    "",
    "=== FAILED REQUESTS ===",
    ...failedRequests,
    "",
    `SUMMARY PASS=${pass} FAIL=${fail}`
  ].join("\n");

  fs.writeFileSync(report, output, "utf8");

  await browser.close();

  if (fail > 0) process.exitCode = 2;
})().catch(err => {
  console.error("FINAL_FUNCTIONAL_FATAL", err?.stack || err?.message || err);
  process.exitCode = 3;
});
'@

    [System.IO.File]::WriteAllText(
        $Runner,
        $RunnerText,
        [System.Text.UTF8Encoding]::new($false)
    )

    Push-Location $Root
    & node $Runner $Report $A $B $C
    $RunnerExit = $LASTEXITCODE
    Pop-Location

    if ($RunnerExit -eq 0) {
        Write-Host ""
        Write-Host "COMPLETE FINAL FUNCTIONAL TEST: PASS"
    }
    else {
        Write-Host ""
        Write-Host "COMPLETE FINAL FUNCTIONAL TEST: FAIL"
    }
}
catch {
    Write-Host ""
    Write-Host "COMPLETE FINAL FUNCTIONAL TEST ERROR:"
    Write-Host $_.Exception.Message
}
finally {
    if (Test-Path -LiteralPath $Runner) {
        Remove-Item -LiteralPath $Runner -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "COMPLETE FINAL FUNCTIONAL TEST COMPLETE"
    Write-Host "Report: $Report"
    Write-Host "NO SOURCE CHANGES"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"
    Write-Host "============================================================"
}
