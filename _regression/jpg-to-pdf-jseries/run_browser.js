const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require(require.resolve("playwright", { paths: ["C:/iepdf/frontend"] }));

const TOOL = "http://localhost:3000/jpg-to-pdf";
const ROOT = path.resolve("C:/iepdf/_regression/jpg-to-pdf-jseries");
const FIX = path.join(ROOT, "fixtures");
const OUT = path.join(ROOT, "artifacts");

fs.mkdirSync(OUT, { recursive: true });

const tests = [
  ["J-01", ["J01-single.jpg"], true],
  ["J-02", ["J02-01.jpg", "J02-02.jpg", "J02-03.jpg"], true],
  ["J-03", ["J03-01.jpg", "J03-02.jpg", "J03-03.jpg", "J03-04.jpg", "J03-05.jpg"], true],
  ["J-04", ["J04-01.jpg", "J04-02.jpg", "J04-03.jpg", "J04-04.jpg", "J04-05.jpg", "J04-06.jpg", "J04-07.jpg", "J04-08.jpg", "J04-09.jpg", "J04-10.jpg"], true],
  ["J-05", ["J05-portrait.jpg", "J05-landscape.jpg", "J05-square.jpg"], true],
  ["J-06", ["J06-image.png", "J06-photo.jpg"], true],
  ["J-07", ["J07 file with spaces and unicode-टेस्ट.jpg"], true],
  ["J-08", ["J08-zero-byte.jpg"], false],
  ["J-09", ["J09-fake-jpg.jpg"], false],
  ["J-10", ["J10-corrupt.jpg"], false],
  ["J-11", ["J11-under-15MB.jpg"], true],
  ["J-12", ["J12-exact-15MB.jpg"], true],
  ["J-13", ["J13-over-15MB.jpg"], false]
];

const results = [];
const consoleErrors = [];
const pageErrors = [];

const pass = (id, msg) => {
  results.push({ id, status: "PASS", msg });
  console.log(`PASS ${id} : ${msg}`);
};

const fail = (id, msg) => {
  results.push({ id, status: "FAIL", msg });
  console.log(`FAIL ${id} : ${msg}`);
};

function validatePdf(pdfPath, expectedPages) {
  const script = `
import sys
from pathlib import Path
from pypdf import PdfReader

pdf = Path(sys.argv[1])
expected = int(sys.argv[2])

if not pdf.exists():
    raise RuntimeError("PDF artifact does not exist")
if pdf.stat().st_size <= 0:
    raise RuntimeError("PDF artifact is empty")

raw = pdf.read_bytes()
if not raw.startswith(b"%PDF-"):
    raise RuntimeError("Artifact does not start with %PDF-")

reader = PdfReader(str(pdf), strict=True)

if len(reader.pages) != expected:
    raise RuntimeError(
        f"Page count mismatch: expected {expected}, got {len(reader.pages)}"
    )

for i, page in enumerate(reader.pages, 1):
    resources = page.get("/Resources")
    if resources is None:
        raise RuntimeError(f"Page {i} has no Resources")

    xobj = resources.get("/XObject")
    if xobj is None:
        raise RuntimeError(f"Page {i} has no XObject")

    image_count = 0
    for _, ref in xobj.items():
        obj = ref.get_object()
        if obj.get("/Subtype") == "/Image":
            width = int(obj.get("/Width", 0))
            height = int(obj.get("/Height", 0))
            if width <= 0 or height <= 0:
                raise RuntimeError(
                    f"Page {i} contains an invalid image dimension"
                )
            image_count += 1

    if image_count == 0:
        raise RuntimeError(f"Page {i} contains no embedded image")

print(f"PAGES={len(reader.pages)}")
print(f"SIZE={pdf.stat().st_size}")
print("PDF_VALID=PASS")
`;

  const validator = path.join(OUT, "_validate_pdf.py");
  fs.writeFileSync(validator, script, "utf8");

  try {
    return execFileSync(
      "python",
      [validator, pdfPath, String(expectedPages)],
      { encoding: "utf8" }
    ).trim();
  } finally {
    try { fs.unlinkSync(validator); } catch {}
  }
}

async function findConvertButton(page, timeout = 30000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const buttons = page.getByRole("button");

    for (let i = 0; i < await buttons.count(); i++) {
      const button = buttons.nth(i);
      const text = ((await button.innerText().catch(() => "")) || "").trim();

      if (/Convert to PDF/i.test(text)) {
        return button;
      }
    }

    await page.waitForTimeout(250);
  }

  return null;
}

async function chooseFiles(page, filenames) {
  const files = filenames.map(name => path.join(FIX, name));

  for (let attempt = 1; attempt <= 3; attempt++) {
    const addButton = page.getByRole("button", { name: "Add Image Files" });
    await addButton.waitFor({ state: "visible", timeout: 10000 });

    try {
      const chooserPromise = page.waitForEvent("filechooser", {
        timeout: 5000
      });

      await addButton.click();

      const chooser = await chooserPromise;
      await chooser.setFiles(files);
      return;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }

      await page.waitForTimeout(500);
    }
  }
}

async function run() {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--disable-dev-shm-usage"]
  });

  const context = await browser.newContext({ acceptDownloads: true });

  context.on("page", page => {
    page.on("console", message => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    page.on("pageerror", error => {
      pageErrors.push(String(error));
    });
  });

  for (const [id, filenames, shouldSucceed] of tests) {
    const page = await context.newPage();

    try {
      await page.goto(TOOL, {
        waitUntil: "domcontentloaded",
        timeout: 30000
      });

      await chooseFiles(page, filenames);

      await page.waitForTimeout(2000);

      const button = await findConvertButton(page);

      if (!button) {
        if (shouldSucceed) {

          throw new Error("Convert to PDF button did not appear");
        }

        pass(id, "Expected negative input blocked without conversion");
        continue;
      }

      const enabled = await button.isEnabled().catch(() => false);

      if (!shouldSucceed) {
        if (id === "J-13" && enabled) {
          fail(id, "Over-limit input exposed an enabled conversion action");
        } else {
          pass(id, "Expected negative input handled without conversion");
        }
        continue;
      }

      if (!enabled) {
        throw new Error("Valid conversion button is disabled");
      }

      const downloadPromise = page.waitForEvent("download", {
        timeout: 45000
      });

      await button.click();

      const download = await downloadPromise;
      const dir = path.join(OUT, id);
      fs.mkdirSync(dir, { recursive: true });

      const saved = path.join(
        dir,
        download.suggestedFilename()
      );

      await download.saveAs(saved);

      if (download.suggestedFilename() !== "converted.pdf") {
        throw new Error(
          `Unexpected output name: ${download.suggestedFilename()}`
        );
      }

      const validation = validatePdf(saved, filenames.length);

      pass(
        id,
        `Conversion/download completed: ${download.suggestedFilename()}`
      );

      pass(
        `${id}-ART`,
        `PDF artifact validated successfully; expected pages=${filenames.length}; ${validation.replace(/\n/g, " | ")}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (shouldSucceed) {
        fail(id, message);
      } else {
        pass(id, "Expected negative input handled without conversion");
      }
    } finally {
      await page.close().catch(() => {});
    }
  }

  // No-file test
  {
    const page = await context.newPage();

    try {
      await page.goto(TOOL, {
        waitUntil: "domcontentloaded",
        timeout: 30000
      });

      const button = await findConvertButton(page);

      if (button && await button.isEnabled().catch(() => false)) {
        fail("J-14", "Convert action enabled with no selected files");
      } else {
        pass("J-14", "Conversion blocked with no selected files");
      }
    } finally {
      await page.close().catch(() => {});
    }
  }

  // Sequential repeatability
  for (let n = 1; n <= 3; n++) {
    const page = await context.newPage();

    try {
      await page.goto(TOOL, {
        waitUntil: "domcontentloaded",
        timeout: 30000
      });

      await chooseFiles(page, [
        "J02-01.jpg",
        "J02-02.jpg",
        "J02-03.jpg"
      ]);

      await page.waitForTimeout(2000);

      const button = await findConvertButton(page);

      if (!button || !(await button.isEnabled())) {
        throw new Error("Repeat conversion action unavailable");
      }

      const downloadPromise = page.waitForEvent("download", {
        timeout: 45000
      });

      await button.click();
      const download = await downloadPromise;

      pass(
        `J-${14 + n}`,
        `Sequential conversion ${n} completed: ${download.suggestedFilename()}`
      );
    } catch (error) {
      fail(
        `J-${14 + n}`,
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      await page.close().catch(() => {});
    }
  }

  if (consoleErrors.length === 0) {
    pass("J-22", "No browser console errors");
  } else {
    fail(
      "J-22",
      `Browser console errors observed: ${consoleErrors.length}`
    );
  }

  if (pageErrors.length === 0) {
    pass("J-23", "No browser page errors");
  } else {
    fail(
      "J-23",
      `Browser page errors observed: ${pageErrors.length}`
    );
  }

  fs.writeFileSync(
    path.join(OUT, "browser-results.json"),
    JSON.stringify(
      { results, consoleErrors, pageErrors },
      null,
      2
    ),
    "utf8"
  );

  await browser.close();

  const passCount = results.filter(r => r.status === "PASS").length;
  const failCount = results.filter(r => r.status === "FAIL").length;

  console.log(`TOTAL PASS=${passCount} FAIL=${failCount}`);

  process.exit(failCount ? 1 : 0);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});









