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

    console.log("BUTTON COUNT:", await button.count());

    if (await button.count() !== 1) {
      console.log("EXPECTED ONE ADD PDF BUTTON");
      return;
    }

    try {
      const chooserPromise = page.waitForEvent("filechooser", {
        timeout: 5000
      });

      await button.click();

      const chooser = await chooserPromise;

      console.log("FILECHOOSER EVENT: YES");
      console.log("INPUT ACCEPT:", await chooser.element().getAttribute("accept"));

    } catch (error) {
      console.log("FILECHOOSER EVENT: NO");
      console.log("ERROR:", error.message || String(error));
    }

  } catch (error) {
    console.error("FILECHOOSER TEST FAILED:", error.message || String(error));
  } finally {
    await browser.close();
  }
})();
