# iePDF Merge - Direct Source/Runtime Correlation Diagnostic
# V5.0
# Purpose: temporarily instrument the Merge page, run a real browser test,
# capture the exact file-input -> analyzer -> state path, then ALWAYS restore source.
# No deployment. No Git operations.

$ErrorActionPreference = "Stop"

$Root = "C:\IEPDF\frontend"
$Page = Join-Path $Root "app\merge-pdf\page.tsx"
$ReportDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $Root "_ui-backups\merge-runtime-diagnostic-$Stamp"
$BackupPage = Join-Path $BackupDir "page.tsx"
$Report = Join-Path $ReportDir "merge-runtime-direct-correlation-$Stamp.txt"
$Runner = Join-Path $env:TEMP "iePDF-merge-runtime-runner-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

if (-not (Test-Path $Page)) { throw "Merge page not found: $Page" }

Copy-Item -LiteralPath $Page -Destination $BackupPage -Force
Write-Host "Backup: $BackupPage"

$original = [System.IO.File]::ReadAllText($Page, [System.Text.Encoding]::UTF8)

function Escape-JsString([string]$s) {
    return $s.Replace('\','\\').Replace('"','\"').Replace("`r","\r").Replace("`n","\n")
}

$marker = "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V5"

if ($original.Contains($marker)) {
    throw "Diagnostic marker already exists in source. Refusing to stack instrumentation."
}

$patched = $original

# 1) Instrument handleFileChange entry.
$pattern1 = '(?s)(const\s+handleFileChange\s*=\s*async\s*\([^)]*\)\s*=>\s*\{)'
$replace1 = '$1' + "`r`n" +
'      console.log("' + $marker + ' HANDLE_FILE_CHANGE_ENTER", { fileCount: files?.length ?? -1, names: files ? Array.from(files).map((f: File) => f.name) : [] });'
$patched = [regex]::Replace($patched, $pattern1, $replace1, 1)

# 2) Instrument processSelectedFiles entry.
$pattern2 = '(?s)(const\s+processSelectedFiles\s*=\s*async\s*\([^)]*\)\s*=>\s*\{)'
$replace2 = '$1' + "`r`n" +
'      console.log("' + $marker + ' PROCESS_SELECTED_ENTER", { fileCount: files?.length ?? -1, names: files ? Array.from(files).map((f: File) => f.name) : [] });'
$patched = [regex]::Replace($patched, $pattern2, $replace2, 1)

# 3) Instrument analyzer call, preserving the original statement.
$pattern3 = '(const\s+analysis\s*=\s*await\s+analyzer\.analyzeMany\(files\);)'
$replace3 = 'console.log("' + $marker + ' ANALYZER_BEFORE", { fileCount: files.length, names: Array.from(files).map((f: File) => f.name) });' + "`r`n" +
'$1' + "`r`n" +
'      console.log("' + $marker + ' ANALYZER_AFTER", { count: analysis?.length ?? -1, results: analysis });'
$patched = [regex]::Replace($patched, $pattern3, $replace3, 1)

# 4) Instrument workspace mapping immediately after it is created.
$pattern4 = '(const\s+workspace\s*=\s*analysis\.map\()'
$replace4 = 'console.log("' + $marker + ' WORKSPACE_MAP_BEFORE", { analysisCount: analysis?.length ?? -1 });' + "`r`n" + '$1'
$patched = [regex]::Replace($patched, $pattern4, $replace4, 1)

# 5) Instrument setWorkspaceFiles functional updater.
$pattern5 = '(setWorkspaceFiles\s*\(\s*\(\s*previous\s*\)\s*=>\s*\[\.\.\.previous,\s*\.\.\.workspace\]\s*\))'
$replace5 = 'console.log("' + $marker + ' SET_WORKSPACE_BEFORE", { workspaceCount: workspace?.length ?? -1, workspace: workspace });' + "`r`n" + '$1'
$patched = [regex]::Replace($patched, $pattern5, $replace5, 1)

# 6) Add a diagnostic effect before the first obvious JSX return, using existing React imports.
$effect = @'
  useEffect(() => {
    console.log("IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V5 STATE_EFFECT", {
      workspaceCount: Array.isArray(workspaceFiles) ? workspaceFiles.length : -1,
      showWorkspace,
    });
  }, [workspaceFiles, showWorkspace]);

'@
$returnPattern = '(?m)^(\s*)(return\s*\()'
if (-not $patched.Contains("IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V5 STATE_EFFECT")) {
    $patched = [regex]::Replace($patched, $returnPattern, '$1' + $effect + '$1$2', 1)
}

$checks = @(
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V5 HANDLE_FILE_CHANGE_ENTER",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V5 PROCESS_SELECTED_ENTER",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V5 ANALYZER_BEFORE",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V5 ANALYZER_AFTER",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V5 SET_WORKSPACE_BEFORE",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V5 STATE_EFFECT"
)
foreach ($c in $checks) {
    if (-not $patched.Contains($c)) {
        Write-Host "Instrumentation marker missing: $c"
        Copy-Item -LiteralPath $BackupPage -Destination $Page -Force
        throw "Safe abort: expected instrumentation point was not found. Original source restored."
    }
}

[System.IO.File]::WriteAllText($Page, $patched, [System.Text.UTF8Encoding]::new($false))
Write-Host "Temporary instrumentation applied."

$tscLog = Join-Path $env:TEMP "iepdf-merge-v5-tsc-$Stamp.txt"
$buildLog = Join-Path $env:TEMP "iepdf-merge-v5-build-$Stamp.txt"

$reportHeader = @"
iePDF MERGE DIRECT SOURCE/RUNTIME CORRELATION DIAGNOSTIC V5
Timestamp: $(Get-Date -Format o)
Page: $Page
Backup: $BackupPage

IMPORTANT:
- Instrumentation is temporary.
- Original source will be restored in the finally block.
- No Git operations.
- No live deployment.

SOURCE MARKERS:
$($checks -join "`r`n")
"@

try {
    Write-Host ""
    Write-Host "===== TypeScript validation ====="
    & pnpm exec tsc --noEmit 2>&1 | Tee-Object -FilePath $tscLog
    if ($LASTEXITCODE -ne 0) { throw "TypeScript validation failed." }

    Write-Host ""
    Write-Host "===== Production build validation ====="
    & pnpm build 2>&1 | Tee-Object -FilePath $buildLog
    if ($LASTEXITCODE -ne 0) { throw "Production build failed." }

    $fixture = Get-ChildItem -Path (Join-Path $Root "_regression\merge-pdf") -Filter "*.pdf" -File |
        Where-Object { $_.Length -le 15MB } |
        Select-Object -First 1

    if (-not $fixture) {
        throw "No <=15 MiB PDF fixture found under _regression\merge-pdf."
    }

    # Node runner uses installed Chrome through Playwright.
    $runnerContent = @'
const fs = require("fs");
const path = require("path");

(async () => {
  const out = [];
  const log = (...a) => { const s = a.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" "); out.push(s); console.log(s); };
  const stamp = process.env.IEPDF_STAMP;
  const report = process.env.IEPDF_REPORT;
  const fixture = process.env.IEPDF_FIXTURE;
  const root = process.env.IEPDF_ROOT;

  let chromium;
  try {
    ({ chromium } = require("@playwright/test"));
  } catch (e) {
    try { ({ chromium } = require("playwright")); }
    catch (e2) { throw new Error("Playwright package could not be loaded: " + e2.message); }
  }

  const chromeCandidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ];
  const executablePath = chromeCandidates.find(fs.existsSync);
  if (!executablePath) throw new Error("Installed Google Chrome executable not found.");

  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage();

  const consoleLines = [];
  const pageErrors = [];
  const failedRequests = [];
  const relevantResponses = [];

  page.on("console", msg => {
    const text = msg.text();
    consoleLines.push(`[console:${msg.type()}] ${text}`);
    if (text.includes("IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V5")) {
      log("DIAGNOSTIC_CONSOLE " + text);
    }
  });

  page.on("pageerror", err => {
    pageErrors.push(String(err && err.stack || err));
    log("PAGE_ERROR " + String(err && err.stack || err));
  });

  page.on("requestfailed", req => {
    failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || "unknown"}`);
  });

  page.on("response", res => {
    const u = res.url();
    if (u.includes("/_next/") || u.includes("/api/") || u.includes("/merge")) {
      relevantResponses.push(`${res.status()} ${res.request().method()} ${u}`);
    }
  });

  await page.goto("http://localhost:3000/merge-pdf", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  const input = page.locator('input[type="file"]').first();
  if (await input.count() !== 1) throw new Error("Expected exactly one file input.");

  await page.evaluate(() => {
    window.__iepdfNativeChangeCount = 0;
    window.__iepdfNativeChangePayloads = [];
    const el = document.querySelector('input[type="file"]');
    if (el) {
      el.addEventListener("change", () => {
        window.__iepdfNativeChangeCount++;
        window.__iepdfNativeChangePayloads.push({
          files: Array.from(el.files || []).map(f => ({ name: f.name, size: f.size, type: f.type }))
        });
      }, true);
    }
  });

  log("SETTING_FILE " + fixture);
  await input.setInputFiles(fixture);

  for (const ms of [100, 250, 500, 1000, 2000, 4000, 8000]) {
    await page.waitForTimeout(ms);
    const state = await page.evaluate(() => {
      const text = document.body.innerText || "";
      const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
      const nativeCount = window.__iepdfNativeChangeCount || 0;
      const rows = Array.from(document.querySelectorAll("button")).filter(b => {
        const t = (b.textContent || "").trim();
        return t === "Remove" || t.includes("Unlock & Merge");
      }).length;
      const handles = document.querySelectorAll('[draggable="true"]').length;
      return {
        nativeCount,
        nativePayloads: window.__iepdfNativeChangePayloads || [],
        inputFiles: inputs.map(i => Array.from(i.files || []).map(f => ({name:f.name,size:f.size,type:f.type}))),
        hasFiles0: /Files\\s*0/.test(text),
        hasTotal0: /Total\\s*0/.test(text),
        hasReady0: /Ready\\s*0/.test(text),
        mergeDisabled: Array.from(document.querySelectorAll("button")).some(b => (b.textContent || "").includes("Unlock & Merge") && b.disabled),
        removeButtons: Array.from(document.querySelectorAll("button")).filter(b => (b.textContent || "").trim() === "Remove").length,
        draggableCount: handles,
        bodyExcerpt: text.slice(0, 5000)
      };
    });
    log(`STATE_AFTER_${ms}MS ` + JSON.stringify(state));
  }

  log("=== DIAGNOSTIC CONSOLE LINES ===");
  for (const line of consoleLines) if (line.includes("IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V5")) log(line);

  log("=== PAGE ERRORS ===");
  for (const x of pageErrors) log(x);

  log("=== FAILED REQUESTS ===");
  for (const x of failedRequests) log(x);

  log("=== RELEVANT RESPONSES ===");
  for (const x of relevantResponses) log(x);

  const final = await page.evaluate(() => ({
    nativeCount: window.__iepdfNativeChangeCount || 0,
    nativePayloads: window.__iepdfNativeChangePayloads || [],
    bodyText: (document.body.innerText || "").slice(0, 10000),
    removeButtons: Array.from(document.querySelectorAll("button")).filter(b => (b.textContent || "").trim() === "Remove").length,
    draggableCount: document.querySelectorAll('[draggable="true"]').length,
    mergeDisabled: Array.from(document.querySelectorAll("button")).some(b => (b.textContent || "").includes("Unlock & Merge") && b.disabled)
  }));

  log("FINAL_STATE " + JSON.stringify(final));
  await browser.close();

  fs.writeFileSync(report, out.join("\n") + "\n", "utf8");
  console.log("REPORT_WRITTEN " + report);
})().catch(err => {
  console.error(err && err.stack || err);
  process.exitCode = 1;
});
'@

    [System.IO.File]::WriteAllText($Runner, $runnerContent, [System.Text.UTF8Encoding]::new($false))

    $env:IEPDF_STAMP = $Stamp
    $env:IEPDF_REPORT = $Report
    $env:IEPDF_FIXTURE = $fixture.FullName
    $env:IEPDF_ROOT = $Root

    Write-Host ""
    Write-Host "===== Browser direct correlation test ====="
    node $Runner
    $nodeExit = $LASTEXITCODE

    $body = ""
    if (Test-Path $Report) {
        $body = [System.IO.File]::ReadAllText($Report, [System.Text.Encoding]::UTF8)
    }

    $sourceChecks = @()
    foreach ($c in $checks) {
        $sourceChecks += "$c = " + $patched.Contains($c)
    }

    $interpretation = if ($body -match "ANALYZER_AFTER") {
        "ANALYZER_RETURNED: execution reached analyzer result. Inspect ANALYZER_AFTER and SET_WORKSPACE_BEFORE."
    } elseif ($body -match "ANALYZER_BEFORE") {
        "ANALYZER_STARTED_BUT_DID_NOT_RETURN: investigate BrowserPdfAnalyzer.analyzeMany/analyze path."
    } elseif ($body -match "PROCESS_SELECTED_ENTER") {
        "PROCESS_STARTED_BUT_ANALYZER_NOT_REACHED: investigate processSelectedFiles before analyzer call."
    } elseif ($body -match "HANDLE_FILE_CHANGE_ENTER") {
        "CHANGE_HANDLER_REACHED_BUT_PROCESS_NOT_STARTED: investigate handleFileChange flow."
    } else {
        "NO_APP_DIAGNOSTIC_MARKERS_CAPTURED: inspect browser/client bundle or handler wiring."
    }

    Add-Content -LiteralPath $Report -Value @"

===== POWERSHELL SUMMARY =====
Node runner exit code: $nodeExit
Fixture: $($fixture.FullName)
Interpretation: $interpretation

SOURCE CHECKS:
$($sourceChecks -join "`r`n")

TSC LOG: $tscLog
BUILD LOG: $buildLog
"@

    if ($nodeExit -ne 0) {
        Write-Warning "Browser runner exited with code $nodeExit. Diagnostic report may still contain useful evidence."
    }
}
finally {
    # ALWAYS restore original source.
    Copy-Item -LiteralPath $BackupPage -Destination $Page -Force
    Write-Host ""
    Write-Host "Original Merge page restored from backup."
    Remove-Item Env:IEPDF_STAMP -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_REPORT -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_FIXTURE -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_ROOT -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $Runner -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "===== FINAL ====="
Write-Host "Report: $Report"
Write-Host "Backup: $BackupPage"
Write-Host "NO PERMANENT SOURCE CHANGES."
Write-Host "NO LIVE DEPLOYMENT."
