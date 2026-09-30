$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$Page = Join-Path $Root "app\merge-pdf\page.tsx"
$Component = Join-Path $Root "components\MergeWorkspace.tsx"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $Root "_ui-backups\V11.2-RENDER-STATE-$Stamp"
$Report = Join-Path $RegDir "merge-v11.2-runtime-render-state-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-v11.2-runtime-render-runner-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$PageBackup = Join-Path $BackupDir "page.tsx"
$ComponentBackup = Join-Path $BackupDir "MergeWorkspace.tsx"

Copy-Item -LiteralPath $Page -Destination $PageBackup -Force
Copy-Item -LiteralPath $Component -Destination $ComponentBackup -Force

$Restored = $false

function Restore-All {
    if (-not $Restored) {
        Copy-Item -LiteralPath $PageBackup -Destination $Page -Force
        Copy-Item -LiteralPath $ComponentBackup -Destination $Component -Force
        $Restored = $true
        Write-Host ""
        Write-Host "Original source restored from V11.2 backup."
    }
}

try {
    Write-Host "============================================================"
    Write-Host "iePDF MERGE PDF - V11.2 RUNTIME REACT RENDER-STATE AUDIT"
    Write-Host "============================================================"
    Write-Host "Started: $(Get-Date)"
    Write-Host "Root: $Root"
    Write-Host ""
    Write-Host "TEMPORARY INSTRUMENTATION ONLY"
    Write-Host "Automatic source restoration enabled"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"

    $PageText = [System.IO.File]::ReadAllText($Page)
    $ComponentText = [System.IO.File]::ReadAllText($Component)

    # ------------------------------------------------------------
    # PAGE INSTRUMENTATION
    # ------------------------------------------------------------
    # Add a harmless useEffect immediately before the first existing
    # useEffect in the Merge page. It observes workspaceFiles without
    # changing the state or render logic.
    # ------------------------------------------------------------

    $PageMarker = "useEffect(() => {"
    $PagePos = $PageText.IndexOf($PageMarker, [System.StringComparison]::Ordinal)

    if ($PagePos -lt 0) {
        throw "V11.2 marker not found: first useEffect in Merge page"
    }

    $PageEffect = @'

  useEffect(() => {
    try {
      console.log("IEPDF_V11_2_PAGE|WORKSPACE_STATE", {
        length: Array.isArray(workspaceFiles) ? workspaceFiles.length : null,
        files: Array.isArray(workspaceFiles)
          ? workspaceFiles.map((f: any, i: number) => ({
              index: i,
              id: f?.id ?? null,
              name: f?.file?.name ?? f?.name ?? null,
              status: f?.status ?? null,
              skipped: f?.skipped ?? null,
            }))
          : null,
      });
    } catch (_) {
      console.log("IEPDF_V11_2_PAGE|WORKSPACE_STATE_ERROR");
    }
  }, [workspaceFiles]);

'@

    $PageText = $PageText.Insert($PagePos, $PageEffect)

    # ------------------------------------------------------------
    # COMPONENT INSTRUMENTATION
    # ------------------------------------------------------------
    # Insert after the function signature. Existing files.map()
    # expressions are NEVER modified.
    # ------------------------------------------------------------

    $ComponentMarker = "}: Props) {"
    $ComponentPos = $ComponentText.IndexOf($ComponentMarker, [System.StringComparison]::Ordinal)

    if ($ComponentPos -lt 0) {
        throw "V11.2 marker not found: }: Props) {"
    }

    $ComponentInsertPos = $ComponentPos + $ComponentMarker.Length

    $ComponentEffect = @'

  try {
    console.log("IEPDF_V11_2_COMPONENT|PROPS", {
      filesIsArray: Array.isArray(files),
      filesLength: Array.isArray(files) ? files.length : null,
      files: Array.isArray(files)
        ? files.map((f: any, i: number) => ({
            index: i,
            id: f?.id ?? null,
            name: f?.file?.name ?? f?.name ?? null,
            status: f?.status ?? null,
            skipped: f?.skipped ?? null,
          }))
        : null,
    });
  } catch (_) {
    console.log("IEPDF_V11_2_COMPONENT|PROPS_ERROR");
  }

'@

    $ComponentText = $ComponentText.Insert($ComponentInsertPos, $ComponentEffect)

    # ------------------------------------------------------------
    # WRITE TEMPORARY INSTRUMENTATION
    # ------------------------------------------------------------

    [System.IO.File]::WriteAllText(
        $Page,
        $PageText,
        [System.Text.UTF8Encoding]::new($false)
    )

    [System.IO.File]::WriteAllText(
        $Component,
        $ComponentText,
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host ""
    Write-Host "V11.2 temporary instrumentation applied."
    Write-Host "Existing files.map() expressions were NOT modified."

    # ------------------------------------------------------------
    # TYPESCRIPT
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
    # BROWSER RUNTIME
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

  function add(type, value) {
    const line = `${type} ${value}`;
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
      text.includes("IEPDF_V11_2_PAGE") ||
      text.includes("IEPDF_V11_2_COMPONENT")
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
    const text = `${req.method()} ${req.url()} :: ${req.failure()?.errorText || "unknown"}`;
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

  add("FILE_INPUT_COUNT", String(await page.locator('input[type="file"]').count()));

  await input.setInputFiles(fixture);

  add("SET_INPUT_FILE", fixture);

  const waits = [100, 250, 500, 1000, 2000, 4000, 8000];

  for (const ms of waits) {
    await page.waitForTimeout(ms);

    const state = await page.evaluate(() => {
      const body = document.body?.innerText || "";

      const visibleButtons = [...document.querySelectorAll("button")]
        .filter(b => !!(b.offsetWidth || b.offsetHeight || b.getClientRects().length));

      const removeButtons = visibleButtons
        .filter(b => /remove/i.test((b.innerText || "").trim()));

      const mergeButtons = visibleButtons
        .filter(b => /Unlock\s*&\s*Merge/i.test((b.innerText || "").trim()));

      const fileInputs = [...document.querySelectorAll('input[type="file"]')];

      return {
        bodyHasFiles0: body.includes("Files 0"),
        bodyHasTotal0: body.includes("Total 0"),
        bodyHasReady0: body.includes("Ready 0"),
        bodyHasAddPdfFiles: body.includes("Add PDF Files"),
        bodyHasUnlockMerge: body.includes("Unlock & Merge"),
        removeButtons: removeButtons.length,
        fileInputCount: fileInputs.length,
        fileInputFileCounts: fileInputs.map(i => i.files ? i.files.length : -1),
        draggableElements: document.querySelectorAll("[draggable='true']").length,
        mergeButtons: mergeButtons.map(b => ({
          text: (b.innerText || "").trim(),
          disabled: b.disabled
        })),
        pdfNames: [...document.querySelectorAll("body *")]
          .map(el => (el.textContent || "").trim())
          .filter(t => /\.pdf$/i.test(t))
          .slice(0, 20)
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
      mergeButtons: [...document.querySelectorAll("button")]
        .filter(b => /Unlock\s*&\s*Merge/i.test((b.innerText || "").trim()))
        .map(b => ({
          text: (b.innerText || "").trim(),
          disabled: b.disabled
        })),
      inputs: [...document.querySelectorAll('input[type="file"]')]
        .map(i => ({
          multiple: i.multiple,
          accept: i.accept,
          disabled: i.disabled,
          files: i.files ? [...i.files].map(f => ({
            name: f.name,
            size: f.size,
            type: f.type
          })) : []
        }))
    };
  });

  add("FINAL_STATE", JSON.stringify(finalState));
  add("PAGE_ERRORS_COUNT", String(errors.length));
  add("FAILED_REQUESTS_COUNT", String(failed.length));

  const reportText = [
    "iePDF MERGE PDF - V11.2 RUNTIME REACT RENDER-STATE AUDIT",
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

  fs.writeFileSync(report, reportText, "utf8");

  await browser.close();
})().catch(err => {
  console.error("V11.2_RUNNER_FATAL", err && (err.stack || err.message || err));
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
    Write-Host "V11.2 ERROR:"
    Write-Host $_.Exception.Message
}
finally {

    Restore-All

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
            "V11.2 did not reach browser test.`r`n",
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
    Write-Host "V11.2 COMPLETE"
    Write-Host "Report: $Report"
    Write-Host "Backup: $BackupDir"
    Write-Host "Original source restored automatically."
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"
    Write-Host "============================================================"
}
