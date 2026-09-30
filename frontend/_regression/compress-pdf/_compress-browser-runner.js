const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.COMPRESS_REGRESSION_ROOT;
const FRONTEND = process.env.COMPRESS_FRONTEND_URL || 'http://127.0.0.1:3000/compress-pdf';
const MAX_BYTES = 15 * 1024 * 1024;

const files = {
  small: path.join(ROOT, 'C-01-small-text.pdf'),
  multi: path.join(ROOT, 'C-02-multipage.pdf'),
  text: path.join(ROOT, 'C-03-text-heavy.pdf'),
  image: path.join(ROOT, 'C-04-image-heavy.pdf'),
  mixed: path.join(ROOT, 'C-05-mixed-pages.pdf'),
  corrupt: path.join(ROOT, 'C-06-corrupted.pdf'),
  zero: path.join(ROOT, 'C-07-zero-byte.pdf'),
  fake: path.join(ROOT, 'C-08-renamed-nonpdf.pdf'),
  under: path.join(ROOT, 'C-09-under-15MiB.pdf'),
  exact: path.join(ROOT, 'C-10-exact-15MiB.pdf'),
  over: path.join(ROOT, 'C-11-over-15MiB.pdf')
};

function result(id, ok, message, extra={}) {
  return { id, ok, message, ...extra };
}

async function setFiles(page, locator, paths) {
  await locator.setInputFiles(paths);
}

async function waitForToast(page, pattern, timeout=8000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const text = await page.locator("body").innerText();

    if (pattern.test(text)) {
      return true;
    }

    await page.waitForTimeout(100);
  }

  return false;
}

async function downloaded(page, action) {
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  const result = await action(downloadPromise);
  const download = await downloadPromise;
  const suggested = download.suggestedFilename();
  const tmp = await download.path();
  if (!tmp) throw new Error('Download path unavailable');
  const data = fs.readFileSync(tmp);
  fs.writeFileSync(path.join(ROOT, `__output-${Date.now()}.pdf`), data);
  return { suggested, bytes: data.length, data };
}

async function runCase(browser, id, fn) {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  try {
    await page.goto(FRONTEND, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500);
    return await fn(page);
  } catch (e) {
    return result(id, false, e.message || String(e));
  } finally {
    await context.close();
  }
}

(async () => {
  process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED_REJECTION:', reason && reason.stack ? reason.stack : String(reason));
    process.exitCode = 1;
  });
  process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT_EXCEPTION:', error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  });

  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const results = [];

  results.push(await runCase(browser, 'C-01', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.small);
    await page.waitForTimeout(500);
    const btn = page.getByRole('button', { name: /^Compress PDF$/ }).first();
    const enabled = await btn.isEnabled();
    return result('C-01', enabled, enabled ? 'Valid small PDF accepted.' : 'Compress button remained disabled.');
  }));

  results.push(await runCase(browser, 'C-02', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.multi);
    await page.getByRole('button', { name: /^Compress PDF$/ }).click();
    const gotToast = await waitForToast(page, /Compression completed/i);
    return result('C-02', gotToast, gotToast ? 'Multi-page compression completed.' : 'Success toast not observed.');
  }));

  results.push(await runCase(browser, 'C-03', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.text);
    await page.getByRole('button', { name: /^Compress PDF$/ }).click();
    const gotToast = await waitForToast(page, /Compression completed/i);
    return result('C-03', gotToast, gotToast ? 'Text-heavy PDF compressed successfully.' : 'Text-heavy compression failed.');
  }));

  results.push(await runCase(browser, 'C-04', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.image);
    await page.getByRole('button', { name: /^Compress PDF$/ }).click();
    const gotToast = await waitForToast(page, /Compression completed/i);
    return result('C-04', gotToast, gotToast ? 'Image-heavy PDF compressed successfully.' : 'Image-heavy compression failed.');
  }));

  results.push(await runCase(browser, 'C-05', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.mixed);
    await page.getByRole('button', { name: /^Compress PDF$/ }).click();
    const gotToast = await waitForToast(page, /Compression completed/i);
    return result('C-05', gotToast, gotToast ? 'Mixed page-size/orientation PDF compressed.' : 'Mixed-page compression failed.');
  }));  results.push(await runCase(browser, 'C-06', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.corrupt);
    await page.waitForTimeout(500);

    const buttonCount = await page.getByRole('button', { name: /^Compress PDF$/ }).count();

    if (buttonCount === 0) {
      return result('C-06', true, 'Corrupt PDF rejected during validation; Compress button not rendered.');
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 3000 }).catch(() => null);
    await page.getByRole('button', { name: /^Compress PDF$/ }).first().click();

    const failedToast = await waitForToast(page, /Compression failed|Invalid PDF/i);
    const download = await downloadPromise;

    return result(
      'C-06',
      failedToast && !download,
      failedToast
        ? 'Corrupt PDF failed cleanly with no download.'
        : 'Corrupt PDF did not produce expected validation failure.'
    );
  }));  results.push(await runCase(browser, 'C-07', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.zero);
    await page.waitForTimeout(300);

    const buttonCount = await page.getByRole('button', { name: /^Compress PDF$/ }).count();

    if (buttonCount === 0) {
      return result('C-07', true, 'Zero-byte PDF rejected during validation; Compress button not rendered.');
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 3000 }).catch(() => null);
    await page.getByRole('button', { name: /^Compress PDF$/ }).first().click();

    const failedToast = await waitForToast(page, /Compression failed|Invalid PDF/i);
    const download = await downloadPromise;

    return result(
      'C-07',
      failedToast && !download,
      failedToast
        ? 'Zero-byte PDF failed cleanly with no download.'
        : 'Zero-byte PDF did not produce expected validation failure.'
    );
  }));  results.push(await runCase(browser, 'C-08', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.fake);
    await page.waitForTimeout(300);

    const buttonCount = await page.getByRole('button', { name: /^Compress PDF$/ }).count();

    if (buttonCount === 0) {
      return result('C-08', true, 'Fake PDF rejected during validation; Compress button not rendered.');
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 3000 }).catch(() => null);
    await page.getByRole('button', { name: /^Compress PDF$/ }).first().click();

    const failedToast = await waitForToast(page, /Compression failed|Invalid PDF/i);
    const download = await downloadPromise;

    return result(
      'C-08',
      failedToast && !download,
      failedToast
        ? 'Fake PDF failed cleanly with no download.'
        : 'Fake PDF did not produce expected validation failure.'
    );
  }));

  results.push(await runCase(browser, 'C-09', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.under);
    await page.waitForTimeout(500);
    const btn = page.getByRole('button', { name: /^Compress PDF$/ }).first();
    const enabled = await btn.isEnabled();
    return result('C-09', enabled, enabled ? 'Under-limit PDF accepted.' : 'Under-limit PDF was rejected.');
  }));

  results.push(await runCase(browser, 'C-10', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.exact);
    await page.waitForTimeout(500);
    const btn = page.getByRole('button', { name: /^Compress PDF$/ }).first();
    const enabled = await btn.isEnabled();
    return result('C-10', enabled, enabled ? 'Exact 15 MiB PDF accepted by boundary gate.' : 'Exact 15 MiB PDF was incorrectly rejected.');
  }));  results.push(await runCase(browser, 'C-11', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.over);

    const tooLarge = await waitForToast(page, /larger than|maximum allowed size|15 MB|15 MiB/i);
    const buttonCount = await page.getByRole('button', { name: /^Compress PDF$/ }).count();

    return result(
      'C-11',
      tooLarge && buttonCount === 0,
      (tooLarge && buttonCount === 0)
        ? 'Above-limit file blocked by client boundary gate and cleared from workspace.'
        : 'Above-limit file was not correctly blocked.'
    );
  }));

  results.push(await runCase(browser, 'C-12', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.small);
    const btn = page.getByRole('button', { name: /^Compress PDF$/ }).first();
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await btn.click();
    let dl;
    try {
      dl = await downloadPromise;
    } catch {
      return result('C-12', false, 'No compressed PDF download observed.');
    }
    const tmp = await dl.path();
    if (!tmp) return result('C-12', false, 'Download path unavailable.');
    const data = fs.readFileSync(tmp);
    const signature = data.subarray(0,5).toString('ascii');
    const nonempty = data.length > 0;
    return result('C-12', signature === '%PDF-' && nonempty,
      `Output signature=${signature}, bytes=${data.length}.`,
      { outputBytes: data.length });
  }));

  results.push(await runCase(browser, 'C-13', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.multi);
    const btn = page.getByRole('button', { name: /^Compress PDF$/ }).first();
    const before = fs.statSync(files.multi).size;
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await btn.click();
    const dl = await downloadPromise;
    const tmp = await dl.path();
    if (!tmp) return result('C-13', false, 'Download path unavailable.');
    const out = fs.statSync(tmp).size;
    return result('C-13', out > 0, `Output=${out} bytes, input=${before} bytes.`,
      { inputBytes: before, outputBytes: out });
  }));

  results.push(await runCase(browser, 'C-14', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.multi);
    const btn = page.getByRole('button', { name: /^Compress PDF$/ }).first();
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await btn.click();
    const dl = await downloadPromise;
    const tmp = await dl.path();
    if (!tmp) return result('C-14', false, 'Download path unavailable.');

    // Lightweight structural validation independent of Python.
    const bytes = fs.readFileSync(tmp);
    const text = bytes.toString('latin1');
    const validHeader = bytes.subarray(0,5).toString('ascii') === '%PDF-';
    const eof = text.lastIndexOf('%%EOF') >= 0;
    const startxref = text.lastIndexOf('startxref') >= 0;
    const valid = validHeader && eof && startxref;
    return result('C-14', valid,
      `Structural PDF check: header=${validHeader}, %%EOF=${eof}, startxref=${startxref}.`);
  }));

  results.push(await runCase(browser, 'C-15', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.multi);
    const btn = page.getByRole('button', { name: /^Compress PDF$/ }).first();
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await btn.click();
    const dl = await downloadPromise;
    const tmp = await dl.path();
    if (!tmp) return result('C-15', false, 'Download path unavailable.');

    // Count "/Type /Page" objects in the serialized PDF.
    const text = fs.readFileSync(tmp).toString('latin1');
    const pages = (text.match(/\/Type\s*\/Page\b/g) || []).length;
    return result('C-15', pages >= 6,
      `Detected approximately ${pages} page objects; expected at least 6.`);
  }));

  results.push(await runCase(browser, 'C-16', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.image);
    const btn = page.getByRole('button', { name: /^Compress PDF$/ }).first();
    const inputBytes = fs.statSync(files.image).size;
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await btn.click();
    const dl = await downloadPromise;
    const tmp = await dl.path();
    if (!tmp) return result('C-16', false, 'Download path unavailable.');
    const outputBytes = fs.statSync(tmp).size;
    const saved = inputBytes - outputBytes;
    const pct = inputBytes > 0 ? (saved / inputBytes) * 100 : 0;
    return result('C-16', outputBytes > 0,
      `Input=${inputBytes}, Output=${outputBytes}, Saved=${saved}, Compression=${pct.toFixed(2)}%.`,
      { inputBytes, outputBytes, compressionPercent: pct });
  }));  results.push(await runCase(browser, 'C-17', async page => {
    const buttonCount = await page.getByRole('button', { name: /^Compress PDF$/ }).count();

    return result(
      'C-17',
      buttonCount === 0,
      buttonCount === 0
        ? 'No-file state correctly hides the Compress button.'
        : 'Compress button is visible without a selected file.'
    );
  }));

  results.push(await runCase(browser, 'C-18', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.image);
    const btn = page.getByRole('button', { name: /^Compress PDF$/ }).first();

    await page.route('**/compress-pdf', async route => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      await route.continue();
    });

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

    await btn.click();

    const loadingButton = page.getByRole('button', { name: /Compressing…/i }).first();
    const loadingSeen = await loadingButton.isVisible({ timeout: 3000 }).then(() => true).catch(() => false);

    await downloadPromise;

    return result(
      'C-18',
      loadingSeen,
      loadingSeen
        ? 'Loading state exposed while processing.'
        : 'Loading state was not observed.'
    );
  }));
  results.push(await runCase(browser, 'C-19', async page => {
    const input = page.locator('input[type="file"]').first();
    await setFiles(page, input, files.small);
    const btn = page.getByRole('button', { name: /^Compress PDF$/ }).first();
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await btn.click();
    const dl = await downloadPromise;
    const success = await waitForToast(page, /Compression completed/i);
    return result('C-19', success && dl.suggestedFilename() === 'compressed.pdf',
      `Success toast=${success}, filename=${dl.suggestedFilename()}.`);
  }));

  await browser.close();

  const outputs = fs.readdirSync(ROOT)
    .filter(n => n.startsWith('__output-') && n.endsWith('.pdf'));
  for (const n of outputs) {
    try { fs.unlinkSync(path.join(ROOT, n)); } catch {}
  }

  process.stdout.write(JSON.stringify(results));
})();
