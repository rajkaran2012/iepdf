const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const TOOL = "http://localhost:3000/pdf-to-jpg";
const FIX = "C:\\iepdf\\frontend\\_regression\\pdf-to-jpg\\fixtures";

const unicodeFixture = fs.readdirSync(FIX)
  .find(x => x.startsWith("J16 file with spaces and unicode-") && x.endsWith(".pdf"));

const cases = [
  ["J-02", "J02-two-page.pdf"],
  ["J-15", unicodeFixture]
];

async function run(id, filename) {
  console.log(`\n===== ${id} : ${filename} =====`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
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

  await input.setInputFiles(path.join(FIX, filename));

  console.log("SETINPUTFILES RETURNED");

  for (let i = 1; i <= 10; i++) {
    await page.waitForTimeout(1000);

    const state = await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]');

      const buttons = [...document.querySelectorAll("button")];

      const convert = buttons.find(b =>
        /Convert to JPG/i.test(b.textContent || "")
      );

      return {
        filename: input?.files?.[0]?.name ?? null,
        convertExists: !!convert,
        convertDisabled: convert ? convert.disabled : null,
        bodyTail: document.body.innerText.slice(-700)
      };
    });

    console.log(`${i}s ${JSON.stringify(state)}`);

    if (state.convertExists && state.convertDisabled === false) {
      console.log(`ADMISSION SUCCESS ${id}`);
      break;
    }
  }

  await context.close();
  await browser.close();
}

(async () => {
  for (const [id, filename] of cases) {
    await run(id, filename);
  }
})();
