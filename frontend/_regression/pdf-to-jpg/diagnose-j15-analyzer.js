const { chromium } = require("playwright");

const TOOL = "http://localhost:3000/pdf-to-jpg";

const UNICODE_FIXTURE =
  "C:\\iepdf\\frontend\\_regression\\pdf-to-jpg\\fixtures\\J16 file with spaces and unicode-टेस्ट.pdf";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--disable-dev-shm-usage"]
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("console", msg => {
    if (msg.type() === "error") {
      console.log(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });

  page.on("pageerror", err => {
    console.log(`[PAGEERROR] ${err.message}`);
  });

  await page.goto(TOOL, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  const input = page.locator('input[type="file"]').first();

  await input.waitFor({
    state: "attached",
    timeout: 10000
  });

  await input.setInputFiles(UNICODE_FIXTURE);

  console.log("SETINPUTFILES RETURNED");

  const result = await input.evaluate(async el => {
    const file = el.files?.[0];

    if (!file) {
      return {
        stage: "FILE_OBJECT",
        ok: false,
        reason: "No File object available"
      };
    }

    const output = {
      stage: "START",
      ok: true,
      filename: file.name,
      size: file.size,
      type: file.type
    };

    try {
      const started = performance.now();

      output.stage = "ARRAYBUFFER_START";

      const bytes = await file.arrayBuffer();

      output.arrayBufferBytes = bytes.byteLength;
      output.arrayBufferElapsedMs =
        Math.round(performance.now() - started);

      output.stage = "ARRAYBUFFER_DONE";

      const pdfLib = await import("pdf-lib");

      output.stage = "PDFLIB_IMPORTED";

      const pdf = await pdfLib.PDFDocument.load(bytes);

      output.stage = "PDF_LOAD_DONE";
      output.pages = pdf.getPageCount();
      output.elapsedMs =
        Math.round(performance.now() - started);

      return output;
    } catch (error) {
      return {
        ...output,
        stage: "ERROR",
        error: String(error?.message ?? error),
        stack: String(error?.stack ?? "")
      };
    }
  });

  console.log("ANALYZER-LIKE RESULT:");
  console.log(JSON.stringify(result, null, 2));

  await context.close();
  await browser.close();
})();
