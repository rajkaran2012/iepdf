const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const page = await browser.newPage();

  try {
    await page.goto("http://127.0.0.1:3000/compress-pdf", {
      waitUntil: "networkidle",
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    const button = page.getByRole("button", { name: "Add PDF File" });

    console.log("ADD BUTTON COUNT:", await button.count());

    if (await button.count() === 0) {
      console.log("ADD PDF BUTTON NOT FOUND");
      return;
    }

    console.log("BEFORE ACTIVE:", await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      text: document.activeElement?.textContent
    })));

    await button.click();

    await page.waitForTimeout(500);

    console.log("AFTER CLICK:", await page.evaluate(() => ({
      activeTag: document.activeElement?.tagName,
      activeText: document.activeElement?.textContent,
      inputFiles: document.querySelector('input[type="file"]')?.files?.length ?? -1
    })));

    console.log(
      "BUTTONS:",
      await page.locator("button").allTextContents()
    );

  } catch (error) {
    console.error("ADD BUTTON TEST FAILED:", error.message || String(error));
  } finally {
    await browser.close();
  }
})();
