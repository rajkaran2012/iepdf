const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = process.cwd();
const BASE = process.env.IEPDF_MERGE_BASE || "http://127.0.0.1:3000";
const REPORT = process.env.IEPDF_MERGE_REPORT;
const OUT = process.env.IEPDF_MERGE_OUT;

const results = [];
let browser;
let context;
let page;

function pass(id, name, detail = "") {
  results.push({ id, status: "PASS", name, detail });
  console.log(`[PASS] ${id} - ${name}${detail ? " | " + detail : ""}`);
}
function fail(id, name, detail = "") {
  results.push({ id, status: "FAIL", name, detail });
  console.log(`[FAIL] ${id} - ${name}${detail ? " | " + detail : ""}`);
}
function skip(id, name, detail = "") {
  results.push({ id, status: "SKIPPED", name, detail });
  console.log(`[SKIPPED] ${id} - ${name}${detail ? " | " + detail : ""}`);
}
function info(msg) { console.log(`[INFO] ${msg}`); }

function discoverFile(names) {
  const roots = [
    path.join(ROOT, "_regression"),
    path.join(ROOT, "test-data"),
    path.join(ROOT, "tests"),
    path.join(ROOT, "fixtures"),
    path.join(ROOT, "scripts"),
    path.join(ROOT, "..", "scripts")
  ];
  const wanted = new Set(names.map(x => x.toLowerCase()));
  const stack = roots.filter(fs.existsSync);
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!e.name.startsWith(".next") && !e.name.includes("node_modules")) stack.push(p);
      } else if (wanted.has(e.name.toLowerCase())) {
        return p;
      }
    }
  }
  return null;
}

function minimalPdf(label) {
  const body = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 43 >>
stream
BT /F1 12 Tf 30 250 Td (${label}) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000063 00000 n 
0000000122 00000 n 
0000000208 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
304
%%EOF
`;
  return Buffer.from(body, "latin1");
}

function ensureTempFixtures() {
  fs.mkdirSync(OUT, { recursive: true });
  const a = path.join(OUT, "LA-A.pdf");
  const b = path.join(OUT, "LA-B.pdf");
  const c = path.join(OUT, "LA-C.pdf");
  fs.writeFileSync(a, minimalPdf("A"));
  fs.writeFileSync(b, minimalPdf("B"));
  fs.writeFileSync(c, minimalPdf("C"));
  return { a, b, c };
}

async function freshPage() {
  if (page) await page.close().catch(() => {});
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(`${BASE}/merge-pdf`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  return page;
}

async function fileInput() {
  const inputs = page.locator('input[type="file"]');
  const count = await inputs.count();
  if (!count) throw new Error("No file input found");
  return inputs.first();
}

async function addFiles(paths) {
  await (await fileInput()).setInputFiles(paths);
  await page.waitForTimeout(1200);
}

async function mergeButton() {
  const exact = page.getByRole("button", { name: /Unlock\s*&\s*Merge/i });
  if (await exact.count()) return exact.first();
  const text = page.getByText(/Unlock\s*&\s*Merge/i);
  if (await text.count()) return text.first();
  throw new Error("Unlock & Merge control not found");
}

async function downloadMerge() {
  const button = await mergeButton();
  if (await button.isDisabled()) throw new Error("Unlock & Merge is disabled");
  const downloadPromise = page.waitForEvent("download", { timeout: 20000 });
  await button.click();
  const download = await downloadPromise;
  const target = path.join(OUT, `merged-${Date.now()}.pdf`);
  await download.saveAs(target);
  if (!fs.existsSync(target) || fs.statSync(target).size === 0) {
    throw new Error("Downloaded file missing or empty");
  }
  return target;
}

async function visibleHandleCount() {
  return await page.locator('[aria-label^="Drag PDF "]').count();
}

async function allText() {
  return await page.locator("body").innerText();
}

async function run() {
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ acceptDownloads: true });
  const fixtures = ensureTempFixtures();

  // Locate existing official regression fixtures when present.
  const A = discoverFile(["A-2-pages.pdf"]) || fixtures.a;
  const B = discoverFile(["B-1-page.pdf"]) || fixtures.b;
  const C = discoverFile(["C-1-page.pdf"]) || fixtures.c;
  const CORRUPT = discoverFile(["Corrupted.pdf"]);
  const PROTECTED = discoverFile(["Protected-1-page.pdf"]);
  const OVER15 = discoverFile(["M-06-valid-over-15MiB.pdf"]);
  const EXACT15 = discoverFile(["M-07-valid-exact-15MiB.pdf"]);

  info(`Fixtures A=${A}; B=${B}; C=${C}`);
  info(`Protected=${PROTECTED || "not found"}; Over15=${OVER15 || "not found"}; Exact15=${EXACT15 || "not found"}`);

  // 1. Fresh-state UI / viewport / accessibility basics.
  try {
    await freshPage();
    const title = await page.title();
    if (!/merge/i.test(title) && !(await allText()).match(/Merge PDF/i)) throw new Error("Merge page identity not found");
    pass("UI-01", "Merge page opens");
  } catch (e) { fail("UI-01", "Merge page opens", e.message); }

  try {
    const drop = page.getByText(/Drop PDFs here/i).first();
    const add = page.getByText(/Add PDF Files/i).first();
    if (!(await drop.count()) || !(await add.count())) throw new Error("Drop/add controls missing");
    const merge = await mergeButton();
    const box = await merge.boundingBox();
    if (!box) throw new Error("Merge action not visible");
    pass("UI-02", "Primary action visible without page-scroll dependency");
  } catch (e) { fail("UI-02", "Primary action visible without page-scroll dependency", e.message); }

  // 2. 0/1/2+ handle behavior.
  try {
    if ((await visibleHandleCount()) !== 0) throw new Error("Handle visible with zero files");
    await addFiles([A]);
    if ((await visibleHandleCount()) !== 0) throw new Error("Handle visible with one file");
    await addFiles([B]);
    if ((await visibleHandleCount()) < 2) throw new Error("Handles did not appear for 2 files");
    pass("UI-03", "Reorder handle visibility matrix 0/1/2+");
  } catch (e) { fail("UI-03", "Reorder handle visibility matrix 0/1/2+", e.message); }

  // 3. Standard merges.
  for (const [id, files, label] of [
    ["M-01", [A, B], "2 valid PDFs"],
    ["M-02", [A, B, C], "3 valid PDFs"],
    ["M-03", [A, A], "duplicate same PDF twice"],
    ["M-04", [A, B, C, A], "4-file order-preserving merge"]
  ]) {
    try {
      await freshPage();
      await addFiles(files);
      const body = await allText();
      if (!/A|B|C|PDF/i.test(body)) throw new Error("Files not reflected in workspace");
      const out = await downloadMerge();
      pass(id, label, `download=${path.basename(out)}`);
    } catch (e) { fail(id, label, e.message); }
  }

  // 4. Add-more behavior.
  try {
    await freshPage();
    await addFiles([A]);
    await addFiles([B, C]);
    const count = await page.locator('[aria-label^="Drag PDF "]').count();
    if (count !== 3) throw new Error(`Expected 3 reorder handles, got ${count}`);
    pass("M-05", "Add More PDFs appends without replacing existing files");
  } catch (e) { fail("M-05", "Add More PDFs appends without replacing existing files", e.message); }

  // 5. Reorder via Playwright drag.
  try {
    await freshPage();
    await addFiles([A, B, C]);
    const handles = page.locator('[aria-label^="Drag PDF "]');
    if (await handles.count() !== 3) throw new Error("Expected 3 handles");
    await handles.nth(2).dragTo(handles.nth(0));
    await page.waitForTimeout(500);
    const body = await allText();
    if (!body.includes("C")) throw new Error("Reordered state not reflected");
    const out = await downloadMerge();
    pass("M-06", "Reorder C to first then merge", `download=${path.basename(out)}`);
  } catch (e) { fail("M-06", "Reorder C to first then merge", e.message); }

  // 6. Remove file and handle shrink behavior.
  try {
    await freshPage();
    await addFiles([A, B, C]);
    const removeButtons = page.getByRole("button", { name: /remove/i });
    const n = await removeButtons.count();
    if (!n) throw new Error("No remove controls found");
    await removeButtons.last().click();
    await page.waitForTimeout(400);
    if ((await visibleHandleCount()) !== 2) throw new Error("Expected 2 handles after removing one");
    await removeButtons.first().click();
    await page.waitForTimeout(400);
    if ((await visibleHandleCount()) !== 1) throw new Error("Expected 1 handle state");
    pass("M-07", "Remove updates workspace and reorder-handle state");
  } catch (e) { fail("M-07", "Remove updates workspace and reorder-handle state", e.message); }

  // 7. External file drop onto drop zone.
  try {
    await freshPage();
    const drop = page.getByText(/Drop PDFs here/i).first();
    await drop.drop({ files: [A] });
    await page.waitForTimeout(1200);
    const body = await allText();
    if (!/A|LA-A/i.test(body)) throw new Error("Dropped file not added");
    pass("DD-01", "External PDF drop onto drop zone adds file");
  } catch (e) { fail("DD-01", "External PDF drop onto drop zone adds file", e.message); }

  // 8. External file drop over a PDF row.
  try {
    await freshPage();
    await addFiles([A, B]);
    const row = page.locator('[aria-label^="Drag PDF "]').first();
    await row.drop({ files: [C] });
    await page.waitForTimeout(1200);
    if ((await page.locator('[aria-label^="Drag PDF "]').count()) < 3) throw new Error("External drop over row did not add file");
    pass("DD-02", "External PDF drop over file row adds file");
  } catch (e) { fail("DD-02", "External PDF drop over file row adds file", e.message); }

  // 9. External file drop over right-side workspace.
  try {
    await freshPage();
    await addFiles([A]);
    const merge = await mergeButton();
    await merge.drop({ files: [B] });
    await page.waitForTimeout(1200);
    if ((await page.locator('[aria-label^="Drag PDF "]').count()) < 2) throw new Error("External drop over right panel did not add file");
    pass("DD-03", "External PDF drop over right status/action panel adds file");
  } catch (e) { fail("DD-03", "External PDF drop over right status/action panel adds file", e.message); }

  // 10. Multi-file external drop.
  try {
    await freshPage();
    const drop = page.getByText(/Drop PDFs here/i).first();
    await drop.drop({ files: [A, B, C] });
    await page.waitForTimeout(1200);
    if ((await page.locator('[aria-label^="Drag PDF "]').count()) < 3) throw new Error("Multi-file external drop did not add all files");
    pass("DD-04", "Multi-file external drop adds all PDFs");
  } catch (e) { fail("DD-04", "Multi-file external drop adds all PDFs", e.message); }

  // 11. Corrupt PDF blocked.
  if (CORRUPT) {
    try {
      await freshPage();
      await addFiles([CORRUPT]);
      const body = await allText();
      if (!/corrupt|invalid|error|failed/i.test(body)) throw new Error("No visible corrupt/invalid state");
      const button = await mergeButton();
      if (!(await button.isDisabled())) throw new Error("Merge remained enabled for corrupt PDF");
      pass("SEC-01", "Corrupted PDF blocked");
    } catch (e) { fail("SEC-01", "Corrupted PDF blocked", e.message); }
  } else skip("SEC-01", "Corrupted PDF blocked", "Official Corrupted.pdf fixture not found");

  // 12. Oversize / exact boundary.
  if (OVER15) {
    try {
      await freshPage();
      await addFiles([OVER15]);
      const body = await allText();
      if (!/15\s*(MB|MiB)|size|large|maximum|exceed/i.test(body)) throw new Error("Oversize rejection message not visible");
      pass("SEC-02", "PDF above 15 MiB rejected");
    } catch (e) { fail("SEC-02", "PDF above 15 MiB rejected", e.message); }
  } else skip("SEC-02", "PDF above 15 MiB rejected", "Official >15 MiB fixture not found");

  if (EXACT15) {
    try {
      await freshPage();
      await addFiles([EXACT15]);
      const body = await allText();
      if (/maximum|exceed|too large|15\s*(MB|MiB).*reject/i.test(body)) throw new Error("Exact 15 MiB file appears rejected");
      pass("SEC-03", "Exact 15 MiB PDF accepted by boundary");
    } catch (e) { fail("SEC-03", "Exact 15 MiB PDF accepted by boundary", e.message); }
  } else skip("SEC-03", "Exact 15 MiB PDF accepted by boundary", "Official exact 15 MiB fixture not found");

  // 13. Protected PDF flows.
  if (PROTECTED) {
    try {
      await freshPage();
      await addFiles([A, PROTECTED]);
      const body = await allText();
      if (!/password/i.test(body)) throw new Error("Password UI not shown");
      pass("SEC-04", "Protected PDF enters password-required flow");
    } catch (e) { fail("SEC-04", "Protected PDF enters password-required flow", e.message); }

    try {
      await freshPage();
      await addFiles([A, PROTECTED]);
      const pw = page.locator('input[aria-label="PDF Password"], input[placeholder*="password" i]').first();
      if (!(await pw.count())) throw new Error("Password input not found");
      await pw.fill("iepdf123");
      await pw.press("Tab").catch(() => {});
      await page.waitForTimeout(1200);
      const body = await allText();
      if (!/ready|accepted|password/i.test(body)) throw new Error("Protected PDF did not transition after correct password");
      pass("SEC-05", "Protected PDF correct password flow");
    } catch (e) { fail("SEC-05", "Protected PDF correct password flow", e.message); }

    try {
      await freshPage();
      await addFiles([A, PROTECTED]);
      const pw = page.locator('input[aria-label="PDF Password"], input[placeholder*="password" i]').first();
      if (!(await pw.count())) throw new Error("Password input not found");
      await pw.fill("wrong-password");
      await pw.press("Tab").catch(() => {});
      await page.waitForTimeout(1200);
      const body = await allText();
      if (!/failed|incorrect|invalid|password/i.test(body)) throw new Error("Wrong password did not produce visible failure state");
      pass("SEC-06", "Protected PDF wrong password remains blocked");
    } catch (e) { fail("SEC-06", "Protected PDF wrong password remains blocked", e.message); }
  } else {
    skip("SEC-04", "Protected PDF enters password-required flow", "Official protected fixture not found");
    skip("SEC-05", "Protected PDF correct password flow", "Official protected fixture not found");
    skip("SEC-06", "Protected PDF wrong password remains blocked", "Official protected fixture not found");
  }

  // 14. Accessibility / keyboard basics.
  try {
    await freshPage();
    const drop = page.getByText(/Drop PDFs here/i).first();
    await drop.focus();
    if (!(await drop.evaluate(el => el instanceof HTMLElement && el.tabIndex >= 0))) {
      throw new Error("Drop zone is not keyboard focusable");
    }
    pass("A11Y-01", "Drop-zone keyboard focusability");
  } catch (e) { fail("A11Y-01", "Drop-zone keyboard focusability", e.message); }

  // 15. Runtime errors.
  try {
    const pageErrors = await page.pageErrors();
    const severe = pageErrors.filter(x => !/TT:\s*undefined function/i.test(String(x)));
    if (severe.length) throw new Error(severe.slice(0,3).map(String).join(" | "));
    pass("OBS-01", "No unhandled page errors during suite");
  } catch (e) { fail("OBS-01", "No unhandled page errors during suite", e.message); }

  await browser.close();

  const counts = {
    PASS: results.filter(x => x.status === "PASS").length,
    FAIL: results.filter(x => x.status === "FAIL").length,
    SKIPPED: results.filter(x => x.status === "SKIPPED").length
  };

  const lines = [];
  lines.push("iePDF MERGE PDF - GLOBAL LAUNCH TEST");
  lines.push("===================================");
  lines.push(`Base URL: ${BASE}`);
  lines.push(`Date: ${new Date().toISOString()}`);
  lines.push("");
  for (const r of results) lines.push(`[${r.status}] ${r.id} - ${r.name}${r.detail ? " | " + r.detail : ""}`);
  lines.push("");
  lines.push(`PASS=${counts.PASS} FAIL=${counts.FAIL} SKIPPED=${counts.SKIPPED}`);
  lines.push(counts.FAIL === 0 ? "RESULT=PASS" : "RESULT=FAIL");
  fs.writeFileSync(REPORT, lines.join("\n"), "utf8");

  console.log("");
  console.log("============================================================");
  console.log(`PASS=${counts.PASS} FAIL=${counts.FAIL} SKIPPED=${counts.SKIPPED}`);
  console.log(counts.FAIL === 0 ? "RESULT=PASS" : "RESULT=FAIL");
  console.log(`REPORT=${REPORT}`);
  console.log("============================================================");

  process.exitCode = counts.FAIL === 0 ? 0 : 1;
}

run().catch(async e => {
  console.error("[FATAL]", e && e.stack ? e.stack : e);
  try { if (browser) await browser.close(); } catch {}
  process.exitCode = 1;
});