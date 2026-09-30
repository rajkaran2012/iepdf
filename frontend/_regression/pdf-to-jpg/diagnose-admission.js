const { chromium } = require("playwright");

const TOOL = "http://localhost:3000/pdf-to-jpg";
const FIXTURE = "C:\\iepdf\\frontend\\_regression\\pdf-to-jpg\\fixtures\\J02-two-page.pdf";

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

  await input.evaluate(el => {
    el.addEventListener("change", () => {
      console.log("[DOM-CHANGE] file input change event fired");
    });

    el.addEventListener("input", () => {
      console.log("[DOM-INPUT] file input input event fired");
    });
  });

  console.log("LISTENERS ATTACHED");

  await input.setInputFiles(FIXTURE);

  console.log("SETINPUTFILES RETURNED");

  const immediate = await input.evaluate(el => ({
    files: el.files?.length ?? null,
    name: el.files?.[0]?.name ?? null,
    size: el.files?.[0]?.size ?? null,
    type: el.files?.[0]?.type ?? null
  }));

  console.log("IMMEDIATE INPUT STATE:");
  console.log(JSON.stringify(immediate, null, 2));

  for (let i = 1; i <= 20; i++) {
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
        inputSize: input?.files?.[0]?.size ?? null,
        inputType: input?.files?.[0]?.type ?? null,
        convertExists: !!convert,
        convertDisabled: convert ? convert.disabled : null,
        bodyTail: document.body.innerText.slice(-2000)
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
