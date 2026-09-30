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

    console.log(
      "FILES BEFORE CHANGE:",
      await input.evaluate(el => el.files ? el.files.length : -1)
    );

    await input.dispatchEvent("change");

    await page.waitForTimeout(2000);

    console.log("AFTER EXPLICIT CHANGE EVENT");
    console.log("BUTTON TEXT:", await page.locator("button").allTextContents());
    console.log("BODY TEXT:");
    console.log((await page.locator("body").innerText()).slice(0, 5000));

  } catch (error) {
    console.error("CHANGE TEST FAILED:", error.message || String(error));
  } finally {
    await context.close();
    await browser.close();
  }
})();
