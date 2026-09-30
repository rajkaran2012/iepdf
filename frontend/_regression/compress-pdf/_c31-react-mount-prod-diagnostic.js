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

  page.on("pageerror", err => {
    console.log("[PAGEERROR]", err.message);
  });

  try {
    await page.goto("http://127.0.0.1:3001/compress-pdf", {
      waitUntil: "networkidle",
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("*"));

      const reactLikeKeys = all
        .map(el => Object.keys(el).filter(k =>
          k.startsWith("__react") ||
          k.startsWith("__next")
        ))
        .flat();

      const rootCandidates = all.filter(el => {
        const keys = Object.keys(el);
        return keys.some(k =>
          k.startsWith("__reactContainer") ||
          k.startsWith("__reactFiber") ||
          k.startsWith("__reactProps")
        );
      });

      return {
        reactPresent: !!window.React,
        reactVersion: window.React?.version ?? null,
        nextPresent: !!window.next,
        bodyChildren: document.body.children.length,
        totalElements: all.length,
        reactLikeKeyCount: reactLikeKeys.length,
        reactLikeKeys: [...new Set(reactLikeKeys)].slice(0, 30),
        rootCandidates: rootCandidates.map(el => ({
          tag: el.tagName,
          id: el.id,
          className: typeof el.className === "string"
            ? el.className.slice(0, 120)
            : ""
        })).slice(0, 20),
        button: (() => {
          const b = Array.from(document.querySelectorAll("button"))
            .find(x => x.textContent?.trim() === "Add PDF File");

          if (!b) return null;

          return {
            found: true,
            outerHTML: b.outerHTML,
            keys: Object.keys(b),
            reactKeys: Object.keys(b).filter(k =>
              k.startsWith("__react") ||
              k.startsWith("__next")
            )
          };
        })()
      };
    });

    console.log("=== REACT MOUNT DIAGNOSTIC ===");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error(
      "REACT MOUNT DIAGNOSTIC FAILED:",
      error.message || String(error)
    );
  } finally {
    await browser.close();
  }
})();
