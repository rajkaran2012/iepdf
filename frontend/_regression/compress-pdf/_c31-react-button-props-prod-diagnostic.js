const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto("http://127.0.0.1:3001/compress-pdf", {
      waitUntil: "networkidle",
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button"))
        .find(el => el.textContent?.trim() === "Add PDF File");

      if (!button) {
        return {
          found: false,
          error: "Add PDF File button not found"
        };
      }

      const reactPropKey = Object.keys(button)
        .find(k => k.startsWith("__reactProps"));

      const fiberKey = Object.keys(button)
        .find(k => k.startsWith("__reactFiber"));

      const props = reactPropKey
        ? button[reactPropKey]
        : null;

      const fiber = fiberKey
        ? button[fiberKey]
        : null;

      return {
        found: true,

        reactPropKey,
        fiberKey,

        propKeys: props ? Object.keys(props) : [],
        hasOnClick: !!props?.onClick,
        onClickType: typeof props?.onClick,

        buttonDisabled: button.disabled,

        fiberTag: fiber?.tag ?? null,
        fiberType:
          typeof fiber?.type === "string"
            ? fiber.type
            : fiber?.type?.name ?? null,

        parentFiberType:
          typeof fiber?.return?.type === "string"
            ? fiber.return.type
            : fiber?.return?.type?.name ?? null
      };
    });

    console.log("=== REACT BUTTON PROPS DIAGNOSTIC ===");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error(
      "REACT BUTTON PROPS DIAGNOSTIC FAILED:",
      error.message || String(error)
    );
  } finally {
    await browser.close();
  }
})();
