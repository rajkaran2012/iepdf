const { chromium } = require("C:/IEPDF/frontend/node_modules/playwright/index.js");

const BASE = "http://127.0.0.1:3000";
const A = "C:/IEPDF/frontend/_regression/merge-pdf/A-2-pages.pdf";
const B = "C:/IEPDF/frontend/_regression/merge-pdf/B-1-page.pdf";
const USERS = 50;
const PER_USER_TIMEOUT = 30000;
const GLOBAL_TIMEOUT = 90000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function userRun(browser, id) {
  const started = Date.now();
  const result = {
    id,
    ok: false,
    elapsedMs: null,
    errors: [],
    requestsFailed: 0,
    pageErrors: 0,
    consoleErrors: 0,
    download: false
  };

  let context;
  try {
    context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    page.on("requestfailed", req => {
      result.requestsFailed++;
      const f = req.failure();
      if (result.errors.length < 5) result.errors.push("requestfailed: " + req.url() + " " + (f?.errorText || ""));
    });
    page.on("pageerror", err => {
      result.pageErrors++;
      if (result.errors.length < 5) result.errors.push("pageerror: " + err.message);
    });
    page.on("console", msg => {
      if (msg.type() === "error") {
        result.consoleErrors++;
        if (result.errors.length < 5) result.errors.push("console: " + msg.text());
      }
    });

    await page.goto(BASE + "/merge-pdf", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });

    const input = page.locator('input[type="file"]').first();
    await input.waitFor({ state: "attached", timeout: 5000 });

    // One user gets one independent browser context.
    await input.setInputFiles([A, B]);

    await page.locator('text=A-2-pages.pdf').first().waitFor({
      state: "attached",
      timeout: 10000
    });
    await page.locator('text=B-1-page.pdf').first().waitFor({
      state: "attached",
      timeout: 10000
    });

    const merge = page.getByRole("button", { name: /Unlock & Merge/i }).first();

    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (!(await merge.isDisabled())) break;
      await sleep(100);
    }

    if (await merge.isDisabled()) {
      throw new Error("Merge button remained disabled");
    }

    const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
    await merge.click();
    const download = await downloadPromise;

    const suggested = download.suggestedFilename();
    if (!suggested || !/\.pdf$/i.test(suggested)) {
      throw new Error("Merge download was not a PDF: " + suggested);
    }

    result.download = true;
    result.ok = true;
    result.elapsedMs = Date.now() - started;
  } catch (e) {
    result.errors.push(String(e?.message || e));
    result.elapsedMs = Date.now() - started;
  } finally {
    if (context) {
      try { await context.close(); } catch {}
    }
  }
  return result;
}

(async () => {
  const hardStop = setTimeout(() => {
    console.error("GLOBAL_WATCHDOG_TIMEOUT");
    process.exit(124);
  }, GLOBAL_TIMEOUT);

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"
    });

    const started = Date.now();
    const jobs = [];
    for (let i = 1; i <= USERS; i++) {
      jobs.push(userRun(browser, i));
    }

    const results = await Promise.all(jobs);
    const elapsed = Date.now() - started;

    const passed = results.filter(r => r.ok).length;
    const failed = results.length - passed;
    const times = results.filter(r => r.elapsedMs != null).map(r => r.elapsedMs).sort((a,b)=>a-b);
    const p95 = times.length ? times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)] : null;
    const avg = times.length ? Math.round(times.reduce((a,b)=>a+b,0) / times.length) : null;
    const max = times.length ? Math.max(...times) : null;

    console.log("LOAD_SUMMARY|" + JSON.stringify({
      users: USERS, passed, failed, totalElapsedMs: elapsed,
      avgMs: avg, p95Ms: p95, maxMs: max,
      pageErrors: results.reduce((n,r)=>n+r.pageErrors,0),
      requestFailures: results.reduce((n,r)=>n+r.requestsFailed,0),
      consoleErrors: results.reduce((n,r)=>n+r.consoleErrors,0),
      downloads: results.filter(r=>r.download).length
    }));

    for (const r of results) {
      console.log("USER|" + JSON.stringify(r));
    }

    if (passed !== USERS || results.some(r => r.pageErrors || r.requestsFailed || r.consoleErrors)) {
      process.exitCode = 2;
    } else {
      process.exitCode = 0;
    }
  } catch (e) {
    console.error("RUNNER_FATAL|" + String(e?.stack || e));
    process.exitCode = 3;
  } finally {
    clearTimeout(hardStop);
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
})();