const { chromium } = require("playwright");

const FRONTEND = "http://127.0.0.1:3000/split-pdf";
const FILE = "C:\\iepdf\\frontend\\_regression\\split-pdf\\S-01-1page.pdf";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const context = await browser.newContext({
    acceptDownloads: true
  });

  const page = await context.newPage();

  page.on("console", msg => {
    console.log(`[BROWSER CONSOLE ${msg.type()}] ${msg.text()}`);
  });

  page.on("pageerror", error => {
    console.log(`[BROWSER PAGE ERROR] ${error.message}`);
  });

  page.on("requestfailed", request => {
    console.log(`[BROWSER REQUEST FAILED] ${request.url()} :: ${request.failure()?.errorText || "unknown"}`);
  });

  try {
    await page.goto(FRONTEND, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.waitForTimeout(500);

    const input = page.locator('input[type="file"]').first();
    const splitButton = page.getByRole("button", {
      name: /^Split PDF$/
    }).first();

    console.log("BEFORE UPLOAD:");
    console.log("Input count:", await input.count());
    console.log("Split button count:", await splitButton.count());
    console.log("Split disabled:", await splitButton.isDisabled());

    const start = Date.now();

    await input.setInputFiles(FILE);

    console.log("");
    console.log("AFTER setInputFiles IMMEDIATELY:");
    console.log("Elapsed:", Date.now() - start, "ms");
    console.log("Split disabled:", await splitButton.isDisabled());
    console.log("Buttons:", await page.locator("button").allTextContents());

    for (const delay of [100, 250, 500, 1000, 2000, 3000]) {
      await page.waitForTimeout(
        delay - (Date.now() - start > delay ? 0 : 0)
      );

      console.log("");
      console.log(`AFTER ~${Date.now() - start}ms:`);
      console.log("Split disabled:", await splitButton.isDisabled());
      console.log("Split count:", await page.getByRole("button", {
        name: /^Split PDF$/
      }).count());
      console.log("Buttons:", await page.locator("button").allTextContents());
    }

  } catch (error) {
    console.error(
      error && error.stack ? error.stack : String(error)
    );
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
})();

