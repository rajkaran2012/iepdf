const { chromium } = require("playwright");
const fs = require("fs");

const base = "http://127.0.0.1:3000";
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const A = "C:\\IEPDF\\frontend\\_regression\\merge-pdf\\A-2-pages.pdf";
const B = "C:\\IEPDF\\frontend\\_regression\\merge-pdf\\B-1-page.pdf";
const C = "C:\\IEPDF\\frontend\\_regression\\compress-pdf\\C-01-small-text.pdf";

let pass = 0, fail = 0;
const results = [];
const pageErrors = [];
const failedRequests = [];
const consoleErrors = [];

function check(id, ok, detail) {
  if (ok) {
    pass++;
    console.log(`PASS ${id} ${detail || ""}`);
  } else {
    fail++;
    console.log(`FAIL ${id} ${detail || ""}`);
  }
  results.push({id, ok, detail});
}

function orderFromRows(page) {
  return page.locator('[aria-label^="Drag PDF "]').evaluateAll(els =>
    els.map(el => el.getAttribute("aria-label"))
  );
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chrome,
    args: ["--disable-gpu"]
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true
  });

  const page = await context.newPage();

  page.on("pageerror", e => pageErrors.push(String(e)));
  page.on("requestfailed", r => failedRequests.push({
    url: r.url(), error: r.failure()?.errorText || "unknown"
  }));
  page.on("console", m => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  try {
    await page.goto(`${base}/merge-pdf`, {waitUntil: "domcontentloaded", timeout: 30000});

    check("UI-01", await page.getByText("Merge PDF", {exact: true}).count() > 0,
      "Merge PDF page loaded");

    const inputs = page.locator('input[type="file"]');
    check("UI-02", await inputs.count() === 1, `file inputs=${await inputs.count()}`);

    const add = page.getByRole("button", {name: /Add PDF Files/i});
    check("UI-03", await add.count() === 1, `Add PDF Files buttons=${await add.count()}`);

    const merge = page.getByRole("button", {name: /Unlock & Merge/i});
    check("UI-04", await merge.count() === 1, `Merge buttons=${await merge.count()}`);
    check("UI-05", await merge.isDisabled(), "empty workspace merge disabled");

    // Use the real file input directly. This avoids relying on file-chooser timing.
    await inputs.setInputFiles(A);
    await page.waitForFunction(() =>
      document.querySelectorAll('[aria-label^="Drag PDF "]').length === 0 &&
      document.body.innerText.includes("A-2-pages.pdf")
    , null, {timeout: 30000});

    check("T1-01", await page.getByText("A-2-pages.pdf", {exact: true}).count() === 1,
      "A added");
    check("T1-02", await page.locator('[aria-label^="Drag PDF "]').count() === 0,
      "one PDF reorder handle hidden");

    // Add PDF Files is the current frozen append control.
    // Use the actual input again; React's onChange appends through the existing handler.
    await inputs.setInputFiles(B);
    await page.waitForFunction(() =>
      document.body.innerText.includes("A-2-pages.pdf") &&
      document.body.innerText.includes("B-1-page.pdf") &&
      document.querySelectorAll('[aria-label^="Drag PDF "]').length === 2
    , null, {timeout: 30000});

    check("T2-01", await page.locator('[aria-label^="Drag PDF "]').count() === 2,
      "two PDF reorder handles visible");

    check("T2-02", !(await merge.isDisabled()), "2-PDF merge enabled");

    await inputs.setInputFiles(C);
    await page.waitForFunction(() =>
      document.body.innerText.includes("C-01-small-text.pdf") &&
      document.querySelectorAll('[aria-label^="Drag PDF "]').length === 3
    , null, {timeout: 30000});

    check("T3-01", await page.locator('[aria-label^="Drag PDF "]').count() === 3,
      "three PDF reorder handles visible");

    let before = await orderFromRows(page);
    check("R0-01",
      JSON.stringify(before) === JSON.stringify([
        "Drag PDF 1 to reorder",
        "Drag PDF 2 to reorder",
        "Drag PDF 3 to reorder"
      ]),
      `initial handles=${JSON.stringify(before)}`);

    // Exact handle mapping: use accessible name, not position/generic locator.
    // Drag C (Drag PDF 3) onto A (Drag PDF 1).
    const cHandle = page.getByRole("button", {name: "Drag PDF 3 to reorder"});
    const aHandle = page.getByRole("button", {name: "Drag PDF 1 to reorder"});

    // Current implementation uses a draggable DIV rather than a button.
    // Fall back to exact aria-label locator when role=button is unavailable.
    const c = (await cHandle.count()) ? cHandle : page.locator('[aria-label="Drag PDF 3 to reorder"]');
    const a = (await aHandle.count()) ? aHandle : page.locator('[aria-label="Drag PDF 1 to reorder"]');

    check("R0-02", await c.count() === 1 && await a.count() === 1,
      "exact C/A handles located");

    await c.dragTo(a, {timeout: 10000});
    await page.waitForTimeout(500);

    let after = await orderFromRows(page);
    check("R1-01",
      JSON.stringify(after) === JSON.stringify([
        "Drag PDF 1 to reorder",
        "Drag PDF 2 to reorder",
        "Drag PDF 3 to reorder"
      ]),
      `post-drag handle labels=${JSON.stringify(after)}`);

    // Verify actual filename order in the DOM rather than handle numbering.
    const bodyText = await page.locator("body").innerText();
    const posC = bodyText.indexOf("C-01-small-text.pdf");
    const posA = bodyText.indexOf("A-2-pages.pdf");
    const posB = bodyText.indexOf("B-1-page.pdf");

    check("R1-02", posC >= 0 && posA >= 0 && posB >= 0 && posC < posA && posA < posB,
      `filename positions C=${posC}, A=${posA}, B=${posB}`);

    check("T3-02", !(await merge.isDisabled()), "merge remains enabled after reorder");

    // Remove all files via the current Remove controls, if present.
    const removeButtons = page.getByRole("button", {name: /Remove/i});
    const removeCount = await removeButtons.count();
    for (let i = removeCount - 1; i >= 0; i--) {
      await removeButtons.nth(i).click();
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(300);
    check("T4-01", await page.locator('[aria-label^="Drag PDF "]').count() === 0,
      "all files removed / handles gone");
    check("T4-02", await merge.isDisabled(), "empty workspace merge disabled");

    // Health checks.
    check("HEALTH-01", pageErrors.length === 0,
      `page errors=${pageErrors.length}`);
    const nonWorkerFailed = failedRequests.filter(x =>
      !x.url.includes("pdf.worker") && !x.url.includes("worker.min")
    );
    check("HEALTH-02", nonWorkerFailed.length === 0,
      `non-worker failed requests=${nonWorkerFailed.length}`);
    check("HEALTH-03", consoleErrors.length === 0,
      `console errors=${consoleErrors.length}`);

  } catch (e) {
    console.log("FATAL " + (e && e.stack ? e.stack : String(e)));
    fail++;
  } finally {
    console.log("");
    console.log("=== DETAILS ===");
    console.log("PAGE_ERRORS " + JSON.stringify(pageErrors));
    console.log("FAILED_REQUESTS " + JSON.stringify(failedRequests));
    console.log("CONSOLE_ERRORS " + JSON.stringify(consoleErrors));
    console.log("");
    console.log(`SUMMARY PASS=${pass} FAIL=${fail}`);
    await browser.close();
  }

  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error("UNHANDLED " + (e && e.stack ? e.stack : String(e)));
  process.exit(1);
});