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

  page.on("console", msg => {
    console.log("[CONSOLE]", msg.type(), msg.text());
  });

  page.on("pageerror", err => {
    console.log("[PAGEERROR]", err.message);
  });

  page.on("requestfailed", req => {
    console.log(
      "[REQUESTFAILED]",
      req.method(),
      req.url(),
      req.failure()?.errorText
    );
  });

  page.on("response", async response => {
    const url = response.url();

    if (
      url.includes("/compress-pdf") ||
      url.includes("/api/")
    ) {
      console.log(
        "[RESPONSE]",
        response.status(),
        response.request().method(),
        url
      );
    }
  });

  try {
    await page.goto("http://127.0.0.1:3001/compress-pdf", {
      waitUntil: "networkidle",
      timeout: 30000
    });

    await page.waitForTimeout(1000);

    await page.locator('input[type="file"]').setInputFiles(
      "C:\\iepdf\\frontend\\_regression\\compress-pdf\\C-01-small-text.pdf"
    );

    await page.waitForTimeout(500);

    console.log(
      "COMPRESS BUTTON COUNT:",
      await page.getByRole("button", { name: "Compress PDF" }).count()
    );

    console.log("CLICKING COMPRESS PDF...");

    const downloadPromise = page.waitForEvent("download", {
      timeout: 20000
    }).catch(error => ({
      __downloadError: true,
      message: error.message
    }));

    await page.getByRole("button", { name: "Compress PDF" }).click();

    console.log("BUTTON CLICKED");

    const result = await downloadPromise;

    if (result?.__downloadError) {
      console.log("=== DOWNLOAD EVENT RESULT ===");
      console.log(JSON.stringify(result, null, 2));

      console.log("PAGE URL:", page.url());

      console.log(
        "BODY AFTER TIMEOUT:",
        (await page.locator("body").innerText()).slice(0, 5000)
      );

      return;
    }

    const suggestedName = result.suggestedFilename();

    const downloadPath = await result.path();

    console.log("=== DOWNLOAD SUCCESS ===");
    console.log("SUGGESTED FILENAME:", suggestedName);
    console.log("DOWNLOAD PATH:", downloadPath);

  } catch (error) {
    console.error(
      "PRODUCTION COMPRESSION DIAGNOSTIC FAILED:",
      error.message || String(error)
    );
  } finally {
    await browser.close();
  }
})();
