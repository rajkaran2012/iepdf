const { chromium } = require("playwright");

const FIXTURE =
  "C:\\iepdf\\frontend\\_regression\\pdf-to-jpg\\fixtures\\J16 file with spaces and unicode-टेस्ट.pdf";

const ASCII_FIXTURE =
  "C:\\iepdf\\frontend\\_regression\\pdf-to-jpg\\fixtures\\J15-ascii-copy.pdf";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--disable-dev-shm-usage"]
  });

  const page = await browser.newPage();

  await page.setContent(`
    <!doctype html>
    <html>
      <body>
        <input id="file" type="file" accept=".pdf,application/pdf">
      </body>
    </html>
  `);

  const input = page.locator("#file");

  console.log("===== ASCII FILE =====");

  await input.setInputFiles(ASCII_FIXTURE);

  console.log(
    JSON.stringify(
      await input.evaluate(el => ({
        files: el.files?.length ?? null,
        name: el.files?.[0]?.name ?? null,
        size: el.files?.[0]?.size ?? null,
        type: el.files?.[0]?.type ?? null
      })),
      null,
      2
    )
  );

  await input.evaluate(el => {
    el.value = "";
  });

  console.log("\n===== UNICODE FILE =====");

  await input.setInputFiles(FIXTURE);

  console.log(
    JSON.stringify(
      await input.evaluate(el => ({
        files: el.files?.length ?? null,
        name: el.files?.[0]?.name ?? null,
        size: el.files?.[0]?.size ?? null,
        type: el.files?.[0]?.type ?? null
      })),
      null,
      2
    )
  );

  await browser.close();
})();
