$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $RegDir "merge-reorder-gate-2.2-diagnostic-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-reorder-gate-2.2-runner-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null

Write-Host "============================================================"
Write-Host "iePDF MERGE PDF - GATE 2.2 APPLICATION REORDER DIAGNOSTIC"
Write-Host "============================================================"
Write-Host "Started: $(Get-Date)"
Write-Host "Root: $Root"
Write-Host ""
Write-Host "READ-ONLY DIAGNOSTIC"
Write-Host "NO SOURCE CHANGES"
Write-Host "NO GIT"
Write-Host "NO DEPLOYMENT"
Write-Host "NO CACHE DELETION"

try {
    $component = Join-Path $Root "components\MergeWorkspace.tsx"

    if (-not (Test-Path -LiteralPath $component)) {
        throw "Canonical MergeWorkspace.tsx not found: $component"
    }

    $pageFile = Join-Path $Root "app\merge-pdf\page.tsx"

    if (-not (Test-Path -LiteralPath $pageFile)) {
        throw "Merge page not found: $pageFile"
    }

    $backupDir = Join-Path $Root "_ui-backups\GATE-2.2-DIAGNOSTIC-$Stamp"
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

    Copy-Item -LiteralPath $component -Destination (Join-Path $backupDir "MergeWorkspace.tsx") -Force
    Copy-Item -LiteralPath $pageFile -Destination (Join-Path $backupDir "page.tsx") -Force

    Write-Host ""
    Write-Host "Backup: $backupDir"

    # ------------------------------------------------------------
    # READ-ONLY SOURCE EVIDENCE BEFORE TEMPORARY INSTRUMENTATION
    # ------------------------------------------------------------

    $componentText = Get-Content -LiteralPath $component -Raw
    $pageText = Get-Content -LiteralPath $pageFile -Raw

    Write-Host ""
    Write-Host "=== SOURCE EVIDENCE ==="

    $sourceChecks = @(
        @{ Id = "SRC-01"; Pattern = 'application/x-iepdf-reorder'; Description = "internal reorder MIME marker" },
        @{ Id = "SRC-02"; Pattern = 'setData("application/x-iepdf-reorder"'; Description = "drag start sets reorder marker" },
        @{ Id = "SRC-03"; Pattern = 'event.dataTransfer.types.includes("application/x-iepdf-reorder")'; Description = "row drop recognizes reorder marker" },
        @{ Id = "SRC-04"; Pattern = 'onReorderFiles'; Description = "reorder callback exists" },
        @{ Id = "SRC-05"; Pattern = 'files.map'; Description = "PDF rows rendered from files" },
        @{ Id = "SRC-06"; Pattern = 'key={file.id}'; Description = "rows keyed by file id" }
    )

    foreach ($check in $sourceChecks) {
        $ok = $componentText.Contains($check.Pattern)
        Write-Host "$($check.Id) $(if ($ok) { 'PASS' } else { 'FAIL' }) - $($check.Description)"
    }

    $pageChecks = @(
        @{ Id = "PAGE-01"; Pattern = 'onReorderFiles'; Description = "page passes reorder callback" },
        @{ Id = "PAGE-02"; Pattern = 'setWorkspaceFiles'; Description = "parent workspace state setter exists" }
    )

    foreach ($check in $pageChecks) {
        $ok = $pageText.Contains($check.Pattern)
        Write-Host "$($check.Id) $(if ($ok) { 'PASS' } else { 'FAIL' }) - $($check.Description)"
    }

    # ------------------------------------------------------------
    # TEMPORARY SOURCE INSTRUMENTATION
    # Instrument ONLY observable boundaries. The original files are
    # restored in finally regardless of test outcome.
    # ------------------------------------------------------------

    $marker1 = 'const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {'

    if (-not $componentText.Contains($marker1)) {
        throw "Gate 2.2 marker not found: row handleDrop"
    }

    $componentInstrument = $componentText.Replace(
        $marker1,
        @'
const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    try {
      const __iepdfV22Types = event.dataTransfer ? Array.from(event.dataTransfer.types) : [];
      console.log("IEPDF_V22|ROW_DROP_ENTER|" + JSON.stringify({
        rowIndex: index,
        fileId: file.id,
        fileName: file.file.name,
        types: __iepdfV22Types
      }));
    } catch (_) {}
'@
    )

    $marker2 = 'onReorderFiles(reorderedFiles);'

    if (-not $componentInstrument.Contains($marker2)) {
        throw "Gate 2.2 marker not found: onReorderFiles call"
    }

    $componentInstrument = $componentInstrument.Replace(
        $marker2,
        @'
console.log("IEPDF_V22|ROW_REORDER_CALLBACK|" + JSON.stringify({
          fromIndex,
          toIndex,
          fileCount: reorderedFiles.length,
          order: reorderedFiles.map((f) => ({
            id: f.id,
            name: f.file?.name || ""
          }))
        }));
        onReorderFiles(reorderedFiles);
'@
    )

    # Add a render-level observable immediately after component signature.
    $signature = 'export default function MergeWorkspace({'

    if (-not $componentInstrument.Contains($signature)) {
        throw "Gate 2.2 marker not found: MergeWorkspace signature"
    }

    $componentInstrument = $componentInstrument.Replace(
        $signature,
        @'
export default function MergeWorkspace({
'@
    )

    # Use a safe render marker after the destructuring block's first stable
    # local declaration. We intentionally locate an existing state declaration
    # rather than trying to parse TypeScript.
    $renderMarker = 'const [draggedIndex, setDraggedIndex] = useState<number | null>(null);'

    if (-not $componentInstrument.Contains($renderMarker)) {
        throw "Gate 2.2 marker not found: draggedIndex state"
    }

    $componentInstrument = $componentInstrument.Replace(
        $renderMarker,
        @'
const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  console.log("IEPDF_V22|RENDER|" + JSON.stringify({
    filesLength: files.length,
    order: files.map((f) => ({
      id: f.id,
      name: f.file?.name || "",
      skipped: f.skipped,
      status: f.status
    }))
  }));
'@
    )

    # Instrument parent reorder callback in app/merge-pdf/page.tsx.
    $pageMarker = 'const handleReorderFiles = (reorderedFiles: WorkspaceFile[]) => {'

    if (-not $pageText.Contains($pageMarker)) {
        throw "Gate 2.2 marker not found: page handleReorderFiles"
    }

    $pageInstrument = $pageText.Replace(
        $pageMarker,
        @'
const handleReorderFiles = (reorderedFiles: WorkspaceFile[]) => {
    console.log("IEPDF_V22|PAGE_REORDER_CALLBACK|" + JSON.stringify({
      count: reorderedFiles.length,
      order: reorderedFiles.map((f) => ({
        id: f.id,
        name: f.file?.name || ""
      }))
    }));
'@
    )

    [System.IO.File]::WriteAllText(
        $component,
        $componentInstrument,
        [System.Text.UTF8Encoding]::new($false)
    )

    [System.IO.File]::WriteAllText(
        $pageFile,
        $pageInstrument,
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host ""
    Write-Host "Temporary Gate 2.2 instrumentation applied."

    # ------------------------------------------------------------
    # TYPESCRIPT CHECK
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
    # BROWSER RUNNER
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

const logs = [];
const pageErrors = [];
const failedRequests = [];
const consoleErrors = [];

function log(line) {
  logs.push(line);
  console.log(line);
}

function parseApp(text) {
  const prefix = "IEPDF_V22|";
  if (!text.startsWith(prefix)) return;
  log(`APP ${text}`);
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

async function getState(page) {
  return await page.evaluate(() => {
    const body = document.body?.innerText || "";
    const removes = [...document.querySelectorAll("button")]
      .filter(b => /Remove PDF/i.test((b.innerText || "").trim()));

    const merge = [...document.querySelectorAll("button")]
      .find(b => /Unlock\s*&\s*Merge/i.test((b.innerText || "").trim()));

    return {
      body,
      removeCount: removes.length,
      mergeDisabled: merge ? merge.disabled : null
    };
  });
}

async function getHandle(page, rowIndex) {
  return await page.evaluate((idx) => {
    const rows = [...document.querySelectorAll("button")]
      .filter(b => /Remove PDF/i.test((b.innerText || "").trim()));

    const remove = rows[idx];
    if (!remove) return null;

    let row = remove.parentElement;

    for (let i = 0; i < 6 && row; i++) {
      if (/\d+\s*Pages/i.test((row.innerText || "").trim())) break;
      row = row.parentElement;
    }

    if (!row) return null;

    const candidates = [...row.querySelectorAll("*")]
      .filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 &&
          el.getAttribute("draggable") === "true";
      })
      .map(el => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          aria: el.getAttribute("aria-label") || "",
          title: el.getAttribute("title") || "",
          className: typeof el.className === "string" ? el.className : "",
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          centerX: r.x + r.width / 2,
          centerY: r.y + r.height / 2
        };
      });

    return candidates.find(c =>
      /Drag PDF/i.test(c.aria) || /reorder/i.test(c.title)
    ) || candidates[0] || null;
  }, rowIndex);
}

async function getRowTargets(page) {
  return await page.evaluate(() => {
    const rows = [...document.querySelectorAll("button")]
      .filter(b => /Remove PDF/i.test((b.innerText || "").trim()));

    return rows.map(b => {
      const r = b.getBoundingClientRect();
      return {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2
      };
    });
  });
}

async function nativeDragAttempt(page, source, target) {
  const events = [];

  await page.evaluate(() => {
    window.__v22Events = [];
  });

  // Dispatch a genuine DragEvent sequence with a DataTransfer object.
  // This is diagnostic only. It does not alter source code.
  const result = await page.evaluate(
    ({ sx, sy, tx, ty }) => {
      const sourceEl = document.elementFromPoint(sx, sy);
      const targetEl = document.elementFromPoint(tx, ty);

      if (!sourceEl || !targetEl) {
        return { ok: false, reason: "elementFromPoint failed" };
      }

      const data = new DataTransfer();
      data.effectAllowed = "move";
      data.setData("application/x-iepdf-reorder", "1");

      const fire = (type, el) => {
        const ev = new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          dataTransfer: data,
          clientX: tx,
          clientY: ty
        });
        return el.dispatchEvent(ev);
      };

      const results = {
        sourceTag: sourceEl.tagName,
        targetTag: targetEl.tagName,
        dragstart: fire("dragstart", sourceEl),
        dragenter: fire("dragenter", targetEl),
        dragover: fire("dragover", targetEl),
        drop: fire("drop", targetEl),
        dragend: fire("dragend", sourceEl)
      };

      return { ok: true, results, types: [...data.types] };
    },
    { sx: source.centerX, sy: source.centerY, tx: target.x, ty: target.y }
  );

  log(`DISPATCH_RESULT ${JSON.stringify(result)}`);

  await page.waitForTimeout(1200);

  return result;
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

    if (/IEPDF_V22\|/.test(text)) {
      parseApp(text);
    }

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
    `http://localhost:3000/merge-pdf?reorderGate22=${Date.now()}`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );

  await page.waitForTimeout(800);

  log(`ROUTE ${page.url()}`);
  log(`TITLE ${await page.title()}`);

  await page.locator('input[type="file"]').first().setInputFiles([A, B, C]);

  const loaded = await waitForNames(page, names);
  log(`LOAD_ALL ${loaded}`);

  await page.waitForTimeout(1200);

  const initial = await getState(page);
  log(`INITIAL_STATE ${JSON.stringify({
    removeCount: initial.removeCount,
    mergeDisabled: initial.mergeDisabled
  })}`);

  const handle = await getHandle(page, 2);
  const targets = await getRowTargets(page);

  log(`SOURCE_HANDLE ${JSON.stringify(handle)}`);
  log(`ROW_TARGETS ${JSON.stringify(targets)}`);

  if (!handle) {
    log("DIAG_RESULT NO_HANDLE_FOUND");
  } else if (targets.length < 3) {
    log("DIAG_RESULT LESS_THAN_THREE_ROWS");
  } else {
    log("=== DETERMINISTIC DRAG EVENT DISPATCH C_TO_A ===");

    await nativeDragAttempt(page, handle, targets[0]);

    const after = await getState(page);

    const positions = await page.evaluate((wanted) => {
      const text = document.body?.innerText || "";
      return wanted.map(n => ({
        name: n,
        position: text.indexOf(n)
      }));
    }, names);

    log(`AFTER_STATE ${JSON.stringify({
      removeCount: after.removeCount,
      mergeDisabled: after.mergeDisabled
    })}`);

    log(`AFTER_POSITIONS ${JSON.stringify(positions)}`);

    const reordered =
      positions[2].position >= 0 &&
      positions[2].position < positions[0].position &&
      positions[0].position < positions[1].position;

    log(`C_TO_A_REORDER_OBSERVED ${reordered}`);
  }

  log("");
  log("=== HEALTH ===");
  log(`PAGE_ERRORS ${JSON.stringify(pageErrors)}`);
  log(`FAILED_REQUESTS ${JSON.stringify(failedRequests)}`);
  log(`CONSOLE_ERRORS ${JSON.stringify(consoleErrors)}`);

  const output = [
    "iePDF MERGE PDF - GATE 2.2 APPLICATION REORDER DIAGNOSTIC",
    `Finished: ${new Date().toISOString()}`,
    "",
    "=== DIAGNOSTIC LOG ===",
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
  console.log("GATE 2.2 DIAGNOSTIC COMPLETE");
  console.log(`Report: ${report}`);
  console.log("NO SOURCE CHANGES IN FINAL STATE");
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
    Write-Host "=== BROWSER APPLICATION REORDER DIAGNOSTIC ==="

    Push-Location $Root
    & node $Runner $Report $A $B $C
    $browserExit = $LASTEXITCODE
    Pop-Location

    if ($browserExit -ne 0) {
        Write-Host "Browser diagnostic returned exit code $browserExit"
    }
}
catch {
    Write-Host ""
    Write-Host "GATE 2.2 ERROR:"
    Write-Host $_.Exception.Message
}
finally {
    # Always restore original application source.
    try {
        if (Test-Path -LiteralPath (Join-Path $backupDir "MergeWorkspace.tsx")) {
            Copy-Item -LiteralPath (Join-Path $backupDir "MergeWorkspace.tsx") `
                -Destination $component -Force
        }

        if (Test-Path -LiteralPath (Join-Path $backupDir "page.tsx")) {
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
    $restoreTscExit = $LASTEXITCODE
    Pop-Location

    if ($restoreTscExit -eq 0) {
        Write-Host "Post-restore TypeScript PASS"
    }
    else {
        Write-Host "Post-restore TypeScript FAIL"
    }

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "GATE 2.2 APPLICATION REORDER DIAGNOSTIC COMPLETE"
    Write-Host "Report: $Report"
    Write-Host "NO SOURCE CHANGES REMAIN"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"
    Write-Host "============================================================"
}
