const { chromium } = require("playwright");

const TOOL = "http://localhost:3000/pdf-to-jpg";

const UNICODE_FIXTURE =
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

  console.log("===== INPUT ATTRIBUTES =====");

  console.log(
    JSON.stringify(
      await input.evaluate(el => ({
        outerHTML: el.outerHTML,
        accept: el.getAttribute("accept"),
        multiple: el.hasAttribute("multiple"),
        disabled: el.disabled,
        hidden: el.hidden,
        display: getComputedStyle(el).display,
        visibility: getComputedStyle(el).visibility,
        opacity: getComputedStyle(el).opacity
      })),
      null,
      2
    )
  );

  async function test(label, fixture) {
    console.log(`\n===== ${label} =====`);

    await page.goto(TOOL, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    const input = page.locator('input[type="file"]').first();

    await input.waitFor({
      state: "attached",
      timeout: 10000
    });

    const events = [];

    await page.evaluate(() => {
      window.__fileEvents = [];

      const input = document.querySelector('input[type="file"]');

      if (input) {
        input.addEventListener("change", () => {
          window.__fileEvents.push({
            event: "change",
            files: input.files?.length ?? null,
            name: input.files?.[0]?.name ?? null
          });
        });

        input.addEventListener("input", () => {
          window.__fileEvents.push({
            event: "input",
            files: input.files?.length ?? null,
            name: input.files?.[0]?.name ?? null
          });
        });
      }
    });

    await input.setInputFiles(fixture);

    console.log("SETINPUTFILES RETURNED");

    await page.waitForTimeout(1000);

    const result = await input.evaluate(el => ({
      files: el.files?.length ?? null,
      name: el.files?.[0]?.name ?? null,
      size: el.files?.[0]?.size ?? null,
      type: el.files?.[0]?.type ?? null,
      value: el.value
    }));

    const capturedEvents = await page.evaluate(() => window.__fileEvents);

    console.log("INPUT AFTER 1 SECOND:");
    console.log(JSON.stringify(result, null, 2));

    console.log("CAPTURED EVENTS:");
    console.log(JSON.stringify(capturedEvents, null, 2));

    console.log(
      "CONVERT BUTTON:",
      JSON.stringify(
        await page
          .getByRole("button", { name: "Convert to JPG" })
          .count()
      )
    );
  }

  await test("ASCII", ASCII_FIXTURE);
  await test("UNICODE", UNICODE_FIXTURE);

  await context.close();
  await browser.close();
})();
