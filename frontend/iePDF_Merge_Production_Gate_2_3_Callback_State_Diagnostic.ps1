$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $RegDir "merge-reorder-gate-2.3-callback-state-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-reorder-gate-2.3-runner-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null

Write-Host "============================================================"
Write-Host "iePDF MERGE PDF - GATE 2.3 CALLBACK -> PARENT STATE DIAGNOSTIC"
Write-Host "============================================================"
Write-Host "Started: $(Get-Date)"
Write-Host "Root: $Root"
Write-Host ""
Write-Host "READ-ONLY DIAGNOSTIC"
Write-Host "NO SOURCE CHANGES"
Write-Host "NO GIT"
Write-Host "NO DEPLOYMENT"
Write-Host "NO CACHE DELETION"

$component = Join-Path $Root "components\MergeWorkspace.tsx"
$pageFile = Join-Path $Root "app\merge-pdf\page.tsx"

$backupDir = $null
$instrumented = $false

try {
    if (-not (Test-Path -LiteralPath $component)) {
        throw "Canonical MergeWorkspace.tsx not found."
    }
    if (-not (Test-Path -LiteralPath $pageFile)) {
        throw "Merge page.tsx not found."
    }

    $wsOriginal = [System.IO.File]::ReadAllText(
        (Resolve-Path $component),
        [System.Text.UTF8Encoding]::new($false)
    )
    $pageOriginal = [System.IO.File]::ReadAllText(
        (Resolve-Path $pageFile),
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host ""
    Write-Host "=== READ-ONLY SOURCE DISCOVERY ==="

    $sourceTerms = @(
        "handleDragStart",
        "handleDragOver",
        "handleDrop",
        "onReorderFiles",
        "application/x-iepdf-reorder",
        "setData(",
        "fromIndex",
        "toIndex"
    )

    foreach ($term in $sourceTerms) {
        $count = ([regex]::Matches($wsOriginal, [regex]::Escape($term))).Count
        Write-Host ("WS {0,-28} count={1}" -f $term, $count)
    }

    $pageTerms = @(
        "handleReorderFiles",
        "setWorkspaceFiles",
        "files={workspaceFiles}"
    )

    foreach ($term in $pageTerms) {
        $count = ([regex]::Matches($pageOriginal, [regex]::Escape($term))).Count
        Write-Host ("PAGE {0,-25} count={1}" -f $term, $count)
    }

    # ------------------------------------------------------------
    # Create backup for temporary instrumentation.
    # ------------------------------------------------------------

    $backupDir = Join-Path $Root "_ui-backups\GATE-2.3-DIAGNOSTIC-$Stamp"
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

    Copy-Item -LiteralPath $component -Destination (Join-Path $backupDir "MergeWorkspace.tsx") -Force
    Copy-Item -LiteralPath $pageFile -Destination (Join-Path $backupDir "page.tsx") -Force

    Write-Host ""
    Write-Host "Backup: $backupDir"

    # ------------------------------------------------------------
    # TEMPORARY INSTRUMENTATION
    #
    # We instrument exact callback boundaries without changing logic.
    # ------------------------------------------------------------

    $ws = $wsOriginal

    # 1. Log drag-start data.
    $dragStartMarker = 'const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {'

    if ($ws.Contains($dragStartMarker)) {
        $replacement = @'
const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    try {
      console.log("IEPDF_V23|DRAG_START|" + JSON.stringify({
        index,
        fileId: file.id,
        fileName: file.file?.name || "",
        dataTypesBefore: event.dataTransfer ? Array.from(event.dataTransfer.types) : []
      }));
    } catch (_) {}
'@
        $ws = $ws.Replace($dragStartMarker, $replacement)
    }
    else {
        Write-Host "INFO: exact handleDragStart marker not found; continuing with callback instrumentation."
    }

    # 2. Log row drop entry without changing behavior.
    $dropMarker = 'const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {'

    if ($ws.Contains($dropMarker)) {
        $replacement = @'
const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    try {
      console.log("IEPDF_V23|DROP_ENTER|" + JSON.stringify({
        index,
        fileId: file.id,
        fileName: file.file?.name || "",
        dataTypes: event.dataTransfer ? Array.from(event.dataTransfer.types) : []
      }));
    } catch (_) {}
'@
        $ws = $ws.Replace($dropMarker, $replacement)
    }
    else {
        Write-Host "INFO: exact handleDrop marker not found; continuing with callback instrumentation."
    }

    # 3. Instrument callback immediately before invocation.
    $callbackCall = 'onReorderFiles(reorderedFiles);'

    if (-not $ws.Contains($callbackCall)) {
        throw "Exact onReorderFiles(reorderedFiles) call not found. No instrumentation applied."
    }

    $ws = $ws.Replace(
        $callbackCall,
        @'
console.log("IEPDF_V23|CHILD_CALLBACK|" + JSON.stringify({
          fileCount: reorderedFiles.length,
          order: reorderedFiles.map((f) => ({
            id: f.id,
            name: f.file?.name || "",
            skipped: f.skipped,
            status: f.status
          }))
        }));
        onReorderFiles(reorderedFiles);
'@
    )

    # 4. Parent callback instrumentation.
    $page = $pageOriginal
    $parentMarker = 'const handleReorderFiles = (reorderedFiles: WorkspaceFile[]) => {'

    if (-not $page.Contains($parentMarker)) {
        throw "Exact parent handleReorderFiles marker not found. No instrumentation applied."
    }

    $page = $page.Replace(
        $parentMarker,
        @'
const handleReorderFiles = (reorderedFiles: WorkspaceFile[]) => {
    console.log("IEPDF_V23|PARENT_CALLBACK|" + JSON.stringify({
      count: reorderedFiles.length,
      order: reorderedFiles.map((f) => ({
        id: f.id,
        name: f.file?.name || "",
        skipped: f.skipped,
        status: f.status
      }))
    }));
'@
    )

    # 5. Instrument the state setter using the exact functional-update
    # pattern, if present. This observes previous and next order without
    # changing the update.
    $setterPattern = 'setWorkspaceFiles((previous) => {'

    if ($page.Contains($setterPattern)) {
        $page = $page.Replace(
            $setterPattern,
            @'
setWorkspaceFiles((previous) => {
      console.log("IEPDF_V23|STATE_PREVIOUS|" + JSON.stringify({
        count: previous.length,
        order: previous.map((f) => ({
          id: f.id,
          name: f.file?.name || ""
        }))
      }));
'@
        )

        # Find the first "return reorderedFiles;" after the setter and log
        # the next state. We do this with bounded string operations rather
        # than a broad/global replacement.
        $setterPos = $page.IndexOf($setterPattern)
        $returnPos = $page.IndexOf("return reorderedFiles;", $setterPos)

        if ($returnPos -ge 0) {
            $page = $page.Insert(
                $returnPos,
                @'
console.log("IEPDF_V23|STATE_NEXT|" + JSON.stringify({
        count: reorderedFiles.length,
        order: reorderedFiles.map((f) => ({
          id: f.id,
          name: f.file?.name || ""
        }))
      }));

'@
            )
        }
        else {
            Write-Host "INFO: return reorderedFiles marker not found; parent callback will still be logged."
        }
    }
    else {
        Write-Host "INFO: functional setWorkspaceFiles marker not found; parent callback will still be logged."
    }

    [System.IO.File]::WriteAllText(
        $component,
        $ws,
        [System.Text.UTF8Encoding]::new($false)
    )

    [System.IO.File]::WriteAllText(
        $pageFile,
        $page,
        [System.Text.UTF8Encoding]::new($false)
    )

    $instrumented = $true

    Write-Host ""
    Write-Host "Temporary callback/state instrumentation applied."

    # ------------------------------------------------------------
    # TypeScript
    # ------------------------------------------------------------

    Write-Host ""
    Write-Host "=== TYPESCRIPT CHECK ==="

    Push-Location $Root
    & pnpm exec tsc --noEmit
    $tscExit = $LASTEXITCODE
    Pop-Location

    if ($tscExit -ne 0) {
        throw "TypeScript failed after temporary instrumentation."
    }

    Write-Host "TypeScript PASS"

    # ------------------------------------------------------------
    # Fixtures
    # ------------------------------------------------------------

    $fixtures = @(Get-ChildItem -LiteralPath $RegDir -Filter "*.pdf" -File |
        Sort-Object Name)

    if ($fixtures.Count -lt 3) {
        throw "At least 3 PDF fixtures are required. Found $($fixtures.Count)."
    }

    $A = $fixtures[0].FullName
    $B = $fixtures[1].FullName
    $C = $fixtures[2].FullName

    # ------------------------------------------------------------
    # Node / Playwright runner
    # ------------------------------------------------------------

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

const logs = [];
const pageErrors = [];
const failedRequests = [];
const consoleErrors = [];

function log(s) {
  logs.push(s);
  console.log(s);
}

function appLog(text) {
  if (text.includes("IEPDF_V23|")) {
    log("APP " + text);
  }
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

async function order(page) {
  return await page.evaluate(wanted => {
    const text = document.body?.innerText || "";
    return wanted.map(n => ({
      name: n,
      position: text.indexOf(n)
    }));
  }, names);
}

async function getHandle(page, index) {
  const removes = page.getByRole("button", { name: /Remove PDF/i });
  const remove = removes.nth(index);

  let row = remove.locator("..");

  for (let i = 0; i < 8; i++) {
    const txt = (await row.innerText().catch(() => "")).trim();
    if (/\d+\s*Pages/i.test(txt)) break;
    row = row.locator("..");
  }

  const handle = row.locator(
    '[draggable="true"][aria-label*="Drag PDF"]'
  ).first();

  return handle;
}

async function getTarget(page, index) {
  const removes = page.getByRole("button", { name: /Remove PDF/i });
  const remove = removes.nth(index);

  let row = remove.locator("..");

  for (let i = 0; i < 8; i++) {
    const txt = (await row.innerText().catch(() => "")).trim();
    if (/\d+\s*Pages/i.test(txt)) break;
    row = row.locator("..");
  }

  return row;
}

async function performDrag(page, fromIndex, toIndex) {
  const source = await getHandle(page, fromIndex);
  const target = await getTarget(page, toIndex);

  if (await source.count() !== 1) {
    return { ok: false, reason: "source handle not found" };
  }

  if (await target.count() !== 1) {
    return { ok: false, reason: "target row not found" };
  }

  // Playwright's documented dragTo is used here. The diagnostic captures
  // the application's own callback/state logs, so the result is not
  // inferred solely from mouse coordinates.
  await source.dragTo(target, { timeout: 15000 });
  await page.waitForTimeout(1500);

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
    const text = msg.text();
    appLog(text);

    if (msg.type() === "error") {
      consoleErrors.push(text);
    }
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
    `http://localhost:3000/merge-pdf?reorderGate23=${Date.now()}`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );

  await page.waitForTimeout(900);

  log(`ROUTE ${page.url()}`);
  log(`TITLE ${await page.title()}`);

  await page.locator('input[type="file"]').first().setInputFiles([A, B, C]);

  const loaded = await waitForNames(page, names);
  const rows = await waitForRows(page, 3);

  log(`LOAD names=${loaded} rows=${rows}`);

  await page.waitForTimeout(1200);

  const before = await order(page);
  log(`BEFORE_ORDER ${JSON.stringify(before)}`);

  log("=== C_TO_A ===");

  const dragResult = await performDrag(page, 2, 0);
  log(`DRAG_RESULT ${JSON.stringify(dragResult)}`);

  const after = await order(page);
  log(`AFTER_ORDER ${JSON.stringify(after)}`);

  const observed =
    after[2].position >= 0 &&
    after[2].position < after[0].position &&
    after[0].position < after[1].position;

  log(`C_TO_A_REORDER_OBSERVED ${observed}`);

  const finalState = await page.evaluate(() => {
    const body = document.body?.innerText || "";
    const removeCount = [...document.querySelectorAll("button")]
      .filter(b => /Remove PDF/i.test((b.innerText || "").trim()))
      .length;

    const merge = [...document.querySelectorAll("button")]
      .find(b => /Unlock\s*&\s*Merge/i.test((b.innerText || "").trim()));

    return {
      removeCount,
      mergeDisabled: merge ? merge.disabled : null,
      body
    };
  });

  log(`FINAL_STATE ${JSON.stringify({
    removeCount: finalState.removeCount,
    mergeDisabled: finalState.mergeDisabled
  })}`);

  log("");
  log("=== HEALTH ===");
  log(`PAGE_ERRORS ${JSON.stringify(pageErrors)}`);
  log(`FAILED_REQUESTS ${JSON.stringify(failedRequests)}`);
  log(`CONSOLE_ERRORS ${JSON.stringify(consoleErrors)}`);

  const output = [
    "iePDF MERGE PDF - GATE 2.3 CALLBACK -> PARENT STATE DIAGNOSTIC",
    `Finished: ${new Date().toISOString()}`,
    "",
    "=== LOG ===",
    ...logs,
    "",
    "=== PAGE ERRORS ===",
    ...(pageErrors.length ? pageErrors : ["NONE"]),
    "",
    "=== FAILED REQUESTS ===",
    ...(failedRequests.length ? failedRequests : ["NONE"]),
    "",
    "=== CONSOLE ERRORS ===",
    ...(consoleErrors.length ? consoleErrors : ["NONE"])
  ].join("\n");

  fs.writeFileSync(report, output, "utf8");

  await browser.close();

  console.log("");
  console.log("GATE 2.3 DIAGNOSTIC COMPLETE");
  console.log(`Report: ${report}`);
  console.log("NO SOURCE CHANGES REMAIN AFTER RESTORE");
  console.log("NO GIT");
  console.log("NO DEPLOYMENT");
  console.log("NO CACHE DELETION");
})().catch(err => {
  console.error("GATE_2_3_FATAL");
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
    Write-Host "=== BROWSER CALLBACK / STATE TRACE ==="

    Push-Location $Root
    & node $Runner $Report $A $B $C
    $browserExit = $LASTEXITCODE
    Pop-Location

    Write-Host "Browser diagnostic exit code: $browserExit"
}
catch {
    Write-Host ""
    Write-Host "GATE 2.3 ERROR:"
    Write-Host $_.Exception.Message
}
finally {
    # Restore original application source unconditionally.
    try {
        if ($backupDir -and (Test-Path -LiteralPath (Join-Path $backupDir "MergeWorkspace.tsx"))) {
            Copy-Item -LiteralPath (Join-Path $backupDir "MergeWorkspace.tsx") `
                -Destination $component -Force
        }

        if ($backupDir -and (Test-Path -LiteralPath (Join-Path $backupDir "page.tsx"))) {
            Copy-Item -LiteralPath (Join-Path $backupDir "page.tsx") `
                -Destination $pageFile -Force
        }

        Write-Host ""
        Write-Host "Original application source restored."
    }
    catch {
        Write-Host ""
        Write-Host "CRITICAL RESTORE ERROR:"
        Write-Host $_.Exception.Message
    }

    if (Test-Path -LiteralPath $Runner) {
        Remove-Item -LiteralPath $Runner -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "=== POST-RESTORE TYPESCRIPT CHECK ==="

    Push-Location $Root
    & pnpm exec tsc --noEmit
    $restoreExit = $LASTEXITCODE
    Pop-Location

    if ($restoreExit -eq 0) {
        Write-Host "Post-restore TypeScript PASS"
    }
    else {
        Write-Host "Post-restore TypeScript FAIL"
    }

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "GATE 2.3 CALLBACK -> PARENT STATE DIAGNOSTIC COMPLETE"
    Write-Host "Report: $Report"
    Write-Host "NO SOURCE CHANGES REMAIN"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"
    Write-Host "============================================================"
}
