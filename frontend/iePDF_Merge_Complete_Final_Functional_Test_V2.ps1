$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $RegDir "merge-complete-final-functional-V2-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-complete-final-functional-V2-runner-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null

Write-Host "============================================================"
Write-Host "iePDF MERGE PDF - COMPLETE FINAL FUNCTIONAL TEST V2"
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
      hasA: false,
      hasB: false,
      hasC: false,
      total: Number((body.match(/Total\s*[\r\n]+(\d+)/) || [])[1] || -1),
      ready: Number((body.match(/Ready\s*[\r\n]+(\d+)/) || [])[1] || -1)
    };
  });
}

async function waitForNames(page, names, timeout = 15000) {
  return await page.waitForFunction(
    (wanted) => {
      const text = document.body?.innerText || "";
      return wanted.every(name => text.includes(name));
    },
    names,
    { timeout }
  ).then(() => true).catch(() => false);
}

async function waitForRows(page, minimum, timeout = 15000) {
  return await page.waitForFunction(
    (n) => {
      return document.querySelectorAll(
        'button'
      ).length >= 0 &&
      document.body?.innerText?.includes(`Files\n${n}`);
    },
    minimum,
    { timeout }
  ).then(() => true).catch(() => false);
}

async function fresh(page, tag) {
  await page.goto(
    `http://localhost:3000/merge-pdf?${tag}=${Date.now()}`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await page.waitForTimeout(600);
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

  // ------------------------------------------------------------
  // PRECHECK
  // ------------------------------------------------------------

  await fresh(page, "functionalV2");

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
  // TEST 1 - REPEATED ADD: A THEN B
  // ------------------------------------------------------------

  await add(page, [A]);

  const aAdded = await waitForNames(page, [AName]);

  s = await getState(page);

  record(
    "T1-01",
    aAdded && s.removeCount >= 1,
    `A added: ${AName}; remove controls=${s.removeCount}`
  );

  await add(page, [B]);

  const abAdded = await waitForNames(page, [AName, BName]);

  s = await getState(page);

  record(
    "T1-02",
    abAdded && s.removeCount >= 2,
    `A+B present; remove controls=${s.removeCount}`
  );

  await page.waitForTimeout(2500);
  s = await getState(page);

  record(
    "T1-03",
    s.mergeDisabled === false,
    `2-PDF Merge enabled=${!s.mergeDisabled}; total=${s.total}; ready=${s.ready}`
  );

  // ------------------------------------------------------------
  // TEST 2 - THREE PDFs IN ONE SELECTION
  // ------------------------------------------------------------

  await fresh(page, "threePdfV2");

  await add(page, [A, B, C]);

  const abcAdded = await waitForNames(page, [AName, BName, CName]);

  s = await getState(page);

  record(
    "T2-01",
    abcAdded && s.removeCount >= 3,
    `A+B+C present; remove controls=${s.removeCount}`
  );

  await page.waitForTimeout(2500);
  s = await getState(page);

  record(
    "T2-02",
    s.mergeDisabled === false,
    `3-PDF Merge enabled=${!s.mergeDisabled}; total=${s.total}; ready=${s.ready}`
  );

  // ------------------------------------------------------------
  // TEST 3 - REMOVE ONE, THEN ADD C
  // ------------------------------------------------------------

  await fresh(page, "removeAddV2");

  await add(page, [A, B]);
  await waitForNames(page, [AName, BName]);

  let removes = page.getByRole("button", { name: /Remove PDF/i });
  const beforeRemove = await removes.count();

  if (beforeRemove > 0) {
    await removes.first().click();
  }

  await page.waitForTimeout(800);

  s = await getState(page);

  record(
    "T3-01",
    beforeRemove >= 2 && s.removeCount === 1,
    `one PDF remains after remove; remove controls=${s.removeCount}`
  );

  await add(page, [C]);
  const cAddedAfterRemove = await waitForNames(page, [CName]);

  s = await getState(page);

  record(
    "T3-02",
    cAddedAfterRemove && s.removeCount >= 2,
    `C added after removal; remove controls=${s.removeCount}`
  );

  // ------------------------------------------------------------
  // TEST 4 - REMOVE ALL -> EMPTY
  // ------------------------------------------------------------

  removes = page.getByRole("button", { name: /Remove PDF/i });

  while (await removes.count() > 0) {
    await removes.first().click();
    await page.waitForTimeout(450);
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

  const readded = await waitForNames(page, [AName, BName, CName]);

  await page.waitForTimeout(2000);
  s = await getState(page);

  record(
    "T5-01",
    readded && s.removeCount >= 3,
    `A+B+C re-added after empty; remove controls=${s.removeCount}`
  );

  record(
    "T5-02",
    s.mergeDisabled === false,
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
  // HEALTH - captured separately from functional behavior
  // ------------------------------------------------------------

  record(
    "HEALTH-01",
    pageErrors.length === 0,
    `page errors=${pageErrors.length}`
  );

  record(
    "HEALTH-02",
    failedRequests.length === 0,
    `failed requests=${failedRequests.length}`
  );

  record(
    "HEALTH-03",
    consoleErrors.length === 0,
    `console errors=${consoleErrors.length}`
  );

  const pass = results.filter(x => x.startsWith("PASS ")).length;
  const fail = results.filter(x => x.startsWith("FAIL ")).length;

  const output = [
    "iePDF MERGE PDF - COMPLETE FINAL FUNCTIONAL TEST V2",
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
    `SUMMARY PASS=${pass} FAIL=${fail}`
  ].join("\n");

  fs.writeFileSync(report, output, "utf8");

  console.log("");
  console.log(`SUMMARY PASS=${pass} FAIL=${fail}`);

  await browser.close();

  process.exitCode = fail === 0 ? 0 : 2;
})().catch(err => {
  console.error("FINAL_FUNCTIONAL_V2_FATAL");
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
    Write-Host "=== BROWSER FUNCTIONAL TEST V2 ==="

    Push-Location $Root
    & node $Runner $Report $A $B $C
    $exitCode = $LASTEXITCODE
    Pop-Location

    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "COMPLETE FINAL FUNCTIONAL TEST V2: PASS"
    }
    elseif ($exitCode -eq 2) {
        Write-Host ""
        Write-Host "COMPLETE FINAL FUNCTIONAL TEST V2: FAIL"
    }
    else {
        Write-Host ""
        Write-Host "COMPLETE FINAL FUNCTIONAL TEST V2: ERROR"
    }
}
catch {
    Write-Host ""
    Write-Host "COMPLETE FINAL FUNCTIONAL TEST V2 ERROR:"
    Write-Host $_.Exception.Message
}
finally {
    if (Test-Path -LiteralPath $Runner) {
        Remove-Item -LiteralPath $Runner -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "COMPLETE FINAL FUNCTIONAL TEST V2 COMPLETE"
    Write-Host "Report: $Report"
    Write-Host "NO SOURCE CHANGES"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"
    Write-Host "============================================================"
}
