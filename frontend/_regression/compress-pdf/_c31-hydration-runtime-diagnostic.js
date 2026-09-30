const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const page = await browser.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];

  page.on("console", msg => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("pageerror", error => {
    pageErrors.push(error.message || String(error));
  });

  page.on("requestfailed", request => {
    requestFailures.push({
      url: request.url(),
      failure: request.failure()?.errorText || "unknown"
    });
  });

  try {
    await page.goto("http://127.0.0.1:3000/compress-pdf", {
      waitUntil: "networkidle",
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button"))
        .find(el => el.textContent?.trim() === "Add PDF File");

      const input = document.querySelector('input[type="file"]');

      return {
        url: location.href,
        title: document.title,

        buttonFound: Boolean(button),
        buttonReactKeys: button
          ? Object.keys(button).filter(key =>
              key.startsWith("__react") ||
              key.toLowerCase().includes("react")
            )
          : [],

        inputFound: Boolean(input),
        inputReactKeys: input
          ? Object.keys(input).filter(key =>
              key.startsWith("__react") ||
              key.toLowerCase().includes("react")
            )
          : [],

        scripts: Array.from(document.scripts)
          .map(s => s.src)
          .filter(Boolean)
      };
    });

    console.log("=== PAGE RESULT ===");
    console.log(JSON.stringify(result, null, 2));

    console.log("=== CONSOLE ERRORS ===");
    console.log(JSON.stringify(consoleErrors, null, 2));

    console.log("=== PAGE ERRORS ===");
    console.log(JSON.stringify(pageErrors, null, 2));

    console.log("=== REQUEST FAILURES ===");
    console.log(JSON.stringify(requestFailures, null, 2));

  } catch (error) {
    console.error("HYDRATION RUNTIME TEST FAILED:", error.message || String(error));
  } finally {
    await browser.close();
  }
})();
