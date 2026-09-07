const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const ROOT = "C:\\IEPDF\\frontend\\_regression\\merge-pdf";
const URL = "http://127.0.0.1:3000/merge-pdf";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function result(id, status, name, details = "") {
  console.log(`RESULT|${id}|${status}|${name}|${details}`);
}

async function main() {
  let browser;

  try {
    browser = await chromium.launch({
      executablePath: CHROME,
      headless: true
    });

    // ========================================================
    // M-01 - 2 valid PDFs
    // ========================================================

    {
      const context = await browser.newContext({
        acceptDownloads: true
      });

      const page = await context.newPage();

      try {
        await page.goto(URL, {
          waitUntil: "domcontentloaded",
          timeout: 30000
        });

        await page.locator('input[type="file"]').setInputFiles([
          path.join(ROOT, "A-2-pages.pdf"),
          path.join(ROOT, "B-1-page.pdf")
        ]);

        await page.waitForTimeout(1200);

        const mergeButton = page.getByRole("button", {
          name: /unlock\s*&\s*merge/i
        });

        if (await mergeButton.count() !== 1) {
          throw new Error("Merge button not found.");
        }

        if (!(await mergeButton.isEnabled())) {
          throw new Error("Merge button is disabled.");
        }

        const output = path.join(ROOT, "M-01-browser-output.pdf");

        if (fs.existsSync(output)) {
          fs.unlinkSync(output);
        }

        const downloadPromise = page.waitForEvent("download", {
          timeout: 30000
        });

        await mergeButton.click();

        const download = await downloadPromise;
        await download.saveAs(output);

        if (!fs.existsSync(output)) {
          throw new Error("Output PDF was not created.");
        }

        const toast = page.getByText(/merge completed/i).first();

        if (!(await toast.isVisible().catch(() => false))) {
          throw new Error("Merge success toast was not visible.");
        }

        result(
          "M-01",
          "PASS",
          "2 valid PDFs -> merge/download/toast",
          "Download and success toast verified."
        );
      } catch (error) {
        result(
          "M-01",
          "FAIL",
          "2 valid PDFs -> merge/download/toast",
          error.message
        );
      } finally {
        await context.close();
      }
    }

    // ========================================================
    // M-02 - 3 valid PDFs
    // ========================================================

    {
      const context = await browser.newContext({
        acceptDownloads: true
      });

      const page = await context.newPage();

      try {
        await page.goto(URL, {
          waitUntil: "domcontentloaded",
          timeout: 30000
        });

        await page.locator('input[type="file"]').setInputFiles([
          path.join(ROOT, "A-2-pages.pdf"),
          path.join(ROOT, "B-1-page.pdf"),
          path.join(ROOT, "C-1-page.pdf")
        ]);

        await page.waitForTimeout(1200);

        const mergeButton = page.getByRole("button", {
          name: /unlock\s*&\s*merge/i
        });

        if (!(await mergeButton.isEnabled())) {
          throw new Error("Merge button is disabled.");
        }

        const output = path.join(ROOT, "M-02-browser-output.pdf");

        if (fs.existsSync(output)) {
          fs.unlinkSync(output);
        }

        const downloadPromise = page.waitForEvent("download", {
          timeout: 30000
        });

        await mergeButton.click();

        const download = await downloadPromise;
        await download.saveAs(output);

        if (!fs.existsSync(output)) {
          throw new Error("Output PDF was not created.");
        }

        const toast = page.getByText(/merge completed/i).first();

        if (!(await toast.isVisible().catch(() => false))) {
          throw new Error("Merge success toast was not visible.");
        }

        result(
          "M-02",
          "PASS",
          "3 valid PDFs -> merge/download/toast",
          "Download and success toast verified."
        );
      } catch (error) {
        result(
          "M-02",
          "FAIL",
          "3 valid PDFs -> merge/download/toast",
          error.message
        );
      } finally {
        await context.close();
      }
    }

    // ========================================================
    // ========================================================
    // M-04 - Password PDF + correct password
    // ========================================================

    {
      const context = await browser.newContext({
        acceptDownloads: true
      });

      const page = await context.newPage();

      try {
        await page.goto(URL, {
          waitUntil: "domcontentloaded",
          timeout: 15000
        });

        await page.locator('input[type="file"]').setInputFiles([
          path.join(ROOT, "A-2-pages.pdf"),
          path.join(ROOT, "Protected-1-page.pdf")
        ]);

        await page.waitForTimeout(1200);

        const password = page.getByLabel("PDF Password");
        await password.fill("iepdf123");
        await password.press("Tab");

        await page.waitForTimeout(3000);

        const bodyText = await page.locator("body").innerText();

        if (!/Password accepted.*ready for merge/i.test(bodyText)) {
          throw new Error("Password was not accepted.");
        }

        const mergeButton = page.getByRole("button", {
          name: /unlock\s*&\s*merge/i
        });

        if (!(await mergeButton.isEnabled())) {
          throw new Error("Merge button is disabled after password acceptance.");
        }

        const output = path.join(ROOT, "M-04-browser-output.pdf");

        if (fs.existsSync(output)) {
          fs.unlinkSync(output);
        }

        const downloadPromise = page.waitForEvent("download", {
          timeout: 30000
        });

        await mergeButton.click();

        const download = await downloadPromise;
        await download.saveAs(output);

        if (!fs.existsSync(output)) {
          throw new Error("M-04 output PDF was not created.");
        }

        const successToast = page.getByText(/merge completed/i).first();

        if (!(await successToast.isVisible().catch(() => false))) {
          throw new Error("Merge success toast was not visible.");
        }

        result(
          "M-04",
          "PASS",
          "Password PDF + correct password -> merge/download",
          "Password accepted, merge completed, download and success toast verified."
        );
      } catch (error) {
        result(
          "M-04",
          "FAIL",
          "Password PDF + correct password -> merge/download",
          error.message
        );
      } finally {
        await context.close();
      }
    }
    // ========================================================
    // ========================================================
    // M-05 - Password PDF + wrong password
    // ========================================================

    {
      const context = await browser.newContext({
        acceptDownloads: true
      });

      const page = await context.newPage();

      try {
        await page.goto(URL, {
          waitUntil: "domcontentloaded",
          timeout: 15000
        });

        await page.locator('input[type="file"]').setInputFiles([
          path.join(ROOT, "A-2-pages.pdf"),
          path.join(ROOT, "Protected-1-page.pdf")
        ]);

        await page.waitForTimeout(1200);

        await page.getByLabel("PDF Password").fill("wrong-password");
        await page.getByLabel("PDF Password").press("Tab");
        await page.waitForTimeout(1500);

        const mergeButton = page.getByRole("button", {
          name: /unlock\s*&\s*merge/i
        });

        if (!(await mergeButton.isEnabled())) {
          throw new Error("Merge button is unexpectedly disabled.");
        }

        const output = path.join(ROOT, "M-05-should-not-exist.pdf");

        if (fs.existsSync(output)) {
          fs.unlinkSync(output);
        }

        const clickPromise = mergeButton.click();

        await clickPromise;
        await page.waitForTimeout(2500);

        const bodyText = await page.locator("body").innerText();

        const invalidPassword =
          /Invalid PDF password/i.test(bodyText);

        const passwordRequired =
          /Password Required/i.test(bodyText);

        const mergeFailed =
          /Merge failed/i.test(bodyText);

        const successToast =
          await page.getByText(/merge completed/i)
            .first()
            .isVisible()
            .catch(() => false);

        if (!invalidPassword) {
          throw new Error("Invalid PDF password message was not shown.");
        }

        if (!passwordRequired) {
          throw new Error("Protected PDF did not remain Password Required.");
        }

        if (!mergeFailed) {
          throw new Error("Merge failed notification was not shown.");
        }

        if (fs.existsSync(output)) {
          throw new Error("Unexpected merged output exists.");
        }

        if (successToast) {
          throw new Error("Unexpected success toast appeared.");
        }

        result(
          "M-05",
          "PASS",
          "Password PDF + wrong password -> blocked",
          "Invalid password shown, merge rejected, no output, no success toast."
        );
      } catch (error) {
        result(
          "M-05",
          "FAIL",
          "Password PDF + wrong password -> blocked",
          error.message
        );
      } finally {
        await context.close();
      }
    }
    // ========================================================
    // M-06 - Oversized PDF must be blocked
    // ========================================================

    {
      const context = await browser.newContext({
        acceptDownloads: true
      });

      const page = await context.newPage();

      try {
        await page.goto(URL, {
          waitUntil: "domcontentloaded",
          timeout: 30000
        });

        await page.locator('input[type="file"]').setInputFiles([
          path.join(ROOT, "A-2-pages.pdf"),
          path.join(ROOT, "M-06-valid-over-15MiB.pdf")
        ]);

        await page.waitForTimeout(2000);

        const bodyText = await page.locator("body").innerText();

        const sizeBlocked =
          /maximum allowed size|exceeds maximum allowed size/i.test(bodyText);

        const readyVisible =
          /M-06-valid-over-15MiB\.pdf[\s\S]*? Ready/i.test(bodyText);

        if (!sizeBlocked) {
          throw new Error("Maximum file size validation message was not shown.");
        }

        if (readyVisible) {
          throw new Error("Oversized PDF was shown as Ready.");
        }

        result(
          "M-06",
          "PASS",
          "Oversized PDF -> blocked",
          "15 MiB limit enforced; oversized PDF was not accepted."
        );
      } catch (error) {
        result(
          "M-06",
          "FAIL",
          "Oversized PDF -> blocked",
          error.message
        );
      } finally {
        await context.close();
      }
    }
    // M-03 - Corrupted PDF must block merge
    // ========================================================

    {
      const context = await browser.newContext({
        acceptDownloads: true
      });

      const page = await context.newPage();

      try {
        await page.goto(URL, {
          waitUntil: "domcontentloaded",
          timeout: 30000
        });

        const output = path.join(ROOT, "M-03-should-not-exist.pdf");

        if (fs.existsSync(output)) {
          fs.unlinkSync(output);
        }

        await page.locator('input[type="file"]').setInputFiles([
          path.join(ROOT, "A-2-pages.pdf"),
          path.join(ROOT, "Corrupted.pdf")
        ]);

        await page.waitForTimeout(1800);

        const bodyText = await page.locator("body").innerText();

        const corruptedVisible = /Corrupted/i.test(bodyText);

        const mergeButton = page.getByRole("button", {
          name: /unlock\s*&\s*merge/i
        });

        const buttonEnabled = await mergeButton.isEnabled();

        const outputExists = fs.existsSync(output);

        const successToastVisible =
          await page.getByText(/merge completed/i)
            .first()
            .isVisible()
            .catch(() => false);

        if (!corruptedVisible) {
          throw new Error("Corrupted state was not shown.");
        }

        if (buttonEnabled) {
          throw new Error("Merge button remained enabled.");
        }

        if (outputExists) {
          throw new Error("Unexpected output PDF exists.");
        }

        if (successToastVisible) {
          throw new Error("Unexpected success toast appeared.");
        }

        result(
          "M-03",
          "PASS",
          "Corrupted PDF -> blocked",
          "Corrupted state shown, merge disabled, no download."
        );
      } catch (error) {
        result(
          "M-03",
          "FAIL",
          "Corrupted PDF -> blocked",
          error.message
        );
      } finally {
        await context.close();
      }
    }

  } catch (error) {
    result(
      "BROWSER",
      "FAIL",
      "Browser regression runner",
      error.message
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();
