const { chromium } = require("playwright");

const TOOL = "http://localhost:3000/pdf-to-jpg";

const UNICODE_FIXTURE =
  "C:\\iepdf\\frontend\\_regression\\pdf-to-jpg\\fixtures\\J16 file with spaces and unicode-टेस्ट.pdf";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--disable-dev-shm-usage"]
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("console", msg => {
    console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`);
  });

  page.on("pageerror", err => {
    console.log(`[PAGEERROR] ${err.message}`);
  });

  await page.goto(TOOL, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  /*
   * Trace every File.arrayBuffer() call before React receives
   * the selected file.
   */
  await page.evaluate(() => {
    if (!File.prototype.__iepdfArrayBufferPatched) {
      const original = File.prototype.arrayBuffer;

      File.prototype.arrayBuffer = async function (...args) {
        const started = performance.now();

        console.log(
          `[J15-TRACE] arrayBuffer START name="${this.name}" size=${this.size}`
        );

        try {
          const result = await original.apply(this, args);

          console.log(
            `[J15-TRACE] arrayBuffer DONE name="${this.name}" bytes=${result.byteLength} elapsed=${Math.round(performance.now() - started)}ms`
          );

          return result;
        } catch (error) {
          console.error(
            `[J15-TRACE] arrayBuffer ERROR name="${this.name}" error="${String(error?.message ?? error)}"`
          );

          throw error;
        }
      };

      Object.defineProperty(
        File.prototype,
        "__iepdfArrayBufferPatched",
        { value: true }
      );
    }
  });

  const input = page.locator('input[type="file"]').first();

  await input.waitFor({
    state: "attached",
    timeout: 10000
  });

  console.log("SETTING UNICODE FILE...");

  await input.setInputFiles(UNICODE_FIXTURE);

  console.log("SETINPUTFILES RETURNED");

  for (const seconds of [0.1, 0.5, 1, 2, 5, 10]) {
    await page.waitForTimeout(seconds * 1000);

    const state = await page.evaluate(() => {
      const body = document.body.innerText;

      return {
        hasUnicodeFilename: body.includes(
          "J16 file with spaces and unicode-टेस्ट.pdf"
        ),
        hasConvertButton: Array.from(
          document.querySelectorAll("button")
        ).some(btn =>
          btn.textContent?.includes("Convert to JPG")
        ),
        bodyStart: body.slice(0, 900)
      };
    });

    console.log(`\n===== AFTER ${seconds}s =====`);
    console.log(JSON.stringify(state, null, 2));
  }

  await context.close();
  await browser.close();
})();
