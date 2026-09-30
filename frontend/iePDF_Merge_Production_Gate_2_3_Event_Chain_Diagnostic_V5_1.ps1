$ErrorActionPreference = "Stop"

$Root = "C:\IEPDF\frontend"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $RegDir "merge-reorder-gate-2.3-event-chain-v5-fixed-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-reorder-gate-2.3-event-chain-v5-fixed-$Stamp.cjs"

$Component = Join-Path $Root "components\MergeWorkspace.tsx"
$PageFile = Join-Path $Root "app\merge-pdf\page.tsx"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "============================================================"
Write-Host "iePDF MERGE PDF - GATE 2.3 EVENT -> CALLBACK CHAIN V5 FIXED"
Write-Host "============================================================"
Write-Host "Diagnostic-only temporary instrumentation"
Write-Host "Original source will be restored automatically"
Write-Host "NO GIT / NO DEPLOYMENT / NO CACHE DELETION"
Write-Host ""

if (-not (Test-Path $Component)) { throw "MergeWorkspace.tsx not found." }
if (-not (Test-Path $PageFile)) { throw "app/merge-pdf/page.tsx not found." }

$WsOriginal = [System.IO.File]::ReadAllText((Resolve-Path $Component), $Utf8NoBom)
$PageOriginal = [System.IO.File]::ReadAllText((Resolve-Path $PageFile), $Utf8NoBom)

$WsPatched = $false
$PagePatched = $false

try {
    Write-Host "=== DISCOVERING CURRENT SOURCE SHAPES ==="

    $wsDragStartPattern = '(?s)(const\s+handleDragStart\s*=\s*\(\s*event:\s*React\.DragEvent<HTMLDivElement>,\s*id:\s*string\s*\)\s*=>\s*\{\s*)'
    $wsDropPattern = '(?s)(const\s+handleDrop\s*=\s*\(\s*event:\s*React\.DragEvent<HTMLDivElement>,\s*targetId:\s*string\s*\)\s*=>\s*\{\s*)'
    $wsCallbackPattern = '(?s)(onReorderFiles\(\s*draggedId,\s*targetId\s*\);)'

    $pageCallbackPattern = '(?s)(const\s+handleReorderFiles\s*=\s*\(\s*draggedId:\s*string,\s*targetId:\s*string\s*\)\s*=>\s*\{\s*)'
    $pageStatePattern = '(?s)(setWorkspaceFiles\(\s*\(previous\)\s*=>\s*\{\s*)'
    $pageReturnPattern = '(?s)(return\s+updated;\s*)'

    foreach ($item in @(
        @{Name="WS dragStart"; Text=$WsOriginal; Pattern=$wsDragStartPattern},
        @{Name="WS drop"; Text=$WsOriginal; Pattern=$wsDropPattern},
        @{Name="WS callback"; Text=$WsOriginal; Pattern=$wsCallbackPattern},
        @{Name="PAGE callback"; Text=$PageOriginal; Pattern=$pageCallbackPattern},
        @{Name="PAGE state"; Text=$PageOriginal; Pattern=$pageStatePattern},
        @{Name="PAGE return"; Text=$PageOriginal; Pattern=$pageReturnPattern}
    )) {
        $count = ([regex]::Matches($item.Text, $item.Pattern)).Count
        Write-Host "$($item.Name): $count"
        if ($count -ne 1) {
            throw "Expected exactly one $($item.Name) marker; found $count."
        }
    }

    Write-Host ""
    Write-Host "=== APPLYING TEMPORARY INSTRUMENTATION ==="

    $WsPatchedText = [regex]::Replace(
        $WsOriginal,
        $wsDragStartPattern,
        '$1        console.log("IEPDF_V23|DRAG_START|" + JSON.stringify({id, typesBefore: Array.from(event.dataTransfer.types)}));' + "`r`n",
        1
    )

    $WsPatchedText = [regex]::Replace(
        $WsPatchedText,
        $wsDropPattern,
        '$1        console.log("IEPDF_V23|DROP_ENTER|" + JSON.stringify({targetId, types: Array.from(event.dataTransfer.types), text: event.dataTransfer.getData("text/plain"), draggedFileId}));' + "`r`n",
        1
    )

    $WsPatchedText = [regex]::Replace(
        $WsPatchedText,
        $wsCallbackPattern,
        'console.log("IEPDF_V23|CHILD_CALLBACK|" + JSON.stringify({draggedId, targetId}));' + "`r`n        " + '$1',
        1
    )

    $PagePatchedText = [regex]::Replace(
        $PageOriginal,
        $pageCallbackPattern,
        '$1        console.log("IEPDF_V23|PARENT_CALLBACK|" + JSON.stringify({draggedId, targetId}));' + "`r`n",
        1
    )

    # Find the setWorkspaceFiles call that occurs after handleReorderFiles.
    $cb = [regex]::Match($PageOriginal, $pageCallbackPattern)
    if (-not $cb.Success) { throw "Could not locate handleReorderFiles for state instrumentation." }

    $tail = $PageOriginal.Substring($cb.Index + $cb.Length)
    $sm = [regex]::Match($tail, $pageStatePattern)
    if (-not $sm.Success) { throw "Could not locate reorder setWorkspaceFiles." }

    $stateAbs = $cb.Index + $cb.Length + $sm.Index
    $stateText = $sm.Value
    $stateLog = '            console.log("IEPDF_V23|STATE_PREVIOUS|" + JSON.stringify({order: previous.map((file) => ({id: file.id, name: file.name})), draggedId, targetId}));' + "`r`n"

    $PagePatchedText =
        $PageOriginal.Substring(0, $stateAbs) +
        $stateText +
        $stateLog +
        $PageOriginal.Substring($stateAbs + $stateText.Length)

    # Find return updated after the reorder state call.
    $tail2 = $PagePatchedText.Substring($stateAbs + $stateText.Length + $stateLog.Length)
    $rm = [regex]::Match($tail2, $pageReturnPattern)
    if (-not $rm.Success) { throw "Could not locate reorder return updated." }

    $returnAbs = $stateAbs + $stateText.Length + $stateLog.Length + $rm.Index
    $returnText = $rm.Value
    $returnLog = '            console.log("IEPDF_V23|STATE_NEXT|" + JSON.stringify({order: updated.map((file) => ({id: file.id, name: file.name}))}));' + "`r`n"

    $PagePatchedText =
        $PagePatchedText.Substring(0, $returnAbs) +
        $returnLog +
        $returnText +
        $PagePatchedText.Substring($returnAbs + $returnText.Length)

    [System.IO.File]::WriteAllText($Component, $WsPatchedText, $Utf8NoBom)
    $WsPatched = $true
    [System.IO.File]::WriteAllText($PageFile, $PagePatchedText, $Utf8NoBom)
    $PagePatched = $true

    Write-Host "Temporary instrumentation applied."
    Write-Host ""

    Write-Host "=== TYPECHECK TEMPORARY BUILD ==="
    Push-Location $Root
    & pnpm exec tsc --noEmit
    $tsExit = $LASTEXITCODE
    Pop-Location
    if ($tsExit -ne 0) {
        throw "TypeScript failed after temporary instrumentation."
    }
    Write-Host "TypeScript PASS."
    Write-Host ""

    $fixtures = @(Get-ChildItem -LiteralPath $RegDir -Filter "*.pdf" -File | Sort-Object Name)
    if ($fixtures.Count -lt 3) {
        throw "Need at least 3 PDF fixtures in $RegDir. Found $($fixtures.Count)."
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

const lines = [];
const appLogs = [];
const pageErrors = [];
const failedRequests = [];

function log(s) {
  lines.push(s);
  console.log(s);
}

(async () => {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chromePath)) {
    throw new Error("Google Chrome not found: " + chromePath);
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  page.on("console", msg => {
    const t = msg.text();
    if (t.includes("IEPDF_V23|")) {
      appLogs.push(t);
      log("APP " + t);
    }
  });

  page.on("pageerror", e => pageErrors.push(String(e?.stack || e)));
  page.on("requestfailed", r => {
    failedRequests.push(
      `${r.method()} ${r.url()} :: ${r.failure()?.errorText || "unknown"}`
    );
  });

  await page.goto(
    `http://localhost:3000/merge-pdf?gate23v5fixed=${Date.now()}`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );

  await page.waitForTimeout(1200);

  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles([A, B, C]);

  await page.waitForFunction(
    wanted => {
      const t = document.body?.innerText || "";
      return wanted.every(n => t.includes(n));
    },
    names,
    { timeout: 20000 }
  );

  await page.waitForFunction(
    () => [...document.querySelectorAll("button")]
      .filter(b => /Remove PDF/i.test((b.innerText || "").trim())).length >= 3,
    { timeout: 20000 }
  );

  const removeButtons = page.getByRole("button", { name: /Remove PDF/i });

  async function rowFor(index) {
    let row = removeButtons.nth(index).locator("..");
    for (let i = 0; i < 10; i++) {
      const txt = await row.innerText().catch(() => "");
      if (/\d+\s*Pages/i.test(txt)) return row;
      row = row.locator("..");
    }
    throw new Error("Could not locate row " + index);
  }

  const rows = [
    await rowFor(0),
    await rowFor(1),
    await rowFor(2)
  ];

  const handles = rows.map(row =>
    row.locator('[draggable="true"][aria-label*="Drag PDF"]').first()
  );

  log("=== PRE-DRAG ===");

  const beforeText = await page.locator("body").innerText();
  const beforeOrder = names.map(n => ({
    name: n,
    position: beforeText.indexOf(n)
  }));
  log("BEFORE_ORDER " + JSON.stringify(beforeOrder));

  for (let i = 0; i < handles.length; i++) {
    log("HANDLE_" + i + " " + JSON.stringify(
      await handles[i].evaluate(el => {
        const r = el.getBoundingClientRect();
        return {
          draggable: el.getAttribute("draggable"),
          aria: el.getAttribute("aria-label"),
          title: el.getAttribute("title"),
          x: r.x, y: r.y, w: r.width, h: r.height
        };
      })
    ));
  }

  await page.evaluate(() => {
    window.__IEPDF_V23_EVENTS = [];

    const push = (event, node) => {
      let types = [];
      let text = "";
      try {
        if (event.dataTransfer) {
          types = Array.from(event.dataTransfer.types);
          text = event.dataTransfer.getData("text/plain");
        }
      } catch (_) {}

      const el = event.target instanceof Element ? event.target : null;
      const handle = el?.closest?.('[draggable="true"][aria-label*="Drag PDF"]');

      window.__IEPDF_V23_EVENTS.push({
        event: event.type,
        node,
        aria: handle?.getAttribute("aria-label") || null,
        types,
        text,
        defaultPrevented: event.defaultPrevented,
        time: Math.round(performance.now())
      });
    };

    for (const eventName of [
      "dragstart", "dragenter", "dragover",
      "dragleave", "drop", "dragend"
    ]) {
      document.addEventListener(eventName, event => {
        const el = event.target instanceof Element ? event.target : null;
        const handle = el?.closest?.('[draggable="true"][aria-label*="Drag PDF"]');
        push(event, handle ? "HANDLE" : "OTHER");
      }, true);
    }
  });

  log("=== DRAG C -> A ===");

  try {
    await handles[2].dragTo(rows[0], { timeout: 15000 });
    log("DRAGTO_RESULT true");
  } catch (e) {
    log("DRAGTO_RESULT false " + String(e?.message || e));
  }

  await page.waitForTimeout(1500);

  const events = await page.evaluate(() => window.__IEPDF_V23_EVENTS || []);

  log("=== NATIVE EVENT TRACE ===");
  for (const event of events) {
    log("EVENT " + JSON.stringify(event));
  }

  log("=== APPLICATION CALLBACK TRACE ===");
  log("APP_LOG_COUNT " + appLogs.length);
  for (const item of appLogs) {
    log("APP_TRACE " + item);
  }

  const afterText = await page.locator("body").innerText();
  const afterOrder = names.map(n => ({
    name: n,
    position: afterText.indexOf(n)
  }));
  log("AFTER_ORDER " + JSON.stringify(afterOrder));

  const expected =
    afterOrder[2].position >= 0 &&
    afterOrder[0].position >= 0 &&
    afterOrder[1].position >= 0 &&
    afterOrder[2].position < afterOrder[0].position &&
    afterOrder[0].position < afterOrder[1].position;

  log("EXPECTED_C_A_B " + String(expected));

  const finalRows = await page.getByRole("button", { name: /Remove PDF/i }).count();
  log("FINAL_ROW_COUNT " + finalRows);
  log("PAGE_ERRORS " + JSON.stringify(pageErrors));
  log("FAILED_REQUESTS " + JSON.stringify(failedRequests));

  fs.writeFileSync(
    report,
    [
      "iePDF MERGE PDF - GATE 2.3 EVENT -> CALLBACK CHAIN V5 FIXED",
      "",
      ...lines,
      "",
      "APP LOGS:",
      ...(appLogs.length ? appLogs : ["NONE"]),
      "",
      "PAGE ERRORS:",
      ...(pageErrors.length ? pageErrors : ["NONE"]),
      "",
      "FAILED REQUESTS:",
      ...(failedRequests.length ? failedRequests : ["NONE"])
    ].join("\n"),
    "utf8"
  );

  await browser.close();

  console.log("");
  console.log("GATE 2.3 V5 FIXED COMPLETE");
  console.log("Expected reorder observed: " + expected);
  console.log("Report: " + report);
  console.log("NO SOURCE CHANGES RETAINED");
})().catch(e => {
  console.error("GATE_2_3_V5_FIXED_FATAL");
  console.error(e?.stack || e);
  process.exitCode = 3;
});
'@

    [System.IO.File]::WriteAllText($Runner, $runnerText, $Utf8NoBom)

    Write-Host "=== RUNNING BROWSER EVENT-CHAIN TEST ==="
    Push-Location $Root
    & node $Runner $Report $A $B $C
    $runnerExit = $LASTEXITCODE
    Pop-Location

    if ($runnerExit -ne 0) {
        throw "Browser diagnostic runner failed. Report: $Report"
    }
}
finally {
    Write-Host ""
    Write-Host "=== RESTORING ORIGINAL SOURCE ==="

    if ($WsPatched) {
        [System.IO.File]::WriteAllText($Component, $WsOriginal, $Utf8NoBom)
        Write-Host "Restored components\MergeWorkspace.tsx"
    }

    if ($PagePatched) {
        [System.IO.File]::WriteAllText($PageFile, $PageOriginal, $Utf8NoBom)
        Write-Host "Restored app\merge-pdf\page.tsx"
    }

    if (Test-Path $Runner) {
        Remove-Item $Runner -Force -ErrorAction SilentlyContinue
    }

    Write-Host "=== POST-RESTORE TYPECHECK ==="
    Push-Location $Root
    & pnpm exec tsc --noEmit
    $restoreExit = $LASTEXITCODE
    Pop-Location

    if ($restoreExit -ne 0) {
        throw "POST-RESTORE TYPESCRIPT FAILED. STOP."
    }

    Write-Host "Post-restore TypeScript PASS."
}

Write-Host ""
Write-Host "============================================================"
Write-Host "GATE 2.3 V5 FIXED FINISHED"
Write-Host "Report: $Report"
Write-Host "SOURCE RESTORED"
Write-Host "NO GIT / NO DEPLOYMENT / NO CACHE DELETION"
Write-Host "============================================================"
