const fs = require("fs");
const path = require("path");

let pw;
try {
  pw = require("playwright");
} catch (e) {
  try {
    pw = require("@playwright/test");
  } catch (e2) {
    console.error("PLAYWRIGHT_LOAD_FAILED|" + e.message);
    process.exit(2);
  }
}

const { chromium, firefox, webkit } = pw;

const BASE = process.env.IEPDF_RESP_URL || "http://127.0.0.1:3000/merge-pdf";
const OUT = process.env.IEPDF_RESP_OUT;
const report = [];

const viewports = [
  ["desktop-1366x768", 1366, 768],
  ["desktop-1920x1080", 1920, 1080],
  ["laptop-1280x720", 1280, 720],
  ["tablet-1024x768", 1024, 768],
  ["ipad-820x1180", 820, 1180],
  ["android-360x800", 360, 800],
  ["android-412x915", 412, 915],
  ["iphone-390x844", 390, 844],
  ["iphone-430x932", 430, 932]
];

function line(s) {
  report.push(s);
  console.log(s);
}

async function runEngine(engineName, launcher) {
  let browser;
  try {
    browser = await launcher.launch({ headless: true });
  } catch (e) {
    line(`ENGINE|${engineName}|SKIPPED|${String(e.message).replace(/\r?\n/g, " ")}`);
    return;
  }

  line(`ENGINE|${engineName}|START`);
  for (const [name, width, height] of viewports) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      isMobile: width <= 430,
      hasTouch: width <= 1024
    });
    const page = await context.newPage();

    const consoleErrors = [];
    const pageErrors = [];
    const requestFailures = [];

    page.on("console", msg => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", err => pageErrors.push(String(err)));
    page.on("requestfailed", req => requestFailures.push(`${req.url()} | ${req.failure()?.errorText || "failed"}`));

    const started = Date.now();
    let status = "PASS";
    let problems = [];

    try {
      const response = await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 15000 });
      if (!response || !response.ok()) {
        problems.push(`HTTP ${response ? response.status() : "none"}`);
      }
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(300);

      const result = await page.evaluate(() => {
        const visible = el => {
          if (!el) return false;
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return s.display !== "none" &&
                 s.visibility !== "hidden" &&
                 parseFloat(s.opacity || "1") > 0 &&
                 r.width > 0 && r.height > 0;
        };

        const merge = [...document.querySelectorAll("button")].find(b =>
          /unlock\s*&\s*merge/i.test(b.textContent || "")
        );
        const add = [...document.querySelectorAll("button")].find(b =>
          /add pdf files/i.test(b.textContent || "")
        );
        const title = [...document.querySelectorAll("h1")].find(h =>
          /merge pdf/i.test(h.textContent || "")
        );
        const privacy = [...document.querySelectorAll("p,span,div")].find(e =>
          /processing happens in your browser/i.test(e.textContent || "")
        );

        const mr = merge?.getBoundingClientRect();
        const ar = add?.getBoundingClientRect();
        const tr = title?.getBoundingClientRect();
        const pr = privacy?.getBoundingClientRect();

        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
        const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);

        const withinViewport = r =>
          !!r &&
          r.right >= 0 && r.left <= vw &&
          r.bottom >= 0 && r.top <= vh;

        const mobile = vw <= 430;
        const mergeWidth = mr?.width || 0;
        const addWidth = ar?.width || 0;

        return {
          viewport: { vw, vh },
          horizontalOverflow: scrollWidth > vw + 1,
          verticalOverflow: scrollHeight > vh + 1,
          titleVisible: visible(title),
          addVisible: visible(add),
          mergeVisible: visible(merge),
          privacyVisible: visible(privacy),
          mergeWithinViewport: withinViewport(mr),
          addWithinViewport: withinViewport(ar),
          privacyWithinViewport: withinViewport(pr),
          mergeWidth,
          addWidth,
          mobile,
          touchTargetMergeOK: mergeWidth >= 44 && (mr?.height || 0) >= 44,
          touchTargetAddOK: addWidth >= 44 && (ar?.height || 0) >= 44,
          mergeText: merge?.textContent?.trim() || "",
          bodyWidth: document.body?.scrollWidth || 0,
          clientWidth: vw,
          scrollHeight
        };
      });

      if (!result.titleVisible) problems.push("title-hidden");
      if (!result.addVisible) problems.push("add-button-hidden");
      if (!result.mergeVisible) problems.push("merge-button-hidden");
      if (!result.privacyVisible) problems.push("privacy-hidden");
      if (!result.mergeWithinViewport) problems.push("merge-button-outside-viewport");
      if (!result.addWithinViewport) problems.push("add-button-outside-viewport");
      if (!result.privacyWithinViewport) problems.push("privacy-outside-viewport");
      if (result.horizontalOverflow) problems.push(`horizontal-overflow(${result.bodyWidth}>${result.clientWidth})`);

      if (result.mobile) {
        if (!result.touchTargetMergeOK) problems.push(`merge-touch-target-too-small(${Math.round(result.mergeWidth)}px)`);
        if (!result.touchTargetAddOK) problems.push(`add-touch-target-too-small(${Math.round(result.addWidth)}px)`);
      }

      if (pageErrors.length) problems.push(`page-errors=${pageErrors.length}`);
      if (requestFailures.length) problems.push(`request-failures=${requestFailures.length}`);
      if (consoleErrors.length) problems.push(`console-errors=${consoleErrors.length}`);

      if (problems.length) status = "FAIL";

      const elapsed = Date.now() - started;
      line(`RESULT|${engineName}|${name}|${width}x${height}|${status}|elapsed=${elapsed}ms|problems=${problems.join(",") || "none"}|merge=${result.mergeVisible}|add=${result.addVisible}|overflow=${result.horizontalOverflow}|mergeW=${Math.round(result.mergeWidth)}|mergeH=${Math.round(result.mergeWithinViewport ? 1 : 0)}|console=${consoleErrors.length}|page=${pageErrors.length}|requests=${requestFailures.length}`);

      if (status === "FAIL") {
        await page.screenshot({
          path: path.join(OUT, `${engineName}-${name}-FAIL.png`),
          fullPage: false
        });
      }
    } catch (e) {
      line(`RESULT|${engineName}|${name}|${width}x${height}|FAIL|exception=${String(e.message).replace(/\r?\n/g, " ")}`);
      try {
        await page.screenshot({
          path: path.join(OUT, `${engineName}-${name}-EXCEPTION.png`),
          fullPage: false
        });
      } catch {}
    } finally {
      await context.close();
    }
  }
  await browser.close();
  line(`ENGINE|${engineName}|END`);
}

(async () => {
  await runEngine("chromium", chromium);

  // Firefox gives an additional desktop/mobile browser-engine check.
  await runEngine("firefox", firefox);

  // WebKit approximates the Safari/iOS rendering engine. It is skipped if
  // the local Playwright WebKit browser is not installed.
  await runEngine("webkit", webkit);

  const fails = report.filter(x => x.includes("|FAIL|")).length;
  const skipped = report.filter(x => x.includes("|SKIPPED|")).length;
  line(`SUMMARY|FAIL_LINES=${fails}|SKIPPED_ENGINES=${skipped}`);
  fs.writeFileSync(OUT, report.join("\n") + "\n", "utf8");
  process.exit(fails ? 1 : 0);
})().catch(e => {
  console.error("FATAL|" + e.stack);
  process.exit(3);
});
