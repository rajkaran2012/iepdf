const { chromium } = require(process.env.IEPDF_PLAYWRIGHT);

const target = process.env.IEPDF_TARGET;
const fixtureA = process.env.IEPDF_FIXTURE_A;
const fixtureB = process.env.IEPDF_FIXTURE_B;
const users = Number(process.env.IEPDF_USERS || 50);
const waveSize = Number(process.env.IEPDF_WAVE_SIZE || 10);
const waveDelayMs = Number(process.env.IEPDF_WAVE_DELAY || 750);
const sla = Number(process.env.IEPDF_SLA || 30000);
const watchdogMs = Number(process.env.IEPDF_WATCHDOG || 120000);

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function oneUser(browser, id) {
  const t0 = Date.now();
  const m = {};
  const errors = [];
  const requestFailures = [];
  const pageErrors = [];
  const consoleErrors = [];
  let downloadBytes = 0;
  let stage = "create-context";

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  page.on("pageerror", e => pageErrors.push(String(e)));
  page.on("requestfailed", r => requestFailures.push({
    url: r.url(), error: r.failure()?.errorText || "unknown"
  }));
  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const mark = name => { m[name] = Date.now() - t0; };

  try {
    stage = "navigation";
    await page.goto(`${target}/merge-pdf`, {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    mark("navigationMs");

    stage = "input-attached";
    await page.locator('input[type="file"]').first().waitFor({
      state: "attached", timeout: 5000
    });
    mark("inputAttachedMs");

    stage = "files-selected";
    await page.locator('input[type="file"]').first().setInputFiles([fixtureA, fixtureB]);
    mark("filesSelectedMs");

    stage = "rows-rendering";
    await page.getByText("A-2-pages.pdf", { exact: true }).first().waitFor({
      state: "visible", timeout: 10000
    });
    mark("aRenderedMs");

    await page.getByText("B-1-page.pdf", { exact: true }).first().waitFor({
      state: "visible", timeout: 10000
    });
    mark("bRenderedMs");

    stage = "merge-readiness";
    const merge = page.getByRole("button", { name: /Unlock & Merge/i }).first();
    const readyDeadline = Date.now() + 5000;
    while (Date.now() < readyDeadline) {
      if (!(await merge.isDisabled())) break;
      await sleep(50);
    }
    if (await merge.isDisabled()) throw new Error("Merge button did not become enabled.");
    mark("mergeEnabledMs");

    stage = "merge-processing";
    const dlPromise = page.waitForEvent("download", { timeout: Math.max(1000, sla - (Date.now()-t0)) });
    await merge.click();
    mark("mergeClickedMs");

    const dl = await dlPromise;
    mark("downloadEventMs");

    const path = await dl.path();
    if (!path) throw new Error("Download path unavailable.");
    const fs = require("fs");
    downloadBytes = fs.statSync(path).size;
    if (downloadBytes <= 0) throw new Error("Downloaded file is empty.");
    mark("downloadVerifiedMs");

    return {
      id, ok:true, stage:"download-verified", elapsedMs:Date.now()-t0,
      milestones:m, downloadedBytes:downloadBytes,
      pageErrors:pageErrors.length, requestFailures:requestFailures.length,
      consoleErrors:consoleErrors.length, errors:[]
    };
  } catch (e) {
    errors.push(String(e?.message || e));
    return {
      id, ok:false, stage, elapsedMs:Date.now()-t0,
      milestones:m, downloadedBytes:downloadBytes,
      pageErrors:pageErrors.length, requestFailures:requestFailures.length,
      consoleErrors:consoleErrors.length, errors
    };
  } finally {
    await context.close().catch(()=>{});
  }
}

(async()=>{
  const browser = await chromium.launch({
    headless:true,
    executablePath: process.env.IEPDF_CHROME,
    args:["--disable-background-networking","--disable-component-update"]
  });

  const started = Date.now();
  const results = [];
  let active = [];

  for (let start=1; start<=users; start+=waveSize) {
    const end = Math.min(users, start + waveSize - 1);
    const batch = [];
    for (let id=start; id<=end; id++) batch.push(oneUser(browser,id));
    const settled = await Promise.all(batch);
    results.push(...settled);
    if (end < users) await sleep(waveDelayMs);
  }

  await browser.close();

  const byStage = {};
  for (const r of results) {
    byStage[r.stage] = (byStage[r.stage] || 0) + 1;
  }

  const completed = results.filter(r=>r.ok);
  const failed = results.filter(r=>!r.ok);

  const successfulTimes = completed.map(r=>r.elapsedMs).sort((a,b)=>a-b);
  const pct = (p) => successfulTimes.length
    ? successfulTimes[Math.min(successfulTimes.length-1, Math.floor((p/100)*successfulTimes.length))]
    : null;

  const stageStats = {};
  for (const key of [
    "navigationMs","inputAttachedMs","filesSelectedMs",
    "aRenderedMs","bRenderedMs","mergeEnabledMs",
    "mergeClickedMs","downloadEventMs","downloadVerifiedMs"
  ]) {
    const vals = results.map(r=>r.milestones[key]).filter(v=>Number.isFinite(v)).sort((a,b)=>a-b);
    stageStats[key] = vals.length ? {
      n:vals.length, p50:vals[Math.floor(vals.length*.50)],
      p95:vals[Math.min(vals.length-1,Math.floor(vals.length*.95))],
      max:vals[vals.length-1]
    } : null;
  }

  const summary = {
    users, completedByRunner:results.length, passed:completed.length,
    failed:failed.length,
    successRatePercent:Number((completed.length/users*100).toFixed(1)),
    totalElapsedMs:Date.now()-started,
    successP50Ms:pct(50), successP95Ms:pct(95), successMaxMs:successfulTimes.at(-1)||null,
    downloads:completed.filter(r=>r.downloadedBytes>0).length,
    pageErrors:results.reduce((n,r)=>n+r.pageErrors,0),
    requestFailures:results.reduce((n,r)=>n+r.requestFailures,0),
    consoleErrors:results.reduce((n,r)=>n+r.consoleErrors,0),
    stageCounts:byStage,
    stageStats,
    globalWatchdogTriggered:(Date.now()-started)>watchdogMs
  };

  console.log("LOAD_SUMMARY|"+JSON.stringify(summary));
  for (const r of results.sort((a,b)=>a.id-b.id)) console.log("USER|"+JSON.stringify(r));
})();
