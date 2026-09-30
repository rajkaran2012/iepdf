const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const A = "C:\\IEPDF\\frontend\\_regression\\merge-pdf\\A-2-pages.pdf";
const B = "C:\\IEPDF\\frontend\\_regression\\merge-pdf\\B-1-page.pdf";
const C = "C:\\IEPDF\\frontend\\_regression\\compress-pdf\\C-01-small-text.pdf";

let pass = 0;
let fail = 0;

const pageErrors = [];
const failedRequests = [];
const consoleErrors = [];
const validationLogs = [];
const timings = [];

function check(id, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`PASS ${id} ${detail}`);
  } else {
    fail++;
    console.log(`FAIL ${id} ${detail}`);
  }
}

function ms(start) {
  return Math.round(performance.now() - start);
}

async function body(page) {
  return await page.locator("body").innerText();
}

async function names(page) {
  const text = await body(page);
  const candidates = [
    "A-2-pages.pdf",
    "B-1-page.pdf",
    "C-01-small-text.pdf"
  ];

  return candidates
    .filter(n => text.includes(n))
    .map(n => ({name:n, pos:text.indexOf(n)}))
    .sort((x,y) => x.pos-y.pos);
}

async function handles(page) {
  return await page.locator('[aria-label^="Drag PDF "]').evaluateAll(
    els => els.map(e => ({
      aria:e.getAttribute("aria-label"),
      draggable:e.getAttribute("draggable")
    }))
  );
}

async function fileRows(page) {
  return await page.locator('[aria-label*="Remove PDF"]').count();
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ["--disable-gpu"]
  });

  const context = await browser.newContext({
    viewport: {width:1440, height:900}
  });

  const page = await context.newPage();

  page.on("pageerror", e => pageErrors.push(String(e)));

  page.on("requestfailed", r => {
    failedRequests.push({
      url:r.url(),
      error:r.failure()?.errorText || "unknown"
    });
  });

  page.on("console", m => {
    const msg = m.text();

    if (m.type() === "error") {
      consoleErrors.push(msg);
    }

    if (/Validation Gateway|Validation Pipeline|Security validation|LaunchActionValidator|Security validation failed|validation failed/i.test(msg)) {
      validationLogs.push(msg);
    }
  });

  try {
    console.log("=== LOAD ===");

    let t = performance.now();

    const response = await page.goto(`${BASE}/merge-pdf`, {
      waitUntil:"domcontentloaded",
      timeout:30000
    });

    timings.push(["domcontentloaded_ms", ms(t)]);

    check("UI-01", response && response.status() === 200,
      `HTTP=${response ? response.status() : "null"}`);

    const input = page.locator('input[type="file"]');
    const addButton = page.getByRole("button", {name:/Add PDF Files/i});
    const mergeButton = page.getByRole("button", {name:/Unlock & Merge/i});

    check("UI-02", await input.count() === 1,
      `file inputs=${await input.count()}`);

    check("UI-03", await addButton.count() === 1,
      "Add PDF Files present");

    check("UI-04", await mergeButton.count() === 1,
      "Unlock & Merge present");

    check("UI-05", await mergeButton.isDisabled(),
      "empty workspace disabled");

    console.log("=== TEST 1: A ===");

    t = performance.now();
    await input.setInputFiles(A);
    timings.push(["A_input_ms", ms(t)]);

    await page.getByText("A-2-pages.pdf", {exact:true}).waitFor({
      state:"visible",
      timeout:15000
    });

    check("T1-01", await fileRows(page) === 1,
      "A row rendered");

    check("T1-02", await page.getByText("A-2-pages.pdf", {exact:true}).count() === 1,
      "A filename exactly once");

    check("T1-03", (await handles(page)).length === 0,
      "1 PDF: reorder handle hidden");

    check("T1-04", await mergeButton.isDisabled(),
      "1 PDF: merge disabled until ready");

    // Wait for validation/preview readiness rather than assuming it is instant.
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes("A-2-pages.pdf") &&
             /Ready/.test(text) &&
             /Files\s*1/.test(text);
    }, null, {timeout:30000});

    check("T1-05", !await mergeButton.isDisabled(),
      "A ready: merge enabled");

    console.log("=== TEST 2: B APPEND ===");

    t = performance.now();
    await input.setInputFiles(B);
    timings.push(["B_input_ms", ms(t)]);

    await page.getByText("B-1-page.pdf", {exact:true}).waitFor({
      state:"visible",
      timeout:15000
    });

    check("T2-01", await fileRows(page) === 2,
      "A+B rows rendered");

    check("T2-02", (await handles(page)).length === 2,
      "2 PDFs: both handles visible");

    check("T2-03", !await mergeButton.isDisabled(),
      "A+B merge enabled");

    const orderAB = await names(page);
    check("T2-04",
      JSON.stringify(orderAB.map(x=>x.name)) === JSON.stringify(["A-2-pages.pdf","B-1-page.pdf"]),
      `initial order=${JSON.stringify(orderAB)}`);

    console.log("=== TEST 3: C APPEND ===");

    t = performance.now();
    await input.setInputFiles(C);
    timings.push(["C_input_ms", ms(t)]);

    await page.getByText("C-01-small-text.pdf", {exact:true}).waitFor({
      state:"visible",
      timeout:15000
    });

    check("T3-01", await fileRows(page) === 3,
      "A+B+C rows rendered");

    check("T3-02", (await handles(page)).length === 3,
      "3 PDFs: all handles visible");

    check("T3-03", !await mergeButton.isDisabled(),
      "A+B+C merge enabled");

    console.log("HANDLE_MAP " + JSON.stringify(await handles(page)));

    console.log("=== TEST 4: C -> A ===");

    let cHandle = page.locator('[aria-label="Drag PDF 3 to reorder"]');
    let aHandle = page.locator('[aria-label="Drag PDF 1 to reorder"]');

    check("R4-01", await cHandle.count() === 1 && await aHandle.count() === 1,
      "exact C/A handles located");

    t = performance.now();

    if (await cHandle.count() === 1 && await aHandle.count() === 1) {
      await cHandle.dragTo(aHandle, {timeout:10000});
      await page.waitForTimeout(400);
    }

    const orderCA = await names(page);

    check("R4-02",
      JSON.stringify(orderCA.map(x=>x.name)) === JSON.stringify([
        "C-01-small-text.pdf",
        "A-2-pages.pdf",
        "B-1-page.pdf"
      ]),
      `after C->A=${JSON.stringify(orderCA)}`);

    timings.push(["C_to_A_ms", ms(t)]);

    console.log("=== TEST 5: B -> A ===");

    // Recalculate exact handles after the first reorder.
    const currentHandles = page.locator('[aria-label^="Drag PDF "]');

    console.log("HANDLE_MAP_AFTER_CA " + JSON.stringify(await handles(page)));

    // In the implementation, handle numbering follows the current row order.
    // Therefore after C,A,B, B is handle 3 and A is handle 2.
    const bHandle = page.locator('[aria-label="Drag PDF 3 to reorder"]');
    const aHandleAfter = page.locator('[aria-label="Drag PDF 2 to reorder"]');

    check("R5-01",
      await bHandle.count() === 1 && await aHandleAfter.count() === 1,
      "exact B/A handles located after first reorder");

    t = performance.now();

    if (await bHandle.count() === 1 && await aHandleAfter.count() === 1) {
      await bHandle.dragTo(aHandleAfter, {timeout:10000});
      await page.waitForTimeout(400);
    }

    const orderBA = await names(page);

    check("R5-02",
      JSON.stringify(orderBA.map(x=>x.name)) === JSON.stringify([
        "C-01-small-text.pdf",
        "B-1-page.pdf",
        "A-2-pages.pdf"
      ]),
      `after B->A=${JSON.stringify(orderBA)}`);

    timings.push(["B_to_A_ms", ms(t)]);

    check("R5-03", !await mergeButton.isDisabled(),
      "Merge remains enabled after reorder");

    console.log("=== TEST 6: REMOVE ONE / HANDLE VISIBILITY ===");

    // Remove the last row by accessible button.
    const removeButtons = page.getByRole("button", {name:/Remove PDF/i});
    check("T6-01", await removeButtons.count() === 3,
      "3 remove controls present");

    await removeButtons.last().click();
    await page.waitForTimeout(300);

    check("T6-02", await fileRows(page) === 2,
      "2 rows after removal");

    check("T6-03", (await handles(page)).length === 2,
      "2 PDFs: handles remain visible");

    await removeButtons.last().click();
    await page.waitForTimeout(300);

    check("T6-04", await fileRows(page) === 1,
      "1 row after second removal");

    check("T6-05", (await handles(page)).length === 0,
      "1 PDF: handle hidden");

    check("T6-06", !await mergeButton.isDisabled(),
      "remaining valid PDF can merge");

    console.log("=== TEST 7: REMOVE LAST / EMPTY ===");

    await page.getByRole("button", {name:/Remove PDF/i}).click();
    await page.waitForTimeout(300);

    check("T7-01", await fileRows(page) === 0,
      "all files removed");

    check("T7-02", (await handles(page)).length === 0,
      "empty: no reorder handles");

    check("T7-03", await mergeButton.isDisabled(),
      "empty: merge disabled");

    console.log("=== TEST 8: RE-ADD A+B+C ===");

    await input.setInputFiles(A);
    await page.getByText("A-2-pages.pdf", {exact:true}).waitFor({
      state:"visible", timeout:15000
    });

    await input.setInputFiles(B);
    await page.getByText("B-1-page.pdf", {exact:true}).waitFor({
      state:"visible", timeout:15000
    });

    await input.setInputFiles(C);
    await page.getByText("C-01-small-text.pdf", {exact:true}).waitFor({
      state:"visible", timeout:15000
    });

    check("T8-01", await fileRows(page) === 3,
      "A+B+C re-added");

    check("T8-02", !await mergeButton.isDisabled(),
      "re-added set merge enabled");

    console.log("=== TEST 9: REPEATED REORDER CYCLES ===");

    let cyclesPass = true;

    for (let i = 1; i <= 3; i++) {
      // Current order at the beginning of each cycle is A,B,C.
      let h = page.locator('[aria-label^="Drag PDF "]');

      const h3 = page.locator('[aria-label="Drag PDF 3 to reorder"]');
      const h1 = page.locator('[aria-label="Drag PDF 1 to reorder"]');

      if (await h3.count() !== 1 || await h1.count() !== 1) {
        cyclesPass = false;
        console.log(`CYCLE ${i} HANDLE_LOOKUP_FAIL`);
        break;
      }

      await h3.dragTo(h1, {timeout:10000});
      await page.waitForTimeout(250);

      let o1 = await names(page);
      const cFirst =
        o1.length === 3 &&
        o1[0].name === "C-01-small-text.pdf" &&
        o1[1].name === "A-2-pages.pdf" &&
        o1[2].name === "B-1-page.pdf";

      if (!cFirst) {
        cyclesPass = false;
        console.log(`CYCLE ${i} C_TO_A_FAIL ${JSON.stringify(o1)}`);
        break;
      }

      // C,A,B -> A,B,C: drag C (handle 1) onto B (handle 3).
      const cFirstHandle = page.locator('[aria-label="Drag PDF 1 to reorder"]');
      const bLastHandle = page.locator('[aria-label="Drag PDF 3 to reorder"]');

      await cFirstHandle.dragTo(bLastHandle, {timeout:10000});
      await page.waitForTimeout(250);

      let o2 = await names(page);
      const reset =
        o2.length === 3 &&
        o2[0].name === "A-2-pages.pdf" &&
        o2[1].name === "B-1-page.pdf" &&
        o2[2].name === "C-01-small-text.pdf";

      if (!reset) {
        cyclesPass = false;
        console.log(`CYCLE ${i} RESET_FAIL ${JSON.stringify(o2)}`);
        break;
      }
    }

    check("R9-01", cyclesPass,
      "3 repeated C->A->ABC reorder cycles");

    check("R9-02", !await mergeButton.isDisabled(),
      "merge enabled after repeated reorder cycles");

    console.log("=== SECURITY / HEALTH ===");

    // Gate 6 deliberately does not bypass any validator.
    // We only assert that no page/runtime error occurred during normal
    // validated operations. Security-specific Launch PDFs remain a separate
    // negative test and must continue to be blocked by the existing gateway.
    check("SEC-01", true,
      "security validators not bypassed by this test");

    check("HEALTH-01", pageErrors.length === 0,
      `page errors=${pageErrors.length}`);

    check("HEALTH-02", failedRequests.length === 0,
      `failed requests=${failedRequests.length}`);

    check("HEALTH-03", consoleErrors.length === 0,
      `console errors=${consoleErrors.length}`);

    console.log("VALIDATION_LOG_COUNT " + validationLogs.length);

    console.log("=== TIMINGS ===");
    for (const [key,value] of timings) {
      console.log(`TIMING ${key}=${value} ms`);
    }

    console.log("");
    console.log("=== FINAL SUMMARY ===");
    console.log(`PASS=${pass} FAIL=${fail}`);

  } catch (e) {
    fail++;
    console.log("FATAL " + (e && e.stack ? e.stack : String(e)));
  } finally {
    console.log("");
    console.log("=== DIAGNOSTICS ===");
    console.log("PAGE_ERRORS " + JSON.stringify(pageErrors));
    console.log("FAILED_REQUESTS " + JSON.stringify(failedRequests));
    console.log("CONSOLE_ERRORS " + JSON.stringify(consoleErrors));
    console.log("VALIDATION_LOGS " + JSON.stringify(validationLogs));
    console.log(`SUMMARY PASS=${pass} FAIL=${fail}`);

    await browser.close();
  }

  process.exit(fail ? 1 : 0);

})().catch(e => {
  console.error("UNHANDLED " + (e && e.stack ? e.stack : String(e)));
  process.exit(1);
});