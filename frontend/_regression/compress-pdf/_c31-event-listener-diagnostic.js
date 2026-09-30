const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const context = await browser.newContext();

  await context.addInitScript(() => {
    window.__c31Listeners = [];

    const originalAddEventListener = EventTarget.prototype.addEventListener;

    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (
        (this === document || this === window) &&
        ["click", "change", "input", "pointerdown", "pointerup"].includes(type)
      ) {
        window.__c31Listeners.push({
          target:
            this === document
              ? "document"
              : this === window
                ? "window"
                : "other",
          type
        });
      }

      return originalAddEventListener.call(this, type, listener, options);
    };
  });

  const page = await context.newPage();

  try {
    await page.goto("http://127.0.0.1:3000/compress-pdf", {
      waitUntil: "networkidle",
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => ({
      listeners: window.__c31Listeners,
      listenerCount: window.__c31Listeners.length
    }));

    console.log("=== EVENT LISTENER REGISTRATION ===");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error(
      "EVENT LISTENER DIAGNOSTIC FAILED:",
      error.message || String(error)
    );
  } finally {
    await browser.close();
  }
})();
