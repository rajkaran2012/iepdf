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

    const input = page.locator('input[type="file"]').first();

    console.log("Uploading S-01-1page.pdf...");
    await input.setInputFiles(
      "C:\\iepdf\\frontend\\_regression\\split-pdf\\S-01-1page.pdf"
    );

    await page.waitForTimeout(3000);

    console.log("");
    console.log("BODY AFTER 3 SECONDS:");
    console.log(await page.locator("body").innerText());

    console.log("");
    console.log("SPLIT BUTTON DISABLED:");
    console.log(
      await page.getByRole("button", { name: /^Split PDF$/ }).first().isDisabled()
    );
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
