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

      (window).__c31NativeClick = false;

      button.addEventListener("click", () => {
        (window).__c31NativeClick = true;
        console.log("C31 NATIVE CLICK FIRED");
      }, { once: true });

      return {
        found: true,
        outerHTML: button.outerHTML,
        connected: button.isConnected
      };
    });

    console.log("BEFORE CLICK:", JSON.stringify(result, null, 2));

    await page.getByRole("button", { name: "Add PDF File" }).click();

    await page.waitForTimeout(500);

    console.log(
      "NATIVE CLICK FIRED:",
      await page.evaluate(() => Boolean((window).__c31NativeClick))
    );

    console.log(
      "ACTIVE ELEMENT:",
      await page.evaluate(() => ({
        tag: document.activeElement?.tagName,
        text: document.activeElement?.textContent
      }))
    );

  } catch (error) {
    console.error("NATIVE CLICK TEST FAILED:", error.message || String(error));
  } finally {
    await browser.close();
  }
})();
