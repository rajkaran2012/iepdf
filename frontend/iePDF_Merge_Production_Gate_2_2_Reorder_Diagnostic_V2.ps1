$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $RegDir "merge-reorder-gate-2.2-diagnostic-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-reorder-gate-2.2-runner-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null

Write-Host "============================================================"
Write-Host "iePDF MERGE PDF - GATE 2.2 REORDER DIAGNOSTIC V2"
Write-Host "============================================================"
Write-Host "Started: $(Get-Date)"
Write-Host "Root: $Root"
Write-Host ""
Write-Host "READ-ONLY BROWSER DIAGNOSTIC"
Write-Host "NO SOURCE CHANGES"
Write-Host "NO GIT"
Write-Host "NO DEPLOYMENT"
Write-Host "NO CACHE DELETION"

try {
    $component = Join-Path $Root "components\MergeWorkspace.tsx"
    $pageFile = Join-Path $Root "app\merge-pdf\page.tsx"

    if (-not (Test-Path -LiteralPath $component)) {
        throw "Canonical MergeWorkspace.tsx not found."
    }

    if (-not (Test-Path -LiteralPath $pageFile)) {
        throw "Merge page.tsx not found."
    }

    Write-Host ""
    Write-Host "=== SOURCE EVIDENCE (READ ONLY) ==="

    $ws = [System.IO.File]::ReadAllText(
        (Resolve-Path $component),
        [System.Text.UTF8Encoding]::new($false)
    )

    $page = [System.IO.File]::ReadAllText(
        (Resolve-Path $pageFile),
        [System.Text.UTF8Encoding]::new($false)
    )

    $checks = @(
        @{ Id = "SRC-01"; Text = "application/x-iepdf-reorder"; Desc = "internal reorder MIME marker" },
        @{ Id = "SRC-02"; Text = "setData(""application/x-iepdf-reorder"""; Desc = "drag start sets internal marker" },
        @{ Id = "SRC-03"; Text = "onReorderFiles"; Desc = "reorder callback exists" },
        @{ Id = "SRC-04"; Text = 'draggable=""true""'; Desc = "draggable handle attribute exists in source" },
        @{ Id = "SRC-05"; Text = 'aria-label=""Drag PDF'; Desc = "accessible drag handle label exists" }
    )

    foreach ($check in $checks) {
        $ok = $ws.Contains($check.Text)
        if ($ok) { $status = "PASS" } else { $status = "INFO" }
        Write-Host "$($check.Id) $status - $($check.Desc)"
    }

    if ($page.Contains("onReorderFiles")) {
        Write-Host "PAGE-01 PASS - merge page contains reorder callback"
    }
    else {
        Write-Host "PAGE-01 INFO - reorder callback text not found in page source"
    }

    # ------------------------------------------------------------
    # Browser runner
    # ------------------------------------------------------------

    $fixtures = @(Get-ChildItem -LiteralPath $RegDir -Filter "*.pdf" -File |
        Sort-Object Name)

    if ($fixtures.Count -lt 3) {
        throw "At least 3 PDF fixtures are required. Found $($fixtures.Count)."
    }

    $A = $fixtures[0].FullName
    $B = $fixtures[1].FullName
    $C = $fixtures[2].FullName

    $runnerText = @'
const { chromium } = require("playwright");
const fs = require("fs");

const report = process.argv[2];
const A = process.argv[3];
const B = process.argv[4];
const C = process.argv[5];

const names = [
  A.split(/[\\/]/).pop(),
  B.split(/[\\/]/).pop(),
  C.split(/[\\/]/).pop()
];

const results = [];
const pageErrors = [];
const failedRequests = [];
const consoleErrors = [];

function log(line) {
  results.push(line);
  console.log(line);
}

function verdict(id, ok, detail) {
  const line = `${ok ? "PASS" : "FAIL"} ${id} - ${detail}`;
  results.push(line);
  console.log(line);
}

async function waitForRows(page, count, timeout = 20000) {
  return page.waitForFunction(
    n => [...document.querySelectorAll("button")]
      .filter(b => /Remove PDF/i.test((b.innerText || "").trim()))
      .length >= n,
    count,
    { timeout }
  ).then(() => true).catch(() => false);
}

async function waitForNames(page, wanted, timeout = 20000) {
  return page.waitForFunction(
    list => {
      const text = document.body?.innerText || "";
      return list.every(n => text.includes(n));
    },
    wanted,
    { timeout }
  ).then(() => true).catch(() => false);
}

async function getOrder(page) {
  return await page.evaluate((wanted) => {
    const body = document.body?.innerText || "";
    return wanted.map(name => ({
      name,
      position: body.indexOf(name)
    }));
  }, names);
}

async function getRows(page) {
  return await page.evaluate(() => {
    const removeButtons = [...document.querySelectorAll("button")]
      .filter(b => /Remove PDF/i.test((b.innerText || "").trim()));

    return removeButtons.map((remove, index) => {
      let row = remove.parentElement;

      for (let i = 0; i < 8 && row; i++) {
        if (/\d+\s*Pages/i.test((row.innerText || "").trim())) break;
        row = row.parentElement;
      }

      const handle = row
        ? [...row.querySelectorAll('[draggable="true"]')]
            .find(el => {
              const aria = el.getAttribute("aria-label") || "";
              return /Drag PDF/i.test(aria);
            })
        : null;

      const hr = handle?.getBoundingClientRect();

      return {
        index,
        rowText: (row?.innerText || "").trim(),
        handle: handle ? {
          tag: handle.tagName,
          aria: handle.getAttribute("aria-label") || "",
          title: handle.getAttribute("title") || "",
          draggable: handle.getAttribute("draggable"),
          x: hr?.x ?? null,
          y: hr?.y ?? null,
          width: hr?.width ?? null,
          height: hr?.height ?? null
        } : null
      };
    });
  });
}

async function getHandle(page, index) {
  const rows = page.getByRole("button", { name: /Remove PDF/i });
  const remove = rows.nth(index);

  let row = remove.locator("..");
  for (let i = 0; i < 8; i++) {
    const txt = (await row.innerText().catch(() => "")).trim();
    if (/\d+\s*Pages/i.test(txt)) break;
    row = row.locator("..");
  }

  const handle = row.locator('[draggable="true"][aria-label*="Drag PDF"]').first();

  return handle;
}

async function rowTarget(page, index) {
  const rows = page.getByRole("button", { name: /Remove PDF/i });
  const remove = rows.nth(index);

  let row = remove.locator("..");
  for (let i = 0; i < 8; i++) {
    const txt = (await row.innerText().catch(() => "")).trim();
    if (/\d+\s*Pages/i.test(txt)) break;
    row = row.locator("..");
  }

  return row;
}

async function performDrag(page, fromIndex, toIndex, method) {
  const source = await getHandle(page, fromIndex);
  const target = await rowTarget(page, toIndex);

  if (await source.count() !== 1) {
    return { ok: false, reason: "source handle not uniquely found" };
  }

  if (await target.count() !== 1) {
    return { ok: false, reason: "target row not uniquely found" };
  }

  if (method === "dragTo") {
    await source.dragTo(target, { timeout: 15000 });
  }

  if (method === "manual") {
    const sb = await source.boundingBox();
    const tb = await target.boundingBox();

    if (!sb || !tb) {
      return { ok: false, reason: "bounding box unavailable" };
    }

    await page.mouse.move(
      sb.x + sb.width / 2,
      sb.y + sb.height / 2
    );
    await page.mouse.down();
    await page.waitForTimeout(300);

    await page.mouse.move(
      sb.x + sb.width / 2 + 25,
      sb.y + sb.height / 2 + 25,
      { steps: 8 }
    );

    await page.waitForTimeout(250);

    await page.mouse.move(
      tb.x + tb.width / 2,
      tb.y + Math.min(30, tb.height / 2),
      { steps: 20 }
    );

    await page.waitForTimeout(500);
    await page.mouse.up();
  }

  await page.waitForTimeout(1200);
  return { ok: true };
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

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

  await page.goto(
    `http://localhost:3000/merge-pdf?reorderGate22=${Date.now()}`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );

  await page.waitForTimeout(800);

  log(`ROUTE ${page.url()}`);
  log(`TITLE ${await page.title()}`);

  await page.locator('input[type="file"]').first().setInputFiles([A, B, C]);

  const loaded = await waitForNames(page, names);
  const rowsLoaded = await waitForRows(page, 3);

  verdict(
    "R0-01",
    loaded && rowsLoaded,
    "A+B+C loaded before reorder"
  );

  const initialRows = await getRows(page);
  log(`INITIAL_ROWS ${JSON.stringify(initialRows)}`);

  const initialOrder = await getOrder(page);
  log(`INITIAL_ORDER ${JSON.stringify(initialOrder)}`);

  // ------------------------------------------------------------
  // METHOD 1: Playwright locator.dragTo()
  // ------------------------------------------------------------

  log("");
  log("=== METHOD 1: PLAYWRIGHT locator.dragTo() ===");

  const drag1 = await performDrag(page, 2, 0, "dragTo");

  log(`DRAGTO_RESULT ${JSON.stringify(drag1)}`);

  const afterDragTo = await getOrder(page);
  log(`AFTER_DRAGTO_ORDER ${JSON.stringify(afterDragTo)}`);

  const dragToObserved =
    afterDragTo[2].position >= 0 &&
    afterDragTo[2].position < afterDragTo[0].position &&
    afterDragTo[0].position < afterDragTo[1].position;

  verdict(
    "R1-01",
    drag1.ok && dragToObserved,
    `C -> A using locator.dragTo(); observed=${dragToObserved}`
  );

  // ------------------------------------------------------------
  // Reset and METHOD 2: real mouse path against exact handle
  // ------------------------------------------------------------

  await page.goto(
    `http://localhost:3000/merge-pdf?reorderGate22Reset=${Date.now()}`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );

  await page.waitForTimeout(700);
  await page.locator('input[type="file"]').first().setInputFiles([A, B, C]);
  await waitForNames(page, names);
  await waitForRows(page, 3);
  await page.waitForTimeout(900);

  log("");
  log("=== METHOD 2: EXACT HANDLE MOUSE PATH ===");

  const drag2 = await performDrag(page, 2, 0, "manual");

  log(`MANUAL_RESULT ${JSON.stringify(drag2)}`);

  const afterManual = await getOrder(page);
  log(`AFTER_MANUAL_ORDER ${JSON.stringify(afterManual)}`);

  const manualObserved =
    afterManual[2].position >= 0 &&
    afterManual[2].position < afterManual[0].position &&
    afterManual[0].position < afterManual[1].position;

  verdict(
    "R2-01",
    drag2.ok && manualObserved,
    `C -> A using exact handle mouse path; observed=${manualObserved}`
  );

  const finalRows = await getRows(page);
  log(`FINAL_ROWS ${JSON.stringify(finalRows)}`);

  const finalBody = await page.evaluate(() => document.body?.innerText || "");
  const mergeButton = [...await page.locator("button").all()]
    .find(async () => false);

  const mergeDisabled = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")]
      .find(x => /Unlock\s*&\s*Merge/i.test((x.innerText || "").trim()));
    return b ? b.disabled : null;
  });

  verdict(
    "R3-01",
    finalRows.length === 3,
    `three PDF rows remain=${finalRows.length}`
  );

  verdict(
    "R3-02",
    mergeDisabled === false,
    `Merge enabled after diagnostic reorder=${mergeDisabled === false}`
  );

  verdict(
    "HEALTH-01",
    pageErrors.length === 0,
    `page errors=${pageErrors.length}`
  );

  verdict(
    "HEALTH-02",
    failedRequests.length === 0,
    `failed requests=${failedRequests.length}`
  );

  verdict(
    "HEALTH-03",
    consoleErrors.length === 0,
    `console errors=${consoleErrors.length}`
  );

  const pass = results.filter(x => x.startsWith("PASS ")).length;
  const fail = results.filter(x => x.startsWith("FAIL ")).length;

  const output = [
    "iePDF MERGE PDF - GATE 2.2 REORDER DIAGNOSTIC V2",
    `Finished: ${new Date().toISOString()}`,
    "",
    "=== RESULTS ===",
    ...results,
    "",
    "=== PAGE ERRORS ===",
    ...(pageErrors.length ? pageErrors : ["NONE"]),
    "",
    "=== FAILED REQUESTS ===",
    ...(failedRequests.length ? failedRequests : ["NONE"]),
    "",
    "=== CONSOLE ERRORS ===",
    ...(consoleErrors.length ? consoleErrors : ["NONE"]),
    "",
    `SUMMARY PASS=${pass} FAIL=${fail}`,
    "",
    "INTERPRETATION:",
    "R1-01 uses Playwright locator.dragTo() against the exact draggable PDF handle.",
    "R2-01 uses a mouse sequence against the exact draggable PDF handle.",
    "No application source instrumentation or source modification is performed."
  ].join("\n");

  fs.writeFileSync(report, output, "utf8");

  await browser.close();

  console.log("");
  console.log(`SUMMARY PASS=${pass} FAIL=${fail}`);
  console.log("GATE 2.2 DIAGNOSTIC COMPLETE");
  console.log(`Report: ${report}`);
  console.log("NO SOURCE CHANGES");
  console.log("NO GIT");
  console.log("NO DEPLOYMENT");
  console.log("NO CACHE DELETION");
})().catch(err => {
  console.error("GATE_2_2_FATAL");
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
    Write-Host "=== BROWSER APPLICATION REORDER DIAGNOSTIC V2 ==="

    Push-Location $Root
    & node $Runner $Report $A $B $C
    $exitCode = $LASTEXITCODE
    Pop-Location

    if ($exitCode -eq 0) {
        Write-Host "Gate 2.2 diagnostic runner completed."
    }
    else {
        Write-Host "Gate 2.2 diagnostic runner returned exit code $exitCode."
    }
}
catch {
    Write-Host ""
    Write-Host "GATE 2.2 ERROR:"
    Write-Host $_.Exception.Message
}
finally {
    if (Test-Path -LiteralPath $Runner) {
        Remove-Item -LiteralPath $Runner -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "GATE 2.2 REORDER DIAGNOSTIC V2 COMPLETE"
    Write-Host "Report: $Report"
    Write-Host "NO SOURCE CHANGES"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"
    Write-Host "============================================================"
}
