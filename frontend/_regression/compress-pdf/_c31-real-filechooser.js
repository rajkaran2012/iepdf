const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    await page.goto("http://127.0.0.1:3000/compress-pdf", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    const addButton = page.getByRole("button", {
      name: "Add PDF File"
    }).first();

    console.log("Clicking Add PDF File...");

    const fileChooserPromise = page.waitForEvent("filechooser", {
      timeout: 10000
    });

    await addButton.click();

    const fileChooser = await fileChooserPromise;

    console.log("FILECHOOSER EVENT RECEIVED");

    await fileChooser.setFiles(
      "C:\\IEPDF\\frontend\\_regression\\compress-pdf\\C-01-small-text.pdf"
    );

    await page.waitForTimeout(2000);

    console.log("BUTTON TEXT:");
    console.log(await page.locator("button").allTextContents());

    console.log("BODY TEXT:");
    console.log((await page.locator("body").innerText()).slice(0, 5000));

    console.log("");
    console.log("Browser will remain open for 10 seconds...");
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error("REAL FILECHOOSER TEST FAILED:", error.message || String(error));
  } finally {
    await context.close();
    await browser.close();
  }
})();
