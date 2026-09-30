const { chromium } = require("playwright");

const TOOL = "http://localhost:3000/pdf-to-jpg";
const FIXTURE =
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
    if (msg.type() === "error") {
      console.log(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });

  page.on("pageerror", err => {
    console.log(`[PAGEERROR] ${err.message}`);
  });

  await page.goto(TOOL, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  const input = page.locator('input[type="file"]').first();

  await input.waitFor({
    state: "attached",
    timeout: 10000
  });

  await input.setInputFiles(FIXTURE);

  console.log("SETINPUTFILES RETURNED");

  const state = await input.evaluate(el => ({
    files: el.files?.length ?? null,
    name: el.files?.[0]?.name ?? null,
    size: el.files?.[0]?.size ?? null,
    type: el.files?.[0]?.type ?? null
  }));

  console.log("INPUT STATE:");
  console.log(JSON.stringify(state, null, 2));

  const result = await Promise.race([
    input.evaluate(async el => {
      const file = el.files?.[0];

      if (!file) {
        return {
          ok: false,
          reason: "No File object available"
        };
      }

      const started = performance.now();
      const buffer = await file.arrayBuffer();

      return {
        ok: true,
        name: file.name,
        size: file.size,
        bufferBytes: buffer.byteLength,
        elapsedMs: Math.round(performance.now() - started)
      };
    }),

    new Promise(resolve =>
      setTimeout(
        () =>
          resolve({
            ok: false,
            timeout: true
          }),
        10000
      )
    )
  ]);

  console.log("ARRAYBUFFER RESULT:");
  console.log(JSON.stringify(result, null, 2));

  await context.close();
  await browser.close();
})();
