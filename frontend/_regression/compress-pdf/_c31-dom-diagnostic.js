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

    const button = page.getByRole("button", {
      name: "Add PDF File"
    }).first();

    console.log("BUTTON HTML:");
    console.log(await button.evaluate(el => el.outerHTML));

    console.log("");
    console.log("BUTTON PARENT HTML:");
    console.log(
      await button.evaluate(el => el.parentElement?.outerHTML || "")
    );

    console.log("");
    console.log("FILE INPUT HTML:");
    console.log(
      await page.locator('input[type="file"]').first().evaluate(el => el.outerHTML)
    );

  } catch (error) {
    console.error("DOM TEST FAILED:", error.message || String(error));
  } finally {
    await browser.close();
  }
})();
