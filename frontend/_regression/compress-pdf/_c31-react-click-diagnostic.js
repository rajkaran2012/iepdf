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

    const navButton = page.getByRole("button", {
      name: "Open navigation menu"
    });

    console.log("NAV BUTTON COUNT:", await navButton.count());

    if (await navButton.count() > 0) {
      console.log("NAV ARIA BEFORE:", await navButton.getAttribute("aria-expanded"));

      await navButton.click();

      await page.waitForTimeout(500);

      console.log("NAV ARIA AFTER:", await navButton.getAttribute("aria-expanded"));

      console.log(
        "MOBILE NAV PRESENT:",
        await page.locator("#mobile-navigation").count()
      );
    }

  } catch (error) {
    console.error("REACT CLICK TEST FAILED:", error.message || String(error));
  } finally {
    await browser.close();
  }
})();
