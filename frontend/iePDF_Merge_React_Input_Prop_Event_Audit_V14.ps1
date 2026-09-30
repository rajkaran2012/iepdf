$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $RegDir "merge-v14-react-input-prop-audit-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-v14-react-input-prop-audit-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null

try {
    Write-Host "============================================================"
    Write-Host "iePDF MERGE PDF - V14 REACT INPUT PROP / EVENT AUDIT"
    Write-Host "============================================================"
    Write-Host "Started: $(Get-Date)"
    Write-Host "Root: $Root"
    Write-Host ""
    Write-Host "READ-ONLY SOURCE + BROWSER DIAGNOSTIC"
    Write-Host "NO SOURCE MODIFICATION"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"

    # ------------------------------------------------------------
    # READ-ONLY SOURCE AUDIT
    # ------------------------------------------------------------

    $Page = Join-Path $Root "app\merge-pdf\page.tsx"

    if (-not (Test-Path -LiteralPath $Page)) {
        throw "Current app/merge-pdf/page.tsx not found"
    }

    $Source = [System.IO.File]::ReadAllText($Page)

    Write-Host ""
    Write-Host "=== CURRENT SOURCE EVIDENCE ==="
    Write-Host "page.tsx size: $($Source.Length)"

    $checks = @(
        "const handleFileChange",
        "processSelectedFiles",
        'type="file"',
        'onChange={handleFileChange}',
        'ref={fileInputRef}',
        'setWorkspaceFiles',
        '<MergeWorkspace',
        'files={workspaceFiles}'
    )

    foreach ($check in $checks) {
        if ($Source.Contains($check)) {
            Write-Host "SOURCE PASS: $check"
        }
        else {
            Write-Host "SOURCE MISS: $check"
        }
    }

    # ------------------------------------------------------------
    # Browser runner
    # ------------------------------------------------------------

    Write-Host ""
    Write-Host "=== BROWSER RUNTIME ==="

    $RunnerText = @'
const { chromium } = require("playwright");
const fs = require("fs");

const fixture = "C:\\IEPDF\\frontend\\_regression\\merge-pdf\\A-2-pages.pdf";
const report = process.argv[2];

(async () => {
  const logs = [];
  const errors = [];
  const failed = [];

  function add(type, text) {
    const line = `${type} ${text}`;
    logs.push(line);
    console.log(line);
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const page = await browser.newPage();

  page.on("console", msg => {
    const text = msg.text();

    if (
      text.includes("IEPDF_V14") ||
      text.includes("IEPDF_V13_1")
    ) {
      add("APP", text);
    }
  });

  page.on("pageerror", err => {
    const text = String(err && (err.stack || err.message || err));
    errors.push(text);
    add("PAGE_ERROR", text);
  });

  page.on("requestfailed", req => {
    const text =
      `${req.method()} ${req.url()} :: ` +
      `${req.failure()?.errorText || "unknown"}`;

    failed.push(text);
    add("REQUEST_FAILED", text);
  });

  await page.goto("http://localhost:3000/merge-pdf?v14=${Date.now()}", {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  add("ROUTE_TITLE", await page.title());
  add("ROUTE_URL", page.url());

  const input = page.locator('input[type="file"]').first();

  add("FILE_INPUT_COUNT", String(await page.locator('input[type="file"]').count()));

  // ------------------------------------------------------------
  // Inspect the actual React DOM props attached to the live input.
  // React 18/19 stores event props on an internal property whose
  // name starts with __reactProps$. We only READ it.
  // ------------------------------------------------------------

  const reactInfoBefore = await input.evaluate(el => {
    const keys = Object.keys(el);
    const reactPropKey = keys.find(k => k.startsWith("__reactProps$"));

    let props = null;

    if (reactPropKey) {
      props = el[reactPropKey];
    }

    return {
      reactPropKeyFound: !!reactPropKey,
      propKeys: props ? Object.keys(props) : [],
      hasOnChange: !!(props && typeof props.onChange === "function"),
      hasOnInput: !!(props && typeof props.onInput === "function"),
      hasRef: !!(props && props.ref),
      type: el.getAttribute("type"),
      accept: el.getAttribute("accept"),
      multiple: el.hasAttribute("multiple"),
      hidden: el.classList.contains("hidden")
    };
  });

  add("REACT_INPUT_PROPS_BEFORE", JSON.stringify(reactInfoBefore));

  // Native listener is installed independently.
  await input.evaluate(el => {
    el.addEventListener("change", event => {
      const target = event.target;

      console.log("IEPDF_V14_NATIVE|CHANGE", JSON.stringify({
        filesLength: target?.files?.length ?? null,
        files: target?.files
          ? [...target.files].map(f => ({
              name: f.name,
              size: f.size,
              type: f.type
            }))
          : []
      }));
    }, true);
  });

  add("NATIVE_LISTENER_ATTACHED", "true");

  await input.setInputFiles(fixture);

  add("SET_INPUT_FILE", fixture);

  await page.waitForTimeout(500);

  // Inspect React props after setInputFiles.
  const reactInfoAfter = await input.evaluate(el => {
    const keys = Object.keys(el);
    const reactPropKey = keys.find(k => k.startsWith("__reactProps$"));
    const props = reactPropKey ? el[reactPropKey] : null;

    return {
      reactPropKeyFound: !!reactPropKey,
      propKeys: props ? Object.keys(props) : [],
      hasOnChange: !!(props && typeof props.onChange === "function"),
      onChangeType: props ? typeof props.onChange : null,
      filesLength: el.files ? el.files.length : null,
      files: el.files
        ? [...el.files].map(f => ({
            name: f.name,
            size: f.size,
            type: f.type
          }))
        : []
    };
  });

  add("REACT_INPUT_PROPS_AFTER", JSON.stringify(reactInfoAfter));

  // ------------------------------------------------------------
  // Dispatch a normal bubbling change event AFTER the real
  // Playwright file selection. This does not call React internals.
  // It tests the browser -> React delegated event path.
  // ------------------------------------------------------------

  const dispatchResult = await input.evaluate(el => {
    const event = new Event("change", {
      bubbles: true,
      cancelable: false
    });

    const dispatched = el.dispatchEvent(event);

    return {
      dispatched,
      filesLength: el.files ? el.files.length : null
    };
  });

  add("MANUAL_BUBBLING_CHANGE_DISPATCH", JSON.stringify(dispatchResult));

  for (const ms of [100, 250, 500, 1000, 2000, 4000]) {
    await page.waitForTimeout(ms);

    const state = await page.evaluate(() => {
      const body = document.body?.innerText || "";

      return {
        files0: body.includes("Files 0"),
        files1: body.includes("Files 1"),
        total0: body.includes("Total 0"),
        total1: body.includes("Total 1"),
        ready0: body.includes("Ready 0"),
        ready1: body.includes("Ready 1"),
        inputFilesLength:
          document.querySelector('input[type="file"]')?.files?.length ?? null,
        removeButtons: [...document.querySelectorAll("button")]
          .filter(b => /remove/i.test((b.innerText || "").trim())).length,
        mergeButtons: [...document.querySelectorAll("button")]
          .filter(b => /Unlock\s*&\s*Merge/i.test((b.innerText || "").trim()))
          .map(b => ({
            text: (b.innerText || "").trim(),
            disabled: b.disabled
          }))
      };
    });

    add(`STATE_${ms}MS`, JSON.stringify(state));
  }

  const final = await page.evaluate(() => ({
    bodyText: (document.body?.innerText || "").slice(0, 14000),
    inputFilesLength:
      document.querySelector('input[type="file"]')?.files?.length ?? null,
    pageTextHasPdf:
      (document.body?.innerText || "").includes("A-2-pages.pdf"),
    removeButtons: [...document.querySelectorAll("button")]
      .filter(b => /remove/i.test((b.innerText || "").trim())).length
  }));

  add("FINAL", JSON.stringify(final));
  add("PAGE_ERRORS_COUNT", String(errors.length));
  add("FAILED_REQUESTS_COUNT", String(failed.length));

  const output = [
    "iePDF MERGE PDF - V14 REACT INPUT PROP / EVENT AUDIT",
    `Finished: ${new Date().toISOString()}`,
    "",
    "=== LOGS ===",
    ...logs,
    "",
    "=== PAGE ERRORS ===",
    ...errors,
    "",
    "=== FAILED REQUESTS ===",
    ...failed
  ].join("\n");

  fs.writeFileSync(report, output, "utf8");

  await browser.close();
})().catch(err => {
  console.error(
    "V14_RUNNER_FATAL",
    err && (err.stack || err.message || err)
  );
  process.exitCode = 1;
});
'@

    [System.IO.File]::WriteAllText(
        $Runner,
        $RunnerText,
        [System.Text.UTF8Encoding]::new($false)
    )

    Push-Location $Root
    & node $Runner $Report
    $RunnerExit = $LASTEXITCODE
    Pop-Location

    if ($RunnerExit -ne 0) {
        throw "Browser runtime test failed with exit code $RunnerExit"
    }

    Write-Host "Browser runtime test PASS"
}
catch {
    Write-Host ""
    Write-Host "V14 ERROR:"
    Write-Host $_.Exception.Message
}
finally {
    if (Test-Path -LiteralPath $Runner) {
        Remove-Item -LiteralPath $Runner -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "V14 COMPLETE"
    Write-Host "Report: $Report"
    Write-Host "NO SOURCE CHANGES"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"
    Write-Host "============================================================"
}
