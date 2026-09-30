$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$Page = Join-Path $Root "app\merge-pdf\page.tsx"
$Component = Join-Path $Root "components\MergeWorkspace.tsx"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $Root "_ui-backups\V11-RENDER-STATE-$Stamp"
$Report = Join-Path $RegDir "merge-v11-runtime-render-state-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-v11-runtime-render-runner-$Stamp.cjs"

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
        Write-Host "Original source restored from V11 backup."
    }
}

try {
    Write-Host "============================================================"
    Write-Host "iePDF MERGE PDF - V11 RUNTIME REACT RENDER-STATE AUDIT"
    Write-Host "============================================================"
    Write-Host "Started: $(Get-Date)"
    Write-Host "Root: $Root"
    Write-Host ""
    Write-Host "TEMPORARY INSTRUMENTATION ONLY"
    Write-Host "Automatic source restoration enabled"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"

    $PageText = [System.IO.File]::ReadAllText($Page)
    $ComponentText = [System.IO.File]::ReadAllText($Component)

    # Use a unique diagnostic function name so this cannot collide with app code.
    $Diag = @'
function __iepdfV11Log(label, data) {
  try {
    console.log("IEPDF_V11_RENDER|" + label, data);
  } catch (_) {
    console.log("IEPDF_V11_RENDER|" + label);
  }
}
'@

    # Instrument MergeWorkspace immediately after the function opens.
    $ComponentMarker = 'export default function MergeWorkspace({'
    $ComponentPos = $ComponentText.IndexOf($ComponentMarker, [System.StringComparison]::Ordinal)

    if ($ComponentPos -lt 0) {
        throw "V11 marker not found: MergeWorkspace function"
    }

    $OpenBrace = $ComponentText.IndexOf("{", $ComponentPos, [System.StringComparison]::Ordinal)
    if ($OpenBrace -lt 0) {
        throw "V11 could not locate MergeWorkspace opening brace"
    }

    $InsertPos = $OpenBrace + 1

    $ComponentInstrument = @"

  $Diag
  __iepdfV11Log("COMPONENT_ENTER", {
    filesType: typeof files,
    filesIsArray: Array.isArray(files),
    filesLength: Array.isArray(files) ? files.length : null,
    fileSummary: Array.isArray(files) ? files.map((f, i) => ({
      index: i,
      id: f?.id ?? null,
      name: f?.file?.name ?? f?.name ?? null,
      status: f?.status ?? null,
      skipped: f?.skipped ?? null,
      ready: f?.status === "ready",
      passwordRequired: f?.status === "password_required"
    })) : null
  });

  const __iepdfV11OriginalFiles = files;
  const __iepdfV11WrappedFiles = Array.isArray(files)
    ? new Proxy(files, {
        get(target, prop, receiver) {
          if (prop === "map") {
            return function __iepdfV11Map(callback, thisArg) {
              __iepdfV11Log("FILES_MAP_CALLED", {
                length: target.length,
                ids: target.map((f) => f?.id ?? null),
                names: target.map((f) => f?.file?.name ?? f?.name ?? null)
              });
              return target.map(function __iepdfV11MapCallback(value, index, array) {
                __iepdfV11Log("FILES_MAP_ITEM", {
                  index,
                  id: value?.id ?? null,
                  name: value?.file?.name ?? value?.name ?? null,
                  status: value?.status ?? null,
                  skipped: value?.skipped ?? null
                });
                const result = callback.call(thisArg, value, index, array);
                __iepdfV11Log("FILES_MAP_RETURN", {
                  index,
                  returned: result !== undefined,
                  returnType: typeof result
                });
                return result;
              });
            };
          }
          return Reflect.get(target, prop, receiver);
        }
      })
    : files;

  __iepdfV11Log("FILES_PROXY_READY", {
    originalLength: Array.isArray(__iepdfV11OriginalFiles) ? __iepdfV11OriginalFiles.length : null,
    wrappedLength: Array.isArray(__iepdfV11WrappedFiles) ? __iepdfV11WrappedFiles.length : null
  });

"@

    $ComponentText = $ComponentText.Insert($InsertPos, $ComponentInstrument)

    # Replace only the JSX rendering identifier "files.map(" with the instrumented proxy.
    # This is deliberately exact and does not alter filtering/business logic.
    $MapCount = ([regex]::Matches($ComponentText, "files\.map\(")).Count

    if ($MapCount -lt 1) {
        throw "V11 could not find files.map() in MergeWorkspace"
    }

    $ComponentText = $ComponentText.Replace("files.map(", "__iepdfV11WrappedFiles.map(")

    [System.IO.File]::WriteAllText(
        $Component,
        $ComponentText,
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host ""
    Write-Host "V11 temporary instrumentation applied."
    Write-Host "files.map occurrences before instrumentation: $MapCount"

    # ------------------------------------------------------------
    # TypeScript
    # ------------------------------------------------------------

    Write-Host ""
    Write-Host "=== TYPESCRIPT ==="

    Push-Location $Root

    & pnpm exec tsc --noEmit

    $TscExit = $LASTEXITCODE

    if ($TscExit -ne 0) {
        throw "TypeScript failed with exit code $TscExit"
    }

    Write-Host "TypeScript PASS"

    # ------------------------------------------------------------
    # Build
    # ------------------------------------------------------------

    Write-Host ""
    Write-Host "=== PRODUCTION BUILD ==="

    & pnpm build

    $BuildExit = $LASTEXITCODE

    if ($BuildExit -ne 0) {
        throw "Production build failed with exit code $BuildExit"
    }

    Write-Host "Production build PASS"

    # ------------------------------------------------------------
    # Create Node runner inside frontend so Playwright resolves
    # from the project's node_modules.
    # ------------------------------------------------------------

    Write-Host ""
    Write-Host "=== BROWSER RUNTIME TEST ==="

    $RunnerText = @'
const { chromium } = require("playwright");
const fs = require("fs");

const root = "C:\\IEPDF\\frontend";
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
    if (text.includes("IEPDF_V11_RENDER")) {
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

  add("ROUTE", await page.title());
  add("URL", page.url());

  const input = page.locator('input[type="file"]').first();

  add("INPUT_COUNT", String(await page.locator('input[type="file"]').count()));

  await input.setInputFiles(fixture);

  add("SET_INPUT_FILE", fixture);

  const waits = [100, 250, 500, 1000, 2000, 4000, 8000];

  for (const ms of waits) {
    await page.waitForTimeout(ms);

    const state = await page.evaluate(() => {
      const body = document.body?.innerText || "";

      const removeButtons = [...document.querySelectorAll("button")]
        .filter(b => /remove/i.test((b.innerText || "").trim())).length;

      const mergeButtons = [...document.querySelectorAll("button")]
        .filter(b => /Unlock\s*&\s*Merge/i.test((b.innerText || "").trim()));

      const handles = [...document.querySelectorAll("[draggable='true']")].length;

      return {
        bodyHasFiles0: body.includes("Files 0"),
        bodyHasTotal0: body.includes("Total 0"),
        bodyHasReady0: body.includes("Ready 0"),
        bodyHasAddPdfFiles: body.includes("Add PDF Files"),
        bodyHasUnlockMerge: body.includes("Unlock & Merge"),
        removeButtons,
        draggableElements: handles,
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

  const finalState = await page.evaluate(() => ({
    bodyText: (document.body?.innerText || "").slice(0, 12000),
    buttons: [...document.querySelectorAll("button")].map(b => ({
      text: (b.innerText || "").trim(),
      disabled: b.disabled,
      visible: !!(b.offsetWidth || b.offsetHeight || b.getClientRects().length)
    })).filter(x => x.text),
    rows: [...document.querySelectorAll("button")].filter(b => /Remove/i.test(b.innerText || "")).length
  }));

  add("FINAL_STATE", JSON.stringify(finalState));
  add("PAGE_ERRORS_COUNT", String(errors.length));
  add("FAILED_REQUESTS_COUNT", String(failed.length));

  const reportText = [
    "iePDF MERGE PDF - V11 RUNTIME REACT RENDER-STATE AUDIT",
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
  console.error("V11_RUNNER_FATAL", err && (err.stack || err.message || err));
  process.exitCode = 1;
});
'@

    [System.IO.File]::WriteAllText(
        $Runner,
        $RunnerText,
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host "Runner: $Runner"

    & node $Runner $Report

    $RunnerExit = $LASTEXITCODE

    if ($RunnerExit -ne 0) {
        throw "Browser runtime test failed with exit code $RunnerExit"
    }

    Write-Host "Browser runtime test PASS"

}
catch {
    Write-Host ""
    Write-Host "V11 ERROR:"
    Write-Host $_.Exception.Message
}
finally {

    Pop-Location

    Restore-All

    if (Test-Path -LiteralPath $Runner) {
        Remove-Item -LiteralPath $Runner -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "=== POST-RESTORE TYPESCRIPT ==="

    Push-Location $Root

    & pnpm exec tsc --noEmit

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Post-restore TypeScript PASS"
    }
    else {
        Write-Host "Post-restore TypeScript FAIL"
    }

    Pop-Location

    Add-Content -LiteralPath $Report -Value ""
    Add-Content -LiteralPath $Report -Value "SOURCE RESTORED: YES"
    Add-Content -LiteralPath $Report -Value "NO GIT"
    Add-Content -LiteralPath $Report -Value "NO DEPLOYMENT"
    Add-Content -LiteralPath $Report -Value "NO CACHE DELETION"

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "V11 COMPLETE"
    Write-Host "Report: $Report"
    Write-Host "Backup: $BackupDir"
    Write-Host "Original source restored automatically."
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "============================================================"
}
