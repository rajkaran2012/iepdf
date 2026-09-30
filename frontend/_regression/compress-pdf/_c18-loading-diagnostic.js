const { chromium } = require("playwright");

const FRONTEND = "http://127.0.0.1:3000/compress-pdf";
const FILE = "C:\\iepdf\\frontend\\_regression\\compress-pdf\\C-04-image-heavy.pdf";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    await page.goto(FRONTEND, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.waitForTimeout(500);

    const input = page.locator('input[type="file"]').first();
    await input.setInputFiles(FILE);

    const btn = page.getByRole("button", {
      name: /^Compress PDF$/
    }).first();

    console.log("BEFORE CLICK:");
    console.log("Compress button:", await btn.count());
    console.log("Button disabled:", await btn.isDisabled());

    let apiSeen = false;
    let loadingSeen = false;

    await page.route("**/compress-pdf", async route => {
      apiSeen = true;

      console.log("BACKEND REQUEST INTERCEPTED");

      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log("Releasing backend response...");

      await route.continue();
    });

    const loadingObserver = page.evaluate(() => {
      return new Promise(resolve => {
        let seen = false;

        const check = () => {
          const buttons = Array.from(
            document.querySelectorAll("button")
          );

          if (
            buttons.some(
              button =>
                (button.textContent || "").includes("Compressing…")
            )
          ) {
            seen = true;
            observer.disconnect();
            resolve(true);
          }
        };

        const observer = new MutationObserver(check);

        observer.observe(document.body, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true
        });

        check();

        setTimeout(() => {
          observer.disconnect();
          resolve(seen);
        }, 5000);
      });
    });

    const downloadPromise = page.waitForEvent("download", {
      timeout: 15000
    });

    await btn.click();

    loadingSeen = await loadingObserver;

    console.log("LOADING STATE SEEN:", loadingSeen);
    console.log("API REQUEST SEEN:", apiSeen);

    const download = await downloadPromise;

    console.log("DOWNLOAD:", download.suggestedFilename());

    console.log("");
    console.log("=== C-18 LOADING DIAGNOSTIC ===");
    console.log("Loading state seen:", loadingSeen);
    console.log("Backend request seen:", apiSeen);
    console.log("Download received:", true);

  } catch (error) {
    console.error("DIAGNOSTIC FAILED:");
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
})();
