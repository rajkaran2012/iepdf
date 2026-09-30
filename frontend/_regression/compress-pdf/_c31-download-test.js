const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const context = await browser.newContext({
    acceptDownloads: true
  });

  const page = await context.newPage();

  try {
    await page.goto(
      "http://127.0.0.1:3000/compress-pdf",
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );

    await page.waitForTimeout(500);

    const input = page.locator('input[type="file"]').first();

    await input.setInputFiles(
      "C:\\IEPDF\\frontend\\_regression\\compress-pdf\\C-01-small-text.pdf"
    );

    const btn =
      page.getByRole("button", {
        name: /^Compress PDF$/
      }).first();

    console.log("Button enabled:", await btn.isEnabled());

    const downloadPromise =
      page.waitForEvent("download", {
        timeout: 15000
      });

    await btn.click();

    const download =
      await downloadPromise;

    console.log(
      "DOWNLOAD:",
      download.suggestedFilename()
    );

    const downloadPath =
      await download.path();

    console.log(
      "PATH:",
      downloadPath
    );

  } catch (error) {

    console.error(
      "DOWNLOAD TEST FAILED:",
      error.message || String(error)
    );

  } finally {

    await context.close();
    await browser.close();

  }
})();
