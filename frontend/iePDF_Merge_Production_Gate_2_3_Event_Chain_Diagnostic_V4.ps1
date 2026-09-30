$ErrorActionPreference = "Stop"

$Root = "C:\IEPDF\frontend"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $RegDir "merge-reorder-gate-2.3-event-chain-v4-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-reorder-gate-2.3-event-chain-v4-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null

Write-Host "============================================================"
Write-Host "iePDF MERGE PDF - GATE 2.3 EVENT -> CALLBACK CHAIN DIAGNOSTIC V4"
Write-Host "============================================================"
Write-Host "READ-ONLY BROWSER INSTRUMENTATION"
Write-Host "NO SOURCE CHANGES"
Write-Host "NO GIT / NO DEPLOYMENT / NO CACHE DELETION"
Write-Host ""

$component = Join-Path $Root "components\MergeWorkspace.tsx"
$pageFile = Join-Path $Root "app\merge-pdf\page.tsx"

if (-not (Test-Path $component)) { throw "MergeWorkspace.tsx not found." }
if (-not (Test-Path $pageFile)) { throw "app/merge-pdf/page.tsx not found." }

$ws = [System.IO.File]::ReadAllText((Resolve-Path $component), [System.Text.UTF8Encoding]::new($false))
$page = [System.IO.File]::ReadAllText((Resolve-Path $pageFile), [System.Text.UTF8Encoding]::new($false))

Write-Host "=== CURRENT SOURCE AUDIT ==="
Write-Host ("Child callback signature present: " + $ws.Contains("onReorderFiles("))
Write-Host ("Internal MIME marker present: " + $ws.Contains("application/x-iepdf-reorder"))
Write-Host ("Row onDrop binding present: " + $ws.Contains("onDrop={(event)"))
Write-Host ("Parent handleReorderFiles present: " + $page.Contains("handleReorderFiles"))
Write-Host ("Parent state reorder logic present: " + $page.Contains("draggedIndex"))

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
const pageErrors = [];
const failedRequests = [];

function log(s) {
  lines.push(s);
  console.log(s);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on("pageerror", e => pageErrors.push(String(e?.stack || e)));
  page.on("requestfailed", r => failedRequests.push(
    `${r.method()} ${r.url()} :: ${r.failure()?.errorText || "unknown"}`
  ));

  await page.goto(
    `http://localhost:3000/merge-pdf?gate23v4=${Date.now()}`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );

  await page.waitForTimeout(1200);

  await page.locator('input[type="file"]').first().setInputFiles([A, B, C]);

  await page.waitForFunction(
    wanted => {
      const t = document.body?.innerText || "";
      return wanted.every(n => t.includes(n));
    },
    names,
    { timeout: 20000 }
  );

  await page.waitForFunction(
    n => [...document.querySelectorAll("button")]
      .filter(b => /Remove PDF/i.test((b.innerText || "").trim())).length >= n,
    3,
    { timeout: 20000 }
  );

  // Attach native capture listeners to the actual row/handle DOM nodes.
  // This does not modify application source or React state.
  await page.evaluate(() => {
    window.__IEPDF_V23_EVENTS = [];

    const push = (event, node, extra) => {
      try {
        const types = event.dataTransfer
          ? Array.from(event.dataTransfer.types)
          : [];

        const text = event.dataTransfer
          ? event.dataTransfer.getData("text/plain")
          : "";

        window.__IEPDF_V23_EVENTS.push({
          event,
          node,
          types,
          text,
          defaultPrevented: event.defaultPrevented,
          extra: extra || null,
          time: performance.now()
        });
      } catch (e) {
        window.__IEPDF_V23_EVENTS.push({
          event,
          node,
          error: String(e)
        });
      }
    };

    const eventNames = [
      "dragstart",
      "dragenter",
      "dragover",
      "dragleave",
      "drop",
      "dragend"
    ];

    for (const name of eventNames) {
      document.addEventListener(name, e => {
        const el = e.target instanceof Element ? e.target : null;
        const handle = el?.closest?.('[draggable="true"][aria-label*="Drag PDF"]');
        const row = el?.closest?.('[data-iepdf-reorder-row="true"]');

        let node = "OTHER";
        if (handle) node = "HANDLE";
        else if (row) node = "ROW";

        push(e, node, {
          aria: handle?.getAttribute("aria-label") || null,
          rowText: row?.innerText?.slice(0, 160) || null
        });
      }, true);
    }
  });

  // Mark rows only in the DOM for diagnostic targeting. This is not
  // application source and is removed with the page.
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")]
      .filter(b => /Remove PDF/i.test((b.innerText || "").trim()));

    buttons.forEach((remove, index) => {
      let row = remove.parentElement;
      for (let i = 0; i < 8 && row; i++, row = row.parentElement) {
        if (/\d+\s*Pages/i.test(row.innerText || "")) break;
      }
      if (row) row.setAttribute("data-iepdf-reorder-row", "true");
    });
  });

  const removes = page.getByRole("button", { name: /Remove PDF/i });

  async function rowFor(index) {
    let row = removes.nth(index).locator("..");
    for (let i = 0; i < 8; i++) {
      const txt = await row.innerText().catch(() => "");
      if (/\d+\s*Pages/i.test(txt)) break;
      row = row.locator("..");
    }
    return row;
  }

  const sourceRow = await rowFor(2);
  const targetRow = await rowFor(0);
  const source = sourceRow.locator('[draggable="true"][aria-label*="Drag PDF"]').first();

  log(`INITIAL_ORDER ${JSON.stringify(names.map(n => ({name:n, position:(await page.locator("body").innerText()).indexOf(n)})))}`);
  log(`SOURCE_HANDLE_COUNT ${await source.count()}`);
  log(`SOURCE_HANDLE ${JSON.stringify(await source.evaluate(el => ({
    draggable: el.getAttribute("draggable"),
    aria: el.getAttribute("aria-label"),
    title: el.getAttribute("title")
  })))}`);

  log("=== PLAYWRIGHT DRAG C -> A ===");

  try {
    await source.dragTo(targetRow, { timeout: 15000 });
    log("DRAGTO_OK true");
  } catch (e) {
    log("DRAGTO_OK false " + String(e?.message || e));
  }

  await page.waitForTimeout(1200);

  const eventDump = await page.evaluate(() => window.__IEPDF_V23_EVENTS || []);
  log("=== NATIVE EVENT TRACE ===");
  for (const e of eventDump) {
    log("EVENT " + JSON.stringify(e));
  }

  const afterText = await page.locator("body").innerText();
  const after = names.map(n => ({name:n, position:afterText.indexOf(n)}));
  log(`AFTER_ORDER ${JSON.stringify(after)}`);

  const c = after[2].position;
  const a = after[0].position;
  const b = after[1].position;
  log(`C_TO_A_EXPECTED ${c >= 0 && c < a && a < b}`);

  log("=== APP CALLBACK LOGS ===");
  // Application logs are captured through the normal console event below.

  log(`PAGE_ERRORS ${JSON.stringify(pageErrors)}`);
  log(`FAILED_REQUESTS ${JSON.stringify(failedRequests)}`);

  fs.writeFileSync(
    report,
    [
      "iePDF MERGE PDF - GATE 2.3 EVENT -> CALLBACK CHAIN DIAGNOSTIC V4",
      "",
      ...lines,
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
  console.log("GATE 2.3 V4 COMPLETE");
  console.log("Report: " + report);
  console.log("NO SOURCE CHANGES");
})().catch(e => {
  console.error("GATE_2_3_V4_FATAL");
  console.error(e?.stack || e);
  process.exitCode = 3;
});
'@

# Inject console capture into runner before navigation.
$runnerText = $runnerText.Replace(
'  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });',
@'
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on("console", msg => {
    const t = msg.text();
    if (t.includes("IEPDF_V23|")) {
      log("APP " + t);
    }
  });
'@
)

[System.IO.File]::WriteAllText($Runner, $runnerText, [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "=== RUNNING EVENT CHAIN DIAGNOSTIC ==="

Push-Location $Root
& node $Runner $Report $A $B $C
$exitCode = $LASTEXITCODE
Pop-Location

Write-Host "Runner exit code: $exitCode"

if (Test-Path $Runner) {
    Remove-Item $Runner -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "============================================================"
Write-Host "GATE 2.3 V4 COMPLETE"
Write-Host "Report: $Report"
Write-Host "NO SOURCE CHANGES"
Write-Host "NO GIT"
Write-Host "NO DEPLOYMENT"
Write-Host "NO CACHE DELETION"
Write-Host "============================================================"
