const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  page.on("console", msg => {
    console.log("BROWSER CONSOLE:", msg.type(), msg.text());
  });

  page.on("pageerror", error => {
    console.log("BROWSER PAGE ERROR:", error.message);
  });

  try {
    await page.goto("http://127.0.0.1:3000/compress-pdf", {
      waitUntil: "networkidle",
      timeout: 30000
    });

    const input = page.locator('input[type="file"]').first();

    await input.setInputFiles(
      "C:\\IEPDF\\frontend\\_regression\\compress-pdf\\C-01-small-text.pdf"
    );

    await input.dispatchEvent("change");

    await page.waitForTimeout(3000);

    console.log("FINAL BUTTONS:", await page.locator("button").allTextContents());
    console.log("FINAL BODY:");
    console.log((await page.locator("body").innerText()).slice(0, 5000));

  } catch (error) {
    console.error("CONSOLE DIAGNOSTIC FAILED:", error.message || String(error));
  } finally {
    await context.close();
    await browser.close();
  }
})();
