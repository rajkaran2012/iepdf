const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    await page.goto("http://127.0.0.1:3000/compress-pdf", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    const input = page.locator('input[type="file"]').first();

    await input.setInputFiles(
      "C:\\IEPDF\\frontend\\_regression\\compress-pdf\\C-01-small-text.pdf"
    );

    await page.waitForTimeout(2000);

    console.log("AFTER UPLOAD");
    console.log("BUTTON COUNT:", await page.locator("button").count());
    console.log("BUTTON TEXT:", await page.locator("button").allTextContents());
    console.log("BODY TEXT:");
    console.log((await page.locator("body").innerText()).slice(0, 5000));

  } catch (error) {
    console.error("UPLOAD TEST FAILED:", error.message || String(error));
  } finally {
    await context.close();
    await browser.close();
  }
})();
