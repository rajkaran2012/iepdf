const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("console", msg => {
    console.log("[CONSOLE]", msg.type(), msg.text());
  });

  page.on("pageerror", error => {
    console.log("[PAGEERROR]", error.message);
  });

  try {
    await page.goto(
      "http://127.0.0.1:3000/split-pdf",
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );

    await page.waitForTimeout(500);

    const result = await page.evaluate(async () => {
      const input = document.querySelector(
        'input[type="file"]'
      );

      if (!input) {
        return { step: "input", error: "File input not found." };
      }

      const file = new File(
        [
          new Uint8Array(
            await (await fetch(
              "http://127.0.0.1:3000/_next/static/chunks/0v5y_pdf-lib_es_api_0s0z1kb._.js"
            )).arrayBuffer()
          )
        ],
        "probe.bin"
      );

      return {
        step: "browser",
        fileSize: file.size,
        fileType: file.type
      };
    });

    console.log("RESULT:", result);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
