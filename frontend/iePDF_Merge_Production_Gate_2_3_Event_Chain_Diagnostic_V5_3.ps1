$ErrorActionPreference = "Stop"

$Root = "C:\IEPDF\frontend"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $RegDir "merge-reorder-gate-2.3-event-chain-v5.3-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-reorder-gate-2.3-event-chain-v5.3-$Stamp.cjs"

$Component = Join-Path $Root "components\MergeWorkspace.tsx"
$PageFile = Join-Path $Root "app\merge-pdf\page.tsx"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "============================================================"
Write-Host "iePDF MERGE PDF - GATE 2.3 EVENT -> CALLBACK CHAIN V5.3"
Write-Host "============================================================"
Write-Host "Scoped diagnostic instrumentation"
Write-Host "Original source will be restored automatically"
Write-Host "NO GIT / NO DEPLOYMENT / NO CACHE DELETION"
Write-Host ""

$WsOriginal = [System.IO.File]::ReadAllText((Resolve-Path $Component), $Utf8NoBom)
$PageOriginal = [System.IO.File]::ReadAllText((Resolve-Path $PageFile), $Utf8NoBom)

$WsPatched = $false
$PagePatched = $false

function Find-FunctionRegion([string]$text, [string]$signatureRegex) {
    $m = [regex]::Match($text, $signatureRegex)
    if (-not $m.Success) { throw "Function signature not found: $signatureRegex" }

    $open = $text.IndexOf("{", $m.Index + $m.Length)
    if ($open -lt 0) { throw "Opening brace not found." }

    $depth = 0
    $inString = $null
    $escape = $false
    for ($i = $open; $i -lt $text.Length; $i++) {
        $ch = $text[$i]

        if ($inString) {
            if ($escape) { $escape = $false; continue }
            if ($ch -eq "\") { $escape = $true; continue }
            if ($ch -eq $inString) { $inString = $null }
            continue
        }

        if ($ch -eq '"' -or $ch -eq "'" -or $ch -eq '`') {
            $inString = $ch
            continue
        }

        if ($ch -eq "{") { $depth++ }
        elseif ($ch -eq "}") {
            $depth--
            if ($depth -eq 0) {
                return @{
                    Start = $m.Index
                    Open = $open
                    End = $i + 1
                }
            }
        }
    }

    throw "Could not find end of function."
}

try {
    Write-Host "=== LOCATING FUNCTIONS ==="

    $dragRegion = Find-FunctionRegion $WsOriginal '(?s)const\s+handleDragStart\s*=\s*\('
    $dropRegion = Find-FunctionRegion $WsOriginal '(?s)const\s+handleDrop\s*=\s*\('
    $pageRegion = Find-FunctionRegion $PageOriginal '(?s)const\s+handleReorderFiles\s*=\s*\('

    Write-Host "handleDragStart region: $($dragRegion.Start)-$($dragRegion.End)"
    Write-Host "handleDrop region: $($dropRegion.Start)-$($dropRegion.End)"
    Write-Host "handleReorderFiles region: $($pageRegion.Start)-$($pageRegion.End)"

    # Instrument child handleDragStart only inside its function.
    $WsPatchedText = $WsOriginal
    $dragBodyOpen = $dragRegion.Open + 1
    $dragInsert = '        console.log("IEPDF_V23|DRAG_START|" + JSON.stringify({id, typesBefore: Array.from(event.dataTransfer.types)}));' + "`r`n"
    $WsPatchedText = $WsPatchedText.Substring(0, $dragBodyOpen + 1) + "`r`n" + $dragInsert + $WsPatchedText.Substring($dragBodyOpen + 1)

    # Re-find drop region after the first insertion.
    $dropRegion2 = Find-FunctionRegion $WsPatchedText '(?s)const\s+handleDrop\s*=\s*\('
    $dropBodyOpen = $dropRegion2.Open + 1
    $dropInsert = '        console.log("IEPDF_V23|DROP_ENTER|" + JSON.stringify({targetId, types: Array.from(event.dataTransfer.types), text: event.dataTransfer.getData("text/plain"), draggedFileId}));' + "`r`n"
    $WsPatchedText = $WsPatchedText.Substring(0, $dropBodyOpen + 1) + "`r`n" + $dropInsert + $WsPatchedText.Substring($dropBodyOpen + 1)

    # Instrument the exact onReorderFiles call inside handleDrop.
    $dropRegion3 = Find-FunctionRegion $WsPatchedText '(?s)const\s+handleDrop\s*=\s*\('
    $dropFunction = $WsPatchedText.Substring($dropRegion3.Start, $dropRegion3.End - $dropRegion3.Start)
    $callRegex = '(?s)onReorderFiles\(\s*draggedId,\s*targetId\s*\);'
    $callMatch = [regex]::Match($dropFunction, $callRegex)
    if (-not $callMatch.Success) { throw "onReorderFiles call not found inside handleDrop." }

    $callReplacement = 'console.log("IEPDF_V23|CHILD_CALLBACK|" + JSON.stringify({draggedId, targetId}));' + "`r`n        " + $callMatch.Value
    $newDropFunction = $dropFunction.Substring(0, $callMatch.Index) + $callReplacement + $dropFunction.Substring($callMatch.Index + $callMatch.Length)

    $WsPatchedText =
        $WsPatchedText.Substring(0, $dropRegion3.Start) +
        $newDropFunction +
        $WsPatchedText.Substring($dropRegion3.End)

    # Instrument parent handleReorderFiles only inside its function.
    $pageRegion2 = Find-FunctionRegion $PageOriginal '(?s)const\s+handleReorderFiles\s*=\s*\('
    $pageFunction = $PageOriginal.Substring($pageRegion2.Start, $pageRegion2.End - $pageRegion2.Start)

    $pageOpenRelative = $pageRegion2.Open - $pageRegion2.Start + 1
    $parentInsert = '        console.log("IEPDF_V23|PARENT_CALLBACK|" + JSON.stringify({draggedId, targetId}));' + "`r`n"
    $pageFunction = $pageFunction.Substring(0, $pageOpenRelative + 1) + "`r`n" + $parentInsert + $pageFunction.Substring($pageOpenRelative + 1)

    $stateRegex = '(?s)setWorkspaceFiles\(\s*\(previous\)\s*=>\s*\{'
    $stateMatch = [regex]::Match($pageFunction, $stateRegex)
    if (-not $stateMatch.Success) { throw "Reorder setWorkspaceFiles not found inside handleReorderFiles." }

    $stateInsert = '            console.log("IEPDF_V23|STATE_PREVIOUS|" + JSON.stringify({order: previous.map((file) => ({id: file.id, name: file.name})), draggedId, targetId}));' + "`r`n"
    $pageFunction = $pageFunction.Substring(0, $stateMatch.Index + $stateMatch.Length) + "`r`n" + $stateInsert + $pageFunction.Substring($stateMatch.Index + $stateMatch.Length)

    $returnRegex = '(?s)return\s+updated\s*;'
    $returnMatch = [regex]::Match($pageFunction, $returnRegex)
    if (-not $returnMatch.Success) { throw "Reorder return updated not found inside handleReorderFiles." }

    $returnInsert = '            console.log("IEPDF_V23|STATE_NEXT|" + JSON.stringify({order: updated.map((file) => ({id: file.id, name: file.name}))}));' + "`r`n"
    $pageFunction = $pageFunction.Substring(0, $returnMatch.Index) + $returnInsert + $returnMatch.Value + $pageFunction.Substring($returnMatch.Index + $returnMatch.Length)

    $PagePatchedText =
        $PageOriginal.Substring(0, $pageRegion2.Start) +
        $pageFunction +
        $PageOriginal.Substring($pageRegion2.End)

    [System.IO.File]::WriteAllText($Component, $WsPatchedText, $Utf8NoBom)
    $WsPatched = $true
    [System.IO.File]::WriteAllText($PageFile, $PagePatchedText, $Utf8NoBom)
    $PagePatched = $true

    Write-Host "Temporary instrumentation applied."
    Write-Host ""

    Write-Host "=== TEMPORARY TYPESCRIPT CHECK ==="
    Push-Location $Root
    & pnpm exec tsc --noEmit
    $tsExit = $LASTEXITCODE
    Pop-Location
    if ($tsExit -ne 0) { throw "TypeScript failed after temporary instrumentation." }
    Write-Host "TypeScript PASS."
    Write-Host ""

    $fixtures = @(Get-ChildItem -LiteralPath $RegDir -Filter "*.pdf" -File | Sort-Object Name)
    if ($fixtures.Count -lt 3) { throw "Need at least 3 PDF fixtures in $RegDir. Found $($fixtures.Count)." }

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
  if (!fs.existsSync(chromePath)) throw new Error("Chrome not found: " + chromePath);

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

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
    `http://localhost:3000/merge-pdf?gate23v53=${Date.now()}`,
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

  const rows = [await rowFor(0), await rowFor(1), await rowFor(2)];
  const handles = rows.map(row =>
    row.locator('[draggable="true"][aria-label*="Drag PDF"]').first()
  );

  const beforeText = await page.locator("body").innerText();
  log("BEFORE_ORDER " + JSON.stringify(
    names.map(n => ({ name: n, position: beforeText.indexOf(n) }))
  ));

  await page.evaluate(() => {
    window.__IEPDF_V23_EVENTS = [];

    for (const eventName of [
      "dragstart", "dragenter", "dragover",
      "dragleave", "drop", "dragend"
    ]) {
      document.addEventListener(eventName, event => {
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
          target: handle ? "HANDLE" : "OTHER",
          aria: handle?.getAttribute("aria-label") || null,
          types,
          text,
          defaultPrevented: event.defaultPrevented,
          time: Math.round(performance.now())
        });
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

  log("=== NATIVE EVENT TRACE ===");
  const events = await page.evaluate(() => window.__IEPDF_V23_EVENTS || []);
  for (const event of events) log("EVENT " + JSON.stringify(event));

  log("=== APPLICATION CALLBACK TRACE ===");
  log("APP_LOG_COUNT " + appLogs.length);
  for (const item of appLogs) log("APP_TRACE " + item);

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
  log("FINAL_ROW_COUNT " + await page.getByRole("button", { name: /Remove PDF/i }).count());
  log("PAGE_ERRORS " + JSON.stringify(pageErrors));
  log("FAILED_REQUESTS " + JSON.stringify(failedRequests));

  fs.writeFileSync(report, lines.join("\n"), "utf8");
  await browser.close();

  console.log("");
  console.log("GATE 2.3 V5.3 COMPLETE");
  console.log("Expected reorder observed: " + expected);
  console.log("Report: " + report);
})().catch(e => {
  console.error("GATE_2_3_V5_3_FATAL");
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
    if ($runnerExit -ne 0) { throw "Browser runner failed. Report: $Report" }
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
    if ($restoreExit -ne 0) { throw "POST-RESTORE TYPESCRIPT FAILED. STOP." }
    Write-Host "Post-restore TypeScript PASS."
}

Write-Host ""
Write-Host "============================================================"
Write-Host "GATE 2.3 V5.3 FINISHED"
Write-Host "Report: $Report"
Write-Host "SOURCE RESTORED"
Write-Host "NO GIT / NO DEPLOYMENT / NO CACHE DELETION"
Write-Host "============================================================"
