$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $RegDir "merge-reorder-production-gate-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-reorder-production-gate-runner-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null

Write-Host "============================================================"
Write-Host "iePDF MERGE PDF - PRODUCTION GATE 2: REORDER TEST"
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

function name(p) {
  return p.split(/[\\/]/).pop();
}

const AName = name(A);
const BName = name(B);
const CName = name(C);

function record(id, ok, detail) {
  const line = `${ok ? "PASS" : "FAIL"} ${id} - ${detail}`;
  results.push(line);
  console.log(line);
}

async function state(page) {
  return await page.evaluate(() => {
    const body = document.body?.innerText || "";

    const rows = [...document.querySelectorAll("button")].filter(b =>
      /Remove PDF/i.test((b.innerText || "").trim())
    );

    const merge = [...document.querySelectorAll("button")].find(b =>
      /Unlock\s*&\s*Merge/i.test((b.innerText || "").trim())
    );

    const draggable = [...document.querySelectorAll("[draggable='true']")]
      .filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });

    // Use the visible PDF row structure rather than generic draggable text.
    const pdfRows = [...document.querySelectorAll("div")]
      .filter(el => {
        const t = (el.innerText || "").trim();
        return /Remove PDF/i.test(t) && /\d+\s*Pages/i.test(t);
      })
      .map(el => (el.innerText || "").trim());

    return {
      body,
      removeCount: rows.length,
      mergeDisabled: merge ? merge.disabled : null,
      draggableCount: draggable.length,
      pdfRows
    };
  });
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

async function waitForRows(page, n, timeout = 20000) {
  return page.waitForFunction(
    count => [...document.querySelectorAll("button")]
      .filter(b => /Remove PDF/i.test((b.innerText || "").trim()))
      .length >= count,
    n,
    { timeout }
  ).then(() => true).catch(() => false);
}

async function fresh(page) {
  await page.goto(
    `http://localhost:3000/merge-pdf?reorderGate=${Date.now()}`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await page.waitForTimeout(700);
}

async function add(page, paths) {
  await page.locator('input[type="file"]').first().setInputFiles(paths);
}

async function getHandleBoxes(page) {
  return await page.evaluate(() => {
    const candidates = [...document.querySelectorAll("button")];

    return candidates
      .filter(b => {
        const text = (b.innerText || "").trim();
        const aria = b.getAttribute("aria-label") || "";
        const title = b.getAttribute("title") || "";
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 &&
          (/drag/i.test(aria) || /drag/i.test(title) ||
           (/Remove PDF/i.test(
             [...(b.parentElement?.innerText || "")].join("")
           ) && text === ""));
      })
      .map(b => {
        const r = b.getBoundingClientRect();
        return {
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
          text: (b.innerText || "").trim(),
          aria: b.getAttribute("aria-label") || "",
          title: b.getAttribute("title") || ""
        };
      });
  });
}

async function rowCenters(page) {
  return await page.evaluate(() => {
    const rows = [...document.querySelectorAll("button")].filter(b =>
      /Remove PDF/i.test((b.innerText || "").trim())
    );

    return rows.map(b => {
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
  });
}

async function reorderUsingHandle(page, fromIndex, toIndex) {
  const handles = await getHandleBoxes(page);

  // The frozen UI intentionally exposes a dedicated drag handle once
  // two or more PDFs exist. Prefer a visible small button with drag metadata.
  let handle = handles[fromIndex];

  if (!handle) {
    // Fallback: locate the row and its first button that is not Remove PDF.
    const rowData = await page.evaluate((idx) => {
      const rows = [...document.querySelectorAll("button")].filter(b =>
        /Remove PDF/i.test((b.innerText || "").trim())
      );
      const row = rows[idx]?.parentElement?.parentElement;
      if (!row) return null;

      const buttons = [...row.querySelectorAll("button")].filter(b => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 &&
          !/Remove PDF/i.test((b.innerText || "").trim());
      });

      if (!buttons.length) return null;
      const r = buttons[0].getBoundingClientRect();

      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, fromIndex);

    handle = rowData;
  }

  const centers = await rowCenters(page);
  if (!handle || !centers[toIndex]) return false;

  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.move(centers[toIndex].x, centers[toIndex].y, { steps: 12 });
  await page.waitForTimeout(350);
  await page.mouse.up();
  await page.waitForTimeout(900);

  return true;
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

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

  await fresh(page);
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

  // ------------------------------------------------------------
  // REORDER FIXTURE
  // ------------------------------------------------------------

  await add(page, [A, B, C]);

  const allNames = await waitForNames(page, [AName, BName, CName]);
  const allRows = await waitForRows(page, 3);

  record(
    "R0-01",
    allNames && allRows,
    "A+B+C loaded before reorder"
  );

  const initialBody = (await state(page)).body;

  record(
    "R0-02",
    initialBody.indexOf(AName) >= 0 &&
    initialBody.indexOf(BName) >= 0 &&
    initialBody.indexOf(CName) >= 0,
    "all three filenames visible"
  );

  // ------------------------------------------------------------
  // HANDLE VISIBILITY
  // ------------------------------------------------------------

  const handleCount = await page.evaluate(() => {
    const els = [...document.querySelectorAll("[draggable='true']")];
    return els.filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).length;
  });

  record(
    "R1-01",
    handleCount >= 3,
    `visible draggable row elements=${handleCount}`
  );

  // ------------------------------------------------------------
  // REORDER #1: C -> A
  // Expected order: C, A, B
  // ------------------------------------------------------------

  const op1 = await reorderUsingHandle(page, 2, 0);

  const order1 = await page.evaluate(([a, b, c]) => {
    const text = document.body?.innerText || "";
    return {
      a: text.indexOf(a),
      b: text.indexOf(b),
      c: text.indexOf(c)
    };
  }, [AName, BName, CName]);

  const passOrder1 =
    op1 &&
    order1.c >= 0 &&
    order1.a > order1.c &&
    order1.b > order1.a;

  record(
    "R2-01",
    passOrder1,
    `C -> A; expected order C, A, B; positions C=${order1.c}, A=${order1.a}, B=${order1.b}`
  );

  // ------------------------------------------------------------
  // REORDER #2: B -> A
  // Expected order: B, C, A
  // ------------------------------------------------------------

  const op2 = await reorderUsingHandle(page, 2, 0);

  const order2 = await page.evaluate(([a, b, c]) => {
    const text = document.body?.innerText || "";
    return {
      a: text.indexOf(a),
      b: text.indexOf(b),
      c: text.indexOf(c)
    };
  }, [AName, BName, CName]);

  const passOrder2 =
    op2 &&
    order2.b >= 0 &&
    order2.c > order2.b &&
    order2.a > order2.c;

  record(
    "R2-02",
    passOrder2,
    `B -> A; expected order B, C, A; positions B=${order2.b}, C=${order2.c}, A=${order2.a}`
  );

  // ------------------------------------------------------------
  // REORDER #3: A -> C
  // Expected order: B, A, C
  // ------------------------------------------------------------

  const op3 = await reorderUsingHandle(page, 2, 1);

  const order3 = await page.evaluate(([a, b, c]) => {
    const text = document.body?.innerText || "";
    return {
      a: text.indexOf(a),
      b: text.indexOf(b),
      c: text.indexOf(c)
    };
  }, [AName, BName, CName]);

  const passOrder3 =
    op3 &&
    order3.b >= 0 &&
    order3.a > order3.b &&
    order3.c > order3.a;

  record(
    "R2-03",
    passOrder3,
    `A -> C; expected order B, A, C; positions B=${order3.b}, A=${order3.a}, C=${order3.c}`
  );

  // ------------------------------------------------------------
  // FINAL STATE / MERGE ENABLE
  // ------------------------------------------------------------

  const finalState = await state(page);

  record(
    "R3-01",
    finalState.removeCount === 3,
    `three PDF rows remain after reorder=${finalState.removeCount}`
  );

  record(
    "R3-02",
    finalState.mergeDisabled === false,
    `Merge enabled after reorder=${!finalState.mergeDisabled}`
  );

  // ------------------------------------------------------------
  // HEALTH
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
    "iePDF MERGE PDF - PRODUCTION GATE 2: REORDER TEST",
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
  console.error("REORDER_GATE_FATAL");
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
    Write-Host "=== BROWSER REORDER TEST ==="

    Push-Location $Root
    & node $Runner $Report $A $B $C
    $exitCode = $LASTEXITCODE
    Pop-Location

    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "PRODUCTION GATE 2 - REORDER: PASS"
    }
    elseif ($exitCode -eq 2) {
        Write-Host ""
        Write-Host "PRODUCTION GATE 2 - REORDER: FAIL"
    }
    else {
        Write-Host ""
        Write-Host "PRODUCTION GATE 2 - REORDER: ERROR"
    }
}
catch {
    Write-Host ""
    Write-Host "PRODUCTION GATE 2 ERROR:"
    Write-Host $_.Exception.Message
}
finally {
    if (Test-Path -LiteralPath $Runner) {
        Remove-Item -LiteralPath $Runner -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "PRODUCTION GATE 2 - REORDER TEST COMPLETE"
    Write-Host "Report: $Report"
    Write-Host "NO SOURCE CHANGES"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"
    Write-Host "============================================================"
}
