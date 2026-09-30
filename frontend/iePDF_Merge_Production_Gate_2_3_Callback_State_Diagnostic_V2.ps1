$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $RegDir "merge-reorder-gate-2.3-callback-state-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-reorder-gate-2.3-runner-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null

Write-Host "============================================================"
Write-Host "iePDF MERGE PDF - GATE 2.3 CALLBACK -> PARENT STATE DIAGNOSTIC V2"
Write-Host "============================================================"
Write-Host "Started: $(Get-Date)"
Write-Host "Root: $Root"
Write-Host ""
Write-Host "READ-ONLY DIAGNOSTIC"
Write-Host "NO SOURCE CHANGES RETAINED"
Write-Host "NO GIT"
Write-Host "NO DEPLOYMENT"
Write-Host "NO CACHE DELETION"

$component = Join-Path $Root "components\MergeWorkspace.tsx"
$pageFile = Join-Path $Root "app\merge-pdf\page.tsx"

$backupDir = $null

function Read-Utf8NoBom([string]$Path) {
    [System.IO.File]::ReadAllText(
        (Resolve-Path -LiteralPath $Path),
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
    [System.IO.File]::WriteAllText(
        $Path,
        $Text,
        [System.Text.UTF8Encoding]::new($false)
    )
}

try {
    if (-not (Test-Path -LiteralPath $component)) {
        throw "Canonical MergeWorkspace.tsx not found."
    }

    if (-not (Test-Path -LiteralPath $pageFile)) {
        throw "Canonical app/merge-pdf/page.tsx not found."
    }

    $wsOriginal = Read-Utf8NoBom $component
    $pageOriginal = Read-Utf8NoBom $pageFile

    Write-Host ""
    Write-Host "=== SOURCE DISCOVERY ==="

    Write-Host ("WS onReorderFiles occurrences: " + ([regex]::Matches($wsOriginal, "onReorderFiles").Count))
    Write-Host ("WS reorder MIME occurrences: " + ([regex]::Matches($wsOriginal, "application/x-iepdf-reorder").Count))
    Write-Host ("WS handleDrop occurrences: " + ([regex]::Matches($wsOriginal, "handleDrop").Count))
    Write-Host ("PAGE handleReorderFiles occurrences: " + ([regex]::Matches($pageOriginal, "handleReorderFiles").Count))
    Write-Host ("PAGE setWorkspaceFiles occurrences: " + ([regex]::Matches($pageOriginal, "setWorkspaceFiles").Count))

    # Backup
    $backupDir = Join-Path $Root "_ui-backups\GATE-2.3-V2-DIAGNOSTIC-$Stamp"
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

    Copy-Item -LiteralPath $component -Destination (Join-Path $backupDir "MergeWorkspace.tsx") -Force
    Copy-Item -LiteralPath $pageFile -Destination (Join-Path $backupDir "page.tsx") -Force

    Write-Host "Backup: $backupDir"

    $ws = $wsOriginal
    $page = $pageOriginal

    # ------------------------------------------------------------
    # CHILD: instrument the actual callback invocation.
    #
    # The source has multiple onReorderFiles references. We locate
    # every call-shaped occurrence and instrument the LAST one,
    # which is the callback invocation in the current component.
    # ------------------------------------------------------------

    $callMatches = [regex]::Matches($ws, "(?m)(?<![\w.])onReorderFiles\s*\(")

    if ($callMatches.Count -lt 1) {
        throw "No onReorderFiles call-shaped occurrence found."
    }

    $lastCall = $callMatches[$callMatches.Count - 1]

    $insertAt = $lastCall.Index

    $childLog = @'
console.log("IEPDF_V23|CHILD_CALLBACK_CALL|" + JSON.stringify({
      targetIndex: index,
      targetId: targetId,
      draggedId: draggedId,
      note: "about to invoke onReorderFiles"
    }));

'@

    $ws = $ws.Insert($insertAt, $childLog)

    # Instrument the child state before callback if the exact local
    # reorderedFiles variable exists near the callback.
    $nearStart = [Math]::Max(0, $insertAt - 2500)
    $nearLength = [Math]::Min(5000, $ws.Length - $nearStart)
    $near = $ws.Substring($nearStart, $nearLength)

    if ($near.Contains("reorderedFiles")) {
        Write-Host "Child reorderedFiles variable detected near callback."
    }
    else {
        Write-Host "INFO: reorderedFiles variable not detected near callback; callback boundary will still be traced."
    }

    # ------------------------------------------------------------
    # PARENT: locate the actual handleReorderFiles declaration with
    # flexible whitespace/types. We do NOT assume exact formatting.
    # ------------------------------------------------------------

    $parentRegex = '(?m)(?<indent>^[ \t]*)const[ \t]+handleReorderFiles[ \t]*=[ \t]*\((?<args>[^)]*)\)[ \t]*=>[ \t]*\{'

    $pm = [regex]::Match($page, $parentRegex)

    if (-not $pm.Success) {
        throw "Could not locate parent handleReorderFiles declaration with flexible source matching."
    }

    $parentInsertAt = $pm.Index + $pm.Length

    $parentLog = @'
    console.log("IEPDF_V23|PARENT_CALLBACK_ENTER|" + JSON.stringify({
      receivedType: typeof reorderedFiles,
      receivedCount: Array.isArray(reorderedFiles) ? reorderedFiles.length : null,
      receivedOrder: Array.isArray(reorderedFiles)
        ? reorderedFiles.map((f) => ({ id: f.id, name: f.file?.name || "" }))
        : null
    }));
'@

    $page = $page.Insert($parentInsertAt, $parentLog)

    # ------------------------------------------------------------
    # STATE: instrument the first functional setWorkspaceFiles updater
    # inside the parent callback, using flexible whitespace.
    # ------------------------------------------------------------

    $stateRegex = '(?m)setWorkspaceFiles[ \t]*\([ \t]*\([ \t]*previous[ \t]*\)[ \t]*=>[ \t]*\{'
    $sm = [regex]::Match($page, $stateRegex)

    if ($sm.Success -and $sm.Index -gt $pm.Index) {
        $stateInsertAt = $sm.Index + $sm.Length

        $stateLog = @'
      console.log("IEPDF_V23|STATE_PREVIOUS|" + JSON.stringify({
        count: previous.length,
        order: previous.map((f) => ({ id: f.id, name: f.file?.name || "" }))
      }));
'@

        $page = $page.Insert($stateInsertAt, $stateLog)

        # Find the matching closing brace for this updater using a simple
        # lexical brace scan that ignores strings/comments sufficiently
        # for this local diagnostic. We only need the first updater block.
        $scanStart = $stateInsertAt
        $depth = 1
        $inSingle = $false
        $inDouble = $false
        $inTemplate = $false
        $escaped = $false
        $endPos = -1

        for ($i = $scanStart; $i -lt $page.Length; $i++) {
            $ch = $page[$i]

            if ($escaped) {
                $escaped = $false
                continue
            }

            if (($inSingle -or $inDouble -or $inTemplate) -and $ch -eq "\") {
                $escaped = $true
                continue
            }

            if (-not $inDouble -and -not $inTemplate -and $ch -eq "'") {
                $inSingle = -not $inSingle
                continue
            }

            if (-not $inSingle -and -not $inTemplate -and $ch -eq '"') {
                $inDouble = -not $inDouble
                continue
            }

            if (-not $inSingle -and -not $inDouble -and $ch -eq '`') {
                $inTemplate = -not $inTemplate
                continue
            }

            if ($inSingle -or $inDouble -or $inTemplate) {
                continue
            }

            if ($ch -eq "{") {
                $depth++
            }
            elseif ($ch -eq "}") {
                $depth--
                if ($depth -eq 0) {
                    $endPos = $i
                    break
                }
            }
        }

        if ($endPos -gt 0) {
            $stateNextLog = @'

      console.log("IEPDF_V23|STATE_UPDATER_RETURN|" + JSON.stringify({
        count: reorderedFiles.length,
        order: reorderedFiles.map((f) => ({ id: f.id, name: f.file?.name || "" }))
      }));
'@
            $page = $page.Insert($endPos, $stateNextLog)
            Write-Host "State updater instrumented."
        }
        else {
            Write-Host "INFO: state updater closing brace not located; previous-state logging retained."
        }
    }
    else {
        Write-Host "INFO: functional setWorkspaceFiles(previous => ...) not located inside parent callback."
    }

    Write-Utf8NoBom $component $ws
    Write-Utf8NoBom $pageFile $page

    Write-Host ""
    Write-Host "Temporary instrumentation applied."

    # ------------------------------------------------------------
    # TypeScript
    # ------------------------------------------------------------

    Write-Host ""
    Write-Host "=== TYPESCRIPT CHECK ==="

    Push-Location $Root
    & pnpm exec tsc --noEmit
    $tsExit = $LASTEXITCODE
    Pop-Location

    if ($tsExit -ne 0) {
        throw "TypeScript failed after temporary instrumentation."
    }

    Write-Host "TypeScript PASS"

    # ------------------------------------------------------------
    # Fixtures
    # ------------------------------------------------------------

    $fixtures = @(Get-ChildItem -LiteralPath $RegDir -Filter "*.pdf" -File |
        Sort-Object Name)

    if ($fixtures.Count -lt 3) {
        throw "Need at least 3 PDF fixtures in $RegDir. Found $($fixtures.Count)."
    }

    $A = $fixtures[0].FullName
    $B = $fixtures[1].FullName
    $C = $fixtures[2].FullName

    # ------------------------------------------------------------
    # Browser runner
    # ------------------------------------------------------------

    $runner = @'
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

const appLogs = [];
const errors = [];
const failed = [];

function emit(s) {
  console.log(s);
  appLogs.push(s);
}

function bodyNamePositions(text) {
  return names.map(n => ({ name: n, position: text.indexOf(n) }));
}

async function waitRows(page, n) {
  return page.waitForFunction(
    wanted => [...document.querySelectorAll("button")]
      .filter(b => /Remove PDF/i.test((b.innerText || "").trim())).length >= wanted,
    n,
    { timeout: 20000 }
  ).then(() => true).catch(() => false);
}

async function getRows(page) {
  return await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")]
      .filter(b => /Remove PDF/i.test((b.innerText || "").trim()));

    return buttons.map((remove, index) => {
      let row = remove.parentElement;
      for (let i = 0; i < 8 && row; i++, row = row.parentElement) {
        if (/\d+\s*Pages/i.test(row.innerText || "")) break;
      }

      const handle = row
        ? row.querySelector('[draggable="true"][aria-label*="Drag PDF"]')
        : null;

      return {
        index,
        text: (row?.innerText || "").slice(0, 300),
        handle: handle ? {
          draggable: handle.getAttribute("draggable"),
          aria: handle.getAttribute("aria-label")
        } : null
      };
    });
  });
}

async function order(page) {
  const text = await page.locator("body").innerText();
  return bodyNamePositions(text);
}

async function drag(page, fromIndex, toIndex) {
  const rows = await page.getByRole("button", { name: /Remove PDF/i }).count();

  if (rows < 3) return { ok: false, reason: "less than 3 rows" };

  const removeButtons = page.getByRole("button", { name: /Remove PDF/i });

  async function rowFor(index) {
    let row = removeButtons.nth(index).locator("..");
    for (let i = 0; i < 8; i++) {
      const text = await row.innerText().catch(() => "");
      if (/\d+\s*Pages/i.test(text)) break;
      row = row.locator("..");
    }
    return row;
  }

  const sourceRow = await rowFor(fromIndex);
  const targetRow = await rowFor(toIndex);
  const source = sourceRow.locator('[draggable="true"][aria-label*="Drag PDF"]').first();

  if (await source.count() !== 1) {
    return { ok: false, reason: "source handle missing" };
  }

  await source.dragTo(targetRow, { timeout: 15000 });
  await page.waitForTimeout(1500);

  return { ok: true };
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on("console", msg => {
    const t = msg.text();
    if (t.includes("IEPDF_V23|")) emit("APP " + t);
    if (msg.type() === "error") errors.push(t);
  });

  page.on("pageerror", e => errors.push("PAGEERROR " + String(e?.stack || e)));
  page.on("requestfailed", r => failed.push(
    `${r.method()} ${r.url()} :: ${r.failure()?.errorText || "unknown"}`
  ));

  await page.goto(
    `http://localhost:3000/merge-pdf?gate23=${Date.now()}`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );

  await page.waitForTimeout(1200);

  await page.locator('input[type="file"]').first().setInputFiles([A, B, C]);

  const loaded = await page.waitForFunction(
    wanted => {
      const t = document.body?.innerText || "";
      return wanted.every(n => t.includes(n));
    },
    names,
    { timeout: 20000 }
  ).then(() => true).catch(() => false);

  const rowsLoaded = await waitRows(page, 3);

  emit(`LOAD loaded=${loaded} rows=${rowsLoaded}`);
  emit(`INITIAL_ROWS ${JSON.stringify(await getRows(page))}`);
  emit(`INITIAL_ORDER ${JSON.stringify(await order(page))}`);

  emit("=== DRAG C -> A ===");
  const result = await drag(page, 2, 0);
  emit(`DRAG_RESULT ${JSON.stringify(result)}`);

  await page.waitForTimeout(500);

  emit(`AFTER_ROWS ${JSON.stringify(await getRows(page))}`);
  emit(`AFTER_ORDER ${JSON.stringify(await order(page))}`);

  const body = await page.locator("body").innerText();
  const c = body.indexOf(names[2]);
  const a = body.indexOf(names[0]);
  const b = body.indexOf(names[1]);

  emit(`ORDER_INDEXES C=${c} A=${a} B=${b}`);
  emit(`C_TO_A_EXPECTED ${c >= 0 && c < a && a < b}`);

  emit(`HEALTH_PAGE_ERRORS ${JSON.stringify(errors)}`);
  emit(`HEALTH_FAILED_REQUESTS ${JSON.stringify(failed)}`);

  fs.writeFileSync(
    report,
    [
      "iePDF MERGE PDF - GATE 2.3 CALLBACK -> PARENT STATE DIAGNOSTIC V2",
      "",
      ...appLogs,
      "",
      "PAGE/CONSOLE ERRORS:",
      ...(errors.length ? errors : ["NONE"]),
      "",
      "FAILED REQUESTS:",
      ...(failed.length ? failed : ["NONE"])
    ].join("\n"),
    "utf8"
  );

  await browser.close();

  console.log("");
  console.log("GATE 2.3 V2 DIAGNOSTIC COMPLETE");
  console.log("Report: " + report);
  console.log("NO SOURCE CHANGES REMAIN AFTER RESTORE");
})().catch(e => {
  console.error("GATE_2_3_V2_FATAL");
  console.error(e?.stack || e);
  process.exitCode = 3;
});
'@

    Write-Utf8NoBom $Runner $runner

    Write-Host ""
    Write-Host "=== RUNNING BROWSER CALLBACK / STATE TRACE ==="

    Push-Location $Root
    & node $Runner $Report $A $B $C
    $runExit = $LASTEXITCODE
    Pop-Location

    Write-Host "Browser diagnostic exit code: $runExit"
}
catch {
    Write-Host ""
    Write-Host "GATE 2.3 V2 ERROR:"
    Write-Host $_.Exception.Message
}
finally {
    try {
        if ($backupDir) {
            Copy-Item -LiteralPath (Join-Path $backupDir "MergeWorkspace.tsx") -Destination $component -Force
            Copy-Item -LiteralPath (Join-Path $backupDir "page.tsx") -Destination $pageFile -Force
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
    Write-Host "GATE 2.3 V2 COMPLETE"
    Write-Host "Report: $Report"
    Write-Host "NO SOURCE CHANGES"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"
    Write-Host "============================================================"
}
