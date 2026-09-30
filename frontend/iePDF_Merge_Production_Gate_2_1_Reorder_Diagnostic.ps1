$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $RegDir "merge-reorder-gate-2.1-diagnostic-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-reorder-gate-2.1-runner-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null

Write-Host "============================================================"
Write-Host "iePDF MERGE PDF - GATE 2.1 REORDER DIAGNOSTIC"
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

const AName = A.split(/[\\/]/).pop();
const BName = B.split(/[\\/]/).pop();
const CName = C.split(/[\\/]/).pop();

const logs = [];
const pageErrors = [];
const failedRequests = [];
const consoleErrors = [];

function log(line) {
  logs.push(line);
  console.log(line);
}

function safe(v) {
  try { return JSON.stringify(v); }
  catch (_) { return String(v); }
}

async function getRows(page) {
  return await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];

    const removeButtons = buttons.filter(b =>
      /Remove PDF/i.test((b.innerText || "").trim())
    );

    return removeButtons.map((remove, index) => {
      let row = remove.parentElement;

      // Walk upward until a container containing the filename is found.
      for (let i = 0; i < 6 && row; i++) {
        const text = (row.innerText || "").trim();
        if (/\d+\s*Pages/i.test(text)) break;
        row = row.parentElement;
      }

      const text = (row?.innerText || "").trim();

      const elements = row
        ? [...row.querySelectorAll("*")]
        : [];

      const handleCandidates = elements.filter(el => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;

        const aria = el.getAttribute("aria-label") || "";
        const title = el.getAttribute("title") || "";
        const draggable = el.getAttribute("draggable");

        return /drag/i.test(aria) ||
          /drag/i.test(title) ||
          draggable === "true";
      });

      const handles = handleCandidates.map(el => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          text: (el.innerText || "").trim(),
          aria: el.getAttribute("aria-label") || "",
          title: el.getAttribute("title") || "",
          draggable: el.getAttribute("draggable"),
          className: typeof el.className === "string" ? el.className : "",
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          centerX: r.x + r.width / 2,
          centerY: r.y + r.height / 2
        };
      });

      return {
        index,
        rowText: text,
        rowTop: row?.getBoundingClientRect().top ?? null,
        rowBottom: row?.getBoundingClientRect().bottom ?? null,
        handles
      };
    });
  });
}

async function getBodyOrder(page, names) {
  return await page.evaluate((wanted) => {
    const body = document.body?.innerText || "";
    return {
      positions: wanted.map(n => ({ name: n, position: body.indexOf(n) })),
      body
    };
  }, names);
}

async function waitForNames(page, names, timeout = 20000) {
  return page.waitForFunction(
    wanted => {
      const text = document.body?.innerText || "";
      return wanted.every(n => text.includes(n));
    },
    names,
    { timeout }
  ).then(() => true).catch(() => false);
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

async function add(page, paths) {
  await page.locator('input[type="file"]').first().setInputFiles(paths);
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

    if (msg.type() === "error") {
      consoleErrors.push(text);
    }

    if (/IEPDF_REORDER_DIAGNOSTIC/i.test(text)) {
      log(`APP-CONSOLE ${text}`);
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
    `http://localhost:3000/merge-pdf?reorderDiagnosticV21=${Date.now()}`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );

  await page.waitForTimeout(800);

  log(`ROUTE ${page.url()}`);
  log(`TITLE ${await page.title()}`);

  await add(page, [A, B, C]);

  const namesReady = await waitForNames(page, [AName, BName, CName]);
  const rowsReady = await waitForRows(page, 3);

  log(`LOAD namesReady=${namesReady} rowsReady=${rowsReady}`);

  const initial = await getRows(page);
  log(`INITIAL_ROWS ${safe(initial)}`);

  const initialOrder = await getBodyOrder(
    page,
    [AName, BName, CName]
  );
  log(`INITIAL_BODY_POSITIONS ${safe(initialOrder.positions)}`);

  // ------------------------------------------------------------
  // EXACT HANDLE IDENTIFICATION
  // ------------------------------------------------------------

  log("");
  log("=== HANDLE IDENTIFICATION ===");

  if (!initial.length) {
    log("NO_ROWS_FOUND");
  }

  initial.forEach((row, i) => {
    log(`ROW_${i} ${safe({
      text: row.rowText,
      handles: row.handles
    })}`);
  });

  // ------------------------------------------------------------
  // ATTACH CAPTURE LISTENERS TO THE ENTIRE DOCUMENT
  // ------------------------------------------------------------

  await page.evaluate(() => {
    window.__iepdfReorderDiag = [];

    const types = [
      "dragstart",
      "drag",
      "dragenter",
      "dragover",
      "dragleave",
      "drop",
      "dragend"
    ];

    for (const type of types) {
      document.addEventListener(type, event => {
        const target = event.target;
        const dt = event.dataTransfer;

        const item = {
          type,
          targetTag: target?.tagName || "",
          targetText: (target?.innerText || "").trim().slice(0, 120),
          targetClass: typeof target?.className === "string"
            ? target.className
            : "",
          defaultPrevented: event.defaultPrevented,
          types: dt ? [...dt.types] : [],
          effectAllowed: dt?.effectAllowed || "",
          dropEffect: dt?.dropEffect || ""
        };

        window.__iepdfReorderDiag.push(item);
        console.log(
          "IEPDF_REORDER_DIAGNOSTIC " +
          type + " " +
          JSON.stringify(item)
        );
      },
      true);
    }
  });

  // ------------------------------------------------------------
  // FIND THE MOST LIKELY ACTUAL HANDLE
  // ------------------------------------------------------------

  const handles = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("button")].filter(b =>
      /Remove PDF/i.test((b.innerText || "").trim())
    );

    return rows.map((remove, rowIndex) => {
      let row = remove.parentElement;

      for (let i = 0; i < 6 && row; i++) {
        if (/\d+\s*Pages/i.test((row.innerText || "").trim())) break;
        row = row.parentElement;
      }

      if (!row) return null;

      const candidates = [...row.querySelectorAll("*")]
        .filter(el => {
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return false;

          const text = (el.innerText || "").trim();
          const aria = el.getAttribute("aria-label") || "";
          const title = el.getAttribute("title") || "";
          const draggable = el.getAttribute("draggable");

          return draggable === "true" ||
            /drag/i.test(aria) ||
            /drag/i.test(title) ||
            (text === "⋮⋮" || text === "⋮⋮");
        })
        .map(el => {
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            text: (el.innerText || "").trim(),
            aria: el.getAttribute("aria-label") || "",
            title: el.getAttribute("title") || "",
            draggable: el.getAttribute("draggable"),
            className: typeof el.className === "string" ? el.className : "",
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            centerX: r.x + r.width / 2,
            centerY: r.y + r.height / 2
          };
        });

      return {
        rowIndex,
        rowText: (row.innerText || "").trim(),
        candidates
      };
    }).filter(Boolean);
  });

  log(`HANDLE_CANDIDATES ${safe(handles)}`);

  // ------------------------------------------------------------
  // TRY DRAG USING THE DEDICATED SMALL BUTTON/CANDIDATE
  // ------------------------------------------------------------

  const chosen = handles[2]?.candidates?.find(c =>
    c.width <= 60 && c.height <= 60
  ) ||
  handles[2]?.candidates?.find(c =>
    c.draggable === "true"
  ) ||
  handles[2]?.candidates?.[0];

  if (!chosen) {
    log("DRAG_ATTEMPT_SKIPPED_NO_HANDLE");
  } else {
    log(`CHOSEN_HANDLE ${safe(chosen)}`);

    // Target row 0 center.
    const rowTargets = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("button")].filter(b =>
        /Remove PDF/i.test((b.innerText || "").trim())
      );

      return rows.map(b => {
        const r = b.getBoundingClientRect();
        return {
          x: r.x + r.width / 2,
          y: r.y + r.height / 2
        };
      });
    });

    log(`ROW_TARGETS ${safe(rowTargets)}`);

    if (rowTargets.length >= 3) {
      log("DRAG_SEQUENCE C_TO_A_BEGIN");

      await page.mouse.move(chosen.centerX, chosen.centerY);
      await page.waitForTimeout(250);

      await page.mouse.down();
      await page.waitForTimeout(500);

      // Move enough distance to exceed normal drag threshold.
      await page.mouse.move(
        chosen.centerX - 10,
        chosen.centerY + 20,
        { steps: 5 }
      );

      await page.waitForTimeout(300);

      await page.mouse.move(
        rowTargets[0].x,
        rowTargets[0].y,
        { steps: 20 }
      );

      await page.waitForTimeout(700);
      await page.mouse.up();

      await page.waitForTimeout(1200);

      log("DRAG_SEQUENCE C_TO_A_END");

      const events = await page.evaluate(() =>
        window.__iepdfReorderDiag || []
      );

      log(`CAPTURED_EVENTS ${safe(events)}`);

      const after = await getBodyOrder(
        page,
        [AName, BName, CName]
      );

      log(`AFTER_BODY_POSITIONS ${safe(after.positions)}`);

      const afterRows = await getRows(page);
      log(`AFTER_ROWS ${safe(afterRows)}`);

      const moved =
        after.positions[2].position >= 0 &&
        after.positions[2].position < after.positions[0].position &&
        after.positions[0].position < after.positions[1].position;

      log(`C_TO_A_REORDER_OBSERVED ${moved}`);
    }
  }

  // ------------------------------------------------------------
  // DIRECT HTML5 DRAG DATA TEST
  // This is diagnostic only and does not alter application source.
  // It checks whether the actual drag-start handler exposes the
  // required internal MIME marker.
  // ------------------------------------------------------------

  log("");
  log("=== INTERNAL MARKER CHECK ===");

  const markerSource = await page.evaluate(() => {
    const scripts = [...document.scripts]
      .map(s => s.textContent || "")
      .filter(Boolean);

    return scripts.some(s =>
      s.includes("application/x-iepdf-reorder")
    );
  });

  log(`PAGE_INLINE_MARKER_VISIBLE ${markerSource}`);

  // ------------------------------------------------------------
  // HEALTH
  // ------------------------------------------------------------

  log("");
  log("=== HEALTH ===");
  log(`PAGE_ERRORS ${safe(pageErrors)}`);
  log(`FAILED_REQUESTS ${safe(failedRequests)}`);
  log(`CONSOLE_ERRORS ${safe(consoleErrors)}`);

  const output = [
    "iePDF MERGE PDF - GATE 2.1 REORDER DIAGNOSTIC",
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
  console.log("GATE 2.1 DIAGNOSTIC COMPLETE");
  console.log(`Report: ${report}`);
  console.log("NO SOURCE CHANGES");
  console.log("NO GIT");
  console.log("NO DEPLOYMENT");
  console.log("NO CACHE DELETION");
})().catch(err => {
  console.error("GATE_2_1_FATAL");
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
    Write-Host "=== RUNNING GATE 2.1 ==="

    Push-Location $Root
    & node $Runner $Report $A $B $C
    $exitCode = $LASTEXITCODE
    Pop-Location

    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "GATE 2.1 DIAGNOSTIC: COMPLETE"
    }
    else {
        Write-Host ""
        Write-Host "GATE 2.1 DIAGNOSTIC: ERROR"
    }
}
catch {
    Write-Host ""
    Write-Host "GATE 2.1 ERROR:"
    Write-Host $_.Exception.Message
}
finally {
    if (Test-Path -LiteralPath $Runner) {
        Remove-Item -LiteralPath $Runner -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "GATE 2.1 REORDER DIAGNOSTIC COMPLETE"
    Write-Host "Report: $Report"
    Write-Host "NO SOURCE CHANGES"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"
    Write-Host "============================================================"
}
