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

    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]');
      if (input) {
        input.addEventListener("change", () => {
          console.log("NATIVE CHANGE EVENT FIRED");
        });
      }
    });

    const input = page.locator('input[type="file"]').first();

    await input.setInputFiles(
      "C:\\IEPDF\\frontend\\_regression\\compress-pdf\\C-01-small-text.pdf"
    );

    await page.waitForTimeout(1000);

    console.log(
      "FILES:",
      await input.evaluate(el => el.files ? el.files.length : -1)
    );

    console.log(
      "BUTTONS:",
      await page.locator("button").allTextContents()
    );

  } catch (error) {
    console.error("EVENT TEST FAILED:", error.message || String(error));
  } finally {
    await context.close();
    await browser.close();
  }
})();
