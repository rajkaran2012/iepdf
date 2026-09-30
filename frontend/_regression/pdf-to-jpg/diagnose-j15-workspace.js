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

      const convertButtons = Array.from(
        document.querySelectorAll("button")
      )
        .filter(btn => btn.textContent?.includes("Convert to JPG"))
        .map(btn => ({
          text: btn.textContent,
          disabled: btn.disabled
        }));

      return {
        bodyStart: body.slice(0, 1200),
        hasUnicodeFilename: body.includes(
          "J16 file with spaces and unicode-टेस्ट.pdf"
        ),
        hasUploadPrompt: body.includes("Drag & drop"),
        convertButtons
      };
    });

    console.log(`\n===== AFTER ${seconds}s =====`);
    console.log(JSON.stringify(state, null, 2));
  }

  await context.close();
  await browser.close();
})();
