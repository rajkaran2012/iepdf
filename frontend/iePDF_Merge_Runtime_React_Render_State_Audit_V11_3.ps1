$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$Component = Join-Path $Root "components\MergeWorkspace.tsx"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $Root "_ui-backups\V11.3-RENDER-STATE-$Stamp"
$Report = Join-Path $RegDir "merge-v11.3-runtime-render-state-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-v11.3-runtime-render-runner-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$Backup = Join-Path $BackupDir "MergeWorkspace.tsx"
Copy-Item -LiteralPath $Component -Destination $Backup -Force

$Restored = $false

function Restore-Source {
    if (-not $Restored) {
        Copy-Item -LiteralPath $Backup -Destination $Component -Force
        $Restored = $true
        Write-Host ""
        Write-Host "Original MergeWorkspace.tsx restored."
    }
}

try {
    Write-Host "============================================================"
    Write-Host "iePDF MERGE PDF - V11.3 RUNTIME REACT RENDER-STATE AUDIT"
    Write-Host "============================================================"
    Write-Host "Started: $(Get-Date)"
    Write-Host "Root: $Root"
    Write-Host ""
    Write-Host "TEMPORARY INSTRUMENTATION ONLY"
    Write-Host "Automatic restoration enabled"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"

    $Text = [System.IO.File]::ReadAllText($Component)

    # Confirm exact current component signature.
    $Marker = "}: Props) {"
    $Pos = $Text.IndexOf($Marker, [System.StringComparison]::Ordinal)

    if ($Pos -lt 0) {
        throw "V11.3 marker not found: }: Props) {"
    }

    $InsertPos = $Pos + $Marker.Length

    # IMPORTANT:
    # This instrumentation does not modify files.map(), canMerge, or JSX.
    $Instrumentation = @'

  console.log("IEPDF_V11_3_RENDER|COMPONENT_ENTER", {
    filesIsArray: Array.isArray(files),
    filesLength: Array.isArray(files) ? files.length : null,
    fileSummary: Array.isArray(files)
      ? files.map((f: any, i: number) => ({
          index: i,
          id: f?.id ?? null,
          name: f?.file?.name ?? f?.name ?? null,
          status: f?.status ?? null,
          skipped: f?.skipped ?? null,
        }))
      : null,
  });

  console.log("IEPDF_V11_3_RENDER|CAN_MERGE_INPUT", {
    filesLength: Array.isArray(files) ? files.length : null,
    activeFilesLength: Array.isArray(files)
      ? files.filter((f: any) => !f?.skipped).length
      : null,
  });

'@

    $Text = $Text.Insert($InsertPos, $Instrumentation)

    [System.IO.File]::WriteAllText(
        $Component,
        $Text,
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host ""
    Write-Host "V11.3 instrumentation applied."
    Write-Host "Existing render logic was NOT modified."

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
    # Browser test
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

    if (text.includes("IEPDF_V11_3_RENDER")) {
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

  await input.setInputFiles(fixture);

  add("SET_INPUT_FILE", fixture);

  for (const ms of [100, 250, 500, 1000, 2000, 4000, 8000]) {
    await page.waitForTimeout(ms);

    const state = await page.evaluate(() => {
      const body = document.body?.innerText || "";

      const visibleButtons = [...document.querySelectorAll("button")]
        .filter(b =>
          !!(b.offsetWidth || b.offsetHeight || b.getClientRects().length)
        );

      const removeButtons = visibleButtons.filter(b =>
        /remove/i.test((b.innerText || "").trim())
      );

      const mergeButtons = visibleButtons.filter(b =>
        /Unlock\s*&\s*Merge/i.test((b.innerText || "").trim())
      );

      const bodyPdfNames = [...document.querySelectorAll("body *")]
        .map(el => (el.textContent || "").trim())
        .filter(t => /\.pdf$/i.test(t))
        .slice(0, 20);

      return {
        files0: body.includes("Files 0"),
        total0: body.includes("Total 0"),
        ready0: body.includes("Ready 0"),
        files1: body.includes("Files 1"),
        total1: body.includes("Total 1"),
        ready1: body.includes("Ready 1"),
        addPdfFiles: body.includes("Add PDF Files"),
        removeButtons: removeButtons.length,
        mergeButtons: mergeButtons.map(b => ({
          text: (b.innerText || "").trim(),
          disabled: b.disabled
        })),
        pdfNames: bodyPdfNames
      };
    });

    add(`STATE_${ms}MS`, JSON.stringify(state));
  }

  const finalState = await page.evaluate(() => {
    const body = document.body?.innerText || "";

    return {
      bodyText: body.slice(0, 14000),
      removeButtons: [...document.querySelectorAll("button")]
        .filter(b => /remove/i.test((b.innerText || "").trim())).length,
      draggableElements:
        document.querySelectorAll("[draggable='true']").length,
      mergeButtons: [...document.querySelectorAll("button")]
        .filter(b => /Unlock\s*&\s*Merge/i.test((b.innerText || "").trim()))
        .map(b => ({
          text: (b.innerText || "").trim(),
          disabled: b.disabled
        }))
    };
  });

  add("FINAL_STATE", JSON.stringify(finalState));
  add("PAGE_ERRORS_COUNT", String(errors.length));
  add("FAILED_REQUESTS_COUNT", String(failed.length));

  const output = [
    "iePDF MERGE PDF - V11.3 RUNTIME REACT RENDER-STATE AUDIT",
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
    "V11.3_RUNNER_FATAL",
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
    Write-Host "V11.3 ERROR:"
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
            "V11.3 did not reach browser test.`r`n",
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
    Write-Host "V11.3 COMPLETE"
    Write-Host "Report: $Report"
    Write-Host "Backup: $BackupDir"
    Write-Host "Original source restored automatically."
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"
    Write-Host "============================================================"
}
