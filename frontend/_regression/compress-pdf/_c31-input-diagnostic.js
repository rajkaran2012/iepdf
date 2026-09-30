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

    console.log("INPUT COUNT:", await page.locator('input[type="file"]').count());

    console.log("INPUT ATTRIBUTES:");
    console.log("accept:", await input.getAttribute("accept"));
    console.log("multiple:", await input.getAttribute("multiple"));
    console.log("class:", await input.getAttribute("class"));
    console.log("style:", await input.getAttribute("style"));

    console.log("VISIBLE:", await input.isVisible());
    console.log("ENABLED:", await input.isEnabled());

    await input.setInputFiles(
      "C:\\IEPDF\\frontend\\_regression\\compress-pdf\\C-01-small-text.pdf"
    );

    await page.waitForTimeout(1000);

    console.log("FILES AFTER SET:", await input.evaluate(el => el.files ? el.files.length : -1));

    if (await input.evaluate(el => el.files && el.files.length > 0)) {
      console.log("FILE NAME:", await input.evaluate(el => el.files[0].name));
      console.log("FILE SIZE:", await input.evaluate(el => el.files[0].size));
      console.log("FILE TYPE:", await input.evaluate(el => el.files[0].type));
    }

    console.log("BUTTONS AFTER SET:");
    console.log(await page.locator("button").allTextContents());

  } catch (error) {
    console.error("INPUT TEST FAILED:", error.message || String(error));
  } finally {
    await context.close();
    await browser.close();
  }
})();
