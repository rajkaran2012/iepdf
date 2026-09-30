const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const page = await browser.newPage();

  try {
    await page.goto("http://127.0.0.1:3001/compress-pdf", {
      waitUntil: "networkidle",
      timeout: 30000
    });

    await page.waitForTimeout(1000);

    const input = page.locator('input[type="file"]');

    console.log("INPUT COUNT:", await input.count());

    await input.setInputFiles(
      "C:\\iepdf\\frontend\\_regression\\compress-pdf\\C-01-small-text.pdf"
    );

    await page.waitForTimeout(1000);

    const result = await page.evaluate(() => ({
      inputFiles:
        document.querySelector('input[type="file"]')?.files?.length ?? 0,

      inputName:
        document.querySelector('input[type="file"]')?.files?.[0]?.name ?? null,

      buttons: Array.from(document.querySelectorAll("button"))
        .map(b => ({
          text: b.textContent?.trim() ?? "",
          disabled: b.disabled
        }))
        .filter(x => x.text),

      bodyHasCompressButton:
        document.body.innerText.includes("Compress PDF"),

      bodyHasWaiting:
        document.body.innerText.includes("Waiting for a PDF")
    }));

    console.log("=== SET INPUT FILES RESULT ===");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("DIAGNOSTIC FAILED:", error.message || String(error));
  } finally {
    await browser.close();
  }
})();
