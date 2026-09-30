const { chromium } = require("C:\\IEPDF\\frontend\\node_modules\\playwright");
const fs = require("fs");

const TARGET = process.argv[2];
const CHROME = process.argv[3];
const FIXTURE_A = process.argv[4];
const FIXTURE_B = process.argv[5];
const USERS = Number(process.argv[6]);
const WAVE_SIZE = Number(process.argv[7]);
const WAVE_DELAY = Number(process.argv[8]);
const SLA = Number(process.argv[9]);
const GLOBAL_WATCHDOG = Number(process.argv[10]);

const now = () => Date.now();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function visible(locator) {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}

async function countVisible(locator) {
  try {
    const n = await locator.count();
    let c = 0;
    for (let i = 0; i < n; i++) {
      if (await locator.nth(i).isVisible().catch(() => false)) c++;
    }
    return c;
  } catch {
    return 0;
  }
}

async function userRun(id) {
  const started = now();
  const milestones = {};
  const pageErrors = [];
  const requestFailures = [];
  const consoleErrors = [];
  let downloadedBytes = 0;
  let stage = "launch";
  let error = null;

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: [
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--no-first-run"
    ]
  });

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  page.on("pageerror", e => pageErrors.push(String(e)));
  page.on("requestfailed", r => requestFailures.push({
    url: r.url(),
    error: r.failure()?.errorText || "unknown"
  }));
  page.on("console", m => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  const mark = name => {
    milestones[name] = now() - started;
  };

  const remaining = () => Math.max(0, SLA - (now() - started));

  try {
    stage = "navigation";
    await page.goto(TARGET + "/merge-pdf", {
      waitUntil: "domcontentloaded",
      timeout: Math.min(10000, remaining())
    });
    mark("navigationMs");

    if (remaining() <= 0) throw new Error("30s SLA exhausted during navigation");

    const input = page.locator('input[type="file"][accept=".pdf"]').first();
    await input.waitFor({ state: "attached", timeout: Math.min(5000, remaining()) });
    mark("inputAttachedMs");

    stage = "files-selected";
    await input.setInputFiles([FIXTURE_A, FIXTURE_B]);
    mark("filesSelectedMs");

    const aText = page.getByText("A-2-pages.pdf", { exact: true }).first();
    const bText = page.getByText("B-1-page.pdf", { exact: true }).first();

    stage = "rows-rendering";
    await aText.waitFor({ state: "visible", timeout: Math.min(10000, remaining()) });
    mark("aRenderedMs");
    await bText.waitFor({ state: "visible", timeout: Math.min(10000, remaining()) });
    mark("bRenderedMs");

    const merge = page.getByRole("button", { name: /Unlock & Merge/i }).first();

    stage = "ready";
    const readyDeadline = now() + remaining();
    while (now() < readyDeadline) {
      if (await visible(merge) && !(await merge.isDisabled().catch(() => true))) {
        mark("mergeEnabledMs");
        break;
      }
      await sleep(100);
    }

    if (!milestones.mergeEnabledMs) {
      throw new Error("Merge button did not become enabled within 30s SLA");
    }

    stage = "merge";
    const downloadPromise = page.waitForEvent("download", {
      timeout: Math.min(10000, remaining())
    });
    await merge.click();
    mark("mergeClickedMs");

    const download = await downloadPromise;
    mark("downloadEventMs");

    const tempPath = await download.path();
    if (!tempPath) throw new Error("Download event occurred but no download path was available");

    const stat = fs.statSync(tempPath);
    downloadedBytes = stat.size;
    if (downloadedBytes <= 0) throw new Error("Downloaded PDF is empty");

    mark("downloadVerifiedMs");

    return {
      id,
      ok: true,
      elapsedMs: now() - started,
      stage: "download-verified",
      milestones,
      downloadedBytes,
      pageErrors: pageErrors.length,
      requestFailures: requestFailures.length,
      consoleErrors: consoleErrors.length,
      error: null
    };
  } catch (e) {
    error = String(e?.message || e);
    return {
      id,
      ok: false,
      elapsedMs: now() - started,
      stage,
      milestones,
      downloadedBytes,
      pageErrors: pageErrors.length,
      requestFailures: requestFailures.length,
      consoleErrors: consoleErrors.length,
      error
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

(async () => {
  const globalStart = now();
  const results = [];
  let aborted = false;

  for (let base = 1; base <= USERS; base += WAVE_SIZE) {
    if (now() - globalStart >= GLOBAL_WATCHDOG) {
      aborted = true;
      break;
    }

    const ids = [];
    for (let i = base; i < Math.min(base + WAVE_SIZE, USERS + 1); i++) ids.push(i);

    const wave = await Promise.all(ids.map(id => userRun(id)));
    results.push(...wave);

    if (base + WAVE_SIZE <= USERS) await sleep(WAVE_DELAY);
  }

  const passed = results.filter(x => x.ok).length;
  const failed = results.length - passed;
  const times = results.map(x => x.elapsedMs).sort((a,b) => a-b);
  const pct = results.length ? (passed / results.length) * 100 : 0;
  const percentile = p => times.length ? times[Math.min(times.length - 1, Math.ceil(times.length * p) - 1)] : null;

  const summary = {
    users: USERS,
    completedByRunner: results.length,
    passed,
    failed,
    successRatePercent: Number(pct.toFixed(2)),
    totalElapsedMs: now() - globalStart,
    p50Ms: percentile(0.50),
    p95Ms: percentile(0.95),
    maxMs: times.length ? times[times.length - 1] : null,
    pageErrors: results.reduce((s,x)=>s+x.pageErrors,0),
    requestFailures: results.reduce((s,x)=>s+x.requestFailures,0),
    consoleErrors: results.reduce((s,x)=>s+x.consoleErrors,0),
    downloads: results.filter(x=>x.downloadedBytes>0).length,
    globalWatchdogTriggered: aborted
  };

  console.log("LOAD_SUMMARY|" + JSON.stringify(summary));

  for (const r of results.sort((a,b)=>a.id-b.id)) {
    console.log("USER|" + JSON.stringify(r));
  }

  console.log("DIAGNOSTIC_END");
})().catch(e => {
  console.error("RUNNER_FATAL|" + String(e?.stack || e));
  process.exit(2);
});
