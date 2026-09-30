const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 }
  });

  try {
    await page.goto("http://127.0.0.1:3000/compress-pdf", {
      waitUntil: "networkidle",
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    const button = page.getByRole("button", {
      name: "Add PDF File"
    }).first();

    console.log("BUTTON COUNT:", await button.count());
    console.log("BUTTON VISIBLE:", await button.isVisible());

    const result = await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]');
      if (!input) return { error: "input not found" };

      let clicked = false;

      input.addEventListener("click", () => {
        clicked = true;
      }, { once: true });

      return { initial: clicked };
    });

    console.log("BEFORE BUTTON CLICK:", result);

    await button.click();

    await page.waitForTimeout(500);

    const after = await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]');
      return input
        ? { activeElement: document.activeElement?.tagName || null }
        : { error: "input not found" };
    });

    console.log("AFTER BUTTON CLICK:", after);

  } catch (error) {
    console.error("CLICK TEST FAILED:", error.message || String(error));
  } finally {
    await browser.close();
  }
})();
