$ErrorActionPreference = "Stop"

# iePDF Merge PDF - Global Browser Diagnostic V4.1
# Diagnostic only. NO source changes. NO deployment.
# Purpose: identify exactly where the single-file add flow stops.

$ProjectRoot = "C:\IEPDF\frontend"
$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$BaseUrl = "http://127.0.0.1:3000"
$Fixture = Join-Path $ProjectRoot "_regression\merge-pdf\A-2-pages.pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ReportDir = Join-Path $ProjectRoot "_regression\merge-pdf"
$Runner = Join-Path $ReportDir "merge-global-diagnostic-v4.1-runner-$Stamp.cjs"
$Report = Join-Path $ReportDir "merge-global-diagnostic-v4.1-$Stamp.txt"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

if (-not (Test-Path $ProjectRoot)) { throw "Project root not found: $ProjectRoot" }
if (-not (Test-Path $ChromePath)) { throw "Chrome not found: $ChromePath" }
if (-not (Test-Path $Fixture)) { throw "Fixture not found: $Fixture" }

$runner = @'
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = process.env.IEPDF_BASE_URL;
const CHROME = process.env.IEPDF_CHROME_PATH;
const FIXTURE = process.env.IEPDF_FIXTURE;
const REPORT = process.env.IEPDF_REPORT;

const out = [];
const consoleMessages = [];
const pageErrors = [];
const requests = [];
const responses = [];

function log(title, value) {
  const line = `${title}: ${value}`;
  out.push(line);
  console.log(line);
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: CHROME,
      args: ["--disable-gpu"]
    });

    const context = await browser.newContext({acceptDownloads:true});
    const page = await context.newPage();

    page.on("console", msg => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
      console.log("BROWSER CONSOLE:", text);
    });

    page.on("pageerror", err => {
      const text = String(err);
      pageErrors.push(text);
      console.log("PAGE ERROR:", text);
    });

    page.on("request", req => {
      const u = req.url();
      if (u.includes("/api/") || u.includes("merge")) {
        requests.push(`${req.method()} ${u}`);
      }
    });

    page.on("response", res => {
      const u = res.url();
      if (u.includes("/api/") || u.includes("merge")) {
        responses.push(`${res.status()} ${u}`);
      }
    });

    await page.goto(`${BASE}/merge-pdf`, {waitUntil:"domcontentloaded"});
    await page.waitForTimeout(1000);

    log("01 URL", await page.url());
    log("02 Title", await page.title());

    const input = page.locator('input[type="file"]').first();
    log("03 File input count", await page.locator('input[type="file"]').count());

    if (await input.count()) {
      log("04 File input multiple", String(await input.getAttribute("multiple")));
      log("05 File input accept", String(await input.getAttribute("accept")));
      log("06 File input class", String(await input.getAttribute("class")));
    }

    const addButton = page.getByRole("button", {name:/Add PDF Files/i}).first();
    log("07 Add PDF Files button count", String(await page.getByRole("button", {name:/Add PDF Files/i}).count()));
    if (await addButton.count()) {
      log("08 Add PDF Files visible", String(await addButton.isVisible()));
      log("09 Add PDF Files enabled", String(await addButton.isEnabled()));
    }

    const beforeInputFiles = await input.evaluate(el => ({
      count: el.files ? el.files.length : -1,
      names: el.files ? Array.from(el.files).map(f => f.name) : []
    }));
    log("10 Input files BEFORE", JSON.stringify(beforeInputFiles));

    log("11 Fixture", FIXTURE);
    log("12 Fixture exists", String(fs.existsSync(FIXTURE)));

    // Directly populate the REAL hidden input. This invokes the application's
    // actual React onChange -> handleFileChange -> processSelectedFiles path.
    await input.setInputFiles(FIXTURE);

    log("13 setInputFiles returned", "YES");

    const afterInputFiles = await input.evaluate(el => ({
      count: el.files ? el.files.length : -1,
      names: el.files ? Array.from(el.files).map(f => f.name) : []
    }));
    log("14 Input files IMMEDIATELY AFTER", JSON.stringify(afterInputFiles));

    // Observe the application at several intervals so async validation/workspace
    // processing is visible rather than guessing a fixed delay.
    for (const ms of [250, 500, 1000, 2000, 4000, 7000]) {
      await page.waitForTimeout(ms);

      const state = await page.evaluate(() => {
        const body = document.body.innerText || "";
        const buttons = Array.from(document.querySelectorAll("button")).map(b => ({
          text: (b.innerText || "").trim(),
          disabled: !!b.disabled,
          aria: b.getAttribute("aria-label"),
          title: b.getAttribute("title")
        })).filter(x => x.text || x.aria || x.title);

        const inputs = Array.from(document.querySelectorAll("input")).map(i => ({
          type: i.type,
          value: i.value,
          files: i.files ? Array.from(i.files).map(f => f.name) : []
        }));

        return {
          bodyTail: body.slice(-3500),
          buttons,
          inputs
        };
      });

      log(`15 State after additional ${ms}ms`, JSON.stringify(state));
    }

    const removeCount = await page.getByRole("button", {name:/Remove PDF/i}).count();
    const dragCount = await page.locator('[aria-label^="Drag PDF "]').count();

    const mergeButtons = page.getByRole("button", {name:/Unlock\s*&\s*Merge/i});
    let mergeInfo = [];
    for (let i = 0; i < await mergeButtons.count(); i++) {
      mergeInfo.push({
        text: await mergeButtons.nth(i).innerText(),
        disabled: await mergeButtons.nth(i).isDisabled().catch(()=>null)
      });
    }

    log("16 Final Remove PDF count", String(removeCount));
    log("17 Final reorder handle count", String(dragCount));
    log("18 Final Merge buttons", JSON.stringify(mergeInfo));
    log("19 Console messages", JSON.stringify(consoleMessages));
    log("20 Page errors", JSON.stringify(pageErrors));
    log("21 Relevant requests", JSON.stringify(requests));
    log("22 Relevant responses", JSON.stringify(responses));

    await browser.close();

    fs.writeFileSync(REPORT, out.join("\n"), "utf8");
    console.log("");
    console.log("DIAGNOSTIC COMPLETE");
    console.log(`Report: ${REPORT}`);
    process.exit(0);
  } catch (e) {
    console.error("[FATAL]", e && e.stack ? e.stack : String(e));
    try { if (browser) await browser.close(); } catch {}
    try { fs.writeFileSync(REPORT, out.join("\n") + "\n[FATAL] " + String(e), "utf8"); } catch {}
    process.exit(3);
  }
})();
'@

[IO.File]::WriteAllText($Runner, $runner, $Utf8NoBom)

$env:IEPDF_BASE_URL = $BaseUrl
$env:IEPDF_CHROME_PATH = $ChromePath
$env:IEPDF_FIXTURE = $Fixture
$env:IEPDF_REPORT = $Report

try {
    Write-Host ""
    Write-Host "============================================================"
    Write-Host " iePDF MERGE PDF - GLOBAL DIAGNOSTIC V4.1"
    Write-Host " One-file Add Flow / Current Source"
    Write-Host "============================================================"
    Write-Host ""
    & pnpm exec node $Runner
    $exitCode = $LASTEXITCODE
} finally {
    Remove-Item Env:IEPDF_BASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_CHROME_PATH -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_FIXTURE -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_REPORT -ErrorAction SilentlyContinue
    Remove-Item $Runner -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Report: $Report"
Write-Host "NO SOURCE CHANGES. NO LIVE DEPLOYMENT."
exit $exitCode
