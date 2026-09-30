const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const context = await browser.newContext();

  await context.addInitScript(() => {
    window.__c31InputClicks = [];

    const originalClick = HTMLInputElement.prototype.click;

    HTMLInputElement.prototype.click = function () {
      window.__c31InputClicks.push({
        type: this.type,
        accept: this.accept,
        files: this.files ? this.files.length : null,
        timestamp: Date.now()
      });

      return originalClick.call(this);
    };
  });

  const page = await context.newPage();

  page.on("pageerror", err =>
    console.log("[PAGEERROR]", err.message)
  );

  try {
    await page.goto("http://127.0.0.1:3001/compress-pdf", {
      waitUntil: "networkidle",
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    const before = await page.evaluate(() => ({
      inputs: document.querySelectorAll('input[type="file"]').length,
      inputClicks: window.__c31InputClicks
    }));

    await page.getByRole("button", { name: "Add PDF File" }).click();

    await page.waitForTimeout(500);

    const after = await page.evaluate(() => ({
      inputClicks: window.__c31InputClicks,
      activeTag: document.activeElement?.tagName ?? null,
      activeType: document.activeElement?.getAttribute?.("type") ?? null,
      inputFiles:
        document.querySelector('input[type="file"]')?.files?.length ?? null
    }));

    console.log("=== INPUT.CLICK TRACE ===");
    console.log("BEFORE:", JSON.stringify(before, null, 2));
    console.log("AFTER:", JSON.stringify(after, null, 2));

  } catch (error) {
    console.error(
      "INPUT.CLICK TRACE FAILED:",
      error.message || String(error)
    );
  } finally {
    await browser.close();
  }
})();
