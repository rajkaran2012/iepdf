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

    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => ({
      react:
        typeof window !== "undefined" &&
        Object.keys(window).some(key => key.toLowerCase().includes("react")),
      next:
        typeof window !== "undefined" &&
        Object.keys(window).some(key => key.toLowerCase().includes("next")),
      scripts: Array.from(document.scripts).map(s => s.src).filter(Boolean),
      inputCount: document.querySelectorAll('input[type="file"]').length,
      buttonCount: document.querySelectorAll("button").length
    }));

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("HYDRATION TEST FAILED:", error.message || String(error));
  } finally {
    await browser.close();
  }
})();
