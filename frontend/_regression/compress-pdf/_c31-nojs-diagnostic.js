const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const context = await browser.newContext({
    javaScriptEnabled: false
  });

  const page = await context.newPage();

  try {
    await page.goto("http://127.0.0.1:3000/compress-pdf", {
      waitUntil: "networkidle",
      timeout: 30000
    });

    const result = await page.evaluate(() => ({
      title: document.title,
      buttons: Array.from(document.querySelectorAll("button"))
        .map(b => b.textContent?.trim()),
      fileInputs: document.querySelectorAll('input[type="file"]').length,
      bodyHasCompress: document.body.innerText.includes("Compress PDF"),
      bodyHasWaiting: document.body.innerText.includes("Waiting for a PDF")
    }));

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("NO-JS TEST FAILED:", error.message || String(error));
  } finally {
    await browser.close();
  }
})();
