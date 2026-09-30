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

    const result = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button"))
        .find(el => el.textContent?.trim() === "Add PDF File");

      if (!button) {
        return { found: false };
      }

      const ownKeys = Object.keys(button);

      return {
        found: true,
        reactKeys: ownKeys.filter(key =>
          key.startsWith("__react") ||
          key.toLowerCase().includes("react")
        ),
        allInternalKeys: ownKeys,
        hasReactProps: ownKeys.some(key =>
          key.startsWith("__reactProps")
        ),
        hasReactFiber: ownKeys.some(key =>
          key.startsWith("__reactFiber")
        )
      };
    });

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("REACT PROP TEST FAILED:", error.message || String(error));
  } finally {
    await browser.close();
  }
})();
