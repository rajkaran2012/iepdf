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

    await input.evaluate(el => {
      el.classList.remove("hidden");
    });

    console.log("INPUT VISIBLE:", await input.isVisible());

    await input.setInputFiles(
      "C:\\IEPDF\\frontend\\_regression\\compress-pdf\\C-01-small-text.pdf"
    );

    await page.waitForTimeout(3000);

    console.log("BUTTON TEXT:", await page.locator("button").allTextContents());

    console.log("BODY TEXT:");
    console.log((await page.locator("body").innerText()).slice(0, 5000));

  } catch (error) {
    console.error("VISIBLE INPUT TEST FAILED:", error.message || String(error));
  } finally {
    await context.close();
    await browser.close();
  }
})();
