const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  page.on("console", msg => console.log("CONSOLE:", msg.type(), msg.text()));
  page.on("pageerror", err => console.log("PAGEERROR:", err.message));
  page.on("requestfailed", req =>
    console.log("REQUEST_FAILED:", req.url(), req.failure()?.errorText)
  );

  try {
    await page.goto("http://127.0.0.1:3000/compress-pdf", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    console.log("URL:", page.url());
    console.log("TITLE:", await page.title());

    const before = await page.locator("body").innerText();
    console.log("BODY_BEFORE_UPLOAD:");
    console.log(before);

    const input = page.locator('input[type="file"]').first();

    console.log("FILE_INPUT_COUNT:", await page.locator('input[type="file"]').count());

    await input.setInputFiles(
      "C:\\IEPDF\\frontend\\_regression\\compress-pdf\\C-01-small-text.pdf"
    );

    await page.waitForTimeout(3000);

    console.log("BODY_AFTER_UPLOAD:");
    console.log(await page.locator("body").innerText());

    console.log(
      "COMPRESS_BUTTON_COUNT:",
      await page.getByRole("button", { name: /^Compress PDF$/ }).count()
    );

    console.log(
      "ALL_BUTTONS:"
    );

    const buttons = await page.locator("button").allTextContents();
    console.log(buttons);

    await page.screenshot({
      path: "C:\\iepdf\\frontend\\_regression\\compress-pdf\\_current-page-diagnostic.png",
      fullPage: true
    });

    console.log("SCREENSHOT_SAVED");

  } catch (error) {
    console.error("DIAGNOSTIC_FAILED:", error.stack || error.message || String(error));
  } finally {
    await context.close();
    await browser.close();
  }
})();
