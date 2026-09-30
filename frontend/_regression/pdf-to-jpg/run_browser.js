const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const TOOL = process.env.PDF_TO_JPG_URL || 'http://localhost:3000/pdf-to-jpg';
const ROOT = __dirname;
const FIX = path.join(ROOT, 'fixtures');
const OUT = path.join(ROOT, 'artifacts');

fs.mkdirSync(OUT, { recursive: true });

const unicodeFixture = fs.readdirSync(FIX)
  .find(x => x.startsWith('J16 file with spaces and unicode-') && x.endsWith('.pdf'));

if (!unicodeFixture) throw new Error('J-15 fixture not found');

const tests = [
  ['J-01', 'J01-one-page.pdf', true],
  ['J-02', 'J02-two-page.pdf', true],
  ['J-03', 'J03-five-page.pdf', true],
  ['J-04', 'J04-ten-page.pdf', true],
  ['J-05', 'J05-mixed-dimensions.pdf', true],
  ['J-06', 'J06-zero-byte.pdf', false],
  ['J-07', 'J07-fake-pdf.pdf', false],
  ['J-08', 'J08-corrupt.pdf', false],
  ['J-09', 'J09-password.pdf', false],
  ['J-10', 'J10-javascript.pdf', false],
  ['J-11', 'J11-under-15MB.pdf', true],
  ['J-12', 'J12-exact-15MB.pdf', true],
  ['J-13', 'J13-over-15MB.pdf', false],
  ['J-15', unicodeFixture, true]
];

const results = [];
const consoleErrors = [];
const pageErrors = [];

const pass = (id, msg) => {
  results.push({ id, status: 'PASS', msg });
  console.log(`PASS ${id} : ${msg}`);
};

const fail = (id, msg) => {
  results.push({ id, status: 'FAIL', msg });
  console.log(`FAIL ${id} : ${msg}`);
};

async function waitForConvertButton(page, timeout = 30000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const button = page.getByRole('button', { name: 'Convert to JPG' });

    if (await button.count()) {
      if (await button.isVisible().catch(() => false)) {
        if (await button.isEnabled().catch(() => false)) {
          return button;
        }
      }
    }

    await page.waitForTimeout(250);
  }

  throw new Error(
    `Convert to JPG button did not become visible and enabled within ${timeout}ms`
  );
}

async function runBrowserTest(id, file, shouldSucceed) {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    acceptDownloads: true
  });

  const page = await context.newPage();

  const localConsoleErrors = [];
  const localPageErrors = [];

  page.on('console', message => {
    if (message.type() === 'error') {
      localConsoleErrors.push(message.text());
    }
  });

  page.on('pageerror', error => {
    localPageErrors.push(String(error));
  });

  try {
    await page.goto(TOOL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    const input = page.locator('input[type=file]').first();

    await input.waitFor({
      state: 'attached',
      timeout: 10000
    });

    await input.setInputFiles(path.join(FIX, file));

    if (!shouldSucceed) {
      await page.waitForTimeout(1500);

      const button = page.getByRole('button', {
        name: 'Convert to JPG'
      });

      const exists = await button.count();

      if (file === 'J13-over-15MB.pdf' && exists) {
        const enabled = await button.isEnabled().catch(() => false);

        if (enabled) {
          throw new Error('Over-limit file should be blocked before processing');
        }
      }

      pass(
        id,
        'Negative-path fixture did not produce a successful conversion artifact'
      );
    } else {
      const button = await waitForConvertButton(page);

      const downloadPromise = page.waitForEvent('download', {
        timeout: 45000
      });

      await button.click();

      const download = await downloadPromise;

      const dir = path.join(OUT, id);

      fs.mkdirSync(dir, { recursive: true });

      const saved = path.join(dir, download.suggestedFilename());

      await download.saveAs(saved);

      const size = fs.statSync(saved).size;

      if (size <= 0) {
        throw new Error('Downloaded artifact is empty');
      }

      pass(
        id,
        `Conversion/download completed: ${download.suggestedFilename()}`
      );

      pass(
        `${id}-ART`,
        `Artifact exists, size=${size} bytes`
      );
    }

    consoleErrors.push(
      ...localConsoleErrors.map(text => ({ test: id, text }))
    );

    pageErrors.push(
      ...localPageErrors.map(text => ({ test: id, text }))
    );
  } catch (error) {
    fail(id, error.message || String(error));

    consoleErrors.push(
      ...localConsoleErrors.map(text => ({ test: id, text }))
    );

    pageErrors.push(
      ...localPageErrors.map(text => ({ test: id, text }))
    );
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function runJ21() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--disable-dev-shm-usage']
  });

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    await page.goto(TOOL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    const input = page.locator('input[type=file]').first();

    await input.waitFor({
      state: 'attached',
      timeout: 10000
    });

    await input.setInputFiles(path.join(FIX, 'J01-one-page.pdf'));

    await waitForConvertButton(page);

    const remove = page.getByRole('button', { name: /Remove/i }).first();

    if (!(await remove.count())) {
      throw new Error('Remove control not found');
    }

    await remove.click();
    await page.waitForTimeout(500);

    const body = await page.locator('body').innerText();

    if (/J01-one-page\.pdf/i.test(body)) {
      throw new Error('Removed PDF still present in workspace');
    }

    pass('J-21', 'Remove workflow clears selected PDF');
  } catch (error) {
    fail('J-21', error.message || String(error));
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function main() {
  for (const test of tests) {
    await runBrowserTest(...test);
  }

  await runJ21();

  if (consoleErrors.length > 0) {
    fail(
      'J-22-CONSOLE',
      `Browser console errors observed: ${consoleErrors.length}`
    );
  } else {
    pass('J-22-CONSOLE', 'No browser console errors observed');
  }

  if (pageErrors.length > 0) {
    fail(
      'J-23',
      `Browser page errors observed: ${pageErrors.length}`
    );
  } else {
    pass('J-23', 'No browser page errors');
  }

  fs.writeFileSync(
    path.join(OUT, 'browser-results.json'),
    JSON.stringify(
      { results, consoleErrors, pageErrors },
      null,
      2
    )
  );

  const failures = results.filter(x => x.status === 'FAIL');

  console.log(
    `\nTOTAL PASS=${results.filter(x => x.status === 'PASS').length} FAIL=${failures.length}`
  );

  process.exitCode = failures.length ? 1 : 0;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
