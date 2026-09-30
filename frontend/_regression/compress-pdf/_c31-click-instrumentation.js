const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const page = await browser.newPage();

  try {
    await page.goto("http://127.0.0.1:3000/compress-pdf", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]');

      if (!input) {
        throw new Error("File input not found");
      }

      const originalClick = input.click.bind(input);

      input.click = function () {
        console.log("INPUT CLICK() CALLED");
        originalClick();
      };
    });

    page.on("console", msg => {
      console.log("BROWSER:", msg.text());
    });

    const button = page.getByRole("button", {
      name: "Add PDF File"
    }).first();

    await button.click();

    await page.waitForTimeout(2000);

    console.log("TEST COMPLETE");

  } catch (error) {
    console.error("CLICK INSTRUMENTATION FAILED:", error.message || String(error));
  } finally {
    await browser.close();
  }
})();
