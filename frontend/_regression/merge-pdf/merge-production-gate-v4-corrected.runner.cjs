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

function elapsed(start) {
  return Math.round(performance.now() - start);
}

async function bodyText(page) {
  return await page.locator("body").innerText();
}

async function handleCount(page) {
  return await page.locator('[aria-label^="Drag PDF "]').count();
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ["--disable-gpu"]
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  page.on("pageerror", e => pageErrors.push(String(e)));

  page.on("requestfailed", r => {
    failedRequests.push({
      url: r.url(),
      error: r.failure()?.errorText || "unknown"
    });
  });

  page.on("console", m => {
    if (m.type() === "error") {
      consoleErrors.push(m.text());
    }
  });

  try {
    console.log("=== LOAD ===");

    let t = performance.now();

    await page.goto(`${BASE}/merge-pdf`, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    timings.push(["page_domcontentloaded_ms", elapsed(t)]);

    check(
      "UI-01",
      await page.getByText("Merge PDF", { exact: true }).count() === 1,
      "Merge PDF page loaded"
    );

    const input = page.locator('input[type="file"]');

    check(
      "UI-02",
      await input.count() === 1,
      `file inputs=${await input.count()}`
    );

    check(
      "UI-03",
      await page.getByRole("button", { name: /Add PDF Files/i }).count() === 1,
      "Add PDF Files present"
    );

    const merge = page.getByRole("button", { name: /Unlock & Merge/i });

    check(
      "UI-04",
      await merge.count() === 1,
      "Unlock & Merge present"
    );

    check(
      "UI-05",
      await merge.isDisabled(),
      "empty workspace merge disabled"
    );

    console.log("=== A: INPUT -> STATE -> ROW ===");

    t = performance.now();

    await input.setInputFiles(A);

    timings.push(["A_input_injection_ms", elapsed(t)]);

    console.log(`INFO A input injected in ${timings[timings.length - 1][1]} ms`);

    // Stage 1: wait only for the filename.
    t = performance.now();

    try {
      await page.getByText("A-2-pages.pdf", { exact: true }).waitFor({
        state: "visible",
        timeout: 10000
      });

      check(
        "A-01",
        true,
        `A filename rendered in ${elapsed(t)} ms`
      );
    } catch (e) {
      check(
        "A-01",
        false,
        "A filename did not render within 10s"
      );

      console.log(
        "DEBUG_BODY_HAS_A",
        (await bodyText(page)).includes("A-2-pages.pdf")
      );

      console.log(
        "DEBUG_FILE_INPUT_VALUE",
        await input.evaluate(el => el.files ? el.files.length : -1)
      );
    }

    // Stage 2: independently wait for a row control.
    t = performance.now();

    try {
      await page.waitForFunction(() => {
        return document.querySelectorAll('button[aria-label*="Remove"]').length >= 1;
      }, null, { timeout: 15000 });

      check(
        "A-02",
        true,
        `A row/remove control rendered in ${elapsed(t)} ms`
      );
    } catch {
      check(
        "A-02",
        false,
        "A remove control did not render within 15s"
      );
    }

    check(
      "A-03",
      await handleCount(page) === 0,
      "one PDF: reorder handle hidden"
    );

    check(
      "A-04",
      await page.getByText("A-2-pages.pdf", { exact: true }).count() === 1,
      "A appears exactly once"
    );

    console.log("=== B: APPEND ===");

    t = performance.now();

    await input.setInputFiles(B);

    try {
      await page.getByText("B-1-page.pdf", { exact: true }).waitFor({
        state: "visible",
        timeout: 15000
      });

      check(
        "B-01",
        true,
        `B rendered in ${elapsed(t)} ms`
      );
    } catch {
      check(
        "B-01",
        false,
        "B filename did not render within 15s"
      );
    }

    try {
      await page.waitForFunction(() => {
        return document.querySelectorAll('[aria-label^="Drag PDF "]').length === 2;
      }, null, { timeout: 15000 });

      check(
        "B-02",
        true,
        "2 PDFs: both reorder handles visible"
      );
    } catch {
      check(
        "B-02",
        false,
        `reorder handles=${await handleCount(page)}`
      );
    }

    check(
      "B-03",
      !await merge.isDisabled(),
      "2-PDF merge enabled"
    );

    console.log("=== C: APPEND ===");

    t = performance.now();

    await input.setInputFiles(C);

    try {
      await page.getByText("C-01-small-text.pdf", { exact: true }).waitFor({
        state: "visible",
        timeout: 15000
      });

      check(
        "C-01",
        true,
        `C rendered in ${elapsed(t)} ms`
      );
    } catch {
      check(
        "C-01",
        false,
        "C filename did not render within 15s"
      );
    }

    try {
      await page.waitForFunction(() => {
        return document.querySelectorAll('[aria-label^="Drag PDF "]').length === 3;
      }, null, { timeout: 15000 });

      check(
        "C-02",
        true,
        "3 PDFs: all reorder handles visible"
      );
    } catch {
      check(
        "C-02",
        false,
        `reorder handles=${await handleCount(page)}`
      );
    }

    console.log("=== REORDER: EXACT HANDLE C -> A ===");

    const handlesBefore = page.locator('[aria-label^="Drag PDF "]');

    check(
      "R0-01",
      await handlesBefore.count() === 3,
      `3 handles before reorder=${await handlesBefore.count()}`
    );

    // Exact current mapping. This prevents the previous diagnostic mistake
    // where "Drag PDF 3" was accidentally mapped to the second row.
    const allLabels = await handlesBefore.evaluateAll(
      els => els.map(el => el.getAttribute("aria-label"))
    );

    console.log("HANDLE_LABELS_BEFORE " + JSON.stringify(allLabels));

    const cHandle = page.locator('[aria-label="Drag PDF 3 to reorder"]');
    const aHandle = page.locator('[aria-label="Drag PDF 1 to reorder"]');

    check(
      "R0-02",
      await cHandle.count() === 1 && await aHandle.count() === 1,
      "exact C and A handles located"
    );

    if (await cHandle.count() === 1 && await aHandle.count() === 1) {
      t = performance.now();

      await cHandle.dragTo(aHandle, { timeout: 10000 });

      // Give React one render cycle, then inspect actual filename order.
      await page.waitForTimeout(250);

      const afterText = await bodyText(page);

      const pC = afterText.indexOf("C-01-small-text.pdf");
      const pA = afterText.indexOf("A-2-pages.pdf");
      const pB = afterText.indexOf("B-1-page.pdf");

      const reorderOk =
        pC >= 0 &&
        pA >= 0 &&
        pB >= 0 &&
        pC < pA &&
        pA < pB;

      check(
        "R1-01",
        reorderOk,
        `expected C,A,B positions C=${pC} A=${pA} B=${pB}`
      );

      timings.push(["C_to_A_reorder_ms", elapsed(t)]);
    } else {
      check("R1-01", false, "exact C/A handles unavailable");
    }

    check(
      "R1-02",
      !await merge.isDisabled(),
      "Merge remains enabled after reorder"
    );

    console.log("=== REMOVE ALL ===");

    const removeButtons = page.getByRole("button", { name: /Remove/i });

    let guard = 20;

    while (await removeButtons.count() > 0 && guard-- > 0) {
      await removeButtons.last().click();
      await page.waitForTimeout(150);
    }

    check(
      "E-01",
      await removeButtons.count() === 0,
      "all files removable"
    );

    check(
      "E-02",
      await merge.isDisabled(),
      "empty workspace merge disabled"
    );

    check(
      "E-03",
      await handleCount(page) === 0,
      "empty workspace has no reorder handles"
    );

    console.log("=== HEALTH ===");

    check(
      "HEALTH-01",
      pageErrors.length === 0,
      `page errors=${pageErrors.length}`
    );

    check(
      "HEALTH-02",
      failedRequests.length === 0,
      `failed requests=${failedRequests.length}`
    );

    // No HMR should exist under pnpm start. Any real console error is reported.
    check(
      "HEALTH-03",
      consoleErrors.length === 0,
      `console errors=${consoleErrors.length}`
    );

    console.log("=== TIMINGS ===");

    for (const [name, value] of timings) {
      console.log(`TIMING ${name}=${value} ms`);
    }

  } catch (e) {
    fail++;
    console.log(
      "FATAL " + (e && e.stack ? e.stack : String(e))
    );
  } finally {
    console.log("");
    console.log("=== DIAGNOSTICS ===");
    console.log("PAGE_ERRORS " + JSON.stringify(pageErrors));
    console.log("FAILED_REQUESTS " + JSON.stringify(failedRequests));
    console.log("CONSOLE_ERRORS " + JSON.stringify(consoleErrors));
    console.log("");
    console.log(`SUMMARY PASS=${pass} FAIL=${fail}`);

    await browser.close();
  }

  process.exit(fail ? 1 : 0);

})().catch(e => {
  console.error(
    "UNHANDLED " + (e && e.stack ? e.stack : String(e))
  );
  process.exit(1);
});