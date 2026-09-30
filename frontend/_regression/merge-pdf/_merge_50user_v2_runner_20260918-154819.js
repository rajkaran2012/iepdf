const { chromium } = require("C:/IEPDF/frontend/node_modules/playwright/index.js");

const BASE = "http://127.0.0.1:3000";
const A = "C:/IEPDF/frontend/_regression/merge-pdf/A-2-pages.pdf";
const B = "C:/IEPDF/frontend/_regression/merge-pdf/B-1-page.pdf";

const USERS = 50;
const WAVE_SIZE = 10;
const WAVE_DELAY = 750;
const USER_TIMEOUT = 45000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label + " timeout after " + ms + " ms")), ms);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function userRun(browser, id) {
  const started = Date.now();

  const result = {
    id,
    ok: false,
    elapsedMs: null,
    navigationMs: null,
    addMs: null,
    readyMs: null,
    mergeMs: null,
    download: false,
    pageErrors: 0,
    requestFailures: 0,
    consoleErrors: 0,
    errors: []
  };

  let context = null;

  try {
    context = await browser.newContext({
      acceptDownloads: true
    });

    const page = await context.newPage();

    page.on("pageerror", err => {
      result.pageErrors++;
      if (result.errors.length < 8) {
        result.errors.push("pageerror: " + err.message);
      }
    });

    page.on("requestfailed", req => {
      result.requestFailures++;
      if (result.errors.length < 8) {
        const f = req.failure();
        result.errors.push(
          "requestfailed: " + req.url() + " " + (f?.errorText || "")
        );
      }
    });

    page.on("console", msg => {
      if (msg.type() === "error") {
        result.consoleErrors++;
        if (result.errors.length < 8) {
          result.errors.push("console: " + msg.text());
        }
      }
    });

    const navStart = Date.now();

    // Do not wait for DOMContentLoaded as the concurrency gate.
    // Wait for the actual document/route to become usable.
    await withTimeout(
      page.goto(BASE + "/merge-pdf", {
        waitUntil: "commit",
        timeout: 15000
      }),
      18000,
      "navigation"
    );

    result.navigationMs = Date.now() - navStart;

    const input = page.locator('input[type="file"]').first();
    const addButton = page.getByRole("button", { name: /Add PDF Files/i }).first();

    await input.waitFor({ state: "attached", timeout: 10000 });
    await addButton.waitFor({ state: "attached", timeout: 10000 });

    const addStart = Date.now();

    await input.setInputFiles([A, B]);

    await withTimeout(
      page.locator('text=A-2-pages.pdf').first().waitFor({
        state: "attached",
        timeout: 12000
      }),
      15000,
      "A render"
    );

    await withTimeout(
      page.locator('text=B-1-page.pdf').first().waitFor({
        state: "attached",
        timeout: 12000
      }),
      15000,
      "B render"
    );

    result.addMs = Date.now() - addStart;

    const merge = page.getByRole("button", { name: /Unlock & Merge/i }).first();

    const readyStart = Date.now();
    const readyDeadline = Date.now() + 15000;

    while (Date.now() < readyDeadline) {
      if (!(await merge.isDisabled())) {
        break;
      }
      await sleep(100);
    }

    if (await merge.isDisabled()) {
      throw new Error("Merge button remained disabled after PDFs rendered");
    }

    result.readyMs = Date.now() - readyStart;

    const mergeStart = Date.now();

    const downloadPromise = page.waitForEvent("download", {
      timeout: 15000
    });

    await merge.click();

    const download = await downloadPromise;

    result.mergeMs = Date.now() - mergeStart;

    const filename = download.suggestedFilename();

    if (!filename || !/\.pdf$/i.test(filename)) {
      throw new Error("Expected PDF download, got: " + filename);
    }

    result.download = true;
    result.ok = true;
    result.elapsedMs = Date.now() - started;

  } catch (e) {
    result.elapsedMs = Date.now() - started;
    result.errors.push(String(e?.message || e));
  } finally {
    if (context) {
      try { await context.close(); } catch {}
    }
  }

  return result;
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"
  });

  const started = Date.now();
  const allResults = [];

  try {
    for (let first = 1; first <= USERS; first += WAVE_SIZE) {
      const last = Math.min(first + WAVE_SIZE - 1, USERS);

      console.log(
        "WAVE|" + JSON.stringify({
          first,
          last,
          startedAtMs: Date.now() - started
        })
      );

      const jobs = [];

      for (let id = first; id <= last; id++) {
        jobs.push(
          withTimeout(
            userRun(browser, id),
            USER_TIMEOUT,
            "user " + id
          ).catch(err => ({
            id,
            ok: false,
            elapsedMs: Date.now() - started,
            navigationMs: null,
            addMs: null,
            readyMs: null,
            mergeMs: null,
            download: false,
            pageErrors: 0,
            requestFailures: 0,
            consoleErrors: 0,
            errors: [String(err?.message || err)]
          }))
        );
      }

      const waveResults = await Promise.all(jobs);
      allResults.push(...waveResults);

      const wavePass = waveResults.filter(x => x.ok).length;

      console.log(
        "WAVE_RESULT|" + JSON.stringify({
          first,
          last,
          passed: wavePass,
          failed: waveResults.length - wavePass
        })
      );

      if (last < USERS) {
        await sleep(WAVE_DELAY);
      }
    }

    const totalElapsedMs = Date.now() - started;
    const passed = allResults.filter(r => r.ok).length;
    const failed = USERS - passed;

    const times = allResults
      .map(r => r.elapsedMs)
      .filter(x => Number.isFinite(x))
      .sort((a,b) => a-b);

    const avgMs = times.length
      ? Math.round(times.reduce((a,b) => a + b, 0) / times.length)
      : null;

    const p50Ms = times.length
      ? times[Math.min(times.length - 1, Math.floor(times.length * 0.50))]
      : null;

    const p95Ms = times.length
      ? times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)]
      : null;

    const maxMs = times.length ? times[times.length - 1] : null;

    const summary = {
      users: USERS,
      passed,
      failed,
      successRatePercent: Number(((passed / USERS) * 100).toFixed(2)),
      totalElapsedMs,
      avgMs,
      p50Ms,
      p95Ms,
      maxMs,
      downloads: allResults.filter(r => r.download).length,
      pageErrors: allResults.reduce((n,r) => n + r.pageErrors, 0),
      requestFailures: allResults.reduce((n,r) => n + r.requestFailures, 0),
      consoleErrors: allResults.reduce((n,r) => n + r.consoleErrors, 0)
    };

    console.log("LOAD_SUMMARY|" + JSON.stringify(summary));

    for (const r of allResults) {
      console.log("USER|" + JSON.stringify(r));
    }

    const clean =
      passed === USERS &&
      summary.downloads === USERS &&
      summary.pageErrors === 0 &&
      summary.requestFailures === 0 &&
      summary.consoleErrors === 0;

    process.exitCode = clean ? 0 : 2;

  } catch (e) {
    console.error("RUNNER_FATAL|" + String(e?.stack || e));
    process.exitCode = 3;
  } finally {
    try { await browser.close(); } catch {}
  }
})();