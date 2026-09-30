$ErrorActionPreference = "Stop"

$Root = "C:\IEPDF\frontend"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $RegDir "merge-reorder-gate-2.3-event-chain-v5-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-reorder-gate-2.3-event-chain-v5-$Stamp.cjs"

$Component = Join-Path $Root "components\MergeWorkspace.tsx"
$PageFile = Join-Path $Root "app\merge-pdf\page.tsx"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null

Write-Host "============================================================"
Write-Host "iePDF MERGE PDF - GATE 2.3 EVENT -> CALLBACK CHAIN V5"
Write-Host "============================================================"
Write-Host "TEMPORARY DIAGNOSTIC INSTRUMENTATION"
Write-Host "SOURCE WILL BE RESTORED AUTOMATICALLY"
Write-Host "NO GIT / NO DEPLOYMENT / NO CACHE DELETION"
Write-Host ""

if (-not (Test-Path $Component)) { throw "MergeWorkspace.tsx not found." }
if (-not (Test-Path $PageFile)) { throw "app/merge-pdf/page.tsx not found." }

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$WsOriginal = [System.IO.File]::ReadAllText((Resolve-Path $Component), $Utf8NoBom)
$PageOriginal = [System.IO.File]::ReadAllText((Resolve-Path $PageFile), $Utf8NoBom)

$WsPatched = $false
$PagePatched = $false

try {
    Write-Host "=== PATCHING TEMPORARY DIAGNOSTIC LOGS ==="

    $wsNeedles = @(
        '    const handleDragStart = (',
        '    const handleDrop = (',
        '        onReorderFiles('
    )

    foreach ($needle in $wsNeedles) {
        $count = ([regex]::Matches($WsOriginal, [regex]::Escape($needle))).Count
        if ($count -ne 1) {
            throw "Expected exactly 1 child marker [$needle], found $count."
        }
    }

    $pageNeedles = @(
        '    const handleReorderFiles = (',
        '        setWorkspaceFiles((previous) => {',
        '          return updated;'
    )

    foreach ($needle in $pageNeedles) {
        $count = ([regex]::Matches($PageOriginal, [regex]::Escape($needle))).Count
        if ($count -ne 1) {
            throw "Expected exactly 1 parent marker [$needle], found $count."
        }
    }

    $WsPatchedText = $WsOriginal

    $old = @'
    const handleDragStart = (
        event: React.DragEvent<HTMLDivElement>,
        id: string
    ) => {
'@
    $new = @'
    const handleDragStart = (
        event: React.DragEvent<HTMLDivElement>,
        id: string
    ) => {
        console.log("IEPDF_V23|DRAG_START|" + JSON.stringify({
            id,
            typesBefore: Array.from(event.dataTransfer.types)
        }));
'@
    if (-not $WsPatchedText.Contains($old)) { throw "Child dragStart block not found." }
    $WsPatchedText = $WsPatchedText.Replace($old, $new)

    $old = @'
    const handleDrop = (
        event: React.DragEvent<HTMLDivElement>,
        targetId: string
    ) => {
        const isInternalReorder =
'@
    $new = @'
    const handleDrop = (
        event: React.DragEvent<HTMLDivElement>,
        targetId: string
    ) => {
        console.log("IEPDF_V23|DROP_ENTER|" + JSON.stringify({
            targetId,
            types: Array.from(event.dataTransfer.types),
            text: event.dataTransfer.getData("text/plain"),
            draggedFileId
        }));

        const isInternalReorder =
'@
    if (-not $WsPatchedText.Contains($old)) { throw "Child drop block not found." }
    $WsPatchedText = $WsPatchedText.Replace($old, $new)

    $old = @'
        onReorderFiles(
            draggedId,
            targetId
        );
'@
    $new = @'
        console.log("IEPDF_V23|CHILD_CALLBACK|" + JSON.stringify({
            draggedId,
            targetId
        }));
        onReorderFiles(
            draggedId,
            targetId
        );
'@
    if (-not $WsPatchedText.Contains($old)) { throw "Child callback block not found." }
    $WsPatchedText = $WsPatchedText.Replace($old, $new)

    $PagePatchedText = $PageOriginal

    $old = @'
    const handleReorderFiles = (
        draggedId: string,
        targetId: string
    ) => {
'@
    $new = @'
    const handleReorderFiles = (
        draggedId: string,
        targetId: string
    ) => {
        console.log("IEPDF_V23|PARENT_CALLBACK|" + JSON.stringify({
            draggedId,
            targetId
        }));
'@
    if (-not $PagePatchedText.Contains($old)) { throw "Parent callback block not found." }
    $PagePatchedText = $PagePatchedText.Replace($old, $new)

    $old = @'
        setWorkspaceFiles((previous) => {
            const draggedIndex = previous.findIndex(
'@
    $new = @'
        setWorkspaceFiles((previous) => {
            console.log("IEPDF_V23|STATE_PREVIOUS|" + JSON.stringify({
                order: previous.map((file) => ({ id: file.id, name: file.name })),
                draggedId,
                targetId
            }));

            const draggedIndex = previous.findIndex(
'@
    if (-not $PagePatchedText.Contains($old)) { throw "Parent state block not found." }
    $PagePatchedText = $PagePatchedText.Replace($old, $new)

    $old = @'
            return updated;
        });
'@
    $new = @'
            console.log("IEPDF_V23|STATE_NEXT|" + JSON.stringify({
                order: updated.map((file) => ({ id: file.id, name: file.name }))
            }));

            return updated;
        });
'@
    if (-not $PagePatchedText.Contains($old)) { throw "Parent state return block not found." }
    $PagePatchedText = $PagePatchedText.Replace($old, $new)

    [System.IO.File]::WriteAllText($Component, $WsPatchedText, $Utf8NoBom)
    $WsPatched = $true

    [System.IO.File]::WriteAllText($PageFile, $PagePatchedText, $Utf8NoBom)
    $PagePatched = $true

    Write-Host "Temporary instrumentation applied."
    Write-Host ""

    Write-Host "=== TYPECHECK BEFORE BROWSER TEST ==="
    Push-Location $Root
    & pnpm exec tsc --noEmit
    $tsExit = $LASTEXITCODE
    Pop-Location

    if ($tsExit -ne 0) {
        throw "TypeScript failed after temporary instrumentation. Source will be restored."
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
const nativeEvents = [];

function log(s) {
  lines.push(s);
  console.log(s);
}

(async () => {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

  if (!fs.existsSync(chromePath)) {
    throw new Error("Google Chrome not found at: " + chromePath);
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

  page.on("pageerror", e => {
    pageErrors.push(String(e?.stack || e));
  });

  page.on("requestfailed", r => {
    failedRequests.push(
      `${r.method()} ${r.url()} :: ${r.failure()?.errorText || "unknown"}`
    );
  });

  await page.goto(
    `http://localhost:3000/merge-pdf?gate23v5=${Date.now()}`,
    {
      waitUntil: "domcontentloaded",
      timeout: 30000
    }
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
      if (/\d+\s*Pages/i.test(txt)) {
        return row;
      }
      row = row.locator("..");
    }

    throw new Error("Could not locate PDF row for index " + index);
  }

  const rows = [
    await rowFor(0),
    await rowFor(1),
    await rowFor(2)
  ];

  const handles = [
    rows[0].locator('[draggable="true"][aria-label*="Drag PDF"]').first(),
    rows[1].locator('[draggable="true"][aria-label*="Drag PDF"]').first(),
    rows[2].locator('[draggable="true"][aria-label*="Drag PDF"]').first()
  ];

  log("=== PRE-DRAG DOM ===");

  const beforeText = await page.locator("body").innerText();
  const beforeOrder = names.map(n => ({
    name: n,
    position: beforeText.indexOf(n)
  }));

  log("BEFORE_ORDER " + JSON.stringify(beforeOrder));

  for (let i = 0; i < handles.length; i++) {
    log("HANDLE_" + i + " " + JSON.stringify(
      await handles[i].evaluate(el => ({
        draggable: el.getAttribute("draggable"),
        aria: el.getAttribute("aria-label"),
        title: el.getAttribute("title"),
        rect: (() => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        })()
      }))
    ));
  }

  // Capture native DOM events in the capture phase. This observes the
  // browser event chain without modifying application source.
  await page.evaluate(() => {
    window.__IEPDF_V23_EVENTS = [];

    const push = (event, node, targetInfo) => {
      let types = [];
      let text = "";

      try {
        if (event.dataTransfer) {
          types = Array.from(event.dataTransfer.types);
          text = event.dataTransfer.getData("text/plain");
        }
      } catch (_) {}

      window.__IEPDF_V23_EVENTS.push({
        event: event.type,
        node,
        targetInfo,
        types,
        text,
        defaultPrevented: event.defaultPrevented,
        time: Math.round(performance.now())
      });
    };

    for (const eventName of [
      "dragstart",
      "dragenter",
      "dragover",
      "dragleave",
      "drop",
      "dragend"
    ]) {
      document.addEventListener(eventName, event => {
        const el = event.target instanceof Element ? event.target : null;
        const handle = el?.closest?.('[draggable="true"][aria-label*="Drag PDF"]');
        const row = el?.closest?.('[draggable="true"]')?.parentElement;

        push(
          event,
          handle ? "HANDLE" : "OTHER",
          {
            aria: handle?.getAttribute("aria-label") || null,
            text: row?.innerText?.slice(0, 180) || null
          }
        );
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
  if (appLogs.length === 0) {
    log("APP_LOG_COUNT 0");
  } else {
    log("APP_LOG_COUNT " + appLogs.length);
    for (const item of appLogs) {
      log("APP_TRACE " + item);
    }
  }

  const afterText = await page.locator("body").innerText();
  const afterOrder = names.map(n => ({
    name: n,
    position: afterText.indexOf(n)
  }));

  log("AFTER_ORDER " + JSON.stringify(afterOrder));

  const cPos = afterOrder[2].position;
  const aPos = afterOrder[0].position;
  const bPos = afterOrder[1].position;

  log("EXPECTED_C_A_B " + String(
    cPos >= 0 && aPos >= 0 && bPos >= 0 &&
    cPos < aPos && aPos < bPos
  ));

  const finalRows = await page.getByRole("button", { name: /Remove PDF/i }).count();
  log("FINAL_ROW_COUNT " + finalRows);

  log("PAGE_ERRORS " + JSON.stringify(pageErrors));
  log("FAILED_REQUESTS " + JSON.stringify(failedRequests));

  fs.writeFileSync(
    report,
    [
      "iePDF MERGE PDF - GATE 2.3 EVENT -> CALLBACK CHAIN V5",
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

  const expected = cPos >= 0 && aPos >= 0 && bPos >= 0 &&
    cPos < aPos && aPos < bPos;

  console.log("");
  console.log("GATE 2.3 V5 COMPLETE");
  console.log("Expected reorder observed: " + expected);
  console.log("Report: " + report);
  console.log("NO SOURCE CHANGES RETAINED");
})().catch(e => {
  console.error("GATE_2_3_V5_FATAL");
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

    Write-Host "Runner exit code: $runnerExit"

    if ($runnerExit -ne 0) {
        throw "V5 browser diagnostic runner failed. See report: $Report"
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
    $restoreTsExit = $LASTEXITCODE
    Pop-Location

    if ($restoreTsExit -ne 0) {
        Write-Host "WARNING: post-restore TypeScript failed. STOP."
        throw "Post-restore TypeScript failed."
    }

    Write-Host "Post-restore TypeScript PASS."
}

Write-Host ""
Write-Host "============================================================"
Write-Host "GATE 2.3 V5 FINISHED"
Write-Host "Report: $Report"
Write-Host "SOURCE RESTORED"
Write-Host "NO GIT"
Write-Host "NO DEPLOYMENT"
Write-Host "NO CACHE DELETION"
Write-Host "============================================================"
