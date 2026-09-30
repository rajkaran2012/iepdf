const { chromium } = require("playwright");

const TOOL = "http://localhost:3000/pdf-to-jpg";
const FIXTURE = "C:\\iepdf\\frontend\\_regression\\pdf-to-jpg\\fixtures\\J04-ten-page.pdf";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
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

  console.log("PAGE LOADED");

  const input = page.locator('input[type="file"]').first();

  await input.waitFor({
    state: "attached",
    timeout: 10000
  });

  console.log("INPUT ATTACHED");

  await input.setInputFiles(FIXTURE);

  console.log("SETINPUTFILES RETURNED");

  for (let i = 1; i <= 60; i++) {
    await page.waitForTimeout(1000);

    const state = await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]');
      const buttons = [...document.querySelectorAll("button")];

      const convert = buttons.find(b =>
        /Convert to JPG/i.test(b.textContent || "")
      );

      return {
        inputFiles: input?.files?.length ?? null,
        inputFilename: input?.files?.[0]?.name ?? null,
        convertExists: !!convert,
        convertDisabled: convert ? convert.disabled : null,
        bodyTail: document.body.innerText.slice(-1000)
      };
    });

    console.log(`--- ${i}s ---`);
    console.log(JSON.stringify(state, null, 2));

    if (state.convertExists && state.convertDisabled === false) {
      console.log("ADMISSION SUCCESS");
      break;
    }
  }

  await context.close();
  await browser.close();
})();
