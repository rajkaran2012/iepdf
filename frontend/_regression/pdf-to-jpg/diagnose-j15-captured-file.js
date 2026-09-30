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

  /*
   * Capture the File synchronously during the native change event,
   * before the React handler can clear/re-render the input.
   */
  await page.evaluate(() => {
    window.__capturedFile = null;
    window.__capturePromise = new Promise(resolve => {
      window.__resolveCapturedFile = resolve;
    });

    const input = document.querySelector('input[type="file"]');

    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0] ?? null;

        window.__capturedFile = file;

        window.__resolveCapturedFile({
          exists: !!file,
          name: file?.name ?? null,
          size: file?.size ?? null,
          type: file?.type ?? null
        });
      },
      { once: true }
    );
  });

  console.log("SETTING UNICODE FILE...");

  await input.setInputFiles(UNICODE_FIXTURE);

  console.log("SETINPUTFILES RETURNED");

  const captured = await page.evaluate(async () => {
    const info = await Promise.race([
      window.__capturePromise,
      new Promise(resolve =>
        setTimeout(
          () =>
            resolve({
              exists: false,
              timeout: true
            }),
          5000
        )
      )
    ]);

    if (!window.__capturedFile) {
      return {
        capture: info,
        stage: "NO_CAPTURED_FILE"
      };
    }

    const file = window.__capturedFile;

    const result = {
      capture: info,
      stage: "FILE_CAPTURED",
      name: file.name,
      size: file.size,
      type: file.type
    };

    try {
      const started = performance.now();

      result.stage = "ARRAYBUFFER_START";

      const bytes = await file.arrayBuffer();

      result.arrayBufferBytes = bytes.byteLength;
      result.arrayBufferElapsedMs =
        Math.round(performance.now() - started);

      result.stage = "ARRAYBUFFER_DONE";

      const pdfLib = await import("pdf-lib");

      result.stage = "PDFLIB_IMPORTED";

      const pdf = await pdfLib.PDFDocument.load(bytes);

      result.stage = "PDF_LOAD_DONE";
      result.pages = pdf.getPageCount();
      result.totalElapsedMs =
        Math.round(performance.now() - started);

      return result;
    } catch (error) {
      return {
        ...result,
        stage: "ERROR",
        error: String(error?.message ?? error),
        stack: String(error?.stack ?? "")
      };
    }
  });

  console.log("CAPTURED-FILE ANALYSIS RESULT:");
  console.log(JSON.stringify(captured, null, 2));

  await context.close();
  await browser.close();
})();
