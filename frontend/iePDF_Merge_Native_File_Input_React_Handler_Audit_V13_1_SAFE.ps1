$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$Page = Join-Path $Root "app\merge-pdf\page.tsx"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $Root "_ui-backups\V13.1-SAFE-$Stamp"
$Report = Join-Path $RegDir "merge-v13.1-safe-native-handler-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-v13.1-safe-native-handler-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$Backup = Join-Path $BackupDir "page.tsx"
Copy-Item -LiteralPath $Page -Destination $Backup -Force
$Restored = $false

function Restore-Source {
    if (-not $Restored) {
        Copy-Item -LiteralPath $Backup -Destination $Page -Force
        $Restored = $true
        Write-Host ""
        Write-Host "Original app/merge-pdf/page.tsx restored."
    }
}

try {
    Write-Host "============================================================"
    Write-Host "iePDF MERGE PDF - V13.1 SAFE NATIVE CHANGE -> REACT AUDIT"
    Write-Host "============================================================"
    Write-Host "Started: $(Get-Date)"
    Write-Host "Root: $Root"
    Write-Host ""
    Write-Host "TEMPORARY INSTRUMENTATION ONLY"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"

    $Text = [System.IO.File]::ReadAllText($Page)

    # Locate the actual handler declaration without parsing JavaScript.
    $Marker = "const handleFileChange"
    $HandlerPos = $Text.IndexOf($Marker, [System.StringComparison]::Ordinal)

    if ($HandlerPos -lt 0) {
        throw "V13.1 SAFE marker not found: const handleFileChange"
    }

    $OpenBrace = $Text.IndexOf("{", $HandlerPos, [System.StringComparison]::Ordinal)

    if ($OpenBrace -lt 0) {
        throw "V13.1 SAFE could not locate handleFileChange opening brace"
    }

    # Diagnostic source evidence only.
    $WindowLength = [Math]::Min(5000, $Text.Length - $HandlerPos)
    $HandlerWindow = $Text.Substring($HandlerPos, $WindowLength)
    $ProcessRefCount = ([regex]::Matches($HandlerWindow, "processSelectedFiles")).Count

    Write-Host ""
    Write-Host "handleFileChange found at source offset: $HandlerPos"
    Write-Host "processSelectedFiles references in handler window: $ProcessRefCount"

    # Insert ONLY after the opening brace.
    # No brace parser, no map replacement, no process-call replacement.
    $Instrumentation = @'

    console.log("IEPDF_V13_1_SAFE|REACT_HANDLER_ENTER", {
      eventFilesLength: event?.currentTarget?.files?.length ?? null,
      eventFiles: event?.currentTarget?.files
        ? Array.from(event.currentTarget.files).map((f: File, i: number) => ({
            index: i,
            name: f?.name ?? null,
            size: f?.size ?? null,
            type: f?.type ?? null,
          }))
        : null,
    });

'@

    $Text = $Text.Insert($OpenBrace + 1, $Instrumentation)

    [System.IO.File]::WriteAllText(
        $Page,
        $Text,
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host ""
    Write-Host "V13.1 SAFE temporary instrumentation applied."
    Write-Host "Only handleFileChange entry was instrumented."
    Write-Host "No files.map(), analyzer, state setter, or JSX was modified."

    # ------------------------------------------------------------
    # TypeScript
    # ------------------------------------------------------------

    Write-Host ""
    Write-Host "=== TYPESCRIPT ==="

    Push-Location $Root
    & pnpm exec tsc --noEmit
    $TscExit = $LASTEXITCODE
    Pop-Location

    if ($TscExit -ne 0) {
        throw "TypeScript failed with exit code $TscExit"
    }

    Write-Host "TypeScript PASS"

    # ------------------------------------------------------------
    # Browser runner
    # ------------------------------------------------------------

    Write-Host ""
    Write-Host "=== BROWSER RUNTIME TEST ==="

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
      text.includes("IEPDF_V13_1_SAFE") ||
      text.includes("IEPDF_V13_1_NATIVE")
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

  await page.goto("http://localhost:3000/merge-pdf", {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  add("ROUTE_TITLE", await page.title());
  add("ROUTE_URL", page.url());

  const input = page.locator('input[type="file"]').first();

  add(
    "FILE_INPUT_COUNT",
    String(await page.locator('input[type="file"]').count())
  );

  // Capture the browser-native change event independently of React.
  await input.evaluate(el => {
    el.addEventListener("change", event => {
      const target = event.target;

      console.log("IEPDF_V13_1_NATIVE|CHANGE", JSON.stringify({
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

  for (const ms of [50, 100, 250, 500, 1000, 2000, 4000, 8000]) {
    await page.waitForTimeout(ms);

    const state = await page.evaluate(() => {
      const body = document.body?.innerText || "";
      const fileInput = document.querySelector('input[type="file"]');

      const mergeButtons = [...document.querySelectorAll("button")]
        .filter(b => /Unlock\s*&\s*Merge/i.test((b.innerText || "").trim()))
        .map(b => ({
          text: (b.innerText || "").trim(),
          disabled: b.disabled
        }));

      return {
        inputFilesLength: fileInput?.files?.length ?? null,
        inputFiles: fileInput?.files
          ? [...fileInput.files].map(f => ({
              name: f.name,
              size: f.size,
              type: f.type
            }))
          : [],
        files0: body.includes("Files 0"),
        files1: body.includes("Files 1"),
        total0: body.includes("Total 0"),
        total1: body.includes("Total 1"),
        ready0: body.includes("Ready 0"),
        ready1: body.includes("Ready 1"),
        removeButtons: [...document.querySelectorAll("button")]
          .filter(b => /remove/i.test((b.innerText || "").trim())).length,
        mergeButtons
      };
    });

    add(`STATE_${ms}MS`, JSON.stringify(state));
  }

  const finalState = await page.evaluate(() => ({
    bodyText: (document.body?.innerText || "").slice(0, 14000),
    inputFiles: (() => {
      const i = document.querySelector('input[type="file"]');
      return i?.files
        ? [...i.files].map(f => ({
            name: f.name,
            size: f.size,
            type: f.type
          }))
        : [];
    })(),
    removeButtons: [...document.querySelectorAll("button")]
      .filter(b => /remove/i.test((b.innerText || "").trim())).length,
    mergeButtons: [...document.querySelectorAll("button")]
      .filter(b => /Unlock\s*&\s*Merge/i.test((b.innerText || "").trim()))
      .map(b => ({
        text: (b.innerText || "").trim(),
        disabled: b.disabled
      }))
  }));

  add("FINAL_STATE", JSON.stringify(finalState));
  add("PAGE_ERRORS_COUNT", String(errors.length));
  add("FAILED_REQUESTS_COUNT", String(failed.length));

  const output = [
    "iePDF MERGE PDF - V13.1 SAFE NATIVE CHANGE -> REACT HANDLER AUDIT",
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
    "V13.1_SAFE_RUNNER_FATAL",
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
    Write-Host "V13.1 SAFE ERROR:"
    Write-Host $_.Exception.Message
}
finally {

    Restore-Source

    if (Test-Path -LiteralPath $Runner) {
        Remove-Item -LiteralPath $Runner -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "=== POST-RESTORE TYPESCRIPT ==="

    Push-Location $Root
    & pnpm exec tsc --noEmit
    $PostTsc = $LASTEXITCODE
    Pop-Location

    if ($PostTsc -eq 0) {
        Write-Host "Post-restore TypeScript PASS"
    }
    else {
        Write-Host "Post-restore TypeScript FAIL"
    }

    if (-not (Test-Path -LiteralPath $Report)) {
        [System.IO.File]::WriteAllText(
            $Report,
            "V13.1 SAFE did not reach browser test.`r`n",
            [System.Text.UTF8Encoding]::new($false)
        )
    }

    Add-Content -LiteralPath $Report -Value ""
    Add-Content -LiteralPath $Report -Value "SOURCE RESTORED: YES"
    Add-Content -LiteralPath $Report -Value "NO GIT"
    Add-Content -LiteralPath $Report -Value "NO DEPLOYMENT"
    Add-Content -LiteralPath $Report -Value "NO CACHE DELETION"

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "V13.1 SAFE COMPLETE"
    Write-Host "Report: $Report"
    Write-Host "Backup: $BackupDir"
    Write-Host "Original source restored automatically."
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"
    Write-Host "============================================================"
}
