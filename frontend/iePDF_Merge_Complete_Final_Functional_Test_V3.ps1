$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $RegDir "merge-complete-final-functional-V3-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-complete-final-functional-V3-runner-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null

Write-Host "============================================================"
Write-Host "iePDF MERGE PDF - COMPLETE FINAL FUNCTIONAL TEST V3"
Write-Host "============================================================"
Write-Host "Started: $(Get-Date)"
Write-Host "Root: $Root"
Write-Host ""
Write-Host "NO SOURCE CHANGES"
Write-Host "NO GIT"
Write-Host "NO DEPLOYMENT"
Write-Host "NO CACHE DELETION"

try {
    $fixtures = @(Get-ChildItem -LiteralPath $RegDir -Filter "*.pdf" -File |
        Sort-Object Name)

    if ($fixtures.Count -lt 3) {
        throw "At least 3 PDF fixtures are required. Found $($fixtures.Count)."
    }

    $A = $fixtures[0].FullName
    $B = $fixtures[1].FullName
    $C = $fixtures[2].FullName

    Write-Host ""
    Write-Host "Fixtures:"
    Write-Host "A = $A"
    Write-Host "B = $B"
    Write-Host "C = $C"

    Write-Host ""
    Write-Host "=== TYPESCRIPT PREFLIGHT ==="
    Push-Location $Root
    & pnpm exec tsc --noEmit
    $tscExit = $LASTEXITCODE
    Pop-Location

    if ($tscExit -ne 0) {
        throw "TypeScript failed."
    }

    Write-Host "TypeScript PASS"

    $runnerText = @'
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
const workerErrors = [];

function baseName(p) {
  return p.split(/[\\/]/).pop();
}

const AName = baseName(A);
const BName = baseName(B);
const CName = baseName(C);

function record(id, ok, detail) {
  const line = `${ok ? "PASS" : "FAIL"} ${id} - ${detail}`;
  results.push(line);
  console.log(line);
}

async function getState(page) {
  return await page.evaluate(() => {
    const body = document.body?.innerText || "";
    const buttons = [...document.querySelectorAll("button")];

    const merge = buttons.find(b =>
      /Unlock\s*&\s*Merge/i.test((b.innerText || "").trim())
    );

    const removes = buttons.filter(b =>
      /Remove PDF/i.test((b.innerText || "").trim())
    );

    const input = document.querySelector('input[type="file"]');

    return {
      body,
      removeCount: removes.length,
      mergeExists: !!merge,
      mergeDisabled: merge ? merge.disabled : null,
      inputFiles: input?.files?.length ?? null,
      total: Number((body.match(/Total\s*[\r\n]+(\d+)/) || [])[1] || -1),
      ready: Number((body.match(/Ready\s*[\r\n]+(\d+)/) || [])[1] || -1)
    };
  });
}

async function waitForNames(page, names, timeout = 20000) {
  return await page.waitForFunction(
    (wanted) => {
      const text = document.body?.innerText || "";
      return wanted.every(name => text.includes(name));
    },
    names,
    { timeout }
  ).then(() => true).catch(() => false);
}

async function waitForRemoveCount(page, minimum, timeout = 20000) {
  return await page.waitForFunction(
    (n) => {
      return [...document.querySelectorAll("button")]
        .filter(b => /Remove PDF/i.test((b.innerText || "").trim()))
        .length >= n;
    },
    minimum,
    { timeout }
  ).then(() => true).catch(() => false);
}

async function waitForMergeEnabled(page, timeout = 20000) {
  return await page.waitForFunction(
    () => {
      const button = [...document.querySelectorAll("button")]
        .find(b => /Unlock\s*&\s*Merge/i.test((b.innerText || "").trim()));
      return !!button && button.disabled === false;
    },
    { timeout }
  ).then(() => true).catch(() => false);
}

async function fresh(page, tag) {
  await page.goto(
    `http://localhost:3000/merge-pdf?${tag}=${Date.now()}`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await page.waitForTimeout(700);
}

async function add(page, paths) {
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
    const text = msg.text();

    if (msg.type() === "error") {
      consoleErrors.push(text);
    }

    if (/pdf\.worker|min\.mjs|fake worker|unpkg\.com/i.test(text)) {
      workerErrors.push(text);
    }
  });

  page.on("pageerror", err => {
    pageErrors.push(String(err?.stack || err?.message || err));
  });

  page.on("requestfailed", req => {
    const failure = req.failure()?.errorText || "unknown";
    const item = `${req.method()} ${req.url()} :: ${failure}`;
    failedRequests.push(item);

    if (/pdf\.worker|min\.mjs|unpkg\.com/i.test(req.url())) {
      workerErrors.push(item);
    }
  });

  // ------------------------------------------------------------
  // PRECHECK
  // ------------------------------------------------------------

  await fresh(page, "functionalV3");

  record(
    "PRE-01",
    await page.locator('input[type="file"]').count() === 1,
    "exactly one file input"
  );

  record(
    "PRE-02",
    await page.getByRole("button", { name: /Add PDF Files/i }).count() === 1,
    "Add PDF Files control present"
  );

  let s = await getState(page);

  record(
    "PRE-03",
    s.mergeDisabled === true,
    "empty workspace Merge disabled"
  );

  // ------------------------------------------------------------
  // TEST 1 - SEQUENTIAL ADD WITH STATE SETTLE
  // ------------------------------------------------------------

  await add(page, [A]);

  const aAdded = await waitForNames(page, [AName]);
  const aRow = await waitForRemoveCount(page, 1);

  record(
    "T1-01",
    aAdded && aRow,
    `A added and rendered: ${AName}`
  );

  // Critical: wait for the first file to finish rendering before second selection.
  await page.waitForTimeout(1500);

  await add(page, [B]);

  const abNames = await waitForNames(page, [AName, BName]);
  const abRows = await waitForRemoveCount(page, 2);

  record(
    "T1-02",
    abNames && abRows,
    `A+B present and rendered: ${AName}, ${BName}`
  );

  const abMerge = await waitForMergeEnabled(page);
  s = await getState(page);

  record(
    "T1-03",
    abMerge,
    `2-PDF Merge enabled=${!s.mergeDisabled}; total=${s.total}; ready=${s.ready}`
  );

  // ------------------------------------------------------------
  // TEST 2 - THREE PDFs IN ONE SELECTION
  // ------------------------------------------------------------

  await fresh(page, "threePdfV3");

  await add(page, [A, B, C]);

  const abcNames = await waitForNames(page, [AName, BName, CName]);
  const abcRows = await waitForRemoveCount(page, 3);

  record(
    "T2-01",
    abcNames && abcRows,
    `A+B+C present and rendered`
  );

  const abcMerge = await waitForMergeEnabled(page);
  s = await getState(page);

  record(
    "T2-02",
    abcMerge,
    `3-PDF Merge enabled=${!s.mergeDisabled}; total=${s.total}; ready=${s.ready}`
  );

  // ------------------------------------------------------------
  // TEST 3 - REMOVE ONE, THEN ADD C
  // ------------------------------------------------------------

  await fresh(page, "removeAddV3");

  await add(page, [A, B]);

  await waitForNames(page, [AName, BName]);
  await waitForRemoveCount(page, 2);

  let removes = page.getByRole("button", { name: /Remove PDF/i });
  const beforeRemove = await removes.count();

  if (beforeRemove > 0) {
    await removes.first().click();
  }

  await waitForRemoveCount(page, 1);
  s = await getState(page);

  record(
    "T3-01",
    beforeRemove >= 2 && s.removeCount === 1,
    `one PDF remains after removal; remove controls=${s.removeCount}`
  );

  await add(page, [C]);

  const cAdded = await waitForNames(page, [CName]);
  const cRows = await waitForRemoveCount(page, 2);

  record(
    "T3-02",
    cAdded && cRows,
    `C added after removal; remove controls=${(await getState(page)).removeCount}`
  );

  // ------------------------------------------------------------
  // TEST 4 - REMOVE ALL -> EMPTY
  // ------------------------------------------------------------

  removes = page.getByRole("button", { name: /Remove PDF/i });

  while (await removes.count() > 0) {
    await removes.first().click();
    await page.waitForTimeout(500);
    removes = page.getByRole("button", { name: /Remove PDF/i });
  }

  s = await getState(page);

  record(
    "T4-01",
    s.removeCount === 0,
    "all PDFs removed"
  );

  record(
    "T4-02",
    s.mergeDisabled === true,
    "Merge disabled in empty state"
  );

  // ------------------------------------------------------------
  // TEST 5 - RE-ADD AFTER EMPTY
  // ------------------------------------------------------------

  await add(page, [A, B, C]);

  const readdedNames = await waitForNames(page, [AName, BName, CName]);
  const readdedRows = await waitForRemoveCount(page, 3);

  record(
    "T5-01",
    readdedNames && readdedRows,
    `A+B+C re-added after empty`
  );

  const readdedMerge = await waitForMergeEnabled(page);
  s = await getState(page);

  record(
    "T5-02",
    readdedMerge,
    `Merge enabled after re-add=${!s.mergeDisabled}`
  );

  // ------------------------------------------------------------
  // TEST 6 - HANDLE VISIBILITY / DRAG SURFACE
  // ------------------------------------------------------------

  const dragInfo = await page.evaluate(() => {
    const els = [...document.querySelectorAll("[draggable='true']")];

    return {
      count: els.length,
      visible: els.filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).length
    };
  });

  record(
    "T6-01",
    dragInfo.visible >= 3,
    `visible draggable elements=${dragInfo.visible}`
  );

  // ------------------------------------------------------------
  // HEALTH
  // ------------------------------------------------------------

  record(
    "HEALTH-01",
    pageErrors.length === 0,
    `page errors=${pageErrors.length}`
  );

  // Worker failures are classified separately, not hidden.
  record(
    "HEALTH-02",
    failedRequests.filter(x => !/unpkg\.com.*pdf\.worker|min\.mjs/i.test(x)).length === 0,
    `non-worker failed requests=${failedRequests.filter(x => !/unpkg\.com.*pdf\.worker|min\.mjs/i.test(x)).length}`
  );

  record(
    "HEALTH-03",
    consoleErrors.filter(x => !/pdf\.worker|min\.mjs|fake worker|unpkg\.com/i.test(x)).length === 0,
    `non-worker console errors=${consoleErrors.filter(x => !/pdf\.worker|min\.mjs|fake worker|unpkg\.com/i.test(x)).length}`
  );

  record(
    "WORKER-01",
    workerErrors.length === 0,
    `PDF.js worker external errors=${workerErrors.length}`
  );

  const pass = results.filter(x => x.startsWith("PASS ")).length;
  const fail = results.filter(x => x.startsWith("FAIL ")).length;

  const output = [
    "iePDF MERGE PDF - COMPLETE FINAL FUNCTIONAL TEST V3",
    `Finished: ${new Date().toISOString()}`,
    "",
    "=== RESULTS ===",
    ...results,
    "",
    "=== CONSOLE ERRORS ===",
    ...(consoleErrors.length ? consoleErrors : ["NONE"]),
    "",
    "=== PAGE ERRORS ===",
    ...(pageErrors.length ? pageErrors : ["NONE"]),
    "",
    "=== FAILED REQUESTS ===",
    ...(failedRequests.length ? failedRequests : ["NONE"]),
    "",
    "=== PDF.JS WORKER RELATED ===",
    ...(workerErrors.length ? workerErrors : ["NONE"]),
    "",
    `SUMMARY PASS=${pass} FAIL=${fail}`
  ].join("\n");

  fs.writeFileSync(report, output, "utf8");

  console.log("");
  console.log(`SUMMARY PASS=${pass} FAIL=${fail}`);

  await browser.close();
  process.exitCode = fail === 0 ? 0 : 2;
})().catch(err => {
  console.error("FINAL_FUNCTIONAL_V3_FATAL");
  console.error(err?.stack || err?.message || err);
  process.exitCode = 3;
});
'@

    [System.IO.File]::WriteAllText(
        $Runner,
        $runnerText,
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host ""
    Write-Host "=== BROWSER FUNCTIONAL TEST V3 ==="

    Push-Location $Root
    & node $Runner $Report $A $B $C
    $exitCode = $LASTEXITCODE
    Pop-Location

    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "COMPLETE FINAL FUNCTIONAL TEST V3: PASS"
    }
    elseif ($exitCode -eq 2) {
        Write-Host ""
        Write-Host "COMPLETE FINAL FUNCTIONAL TEST V3: FAIL"
    }
    else {
        Write-Host ""
        Write-Host "COMPLETE FINAL FUNCTIONAL TEST V3: ERROR"
    }
}
catch {
    Write-Host ""
    Write-Host "COMPLETE FINAL FUNCTIONAL TEST V3 ERROR:"
    Write-Host $_.Exception.Message
}
finally {
    if (Test-Path -LiteralPath $Runner) {
        Remove-Item -LiteralPath $Runner -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "COMPLETE FINAL FUNCTIONAL TEST V3 COMPLETE"
    Write-Host "Report: $Report"
    Write-Host "NO SOURCE CHANGES"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"
    Write-Host "============================================================"
}
