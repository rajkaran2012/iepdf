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

    const result = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button"))
        .find(el => el.textContent?.trim() === "Add PDF File");

      if (!button) {
        return { error: "Add PDF File button not found" };
      }

      const input = document.querySelector('input[type="file"]');

      let buttonClicked = false;
      let inputClicked = false;

      button.addEventListener("click", () => {
        buttonClicked = true;
        console.log("NATIVE BUTTON CLICK");
      });

      if (input) {
        input.addEventListener("click", () => {
          inputClicked = true;
          console.log("NATIVE INPUT CLICK");
        });
      }

      return {
        buttonFound: true,
        inputFound: !!input,
        buttonClicked,
        inputClicked
      };
    });

    console.log("BEFORE:", result);

    await page.getByRole("button", {
      name: "Add PDF File"
    }).click();

    await page.waitForTimeout(500);

    console.log("AFTER:");
    console.log(await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]');
      return {
        activeElement: document.activeElement?.tagName || null,
        inputFiles: input?.files?.length ?? -1
      };
    }));

  } catch (error) {
    console.error("EVENT TEST FAILED:", error.message || String(error));
  } finally {
    await browser.close();
  }
})();
