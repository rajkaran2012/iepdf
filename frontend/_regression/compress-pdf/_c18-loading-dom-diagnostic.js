const { chromium } = require("playwright");

const FRONTEND = "http://127.0.0.1:3000/compress-pdf";
const FILE = "C:\\iepdf\\frontend\\_regression\\compress-pdf\\C-04-image-heavy.pdf";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    await page.goto(FRONTEND, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.waitForTimeout(500);

    const input = page.locator('input[type="file"]').first();
    await input.setInputFiles(FILE);

    const btn = page.getByRole("button", {
      name: /^Compress PDF$/
    }).first();

    await page.route("**/compress-pdf", async route => {
      console.log("BACKEND REQUEST INTERCEPTED");

      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log("RELEASING BACKEND");
      await route.continue();
    });

    const downloadPromise = page.waitForEvent("download", {
      timeout: 15000
    });

    await btn.click();

    console.log("");
    console.log("=== 100ms AFTER CLICK ===");
    await page.waitForTimeout(100);
    console.log("Buttons:", await page.locator("button").allTextContents());
    console.log("Compressing count:", await page.getByRole("button", {
      name: /Compressing/i
    }).count());

    console.log("");
    console.log("=== 1000ms AFTER CLICK ===");
    await page.waitForTimeout(900);
    console.log("Buttons:", await page.locator("button").allTextContents());
    console.log("Compressing count:", await page.getByRole("button", {
      name: /Compressing/i
    }).count());

    console.log("");
    console.log("=== 3000ms AFTER CLICK ===");
    await page.waitForTimeout(2000);
    console.log("Buttons:", await page.locator("button").allTextContents());
    console.log("Compressing count:", await page.getByRole("button", {
      name: /Compressing/i
    }).count());

    console.log("");
    console.log("=== 4500ms AFTER CLICK ===");
    await page.waitForTimeout(1500);
    console.log("Buttons:", await page.locator("button").allTextContents());
    console.log("Compressing count:", await page.getByRole("button", {
      name: /Compressing/i
    }).count());

    await downloadPromise;

    console.log("");
    console.log("=== RESULT ===");
    console.log("Download received: true");

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
