$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$Page = Join-Path $Root "app\merge-pdf\page.tsx"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $Root "_ui-backups\V12-PARENT-HANDOFF-$Stamp"
$Report = Join-Path $RegDir "merge-v12-parent-state-handoff-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-v12-parent-state-handoff-runner-$Stamp.cjs"

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
    Write-Host "iePDF MERGE PDF - V12 PARENT STATE -> PROP HANDOFF AUDIT"
    Write-Host "============================================================"
    Write-Host "Started: $(Get-Date)"
    Write-Host "Root: $Root"
    Write-Host ""
    Write-Host "TEMPORARY INSTRUMENTATION ONLY"
    Write-Host "Automatic restoration enabled"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"

    $Text = [System.IO.File]::ReadAllText($Page)

    # ------------------------------------------------------------
    # Locate processSelectedFiles
    # ------------------------------------------------------------

    $ProcessMarker = "const processSelectedFiles"
    $ProcessPos = $Text.IndexOf($ProcessMarker, [System.StringComparison]::Ordinal)

    if ($ProcessPos -lt 0) {
        throw "V12 marker not found: const processSelectedFiles"
    }

    # Insert a diagnostic log immediately after the process function opens.
    $ProcessOpen = $Text.IndexOf("{", $ProcessPos, [System.StringComparison]::Ordinal)

    if ($ProcessOpen -lt 0) {
        throw "V12 could not locate processSelectedFiles opening brace"
    }

    $ProcessInstrumentation = @'

    console.log("IEPDF_V12_PAGE|PROCESS_ENTER", {
      incomingFileCount: Array.isArray(files) ? files.length : null,
      incomingFiles: Array.isArray(files)
        ? files.map((f: File, i: number) => ({
            index: i,
            name: f?.name ?? null,
            size: f?.size ?? null,
            type: f?.type ?? null,
          }))
        : null,
    });

'@

    $Text = $Text.Insert($ProcessOpen + 1, $ProcessInstrumentation)

    # ------------------------------------------------------------
    # Locate analyzer.analyzeMany(files)
    # ------------------------------------------------------------

    $AnalyzerMarker = "analyzer.analyzeMany(files)"
    $AnalyzerPos = $Text.IndexOf($AnalyzerMarker, [System.StringComparison]::Ordinal)

    if ($AnalyzerPos -lt 0) {
        throw "V12 marker not found: analyzer.analyzeMany(files)"
    }

    $AnalyzerEnd = $AnalyzerPos + $AnalyzerMarker.Length

    $AnalyzerInstrumentation = @'

    console.log("IEPDF_V12_PAGE|ANALYZER_RETURN", {
      resultCount: Array.isArray(analysis) ? analysis.length : null,
      results: Array.isArray(analysis)
        ? analysis.map((r: any, i: number) => ({
            index: i,
            id: r?.id ?? null,
            name: r?.file?.name ?? r?.name ?? null,
            status: r?.status ?? null,
            skipped: r?.skipped ?? null,
            error: r?.error ?? null,
          }))
        : null,
    });

'@

    $Text = $Text.Insert($AnalyzerEnd, $AnalyzerInstrumentation)

    # ------------------------------------------------------------
    # Locate setWorkspaceFiles previous=> expression.
    # We observe the value being supplied without changing it.
    # ------------------------------------------------------------

    $SetterMarker = "setWorkspaceFiles((previous) => [...previous, ...workspace])"
    $SetterPos = $Text.IndexOf($SetterMarker, [System.StringComparison]::Ordinal)

    if ($SetterPos -lt 0) {
        throw "V12 marker not found: setWorkspaceFiles((previous) => [...previous, ...workspace])"
    }

    $SetterInstrumentation = @'

    console.log("IEPDF_V12_PAGE|SET_WORKSPACE_REQUEST", {
      workspaceCount: Array.isArray(workspace) ? workspace.length : null,
      workspace: Array.isArray(workspace)
        ? workspace.map((f: any, i: number) => ({
            index: i,
            id: f?.id ?? null,
            name: f?.file?.name ?? f?.name ?? null,
            status: f?.status ?? null,
            skipped: f?.skipped ?? null,
          }))
        : null,
    });

'@

    $Text = $Text.Insert($SetterPos, $SetterInstrumentation)

    # ------------------------------------------------------------
    # Locate the MergeWorkspace JSX handoff.
    # ------------------------------------------------------------

    $HandoffMarker = "<MergeWorkspace"
    $HandoffPos = $Text.IndexOf($HandoffMarker, [System.StringComparison]::Ordinal)

    if ($HandoffPos -lt 0) {
        throw "V12 marker not found: <MergeWorkspace"
    }

    # Log workspaceFiles immediately before the JSX return section.
    # Find the nearest preceding "return (" so instrumentation is valid
    # and doesn't alter the JSX expression.
    $ReturnPos = $Text.LastIndexOf("return (", $HandoffPos, [System.StringComparison]::Ordinal)

    if ($ReturnPos -lt 0) {
        throw "V12 could not locate return ( before MergeWorkspace"
    }

    $ReturnInstrumentation = @'

    console.log("IEPDF_V12_PAGE|BEFORE_RENDER", {
      workspaceFilesLength: Array.isArray(workspaceFiles) ? workspaceFiles.length : null,
      workspaceFiles: Array.isArray(workspaceFiles)
        ? workspaceFiles.map((f: any, i: number) => ({
            index: i,
            id: f?.id ?? null,
            name: f?.file?.name ?? f?.name ?? null,
            status: f?.status ?? null,
            skipped: f?.skipped ?? null,
          }))
        : null,
    });

'@

    $Text = $Text.Insert($ReturnPos, $ReturnInstrumentation)

    # ------------------------------------------------------------
    # Write temporary source
    # ------------------------------------------------------------

    [System.IO.File]::WriteAllText(
        $Page,
        $Text,
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host ""
    Write-Host "V12 temporary instrumentation applied."
    Write-Host "No MergeWorkspace source was modified."
    Write-Host "No files.map() expression was modified."

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

    if (text.includes("IEPDF_V12_PAGE")) {
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

      const mergeButtons = [...document.querySelectorAll("button")]
        .filter(b => /Unlock\s*&\s*Merge/i.test((b.innerText || "").trim()))
        .map(b => ({
          text: (b.innerText || "").trim(),
          disabled: b.disabled
        }));

      const removeButtons = [...document.querySelectorAll("button")]
        .filter(b => /remove/i.test((b.innerText || "").trim()))
        .length;

      return {
        files0: body.includes("Files 0"),
        files1: body.includes("Files 1"),
        total0: body.includes("Total 0"),
        total1: body.includes("Total 1"),
        ready0: body.includes("Ready 0"),
        ready1: body.includes("Ready 1"),
        removeButtons,
        mergeButtons
      };
    });

    add(`STATE_${ms}MS`, JSON.stringify(state));
  }

  const finalState = await page.evaluate(() => ({
    bodyText: (document.body?.innerText || "").slice(0, 14000),
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
    "iePDF MERGE PDF - V12 PARENT STATE -> PROP HANDOFF AUDIT",
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
    "V12_RUNNER_FATAL",
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
    Write-Host "V12 ERROR:"
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
            "V12 did not reach browser test.`r`n",
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
    Write-Host "V12 COMPLETE"
    Write-Host "Report: $Report"
    Write-Host "Backup: $BackupDir"
    Write-Host "Original source restored automatically."
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"
    Write-Host "============================================================"
}
