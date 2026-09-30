const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const A = "C:\\IEPDF\\frontend\\_regression\\merge-pdf\\A-2-pages.pdf";

const pageErrors = [];
const failedRequests = [];
const consoleErrors = [];
const hmrRequests = [];
const runtimeLogs = [];

function log(msg) {
  console.log(msg);
}

function hasHmr(value) {
  return String(value).includes("/_next/hmr") ||
         String(value).includes("webpack-hmr") ||
         String(value).includes("next-dev");
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: [
      "--disable-gpu",
      "--disable-background-networking"
    ]
  });

  const context = await browser.newContext({
    viewport: {width: 1440, height: 900}
  });

  const page = await context.newPage();

  page.on("pageerror", e => {
    pageErrors.push(String(e));
  });

  page.on("request", r => {
    if (hasHmr(r.url())) {
      hmrRequests.push({
        type: "request",
        url: r.url(),
        method: r.method()
      });
    }
  });

  page.on("requestfailed", r => {
    failedRequests.push({
      url: r.url(),
      error: r.failure()?.errorText || "unknown"
    });
  });

  page.on("console", m => {
    const msg = m.text();

    if (hasHmr(msg)) {
      hmrRequests.push({
        type: "console",
        text: msg
      });
      return;
    }

    if (m.type() === "error") {
      consoleErrors.push(msg);
    }
  });

  try {
    log("=== NAVIGATION ===");

    const navStart = performance.now();

    const response = await page.goto(`${BASE}/merge-pdf`, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    log(`HTTP_STATUS ${response ? response.status() : "null"}`);
    log(`NAVIGATION_DOMCONTENTLOADED_MS ${Math.round(performance.now() - navStart)}`);

    const html = await page.content();

    log(`HTML_LENGTH ${html.length}`);
    log(`HTML_HAS_HMR_REFERENCE ${hasHmr(html)}`);

    // Inspect all loaded script URLs.
    const scripts = await page.locator("script[src]").evaluateAll(
      els => els.map(e => e.src)
    );

    log("SCRIPT_URLS " + JSON.stringify(scripts));

    const hmrScripts = scripts.filter(hasHmr);
    log("HMR_SCRIPT_COUNT " + hmrScripts.length);

    // Runtime framework markers.
    const runtimeInfo = await page.evaluate(() => ({
      href: location.href,
      readyState: document.readyState,
      nextData: !!document.getElementById("__NEXT_DATA__"),
      bodyLength: document.body ? document.body.innerText.length : 0,
      fileInputs: document.querySelectorAll('input[type="file"]').length,
      addButtons: Array.from(document.querySelectorAll("button"))
        .filter(b => /Add PDF Files/i.test(b.innerText || "")).length,
      mergeButtons: Array.from(document.querySelectorAll("button"))
        .filter(b => /Unlock & Merge/i.test(b.innerText || "")).length
    }));

    log("RUNTIME_INFO " + JSON.stringify(runtimeInfo));

    log("=== REACT INPUT DIAGNOSTIC ===");

    const input = page.locator('input[type="file"]');

    if (await input.count() !== 1) {
      throw new Error("Expected exactly one file input.");
    }

    // Attach native event listeners before changing files.
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]');
      if (!input) return;

      window.__IEPDF_V5_EVENTS = [];

      input.addEventListener("input", () => {
        window.__IEPDF_V5_EVENTS.push({
          event: "native-input",
          files: input.files ? input.files.length : -1,
          time: Date.now()
        });
      }, true);

      input.addEventListener("change", () => {
        window.__IEPDF_V5_EVENTS.push({
          event: "native-change",
          files: input.files ? input.files.length : -1,
          time: Date.now()
        });
      }, true);
    });

    const fileInputStart = performance.now();

    await input.setInputFiles(A);

    log(`FILE_INJECTION_COMPLETE_MS ${Math.round(performance.now() - fileInputStart)}`);

    const immediate = await input.evaluate(el => ({
      files: el.files ? el.files.length : -1,
      name: el.files && el.files[0] ? el.files[0].name : null
    }));

    log("INPUT_IMMEDIATE_STATE " + JSON.stringify(immediate));

    await page.waitForTimeout(250);

    const events250 = await page.evaluate(() => window.__IEPDF_V5_EVENTS || []);
    log("NATIVE_EVENTS_250MS " + JSON.stringify(events250));

    const body250 = await page.locator("body").innerText();

    log("BODY_HAS_A_250MS " + body250.includes("A-2-pages.pdf"));

    // Inspect current React DOM/state proxies without changing source.
    const dom250 = await page.evaluate(() => ({
      removeButtons: Array.from(document.querySelectorAll("button"))
        .filter(b => /Remove/i.test(b.getAttribute("aria-label") || "") || /Remove/i.test(b.innerText || ""))
        .length,
      handles: document.querySelectorAll('[aria-label^="Drag PDF "]').length,
      bodyTextContainsA: document.body.innerText.includes("A-2-pages.pdf")
    }));

    log("DOM_250MS " + JSON.stringify(dom250));

    // Wait only for the application filename, but do not fail immediately.
    let rendered = false;

    try {
      await page.getByText("A-2-pages.pdf", {exact:true}).waitFor({
        state: "visible",
        timeout: 5000
      });
      rendered = true;
    } catch {}

    log("A_RENDERED_WITHIN_5S " + rendered);

    const eventsAfter = await page.evaluate(() => window.__IEPDF_V5_EVENTS || []);
    log("NATIVE_EVENTS_AFTER " + JSON.stringify(eventsAfter));

    const inputFinal = await input.evaluate(el => ({
      files: el.files ? el.files.length : -1,
      name: el.files && el.files[0] ? el.files[0].name : null
    }));

    log("INPUT_FINAL_STATE " + JSON.stringify(inputFinal));

    const finalDom = await page.evaluate(() => ({
      bodyText: document.body.innerText.slice(0, 12000),
      removeButtons: Array.from(document.querySelectorAll("button"))
        .filter(b => /Remove/i.test(b.getAttribute("aria-label") || "") || /Remove/i.test(b.innerText || ""))
        .map(b => b.innerText || b.getAttribute("aria-label")),
      handles: Array.from(document.querySelectorAll('[aria-label^="Drag PDF "]'))
        .map(e => e.getAttribute("aria-label"))
    }));

    log("FINAL_DOM " + JSON.stringify(finalDom));

    log("=== DIAGNOSTIC RESULT ===");
    log("HMR_REQUEST_COUNT " + hmrRequests.length);
    log("PAGE_ERROR_COUNT " + pageErrors.length);
    log("FAILED_REQUEST_COUNT " + failedRequests.length);
    log("CONSOLE_ERROR_COUNT " + consoleErrors.length);

    log("PAGE_ERRORS " + JSON.stringify(pageErrors));
    log("FAILED_REQUESTS " + JSON.stringify(failedRequests));
    log("CONSOLE_ERRORS " + JSON.stringify(consoleErrors));
    log("HMR_EVENTS " + JSON.stringify(hmrRequests));

    // V5 is diagnostic: a clean runtime is PASS only if no HMR, no page errors,
    // no failed requests, and the native change event fires. UI rendering is
    // reported separately so we can distinguish runtime/test issues.
    const nativeChange = eventsAfter.some(e => e.event === "native-change");
    const cleanHmr = hmrRequests.length === 0;
    const cleanPage = pageErrors.length === 0;
    const cleanRequests = failedRequests.length === 0;

    log(`V5_NATIVE_CHANGE ${nativeChange ? "PASS" : "FAIL"}`);
    log(`V5_HMR_CLEAN ${cleanHmr ? "PASS" : "FAIL"}`);
    log(`V5_PAGE_ERRORS_CLEAN ${cleanPage ? "PASS" : "FAIL"}`);
    log(`V5_REQUESTS_CLEAN ${cleanRequests ? "PASS" : "FAIL"}`);
    log(`V5_UI_RENDERED_A ${rendered ? "PASS" : "FAIL"}`);

    const diagnosticFailures =
      (nativeChange ? 0 : 1) +
      (cleanHmr ? 0 : 1) +
      (cleanPage ? 0 : 1) +
      (cleanRequests ? 0 : 1);

    log(`V5_DIAGNOSTIC_FAILURES ${diagnosticFailures}`);

    process.exit(diagnosticFailures ? 1 : 0);

  } catch (e) {
    log("FATAL " + (e && e.stack ? e.stack : String(e)));
    process.exit(1);
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error("UNHANDLED " + (e && e.stack ? e.stack : String(e)));
  process.exit(1);
});