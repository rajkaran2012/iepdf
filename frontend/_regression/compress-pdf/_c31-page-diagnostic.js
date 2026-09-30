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

    await page.waitForTimeout(2000);

    console.log("URL:", page.url());
    console.log("BUTTON COUNT:", await page.locator("button").count());
    console.log("BUTTON TEXT:", await page.locator("button").allTextContents());
    console.log("FILE INPUT COUNT:", await page.locator('input[type="file"]').count());

    const bodyText = await page.locator("body").innerText();
    console.log("BODY TEXT START:");
    console.log(bodyText.slice(0, 4000));

  } catch (error) {
    console.error("DIAGNOSTIC FAILED:", error.message || String(error));
  } finally {
    await context.close();
    await browser.close();
  }
})();
