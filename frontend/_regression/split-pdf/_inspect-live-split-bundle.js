const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(
      "http://127.0.0.1:3000/split-pdf",
      { waitUntil: "networkidle", timeout: 30000 }
    );

    const url =
      "http://127.0.0.1:3000/_next/static/chunks/_188tzp_._.js";

    const response = await page.request.get(url);
    const text = await response.text();

    console.log("STATUS:", response.status());
    console.log("BUNDLE LENGTH:", text.length);

    const needles = [
      "const analysis = await analyzer.analyzeMany",
      'if (result.status !== "ready")',
      "setWorkspaceFile({",
      "file: selectedFile"
    ];

    for (const needle of needles) {
      const index = text.indexOf(needle);

      console.log("");
      console.log("NEEDLE:", needle);
      console.log("INDEX:", index);

      if (index >= 0) {
        console.log(
          text.slice(
            Math.max(0, index - 500),
            index + 2500
          )
        );
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
