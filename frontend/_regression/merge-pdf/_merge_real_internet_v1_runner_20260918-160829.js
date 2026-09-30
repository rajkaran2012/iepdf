const { chromium } = require("C:/IEPDF/frontend/node_modules/playwright");
const fs = require('fs');

const TARGET = "https://www.iepdf.com";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FIXTURE_A = "C:/IEPDF/frontend/_regression/merge-pdf/A-2-pages.pdf";
const FIXTURE_B = "C:/IEPDF/frontend/_regression/merge-pdf/B-1-page.pdf";
const USERS = 50;
const WAVE_SIZE = 10;
const WAVE_DELAY_MS = 750;
const USER_TIMEOUT_MS = 30000;
const GLOBAL_TIMEOUT_MS = 120000;

const results = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function oneUser(i, browser) {
  const started = Date.now();
  let context, page;
  const r = {
    user: i,
    passed: false,
    elapsedMs: 0,
    stage: "start",
    pageErrors: 0,
    requestFailures: 0,
    consoleErrors: 0,
    downloadedBytes: 0,
    error: null
  };

  const timer = setTimeout(() => {}, USER_TIMEOUT_MS);

  try {
    context = await browser.newContext({ acceptDownloads: true });
    page = await context.newPage();

    page.on('pageerror', () => r.pageErrors++);
    page.on('requestfailed', () => r.requestFailures++);
    page.on('console', m => { if (m.type() === 'error') r.consoleErrors++; });

    const start = Date.now();
    await page.goto(TARGET + (TARGET.endsWith('/') ? 'merge-pdf' : '/merge-pdf'),
      { waitUntil: 'domcontentloaded', timeout: 10000 });
    r.stage = "loaded";

    const input = page.locator('input[type="file"]');
    await input.waitFor({ state: 'attached', timeout: 5000 });

    // Use one input event with both files. This is the same user workflow as
    // selecting multiple PDFs, avoiding repeated input replacement semantics.
    await input.setInputFiles([FIXTURE_A, FIXTURE_B]);
    r.stage = "files-selected";

    const mergeButton = page.getByRole('button', { name: /Unlock & Merge/i });
    await mergeButton.waitFor({ state: 'attached', timeout: 5000 });

    await page.waitForFunction(() => {
      const buttons = [...document.querySelectorAll('button')];
      const b = buttons.find(x => /Unlock & Merge/i.test(x.textContent || ''));
      return !!b && !b.disabled;
    }, { timeout: 12000 });
    r.stage = "ready";

    const before = await page.locator('body').innerText();
    if (!/A-2-pages\.pdf/.test(before) || !/B-1-page\.pdf/.test(before)) {
      throw new Error("Both PDFs were not rendered in the workspace.");
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await mergeButton.click();
    r.stage = "merge-clicked";

    const download = await downloadPromise;
    const path = await download.path();
    if (!path) throw new Error("Download path unavailable.");

    const stat = fs.statSync(path);
    r.downloadedBytes = stat.size;
    if (stat.size < 100) throw new Error("Downloaded PDF is unexpectedly small.");

    r.stage = "download-verified";
    r.passed = true;
  } catch (e) {
    r.error = String(e && e.message ? e.message : e);
  } finally {
    clearTimeout(timer);
    r.elapsedMs = Date.now() - started;
    try { if (context) await context.close(); } catch {}
  }

  return r;
}

(async () => {
  const globalStart = Date.now();
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--disable-dev-shm-usage']
  });

  try {
    for (let base = 1; base <= USERS; base += WAVE_SIZE) {
      const wave = [];
      for (let i = base; i < Math.min(base + WAVE_SIZE, USERS + 1); i++) {
        wave.push(oneUser(i, browser));
      }
      const out = await Promise.all(wave);
      results.push(...out);
      if (base + WAVE_SIZE <= USERS) await sleep(WAVE_DELAY_MS);
      if (Date.now() - globalStart > GLOBAL_TIMEOUT_MS) {
        throw new Error("GLOBAL_WATCHDOG_TIMEOUT");
      }
    }
  } finally {
    await browser.close();
  }

  const passed = results.filter(x => x.passed);
  const failed = results.filter(x => !x.passed);
  const times = results.map(x => x.elapsedMs).sort((a,b) => a-b);
  const p = q => times.length ? times[Math.min(times.length-1, Math.floor(times.length*q))] : 0;

  const summary = {
    users: USERS,
    passed: passed.length,
    failed: failed.length,
    successRatePercent: Number((passed.length / USERS * 100).toFixed(2)),
    totalElapsedMs: Date.now() - globalStart,
    p50Ms: p(.50),
    p95Ms: p(.95),
    p99Ms: p(.99),
    maxMs: times.length ? times[times.length-1] : 0,
    pageErrors: results.reduce((n,x) => n+x.pageErrors,0),
    requestFailures: results.reduce((n,x) => n+x.requestFailures,0),
    consoleErrors: results.reduce((n,x) => n+x.consoleErrors,0),
    downloads: results.filter(x => x.downloadedBytes > 0).length
  };

  console.log("LOAD_SUMMARY|" + JSON.stringify(summary));
  for (const r of results) {
    console.log("USER|" + JSON.stringify(r));
  }

  process.exit(summary.passed === USERS &&
               summary.pageErrors === 0 &&
               summary.requestFailures === 0 &&
               summary.consoleErrors === 0 &&
               summary.downloads === USERS ? 0 : 1);
})().catch(e => {
  console.error("RUNNER_FATAL|" + String(e && e.stack ? e.stack : e));
  process.exit(2);
});